#!/usr/bin/bash

DEFAULT_NAMESPACE='fio'
DEFAULT_WORKERS=2
DEFAULT_SC='ocs-storagecluster-ceph-rbd'
DEFAULT_SEED_METHOD='parallel'

SEED_METHOD=''
WORKER_YAML='fio.yaml'
WORKERS=0
STORAGECLASS=''
NAMESPACE=""
WORKER_LIMIT=20
SCRIPT_NAME=$(basename $0)
ITERATION_LIMIT=12 # 60 sec pod running timeout
ITERATION_DELAY=5
LOCKFILE='./fiodeploy.lock'

NC='\033[0m'     # No Color
INFO='\033[0;32m' # green
ERROR='\033[0;31m' # red
WARNING='\033[1;33m' # yellow
TICK='\xE2\x9C\x94' # tickmark

console () {
    echo -e "${1}${2}${NC}"
}

check_ready() {
    console ${INFO} "Checking access to kubernetes"
    state=$(oc status)
    if [ $? == 1 ]; then
       console ${ERROR} "oc status check failed...are you logged in?"
       exit
    fi
}

acquire_lock() {
    if [ -f "${LOCKFILE}" ]; then
        console ${ERROR} "'lock' found. Is the script already running?"
        exit
    else
        touch ${LOCKFILE}
    fi
}
release_lock() {
    rm -f ${LOCKFILE} 2>/dev/null
}

get_environment() {

    read -p $(echo -e ${INFO})"What namespace should be created for the workload test [${DEFAULT_NAMESPACE}]? "$(echo -e ${NC}) NAMESPACE
    if [ -z "$NAMESPACE" ]; then 
        NAMESPACE=$DEFAULT_NAMESPACE
        console ${WARNING} "- defaulting to '${NAMESPACE}' namespace"
    fi

    read -p $(echo -e ${INFO})"How many fio workers [${DEFAULT_WORKERS}]? "$(echo -e ${NC}) WORKERS
    if [ -z "$WORKERS" ]; then 
        WORKERS=$DEFAULT_WORKERS
	    console ${WARNING} "- defaulting to ${DEFAULT_WORKERS} workers" 
    else
        if [ $WORKERS -eq $WORKERS 2>/dev/null ]; then
            # is numeric
            if [[ $WORKERS -lt 1 || $WORKERS -gt $WORKER_LIMIT ]]; then
                console ${ERROR} "Worker count must be within the range 1-${WORKER_LIMIT}"
                exit
            fi
        else
            console ${ERROR} "Invalid input for workers. Must be an integer"
            exit
        fi
    fi

    read -p $(echo -e ${INFO})"What storageclass should the fio worker pods use [$DEFAULT_SC]. (Enter 'none' to not use PVCs)? "$(echo -e ${NC}) STORAGECLASS
    if [ -z $STORAGECLASS ]; then
        STORAGECLASS=$DEFAULT_SC
        console ${WARNING} "- storageclass for PVCs defaulting to ${DEFAULT_SC}"
    else
        # convert storageclass to lowercase for the compare
        if [ "${STORAGECLASS,,}" == 'none' ]; then
            STORAGECLASS=''
        fi
    fi

    if [ -z "$STORAGECLASS" ]; then
        WORKER_YAML='fio_no_pvc.yaml'
    else
        sed "s/{STORAGECLASS}/${STORAGECLASS}/g" ./yaml/fio.yaml > ./yaml/fioworker.yaml
        WORKER_YAML='fioworker.yaml'
    fi

    while [ -z "$SEED_METHOD" ]; do
        read -p $(echo -e ${INFO})"Seed I/O test files in parallel or serial mode [$DEFAULT_SEED_METHOD] ? "$(echo -e ${NC}) SEED_METHOD
        if [ -z "$SEED_METHOD" ]; then
            SEED_METHOD=$DEFAULT_SEED_METHOD
        fi

        case "${SEED_METHOD,,}" in
            s|serial)
                SEED_METHOD='serial'
                ;;
            p|parallel)
                SEED_METHOD='parallel'
                ;;
            *)
                echo "Unknown response, please try again - parallel or serial (you can shorten this to p or s)"
                SEED_METHOD=''
        esac
    done

}

check_fio_complete() {
    oc -n $NAMESPACE exec fiomgr -- pidof fio
    if [ $? -eq 0 ]; then
        console ${ERROR} "fio tasks still running on the fiomgr pod. These will block/delay workload testing"
        console ${ERROR} "Please login to fiomgr to investigate and check for cluster for errors that could prevent I/O"
    fi
}

setup() {
    acquire_lock

    check_ready

    console ${INFO} "Setting up the environment"

    # create namespace
    console ${INFO} "Creating the namespace (${NAMESPACE})"
    ns=$(oc create namespace ${NAMESPACE})
    if [ $? != 0 ]; then
       console ${ERROR} "Unable to create namespace...cannot continue"
       exit
    fi

    # deploy the pods
    console ${INFO} "Deploying the mgr"
    oc -n $NAMESPACE create -f yaml/fiomgr.yaml
    if [ $? != 0 ]; then 
        console ${ERROR} "Failed to create the mgr pod"
        exit
    fi

    console ${INFO} "Deploying the workers"

    for n in $(seq ${WORKERS}); do
       cat yaml/${WORKER_YAML} | sed "s/fioclient/fioworker${n}/g" | oc create -n ${NAMESPACE} -f -;
    done 

    console ${INFO} "Waiting for pods to reach a running state"
    t=1
    while [ $t -lt $ITERATION_LIMIT ]; do # get pod -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}'
        status=$(oc -n ${NAMESPACE} get pod -o=jsonpath='{..status.phase}')
        if [[ "$status" != *"Running" ]]; then
            console ${WARNING} "\t - waiting for pods to reach 'Running' state (${t}/${ITERATION_LIMIT})"
            sleep $ITERATION_DELAY
            t=$((t+1))
        else
            break
        fi
    done
    if [ $t -eq $ITERATION_LIMIT ]; then
        console ${ERROR} "Waited too long for pods to reach ready"
        exit
    fi

    console ${INFO} "Removing residual IP information from data directory"
    rm -fr ./data/*-ip.list

    console ${INFO} "Fetching the worker IP information (pod and host)"
    declare -A lookup
    for n in $(seq ${WORKERS}); do
       podIP_set="NO"
       t=0
       while [ $t -ne $ITERATION_LIMIT ]; do
           ip_info=$(oc -n ${NAMESPACE} get pod fioworker${n} -o=jsonpath='{.status.podIP} {.status.hostIP}')
           podIP=$(echo ${ip_info} | cut -f1 -d ' ')
           hostIP=$(echo ${ip_info} | cut -f2 -d ' ')
           if [ "$podIP" != "$hostIP" ]; then
               break
           else
               t=$((t+1))
               console ${WARNING} "\t - waiting for fioworker${n} to have a valid IP (${t}/${ITERATION_LIMIT})"
               sleep $ITERATION_DELAY
           fi
       done

       if [ $t -eq $ITERATION_LIMIT ]; then
           console ${ERROR} "Waited too long for fioworker${n} to get a valid IP"
           exit
       fi
       
       if [ ${lookup[${hostIP}]+_}  ]; then
           # add to the entry 
           ((lookup[${hostIP}]++)) # increment the map
       else
           # add to the map
           lookup[${hostIP}]=1
       fi
       echo -e "$hostIP" >> ./data/host-ip.list
       echo -e "$podIP" >> ./data/worker-ip.list
       console ${INFO} "${TICK}${NC} fioworker${n} on ${hostIP} with POD IP ${podIP}"
    done

    # transfer the client ip addresses and fio jobs to the mgr
    console ${INFO} "Transfering worker IP addresses (pod and host), plus fio job specs to the fiomgr pod"
    oc -n $NAMESPACE  rsync data/ fiomgr:/
    if [ $? != 0 ]; then
        console ${ERROR} "rsync failed"
        exit
    fi

    # seed the test files
    console ${INFO} "Seeding the test files on the workers (mode=$SEED_METHOD)"
    if [ "$SEED_METHOD" == 'parallel' ]; then 
        console ${INFO} "- seeding $WORKERS pods in parallel"
        oc -n $NAMESPACE exec fiomgr -- fio --client=worker-ip.list fio/jobs/randr.job --output=seed.output
        if [ $? != 0 ]; then 
            console ${ERROR} "  failed to seed the test files on the workers"
            console ${ERROR} "Deployment aborted"
            exit
        fi
    else
        for pod in $(cat ./data/worker-ip.list); do 
            console ${INFO} "- seeding $pod"
            oc -n $NAMESPACE exec fiomgr -- fio --client=$pod fio/jobs/randr.job --output=seed.output
            if [ $? != 0 ]; then
                console ${ERROR} "  failed to seed the test file on $pod"
                console ${ERROR} "Deployment aborted"
                exit
            fi
        done
    fi

    check_fio_complete

    echo -e "\n"
    if [ ${#lookup[@]} -eq 1 ]; then
        console ${WARNING} "${TICK} All workers are on a single host"
    else
        console ${INFO} "${TICK}${NC} ${WORKERS} worker pods running on ${#lookup[@]} hosts"
    fi
    console ${INFO} "${TICK}${NC} test files seeded, workers ready"
    console ${INFO} "${TICK}${NC} ${WORKERS} worker pods ready"
    console ${INFO} "${TICK}${NC} use rsh to login to the fiomgr pod to run a workload or use the fioservice and fiocli commands\n"

    release_lock
}

destroy() {

    console ${WARNING} "Are you sure you want to delete the '${NAMESPACE}' namespace and all it's pods/PVCs?"
    select confirm in 'Yes' 'No' ; do
        case $confirm in
            Yes)
                break		
                ;;
            No)
		exit
		;;
        esac
    done
 
    acquire_lock

    check_ready
    console ${INFO} "Destroying fio namespace - '${NAMESPACE}'"
    oc delete namespace ${NAMESPACE}
    release_lock
}


usage() {
    echo -e "Usage: ${SCRIPT_NAME} [-hwsdr]"
    echo -e "\t-h        ... display usage information"
    # echo -e "\t-w <file> ... yaml filename to use for the worker pod (must be defined before -s!)"
    echo -e "\t-s        ... setup an fio test environment"
    echo -e "\t-d <ns>   ... destroy the given namespace"
    echo -e "\t-r        ... reset - remove the lockfile"

    echo "e.g."
    echo -e "> ./${SCRIPT_NAME} -s\n"
}

main() {

    args=1
    while getopts "hsd:r" option; do
        case "${option}" in
            h)
                usage
                exit
                ;;
            # w)
            #     WORKER_YAML=${OPTARG}
            #     if [ ! -f "yaml/${WORKER_YAML}" ]; then
            #         console ${ERROR} "-w provided a file name that does not exist in the yaml directory"
            #         exit 1
            #     fi
            #     ;;
            s)
                get_environment
                setup
                exit
                ;;
            d)
                NAMESPACE=${OPTARG}
                destroy
                exit
                ;;

            r) 
                release_lock
                exit
                ;;
            \?)
                echo "Unsupported option."
                usage
                exit
                ;;
        esac
        args=0
    done
    shift "$((OPTIND-1))"
    if [[ $args ]]; then 
        usage
        exit
    fi
}

main $@ 
