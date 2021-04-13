#!/usr/bin/bash

# TODO
# 1. make the command interaction optional - with oc or kubectl
# 3. switch to replicaset management
# 4. remove the seeding of the fio files
PLATFORM=''
DEFAULT_NAMESPACE='fio'
DEFAULT_WORKERS=2
DEFAULT_SC='ocs-storagecluster-ceph-rbd'
DEFAULT_SEED_METHOD='parallel'
DEFAULT_FIOSERVICE_MODE='local'
CLUSTER_CMD=''
SEED_METHOD=''
FIOSERVICE_MODE=''
FIOSERVICE_PORT=8080
WORKER_YAML='fio.yaml'
WORKERS=0
STORAGECLASS=''
NAMESPACE=""
WORKER_LIMIT=20
SCRIPT_NAME=$(basename $0)
ITERATION_LIMIT=60 # 5 min pod running timeout
ITERATION_DELAY=5
LOCKFILE='./fiodeploy.lock'
POD_READY_LIMIT=120
DELETE_TIMEOUT=60

NC='\033[0m'     # No Color
INFO='\033[0;32m' # green
OK='\033[0;32m' # green
ERROR='\033[0;31m' # red
WARNING='\033[1;33m' # yellow
TICK='\xE2\x9C\x94' # tickmark
CROSS='x'

exists () {
    which $1 > /dev/null 2>&1
}

console () {
    echo -e "${1}${2}${NC}"
}

check_prereq () {
    console "\nChecking oc/kubectl CLI is available"
    if exists "oc"; then
        CLUSTER_CMD='oc'
        PLATFORM='openshift'
        console ${OK} "${TICK} oc command available${NC}"
    else
        if exists "kubectl"; then
            CLUSTER_CMD='kubectl'
            PLATFORM='kubernetes'
            console ${OK} "${TICK} kubectl command available ${NC}"
        else
            console ${ERROR} "${CROSS} oc or kubectl commands not found. Unable to continue"
            exit
        fi
    fi
}

prompt () {
    local choices=$2
    while true; do
        # read -p $(echo -e ${INFO})"$1? "$(echo -e ${NC}) answer
        read -p "$1? " answer
        if [ -z "$answer" ]; then
            continue
        fi

        if [[ "${choices}" == *"${answer}"* ]]; then
            break
        fi
    done
    echo $answer
}

check_port() {
    console "\nChecking port ${FIOSERVICE_PORT} is free"
    cmd=$(lsof -Pi :${FIOSERVICE_PORT} -sTCP:LISTEN -t)
    if [ $? -eq 0 ]; then
        console ${ERROR} "${CROSS} port ${FIOSERVICE_PORT} is in use${NC}"
        exit
    fi
    console ${OK} "${TICK} port ${FIOSERVICE_PORT} is available${NC}"
}

check_ready() {
    console "\nChecking you are logged in to ${PLATFORM} with kubeadmin"
    local login_state
    if [ "$CLUSTER_CMD" == "oc" ]; then
        login_state=$($CLUSTER_CMD whoami 2>&1)
        if [ $? -eq 0 ]; then
            if [ "$login_state" = "kube:admin" ]; then
                console ${OK} "${TICK} ${PLATFORM} access OK ${NC}"
            else
                console ${ERROR} "${CROSS} you're logged in, but not with kubeadmin?${NC}"
                exit
            fi
        else
            console ${ERROR} "${CROSS} you're not logged in. Login to ${PLATFORM} with the kubeadmin account"
            exit
        fi
    else
        console ${WARNING} "? unable to check login state with kubernetes"
    fi
}

acquire_lock() {
    if [ -f "${LOCKFILE}" ]; then
        console ${ERROR} "'fiodeploy.lock' file found. Is the script still running? ${NC}"
        exit
    else
        touch ${LOCKFILE}
    fi
}
release_lock() {
    rm -f ${LOCKFILE} 2>/dev/null
}

get_environment() {
    console "\nFIOLoadgen will use a create a new namespace to support the test environment"
    # read -p $(echo -e ${INFO})"What namespace should be used [${DEFAULT_NAMESPACE}]? "$(echo -e ${NC}) NAMESPACE
    read -p "What namespace should be used [${DEFAULT_NAMESPACE}]? " NAMESPACE
    if [ -z "$NAMESPACE" ]; then
        NAMESPACE=$DEFAULT_NAMESPACE

    fi
    console ${OK} "- checking '${NAMESPACE}' namespace is available"
    check_ns=$($CLUSTER_CMD get ns $NAMESPACE> /dev/null 2>&1)
    if [ $? = 0 ]; then
        overwrite "${ERROR}${CROSS} namespace $NAMESPACE already exists. Unable to continue${NC}"
        exit
    else
        overwrite "${OK}${TICK} namespace '$NAMESPACE' is available${NC}\n"
    fi

    # read -p $(echo -e ${INFO})"How many fio workers (1-${WORKER_LIMIT}) [${DEFAULT_WORKERS}]? "$(echo -e ${NC}) WORKERS
    read -p "How many fio workers (1-${WORKER_LIMIT}) [${DEFAULT_WORKERS}]? " WORKERS
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

    console ${OK} "${TICK} ${WORKERS} worker pods will be deployed ${NC}"
    console "\nChecking available storageclasses"
    sc_names=$(oc get sc -o jsonpath='{.items[*].metadata.name}')
    for sc in ${sc_names}; do
        console "- ${sc}"
    done
    # read -p $(echo -e ${INFO})"What storageclass should the fio worker pods use [$DEFAULT_SC]? "$(echo -e ${NC}) STORAGECLASS
    read -p "What storageclass should the fio worker pods use [$DEFAULT_SC]? " STORAGECLASS
    if [ -z $STORAGECLASS ]; then
        STORAGECLASS=$DEFAULT_SC
    fi

    if [[ "${sc_names}" != *"${STORAGECLASS}"* ]]; then
        console ${ERROR} "${CROSS} storageclass '${STORAGECLASS}' does not exist."
        exit
    fi

    console ${OK} "${TICK} storageclass '${STORAGECLASS}' will be used${NC}"
    # if [ -z "$STORAGECLASS" ]; then
    #     WORKER_YAML='fio_no_pvc.yaml'
    # else
    #     sed "s/{STORAGECLASS}/${STORAGECLASS}/g" ./yaml/fio.yaml > ./yaml/fioworker.yaml
    #     WORKER_YAML='fioworker.yaml'
    # fi

    console "\nTo manage the tests, FIOLoadgen can use either a local daemon on your machine (local), or"
    console "deploy the management daemon to the target environment (remote)"
    while [ -z "$FIOSERVICE_MODE" ]; do
        # read -p $(echo -e ${INFO})"How do you want to manage the tests (local/remote) [local]? "$(echo -e ${NC}) FIOSERVICE_MODE
        read -p "How do you want to manage the tests (local/remote) [local]? " FIOSERVICE_MODE
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

overwrite() {
    echo -e "\r\033[1A\033[0K$@"
}

wait_for_pod() {
    local pod_name=$1
    console ${INFO} "- waiting for the $pod_name pod to reach ready status"
    local t=1
    while [[ $($CLUSTER_CMD get -n $NAMESPACE pod $pod_name -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}') != "True" ]]; do
        sleep 1
        t=$((t+1))
        if [[ $t -gt $POD_READY_LIMIT ]]; then
            overwrite "${ERROR}x Time out waiting for the $pod_name pod to reach ready${NC}"
            exit
        fi
    done
    overwrite "${OK}${TICK} pod ${pod_name} is ready${NC}"
}

get_port_fwd_pid() {
    echo $(ps -ef | awk '/[p]ort-forward fioservice/ { print $2;}')
}

setup() {
    # TODO - show a summary of the options chosen
    console "\nTest Environment Summary"
    console "\n\tNamespace   : ${NAMESPACE}"
    console "\tFIO Workers : $WORKERS"
    console "\tStorageclass: ${STORAGECLASS}"
    console "\tFIO service : ${FIOSERVICE_MODE}\n"
    ready=$(prompt "Ready to deploy (y/n) " "y n Y N yes no")
    case $ready in
        [nN] | no)
            console ${ERROR} "Aborted${NC}"
            exit
    esac

    acquire_lock

    console ${INFO} "\nStarting deployment\n"

    # create namespace
    console "Creating namespace (${NAMESPACE})"
    ns=$($CLUSTER_CMD create namespace ${NAMESPACE})
    if [ $? != 0 ]; then
        console ${ERROR} "${CROSS} Unable to create namespace...cannot continue${NC}"
        exit
    else
        console ${OK} "${TICK} namespace created OK${NC}"
    fi

    # deploy the pods

    console "\nDeploying the FIO workers statefulset"
    statefulset=$(cat yaml/fioworker_statefulset_template.yaml | \
        sed "s/!WORKERS!/${WORKERS}/" | \
        sed "s/!STORAGECLASS!/${STORAGECLASS}/g" | \
        $CLUSTER_CMD -n ${NAMESPACE} create -f - 2>&1)
    # $CLUSTER_CMD -n ${NAMESPACE} create -f yaml/fioworker_statefulset.yaml
    if [ $? -ne 0 ]; then
        console ${ERROR} "${CROSS} Failed to deploy stateful set - '${statefulset}'${NC}"
        exit
    else
        console ${OK} "${TICK} ${statefulset}${NC}"
    fi

    # for n in $(seq ${WORKERS}); do
    #    cat yaml/${WORKER_YAML} | sed "s/fioclient/fioworker${n}/g" | oc create -n ${NAMESPACE} -f -;
    # done

    console "\nWaiting for pods in the statefulset to reach a running state\n"
    t=1
    while [ $t -lt $ITERATION_LIMIT ]; do # get pod -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}'
        status=$($CLUSTER_CMD -n ${NAMESPACE} get statefulset fioworker -o jsonpath='{..status.readyReplicas}')
        if [ -z "$status" ]; then
            status='0'
        fi
        msg="${INFO}- ${status}/${WORKERS} PODs ready ... (check ${t}/${ITERATION_LIMIT})"
        overwrite $msg
        if [ "$status" != "$WORKERS" ]; then
            sleep $ITERATION_DELAY
            t=$((t+1))
        else
            break
        fi
    done

    if [ $t -ne $ITERATION_LIMIT ]; then
        overwrite "${OK}${TICK} All worker pods ready${NC}"
    else
        console ${ERROR} "\nTimed out waiting too long for worker pods to reach ready state, unable to continue."
        console ${ERROR} "Statefulset : fioloadgen"
        console ${ERROR} "Storageclass: ${STORAGECLASS}"
        console ${ERROR} "Pods Ready  : ${status}"
        exit
    fi

    declare -A lookup
    if [ "$FIOSERVICE_MODE" = "local" ]; then
        console "\nDeploying the mgr"
        fio_mgr_out=$($CLUSTER_CMD -n $NAMESPACE create -f yaml/fiomgr.yaml)
        if [ $? == 0 ]; then
            console ${OK} "${TICK} ${fio_mgr_out}${NC}"
        else
            console ${ERROR} "${CROSS} Failed to create the mgr pod ${NC}"
            exit
        fi

        wait_for_pod 'fiomgr'

        console "\nRemoving residual IP information from local data directory"
        rm -fr ./data/*-ip.list

        console "\nFetching the IP information of the worker pods (pod and host)"

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
            console ${OK} "${TICK} ${pod_name} on ${hostIP} with POD IP ${podIP}${NC}"
        done

        # transfer the client ip addresses and fio jobs to the mgr
        console "\nTransfering worker IP addresses (pod and host), plus fio job specs to the fiomgr pod"
        rsync_out=$($CLUSTER_CMD -n $NAMESPACE  rsync data/ fiomgr:/)
        if [ $? == 0 ]; then
            console ${OK} "${TICK} transfer complete${NC}"
        else
            console ${ERROR} "${CROSS} rsync to the fiomgr pod failed. Unable to continue${NC}"
            exit
        fi
        console "\nStarting a local instance of the FIOservice daemon (API and UI)\n"
        python3 ./fioservice.py --mode=dev start --namespace ${NAMESPACE}
        if [ $? -ne 0 ]; then
            console ${ERROR} "${CROSS} failed to start the local fioservice daemon"
            exit
        fi
        console ${OK} "${TICK} fioservice started${NC}"
        console ${OK} "\nAccess the UI at http://localhost:8080. From there you may submit jobs and view"
        console ${OK} "job output and graphs"
        console ${OK} "Daemon logs can be found in $HOME/fioseervice.log"
        console ${OK} "\nTo stop the daemon use 'fioservice.py stop'\n"
    else
        # Use remote fioservice deployed to the target cluster
        console "\nSubmitting the deployment for the fioservice daemon"
        deployment=$($CLUSTER_CMD -n $NAMESPACE create -f yaml/fioservice.yaml)
        if [ $? -gt 0 ]; then
            console ${ERROR} "${CROSS} deployment failed, unable to continue${NC}"
            exit
        else
            console ${OK} "${TICK} deployment created${NC}"
        fi

        pod_name=$($CLUSTER_CMD -n $NAMESPACE get pod -l app=fioservice -o jsonpath='{.items[0].metadata.name}')
        # status=$($CLUSTER_CMD -n $NAMESPACE get pod $pod_name -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}')
        # console ${INFO} "Waiting for fioservice to reach Ready state"
        wait_for_pod $pod_name
        # t=1
        # while [ $t -lt $ITERATION_LIMIT ]; do
        #     status=$($CLUSTER_CMD -n $NAMESPACE get pod $pod_name -o=jsonpath='{..status.conditions[?(@.type=="Ready")].status}')
        #     if [ "$status" != "True" ]; then
        #         console ${INFO} "\t - waiting (${t}/${ITERATION_LIMIT})"
        #         sleep $ITERATION_DELAY
        #         t=$((t+1))
        #     else
        #         break
        #     fi
        # done
        # if [ $t -ne $ITERATION_LIMIT ]; then
        # else
        #     console ${ERROR} "Timed out Waiting too long for fioservice to reach ready, unable to continue."
        #     console ${ERROR} "Deployment : fioservice"
        #     console ${ERROR} "Pod        : ${pod_name}"
        #     exit
        # fi
        console "\nAdding port-forward rule (port ${FIOSERVICE_PORT})"
        $CLUSTER_CMD -n $NAMESPACE port-forward $pod_name 8080:8080 > /dev/null 2>&1 &
        if [ $? -gt 0 ]; then
            console ${ERROR} "${CROSS} failed to add the port-forward to pod ${pod_name}${NC}"
            exit
        else
            # get pid of port-forward
            pid=$(get_port_fwd_pid)
            console ${OK} "${TICK} port-forward successful (pid=${pid})${NC}"
        fi

        console ${INFO} "\nAccess the UI at http://localhost:8080. From there you may submit jobs and view"
        console ${INFO} "job output and graphs"
        console ${INFO} "\nTo remove the port-forward, use kill -9 ${pid}\n"
    fi

    console ${INFO} "To drop the test environment, use the fiodeploy.sh -d <namespace> command"

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
    echo
    ready=$(prompt "Are you sure you want to delete the '${NAMESPACE}' namespace and all it's pods/PVCs? (y/n) " "y n Y N yes no")
    case $ready in
        [nN] | no)
            console ${ERROR} "Aborted$NC"
            exit
    esac

    console "\nChecking for any port-forward PID to remove"
    pid=$(get_port_fwd_pid)
    if [ ! -z "$pid" ]; then
        kill -9 $pid
        if [ $? -gt 0 ]; then
            console ${ERROR} "Failed to remove the port-forward (pid=${pid})${NC}"
            exit 1
        else
            console ${OK} "${TICK} removed the port-forward process${NC}"
        fi
    else
        console ${OK} "${TICK} port-forward not present${NC}"
    fi

    console "\nChecking pods running in $NAMESPACE are only fioloadgen pods"
    pod_names=$($CLUSTER_CMD -n $NAMESPACE get pod -o jsonpath='{.items[*].metadata.name}')
    pod_array=( $pod_names )
    for pod_name in "${pod_array[@]}"; do
        if [[ $pod_name == fioservice* || $pod_name == fioworker* ]]; then
            continue
        else
            console ${ERROR} "Namespace contains non fio pods, unable to cleanup${NC}"
            exit 1
        fi
    done
    if [ ${#pod_array[@]} -eq 0 ]; then
        console ${OK} "${TICK} namespace is empty${NC}"
    else
        console ${OK} "${TICK} only fio loadgen related pods present${NC}"
    fi

    acquire_lock

    console "\nPlease wait while the '${NAMESPACE}' namespace is deleted (timeout @ ${DELETE_TIMEOUT}s)"
    cmd=$(timeout --foreground --kill-after $DELETE_TIMEOUT $DELETE_TIMEOUT $CLUSTER_CMD delete namespace ${NAMESPACE})
    case "$?" in
        0)
            console "${OK}${TICK} namespace successfully deleted${NC}"
            ;;
      124)
            console "${ERROR}${CROSS} namespace delete request timed out${NC}"
            ;;
        *)
            console "${ERROR}${CROSS} namespace delete failed for '${NAMESPACE}' rc=$?${NC}"
            ;;
    esac

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
                check_port
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
