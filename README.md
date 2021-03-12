
# FIOLoadGen
Project that provides a structured test environment based on fio workload patterns. The project contains a number of tools that promote the following workflow;
1. Use fiodeploy to create the test environment (builds an fio client/server environment containing a specific number of workers)
2. run fioservice to provide an API and web interface to the test framework
3. Use fiocli to interact with the API, to run and query job state/results

These components provide the following features;
- standard repeatable deployment of an fio testing framework
- persistent store for job results and profiles for future reference (regression testing anyone?)
- ability to export job results for reuse in other systems
- ability to dump all jobs or a specific job in sqlite format for import in another system
- fio job management through a RESTful API supporting
   - cli tool to interact with the API to run jobs, query output, query profiles
   - web front end supporting fio profile view/refresh, job submission and visualisation of fio results (using chartjs)
- supported backend - openshift only at the moment, but adding kubernetes should be a no brainer!

## What does the workflow look like?
Here's a demo against an openshift cluster. It shows the creation of the mgr pod and workers, and illustrates the use of the CLI to run and query jobs.

![demo](media/fioloadgen_1.2_2.gif)


## Requirements
- python3
- python3-cherrypy
- python3-requests

### Notes
Cherrypy can be a pain to install, depending on your distro. Here's a quick table to provide some pointers

| Distro | Repo | Dev Tested
|----------|---------|----------|
| RHEL8 | ceph (rhcs4) or ocs4 repos | Yes via downstream repo rhceph repo |
| Fedora | in the base repo | Yes via rpm |
| CentOS8 | N/A | Untested |
| OpenSuSE | base repo | Untested |
| Ubuntu | base repo | Untested |

If all else fails - install pip3, and install with ```pip3 install cherrypy```

## Deploying the FIOLOADGEN environment
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
3. [TODO] Grab and store the target storage configuration
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
- [X] UI - show profiles, submit jobs
- [X] UI - add use chart.js to visualize the results a run
- [X] UI - reload the profiles in the UI with changes in the filesystem
- [ ] extend the 'fiotester' container to include other benchmarking tools
- [X] enable the fioservice to run away from the cli (remote loadgen deployments)
- [X] provide an fioservice container that can be run on the target infrastructure, instead of locally
- [ ] react optimization
- [ ] formalise the code as an installable python package(why not add an rpm too?)
- [ ] replace raw information of a profile with widgets to make it more accessible
- [ ] use presets and custom
- [ ] store the fio parameters used the jobs database record

