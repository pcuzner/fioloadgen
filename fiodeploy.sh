#!/usr/bin/bash

DEFAULT_NAMESPACE='fio'
DEFAULT_WORKERS=2
WORKER_YAML='fio.yaml'
WORKERS=0
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
    console ${INFO} "Deployment will use worker pods based on yaml/${WORKER_YAML}"
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

    console ${INFO} "Waiting for workers to enter a running state"
    t=1
    while [ $t -lt $ITERATION_LIMIT ]; do # status=$(oc -n fio get pod -o=jsonpath='{..status.phase}')
        status=$(oc -n ${NAMESPACE} get pod -o=jsonpath='{..status.phase}')    
        if [[ "$status" == *"Running" ]]; then
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
       ip_info=$(oc -n ${NAMESPACE} get pod fioworker${n} -o=jsonpath='{.status.podIP} {.status.hostIP}')
       podIP=$(echo ${ip_info} | cut -f1 -d ' ')
       hostIP=$(echo ${ip_info} | cut -f2 -d ' ')
       if [ ${lookup[${hostIP}]+_}  ]; then
           # add to the entry 
           ((lookup[${hostIP}]++)) # increment the map
       else
           # add to the map
           lookup[${hostIP}]=1
       fi
       echo -e "$hostIP" >> ./data/host-ip.list
       echo -e "$podIP" >> ./data/worker-ip.list
       console ${INFO} "${TICK}${NC} fioworker${n}"
    done

    # transfer the client ip addresses and fio jobs to the mgr
    console ${INFO} "Transfering worker IP addresses (pod and host), plus fio job specs to the fiomgr pod"
    oc -n $NAMESPACE  rsync data/ fiomgr:/
    if [ $? != 0 ]; then
        console ${ERROR} "rsync failed"
        exit
    fi

    # seed the test files
    console ${INFO} "Seeding the test files on the workers"
    oc -n $NAMESPACE exec -it fiomgr -- fio --client=worker-ip.list fio/jobs/randrw7030.job --output=seed.output
    if [ $? != 0 ]; then 
        console ${ERROR} "failed to seed the test files on the workers"
        exit
    fi

    echo -e "\n"
    console ${INFO} "${TICK}${NC} ${WORKERS} worker pods running on ${#lookup[@]} hosts"
    console ${INFO} "${TICK}${NC} test files seeded, workers ready"
    console ${INFO} "${TICK}${NC} ${WORKERS} worker pods ready"
    console ${INFO} "${TICK}${NC} use rsh to login to the fiomgr pod to run a workload\n"

    release_lock
}

destroy() {

    console ${WARNING} "Are you sure you want to delete the '${NAMESPACE}' namespace and all it's pods?"
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
    echo -e "\t-w <file> ... yaml filename to use for the worker pod (must be defined before -s!)"
    echo -e "\t-s        ... setup an fio test environment"
    echo -e "\t-d <ns>   ... destroy the given namespace"
    echo -e "\t-r        ... reset - remove the lockfile"

    echo "e.g."
    echo -e "> ./${SCRIPT_NAME} -s\n"
}

main() {

    args=1
    while getopts ":w:sd:hr" option; do
        case "${option}" in
            h)
                usage
                exit
                ;;
            w)
                WORKER_YAML=${OPTARG}
                if [ ! -f "yaml/${WORKER_YAML}" ]; then
                    console ${ERROR} "-w provided a file name that does not exist in the yaml directory"
                    exit 1
                fi
                ;;
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
