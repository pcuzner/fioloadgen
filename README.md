
# FIOLoadGen
Project that provides a structured test environment based on fio workload patterns. The project contains a number of tools that promote the following workflow;
1. Use fiodeploy to create the test environment (builds an fio client/server environment containing a specific number of workers)
2. run fioservice to provide an API and web interface to manage the tests and view the results
3. optionally, use fiocli to interact with the API, to run and query job state/results via the CLI

These components provide the following features;
- standard repeatable deployment of an fio testing framework
- persistent store for job results and profiles for future reference (useful for regression testing, or bake-off's)
- ability to export job results for reuse in other systems
- ability to dump all jobs or a specific job in sqlite format for import in another system
- fio job management through a RESTful API supporting
   - cli tool to interact with the API to run jobs, query output, query profiles
   - web front end supporting fio profile view/refresh, job submission and visualisation of fio results (using chartjs)
- supported backend - openshift only at the moment, but adding kubernetes should be a no brainer!

## What does the workflow look like?
Here's a demo against an openshift cluster. It shows the creation of the mgr pod and workers, and illustrates the use of the CLI to run and query jobs.

![demo](media/fioloadgen_1.2_2.gif)

[full video (no sound)](https://youtu.be/YzakBle2afU)

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

If all else fails you have two options
- install pip3, and install with ```pip3 install cherrypy```
- use remote mode for the fioservice daemon which runs the API/web interface in the Openshift cluster

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
Here's an example of the deployment, using the remote fioservice option.
```
[paul@rhp1gen3 fioloadgen]$ ./fiodeploy.sh -s
Checking kubernetes CLI is available
✔ oc command available
Checking access to kubernetes
✔ access OK

FIOLoadgen will use a dedicated namespace for the tests
What namespace should be used [fio]?
- checking existing namespaces
✔ namespace 'fio' will be used
How many fio workers [2]?
✔ 2 worker pods will be deployed
Checking available storageclasses
- thin
What storageclass should the fio worker pods use [ocs-storagecluster-ceph-rbd]? thin
✔ storageclass 'thin' will be used

To manage the tests, FIOLoadgen can use either a local daemon on your machine (local), or
deploy the management daemon to the target environment (remote)
How do you want to manage the tests (local/remote) [local]? remote

Setting up the environment

Creating namespace (fio)
✔ namespace created OK
Deploying the FIO workers statefulset
statefulset.apps/fioworker created
0
Waiting for pods to reach a running state
         - waiting for pods to reach 'Running' state (1/60)
         - waiting for pods to reach 'Running' state (2/60)
         - waiting for pods to reach 'Running' state (3/60)
         - waiting for pods to reach 'Running' state (4/60)
         - waiting for pods to reach 'Running' state (5/60)
         - waiting for pods to reach 'Running' state (6/60)
         - waiting for pods to reach 'Running' state (7/60)
         - waiting for pods to reach 'Running' state (8/60)
         - waiting for pods to reach 'Running' state (9/60)
✔ Pods ready
Submitting the fioservice daemon
serviceaccount/fioservice-sa created
role.rbac.authorization.k8s.io/fioservice created
rolebinding.rbac.authorization.k8s.io/fioservice-binding created
deployment.apps/fioservice created
Waiting for fioservice to reach Ready state
         - waiting (1/60)
         - waiting (2/60)
         - waiting (3/60)
✔ FIOservice pod ready
Adding port-forward rule

Access the UI at http://localhost:8080. From there you may submit jobs and view
job output and graphs


To drop the test environment, use the fiodeploy.sh -d <namespace> command
```

The pods deployed to the 'fio' namespace vary slightly depending upon
whether you run the fioservice on your local machine, or run it within the Openshift
cluster itself (remote mode).

In *'local'* mode, you will see an fiomgr pod. This pod provides the focal point for fio job management. The local fioservice daemon will interact with this pod using the 'oc'
command to start test runs.

With *'remote'* mode, fiodeploy will create a deployment in the target environment where the fioservice will run, and establishes a port-forward from you local machine to this pod. FIO jobs are all managed directly within this pod, and all interactions between the
fioservice and the platform is performed using the kubernetes API.

In either deployment model, the workers that perform the I/O tests are deployed using a
statefulset, where the pods are called 'fioworker-N'. Each fioworker pod uses a PVC from the requested storageclass defined during setup.


local mode After deployment, you'll have the following configuration in Openshift
- fiomgr : pod that acts as the test controller - sending work requests to the worker pods
- fioworkerN: pods that run the fio tool in server mode, waiting to receive job requests from the controller pod (fiomgr)

At this point you can rsh into the fiomgr pod and run fio workloads directly, or opt for the fio web service.


## Manually starting a local FIO Service (API/UI)
```
> ./fioservice.py --mode=dev start
```
1. Defaults to an openshift connection (--type=oc) and namespace of fio (--namespace=fio)
2. Expects to be run from the root of the project folder (at start up it will attempt
   to refresh profiles from the local project folder.)

## Stopping the FIO service
```
> ./fioservice.py stop
```

## Removing the FIOLoadgen environment
The fiodeploy command provides a **-d** switch to handle the remove of the fio namespace
and all associated resources.


## Using the CLI command to manage tests

1. Show the current status of the fioservice
```
> ./fiocli.py status

Example output:

Target      : Openshift
Workers     : 2
Debug Mode  : No
Job running : No
Jobs queued : 0
Uptime      : 4:47:29
```

2. List available IO profiles you can test with
```
> ./fiocli.py profile --ls

Example output:
./fiocli.py profile --ls
- randr.job
- randrlimited.job
- randrw7030.job
- seqwrite.job

```
3. Show the parameters within a profile
```
> ./fiocli.py profile --show <profile-name>
```
4. Add a fio job profile to the fioservice database
```
> ./fiocli.py profile-add --name <profile-name> --file=<local_file>

Example output:
./fiocli.py profile-add --name new.job --file=/home/test/fioloadgen/newread.job
profile upload successful
```
5. Remove an fio job profile from the fioservice database
```
> ./fiocli.py profile-rm --name <profile-name>

Example output:
./fiocli.py profile-rm --name new.job
profile deleted
```
6. Run an fio job using a given profile
```
> ./fiocli.py run --profile <profile-name> --workers <int> --title <text>
```
7. List jobs stored in the database
```
> ./fiocli.py job --ls

Example output:
./fiocli.py job --ls
Job ID                                 Status            End Time        Job Title
91a2c232-1d36-4685-a94d-19ea6a253ae6   complete     2021-03-12 11:38:05  test run - sc=thin
Jobs:   1

```
8. Show summarized outut from a run
```
> ./fiocli.py job --show <run id>

Example output:
./fiocli.py job --show 91a2c232-1d36-4685-a94d-19ea6a253ae6

Id       : 91a2c232-1d36-4685-a94d-19ea6a253ae6
Title    : test run - sc=thin
Run Date : 2021-03-12 11:36:42
Profile  : randr.job
Workers  : 2
Status   : complete
Summary  :
  Clients: 2
  Total_Iops: 23212.479792
  Read Ms Min/Avg/Max: 0.50/0.51/0.51
  Write Ms Min/Avg/Max: 0.00/0.00/0.00

```
9. show full json output from a run
```
> ./fiocli.py job --show <id> --raw

Example output:
[paul@rhp1gen3 fioloadgen]$ ./fiocli.py job --show 91a2c232-1d36-4685-a94d-19ea6a253ae6 --raw

Id       : 91a2c232-1d36-4685-a94d-19ea6a253ae6
Title    : test run - sc=thin
Run Date : 2021-03-12 11:36:42
Profile  : randr.job
Workers  : 2
Status   : complete
Summary  :
  Clients: 2
  Total_Iops: 23212.479792
  Read Ms Min/Avg/Max: 0.50/0.51/0.51
  Write Ms Min/Avg/Max: 0.00/0.00/0.00
{
  "fio version": "fio-3.25",
  "timestamp": 1615502202,
  "time": "Thu Mar 11 22:36:42 2021",
  "global options": {
    "size": "5g",
    "directory": "/mnt",
    "iodepth": "4",
    "direct": "1",
    "bs": "4k",
    "time_based": "1",
    "ioengine": "libaio",
    "runtime": "60"
  },
  "client_stats": [
    {
      "jobname": "workload",
      "groupid": 0,
      "error": 0,
      "job options": {
        "rw": "randrw",
        "rwmixread": "100",
        "numjobs": "1"
      },
<snip>
```

## The FIOLoadgen Database
The fioservice maintains a sqlite database containing 2 tables - profiles and jobs, which
can be managed using the fiocli command.

1. Dump the jobs table to a backup file
```
./fiocli.py db-dump [-h] [--table {jobs,profiles}] [--out OUT]

Example output:
./fiocli.py db-dump --table jobs --out myjobs.backup
database dump of table 'jobs' written to myjobs.backup
```
2. Export a specific job from the database
```
fiocli.py db-export [-h] [--table {jobs,profiles}] --row ROW [--out OUT]

Example output:
./fiocli.py db-export --table jobs --row id=91a2c232-1d36-4685-a94d-19ea6a253ae6
database table row from 'jobs' written to /home/paul/fioservice-db-jobs-row.sql
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

