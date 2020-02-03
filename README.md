
# FIOLoadGen
Project that provides a structured test environment based on fio workload patterns. The project contains a number of tools that promote the following workflow;  
1. deploy the test environment (builds an fio client/server environment containing a specific number of workers)
2. fiowebservice : provides an API endpoint to interact with the backend test environment via curl or CLI
3. fiocli - CLI interface to the web service to run, and query fio jobs

These components provide the following features;  
- RESTful API
- sqlite3 database (used to hold job state and output)
- web front end (not implemented yet - just a placeholder react app is present)
- cli client to interact with the REST API
- supported backends (openshift - kubernetes, and ssh to come)

## Deploying the test environment
Before you deploy, you **must** have a working connection to openshift and the required CLI tool (oc) must be in your path.  
Once you have logged in to openshift, you can run the ```fiodeploy.sh``` script. This script is used to standup and tear down test environments
```
$ ./fiodeploy.sh -h
Usage: fiodeploy.sh [-dsh]
        -h      ... display usage information
        -s      ... setup an fio test environment
        -d <ns> ... destroy the given namespace
        -r      ... reset - remove the lockfile
e.g.
> ./fiodeploy.sh -s
```

After deployment, you'll have the following configuration in Openshift
- fiomgr : pod that acts as the test controller - sending work requests to the worker pods
- fioworkerN: pods that run the fio tool in server mode, waiting to receive job requests from the controller pod (fiomgr)

At this point you can rsh into the fiomgr pod and run fio workloads directly, or opt for the fio web service.


## Managing the FIO web Service
```
> ./fioservice.py start
```
1. Defaults to an openshift connection (--type=oc) and namespace of fio (--namespace=fio)
2. for oc type engines
   have I got a working kube environment
3. [TODO] Grab and store the ceph configuration
   version
   number of osds by type (hdd and ssd)
   number of pools
   number of machines / nodes
   (what does osd metadata provide for cpu, and platform)

stop your engine
```
> ./fioservice.py stop
```

## Interacting with the web service

1. List available IO profiles you can test with
```
> fiocli profile --ls
```
2. Show the parameters within a profile
```
> fiocli profile --show <profile-name>
```
3. Run an fio job using a given profile
```
> fiocli run --profile <profile-name> --workers <int> --title <text>
```
4. List jobs stored in the database
```
> fiocli job --ls
```
5. Show summarized outut from a run
```
> fiocli job --show <run id>
```
6. show full json output from a run
```
> fiocli job --show <id> --raw
```

## Files used by the environment
Runtime files and a the database are placed in the users home directory

| filename | Used By | Purpose |
|----------|---------|---------|
| ```fioservice.db``` | web service | sqlite3 database containing profiles and job information |
| ```fioservice.pid``` | web service | pid file for the web service
| ```fioservice.log``` | web service | cherrypy log file - error and generic log messages
| ```fioservice.access.log``` | web service | cherrypy access log messages
| ```fiodeploy.lock``` | deploy script | used as a lock file to prevent multiple deploys running

