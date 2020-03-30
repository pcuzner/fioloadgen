
# FIOLoadGen
Project that provides a structured test environment based on fio workload patterns. The project contains a number of tools that promote the following workflow;  
1. Use fiodeploy to create the test environment (builds an fio client/server environment containing a specific number of workers)
2. run fioservice to provide an API and web interface to the test framework
3. Use fiocli to interact with the API, to run and query job state/results

These components provide the following features;  
- RESTful API
- sqlite3 database (used to hold job state and output)
- web front end (partially implemented)
- cli client to interact with the REST API
- supported backends (openshift is all I'm testing against at the moment!)

## What does the workflow look like?
Here's a demo against an openshift cluster. It shows the creation of the mgr pod and workers, and illustrates the use of the CLI to run and query jobs.  

![demo gif](media/fioloadgen-demo.gif)


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
> ./fiocli.py profile --ls
```
2. Show the parameters within a profile
```
> ./fiocli.py profile --show <profile-name>
```
3. Run an fio job using a given profile
```
> ./fiocli.py run --profile <profile-name> --workers <int> --title <text>
```
4. List jobs stored in the database
```
> ./fiocli.py job --ls
```
5. Show summarized outut from a run
```
> ./fiocli.py job --show <run id>
```
6. show full json output from a run
```
> ./fiocli.py job --show <id> --raw
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

## TODO List  
- [x] implement a wait parameter in the CLI when running an fio job
- [x] UI - define the UI structure and components  
- [x] UI - view results from db
- [-] UI - show profiles, submit jobs (submit remaining)
- [X] UI - add use chart.js to visualize the results a run
- [ ] extend the container to include other benchmarking tools  
- [ ] all the service to be separate from the cli
- [ ] provide an fioservice container that can be run on the target infrastructure, instead of locally


  