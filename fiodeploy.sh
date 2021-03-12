#!/usr/bin/bash

# TODO
# 1. make the command interaction optional - with oc or kubectl
# 3. switch to replicaset management
# 4. remove the seeding of the fio files

DEFAULT_NAMESPACE='fio'
DEFAULT_WORKERS=2
DEFAULT_SC='ocs-storagecluster-ceph-rbd'
DEFAULT_SEED_METHOD='parallel'
DEFAULT_FIOSERVICE_MODE='local'
CLUSTER_CMD=''
SEED_METHOD=''
FIOSERVICE_MODE=''
WORKER_YAML='fio.yaml'
WORKERS=0
STORAGECLASS=''
NAMESPACE=""
WORKER_LIMIT=20
SCRIPT_NAME=$(basename $0)
ITERATION_LIMIT=60 # 5 min pod running timeout
ITERATION_DELAY=5
LOCKFILE='./fiodeploy.lock'

NC='\033[0m'     # No Color
INFO='\033[0;32m' # green
ERROR='\033[0;31m' # red
WARNING='\033[1;33m' # yellow
TICK='\xE2\x9C\x94' # tickmark

exists () {
    which $1 > /dev/null 2>&1
}

console () {
    echo -e "${1}${2}${NC}"
}

check_prereq () {
    console ${INFO} "Checking kubernetes CLI is available"
    if exists "oc"; then
        CLUSTER_CMD='oc'
        console ${INFO} "${TICK}${NC} oc command available"
    else
        if exists "kubectl"; then
            CLUSTER_CMD='kubectl'
            console ${INFO} "${TICK}${NC} kubectl command available"
        else
            console ${ERROR} "oc or kubectl commands not found. Unable to continue"
            exit
        fi
    fi
}

check_ready() {
    console ${INFO} "Checking access to kubernetes"
    state=$($CLUSTER_CMD status)
    if [ $? == 0 ]; then
        console ${INFO} "${TICK}${NC} access OK"
    else
        console ${ERROR} "$CLUSTER_CMD status check failed...are you logged in?"
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
    console ${INFO} "\nFIOLoadgen will use a dedicated namespace for the tests"
    read -p $(echo -e ${INFO})"What namespace should be used [${DEFAULT_NAMESPACE}]? "$(echo -e ${NC}) NAMESPACE
    if [ -z "$NAMESPACE" ]; then
        NAMESPACE=$DEFAULT_NAMESPACE

    fi
    console ${INFO} "- checking existing namespaces"
    check_ns=$($CLUSTER_CMD get ns $NAMESPACE> /dev/null 2>&1)
    if [ $? = 0 ]; then
        console ${ERROR} "- namespace $NAMESPACE already exists. Unable to continue"
        exit
    else
        console ${INFO} "${TICK}${NC} namespace '$NAMESPACE' will be used"
    fi

    read -p $(echo -e ${INFO})"How many fio workers [${DEFAULT_WORKERS}]? "$(echo -e ${NC}) WORKERS
    if [ -z "$WORKERS" ]; then
        WORKERS=$DEFAULT_WORKERS
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

    console ${INFO} "${TICK}${NC} ${WORKERS} worker pods will be deployed"
    console ${INFO} "Checking available storageclasses"
    sc_names=$(oc get sc -o jsonpath='{.items[*].metadata.name}')
    for sc in ${sc_names}; do
        console ${INFO} "- ${sc}"
    done
    read -p $(echo -e ${INFO})"What storageclass should the fio worker pods use [$DEFAULT_SC]? "$(echo -e ${NC}) STORAGECLASS
    if [ -z $STORAGECLASS ]; then
        STORAGECLASS=$DEFAULT_SC
    fi

    if [[ "${sc_names}" != *"${STORAGECLASS}"* ]]; then
        console ${ERROR} "Storageclass ${STORAGECLASS} does not exist."
        exit
    fi

    console ${INFO} "${TICK}${NC} storageclass '${STORAGECLASS}' will be used"
    # if [ -z "$STORAGECLASS" ]; then
    #     WORKER_YAML='fio_no_pvc.yaml'
    # else
    #     sed "s/{STORAGECLASS}/${STORAGECLASS}/g" ./yaml/fio.yaml > ./yaml/fioworker.yaml
    #     WORKER_YAML='fioworker.yaml'
    # fi

    console ${INFO} "\nTo manage the tests, FIOLoadgen can use either a local daemon on your machine (local), or"
    console ${INFO} "deploy the management daemon to the target environment (remote)"
    while [ -z "$FIOSERVICE_MODE" ]; do
        read -p $(echo -e ${INFO})"How do you want to manage the tests (local/remote) [local]? "$(echo -e ${NC}) FIOSERVICE_MODE
        if [ -z "$FIOSERVICE_MODE" ]; then
            FIOSERVICE_MODE=$DEFAULT_FIOSERVICE_MODE
        fi

        case "${FIOSERVICE_MODE,,}" in
            local)
                FIOSERVICE_MODE='local'
                ;;
            remote)
                FIOSERVICE_MODE='remote'
                ;;
            *)
                echo "Unknown response, please try again - local or remote?"
                FIOSERVICE_MODE=''
        esac
    done

    # while [ -z "$SEED_METHOD" ]; do
    #     read -p $(echo -e ${INFO})"Seed I/O test files in parallel or serial mode [$DEFAULT_SEED_METHOD] ? "$(echo -e ${NC}) SEED_METHOD
    #     if [ -z "$SEED_METHOD" ]; then
    #         SEED_METHOD=$DEFAULT_SEED_METHOD
    #     fi

    #     case "${SEED_METHOD,,}" in
    #         s|serial)
    #             SEED_METHOD='serial'
    #             ;;
    #         p|parallel)
    #             SEED_METHOD='parallel'
    #             ;;
    #         *)
    #             echo "Unknown response, please try again - parallel or serial (you can shorten this to p or s)"
    #             SEED_METHOD=''
    #     esac
    # done

}

# check_fio_complete() {
#     $CLUSTER_CMD -n $NAMESPACE exec fiomgr -- pidof fio
#     if [ $? -eq 0 ]; then
#         console ${ERROR} "fio tasks still running on the fiomgr pod. These will block/delay workload testing"
#         console ${ERROR} "Please login to fiomgr to investigate and check for cluster for errors that could prevent I/O"
#     fi
# }

setup() {
    acquire_lock

    console ${INFO} "\nSetting up the environment\n"

    # create namespace
    console ${INFO} "Creating namespace (${NAMESPACE})"
    ns=$($CLUSTER_CMD create namespace ${NAMESPACE})
    if [ $? != 0 ]; then
        console ${ERROR} "Unable to create namespace...cannot continue"
        exit
    else
        console ${INFO} "${TICK}${NC} namespace created OK"
    fi

    # deploy the pods

    console ${INFO} "Deploying the FIO workers statefulset"
    cat yaml/fioworker_statefulset_template.yaml | \
        sed "s/!WORKERS!/${WORKERS}/" | \
        sed "s/!STORAGECLASS!/${STORAGECLASS}/" | \
        $CLUSTER_CMD -n ${NAMESPACE} create -f -
    # $CLUSTER_CMD -n ${NAMESPACE} create -f yaml/fioworker_statefulset.yaml
    echo $?
    # TODO - capture the output o f the deploy and use tick or error based on the rc

    # for n in $(seq ${WORKERS}); do
    #    cat yaml/${WORKER_YAML} | sed "s/fioclient/fioworker${n}/g" | oc create -n ${NAMESPACE} -f -;
    # done

    console ${INFO} "Waiting for pods to reach a running state"
    t=1
    while [ $t -lt $ITERATION_LIMIT ]; do # get pod -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}'
        status=$($CLUSTER_CMD -n ${NAMESPACE} get statefulset fioworker -o jsonpath='{..status.readyReplicas}')
        if [ "$status" != "$WORKERS" ]; then
            console ${INFO} "\t - waiting for pods to reach 'Running' state (${t}/${ITERATION_LIMIT})"
            sleep $ITERATION_DELAY
            t=$((t+1))
        else
            break
        fi
    done
    if [ $t -ne $ITERATION_LIMIT ]; then
        console ${INFO} "${TICK}${NC} Pods ready"
    else
        console ${ERROR} "Timed out Waiting too long for pods (x${WORKERS}) to reach ready, unable to continue."
        console ${ERROR} "Statefulset : fioloadgen"
        console ${ERROR} "Storageclass: ${STORAGECLASS}"
        console ${ERROR} "Pods Ready  : ${STATUS}"
        exit
    fi

    declare -A lookup
    if [ "$FIOSERVICE_MODE" = "local" ]; then
        console ${INFO} "Deploying the mgr"
        $CLUSTER_CMD -n $NAMESPACE create -f yaml/fiomgr.yaml
        if [ $? == 0 ]; then
            console ${INFO} "${TICK}${NC} FIO management daemon deployed"
        else
            console ${ERROR} "Failed to create the mgr pod"
            exit
        fi

        console ${INFO} "Removing residual IP information from data directory"
        rm -fr ./data/*-ip.list

        console ${INFO} "Fetching the IP information of the worker pods (pod and host)"

        pod_names=$($CLUSTER_CMD -n ${NAMESPACE} get pod -l app=fioloadgen -o jsonpath='{.items[*].metadata.name}')
        for pod_name in ${pod_names}; do
            podIP_set="NO"

            ip_info=$($CLUSTER_CMD -n ${NAMESPACE} get pod ${pod_name} -o=jsonpath='{.status.podIP} {.status.hostIP}')
            podIP=$(echo ${ip_info} | cut -f1 -d ' ')
            hostIP=$(echo ${ip_info} | cut -f2 -d ' ')
            # if [ "$podIP" != "$hostIP" ]; then
            #     break
            # else
            #     console ${ERROR} "Unable to retrieve IP information for ${pod_name}"
            #     exit
            # fi

            if [ ${lookup[${hostIP}]+_}  ]; then
                # add to the entry
                ((lookup[${hostIP}]++)) # increment the map
            else
                # add to the map
                lookup[${hostIP}]=1
            fi
            echo -e "$hostIP" >> ./data/host-ip.list
            echo -e "$podIP" >> ./data/worker-ip.list
            console ${INFO} "${TICK}${NC} ${pod_name} on ${hostIP} with POD IP ${podIP}"
        done

        # transfer the client ip addresses and fio jobs to the mgr
        console ${INFO} "Transfering worker IP addresses (pod and host), plus fio job specs to the fiomgr pod"
        $CLUSTER_CMD -n $NAMESPACE  rsync data/ fiomgr:/
        if [ $? == 0 ]; then
            console ${INFO} "${TICK}${NC} transfer complete"
        else
            console ${ERROR} "rsync to the fiomgr pod failed. Unable to continue"
            exit
        fi
        console ${INFO} "Starting a local instance of the FIOservice daemon (API and UI)"
        python3 ./fioservice.py --mode=dev start
        console ${INFO} "\nAccess the UI at http://localhost:8080. From there you may submit jobs and view"
        console ${INFO} "job output and graphs"
        console ${INFO} "Daemon logs can be found in $HOME/fioseervice.log"
        console ${INFO} "\nTo stop the daemon use 'fioservice.py stop'"
    else
        # Use remote fioservice deployed to the target cluster
        console ${INFO} "Submitting the fioservice daemon"
        $CLUSTER_CMD -n $NAMESPACE create -f yaml/fioservice.yaml
        pod_name=$($CLUSTER_CMD -n $NAMESPACE get pod -l app=fioservice -o jsonpath='{.items[0].metadata.name}')
        status=$($CLUSTER_CMD -n $NAMESPACE get pod $pod_name -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}')
        console ${INFO} "Waiting for fioservice to reach Ready state"
        t=1
        while [ $t -lt $ITERATION_LIMIT ]; do
            status=$($CLUSTER_CMD -n $NAMESPACE get pod $pod_name -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}')
            if [ "$status" != "True" ]; then
                console ${INFO} "\t - waiting (${t}/${ITERATION_LIMIT})"
                sleep $ITERATION_DELAY
                t=$((t+1))
            else
                break
            fi
        done
        if [ $t -ne $ITERATION_LIMIT ]; then
            console ${INFO} "${TICK}${NC} FIOservice pod ready"
        else
            console ${ERROR} "Timed out Waiting too long for fioservice to reach ready, unable to continue."
            console ${ERROR} "Deployment : fioservice"
            console ${ERROR} "Pod        : ${pod_name}"
            exit
        fi
        console ${INFO} "Adding port-forward rule"
        $CLUSTER_CMD -n $NAMESPACE port-forward $pod_name 8080:8080 &
        console ${INFO} "\nAccess the UI at http://localhost:8080. From there you may submit jobs and view"
        console ${INFO} "job output and graphs"
        echo ""
    fi

    console ${INFO} "\nTo drop the test environment, use the fiodeploy.sh -d <namespace> command"

    # # seed the test files
    # console ${INFO} "Seeding the test files on the workers (mode=$SEED_METHOD), please wait"
    # if [ "$SEED_METHOD" == 'parallel' ]; then
    #     console ${INFO} "- seeding $WORKERS pods in parallel"
    #     $CLUSTER_CMD -n $NAMESPACE exec fiomgr -- fio --client=worker-ip.list fio/jobs/randr.job --output=seed.output
    #     if [ $? != 0 ]; then
    #         console ${ERROR} "  failed to seed the test files on the workers"
    #         console ${ERROR} "Deployment aborted"
    #         exit
    #     fi
    # else
    #     for pod in $(cat ./data/worker-ip.list); do
    #         console ${INFO} "- seeding $pod"
    #         $CLUSTER_CMD -n $NAMESPACE exec fiomgr -- fio --client=$pod fio/jobs/randr.job --output=seed.output
    #         if [ $? != 0 ]; then
    #             console ${ERROR} "  failed to seed the test file on $pod"
    #             console ${ERROR} "Deployment aborted"
    #             exit
    #         fi
    #     done
    # fi

    # check_fio_complete

    # echo -e "\n"
    # if [ ${#lookup[@]} -eq 1 ]; then
    #     console ${WARNING} "${TICK} All workers are on a single host"
    # else
    #     console ${INFO} "${TICK}${NC} ${WORKERS} worker pods running on ${#lookup[@]} hosts"
    # fi
    # console ${INFO} "${TICK}${NC} test files seeded, workers ready"
    # console ${INFO} "${TICK}${NC} ${WORKERS} worker pods ready"
    # console ${INFO} "${TICK}${NC} use rsh to login to the fiomgr pod to run a workload or use the fioservice and fiocli commands\n"

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

    console ${INFO} "Deleting FIOLoadgen namespace '${NAMESPACE}'"
    $CLUSTER_CMD delete namespace ${NAMESPACE}
    if [ $? == 0 ]; then
        console ${INFO} "${TICK}${NC} namespace successfully deleted"
    else
        console ${ERROR} "Namespace delete failed for '${NAMESPACE}'"
    fi

    release_lock
}


usage() {
    echo -e "Usage: ${SCRIPT_NAME} [-hwsdr]"
    echo -e "\t-h             ... display usage information"
    echo -e "\t-s             ... setup an FIOLoadgen test environment"
    echo -e "\t-d <namespace> ... delete the FIOLoadgen namespace"
    echo -e "\t-r             ... reset (remove the lockfile)"

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
                check_prereq
                check_ready
                get_environment
                setup
                exit
                ;;
            d)
                check_prereq
                check_ready
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
