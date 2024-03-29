
# FIOLoadGen
Project that provides a structured test environment based on fio workload patterns. The project contains a number of tools that promote the following workflow;
1. Use fiodeploy to create the test environment (builds an fio client/server environment containing a specific number of workers)
2. run fioservice to provide an API and web interface to manage the tests and view the results
3. optionally, use fiocli to interact with the API, to run and query job state/results via the CLI

These components provide the following features;
- standard repeatable deployment of an fio testing framework
- persistent store for job results and profiles for future reference (useful for regression testing, or bake-off's)
- support for predefined fio job profiles and custom profiles defined in the UI
- deployment of fio workers to multiple storageclasses (allows testing against different providers)
- ability to export job results for reuse in other systems
- ability to dump all jobs or a specific job in sqlite format for import in another system
- fio job management through a RESTful API supporting
   - cli tool to interact with the API to run jobs, query output, query profiles
   - web front end supporting fio profile view/refresh, job submission and visualisation of fio results (using chartjs)
- supported backend - openshift and kubernetes (tested with minikube)


## What does the workflow look like?
Here's a demo against an openshift cluster. It shows the creation of the mgr pod and workers, and illustrates the use of the CLI to run and query jobs.

![demo](media/fioloadgen_1.2_2.gif)

[full video (no sound)](https://youtu.be/YzakBle2afU)


## Installation
The fioloadgen tool currently runs from your local directory, so you just need to download the repo and follow the steps in the "Deploying the FIOLoadgen.." section.
However, the tool provides an API and web interface nd for that there are two options;
either local or remote.

Choosing 'local' means that the fioservice daemon will try and run on your machine, so
you'll need to satisfy the python dependencies. If this sounds like a hassle, just
choose the 'remote' option to deploy the service in the target kubernetes cluster,
along with the FIO worker pods.

### Python Requirements
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
- use **remote** mode for the fioservice daemon which runs the API/web interface in the Openshift cluster (no local dependencies!)


## Deploying the FIOLOADGEN environment
Before you deploy, you **must** have a working connection to openshift and the required CLI tool (oc) must be in your path.
Once you have logged in to openshift, you can run the ```fiodeploy.sh``` script. This script is used to standup (```-s```) **and** tear down (```-d```) test environments
```
$ ./fiodeploy -h
Usage: fiodeploy [-dsh]
        -h      ... display usage information
        -s      ... setup an fio test environment
        -d <ns> ... destroy the given namespace
        -r      ... reset - remove the lockfile
e.g.
> ./fiodeploy -s
```
Here's an example of a deployment, using the remote fioservice option.
```
[paul@rhp1gen3 fioloadgen]$ ./fiodeploy -s
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
whether you run the fioservice on your local machine, or run it within the target
cluster itself (remote mode).

In *'local'* mode, you will see an fiomgr pod. This pod provides the focal point for fio job management. The local fioservice daemon will interact with this pod using the 'oc'
command to start test runs. You could 'exec' into the fiomgr pod directly to run fio
jobs, which may provide the most hands-on experience for some users. However, using the
fiomgr directly will not load results into the fioservice database or provide the
analysis charts.

With *'remote'* mode, fiodeploy will create a deployment in the target environment where the fioservice will run, and establishes a **port-forward** from your local machine to this pod. FIO jobs are managed by this pod, and all interactions between the fioservice and the kubernetes platform is performed using the kubernetes API.

In either deployment model, the workers that perform the I/O tests are deployed using a
statefulset. The pods created are called 'fioworker-N', with each fioworker pod using a
PVC from the requested storageclass defined during setup.

## Using the UI
The fioservice daemon provides an API which supports the web interface and the fiocli
command. The UI is split into 3 main areas
- Page banner/heading
- FIO profiles
- Job Summary and Analysis

### Page Banner
![banner](media/fioloadgen_banner.png)


### FIO Profiles
![banner](media/fioloadgen_profiles.png)


### Job Summary & Analysis
![banner](media/fioloadgen_jobs.png)

Each row in the job table has a menu icon that provides options for managing the job
based on it's state. For example, queued jobs may be deleted and complete jobs rerun.


## Manually starting a local FIO Service (API/UI)
Normally the fioservice is started by the ```fiodeploy``` script. But if you need to manage
things for yourself, this info may help.

### Starting the fioservice daemon
```
> ./fioservice --mode=dev start
```
1. Defaults to an openshift connection (--type=oc) and namespace of fio (--namespace=fio)
2. Expects to be run from the root of the project folder (at start up it will attempt
   to refresh profiles from the local project folder.)

### Stopping the fioservice daemon
```
> ./fioservice stop
```


## Removing the FIOLoadgen environment
The fiodeploy command provides a **-d** switch to handle the remove of the fio namespace
and all associated resources.


## Using the CLI command to manage tests

1. Show the current status of the fioservice
```
> ./fiocli status

Example output:

Target      : Kubernetes
Debug Mode  : No
Workers
  my-storageclass : 1
  standard        : 1
Job running : No
Jobs queued : 0
Uptime      : 2 days, 1:58:07

```

2. List available IO profiles you can test with
```
> ./fiocli profile --ls

Example output:
./fiocli profile --ls
- randr.job
- randrlimited.job
- randrw7030.job
- seqwrite.job

```
3. Show the parameters within a profile
```
> ./fiocli profile --show <profile-name>
```
4. Add a fio job profile to the fioservice database
```
> ./fiocli profile-add --name <profile-name> --file=<local_file>

Example output:
./fiocli profile-add --name new.job --file=/home/test/fioloadgen/newread.job
profile upload successful
```
5. Remove an fio job profile from the fioservice database
```
> ./fiocli profile-rm --name <profile-name>

Example output:
./fiocli profile-rm --name new.job
profile deleted
```
6. Run an fio job using a given profile
```
> ./fiocli run --profile <profile-name> --workers <int> --title <text>
```
7. List jobs stored in the database
```
> ./fiocli job --ls

Example output:
./fiocli job --ls
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
./fiocli db-dump [-h] [--table {jobs,profiles}] [--out OUT]

Example output:
./fiocli db-dump --table jobs --out myjobs.backup
database dump of table 'jobs' written to myjobs.backup
```
2. Export a specific job from the database
```
fiocli db-export [-h] [--table {jobs,profiles}] --row ROW [--out OUT]

Example output:
./fiocli db-export --table jobs --row id=91a2c232-1d36-4685-a94d-19ea6a253ae6
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
- [X] replace raw information of a profile with widgets to make it more accessible
- [X] use presets and custom
- [X] store the fio parameters used the jobs database record

