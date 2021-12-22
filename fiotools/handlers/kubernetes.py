#!/usr/bin/env python3

from .base import BaseHandler

# import shutil
import os
import shutil
import subprocess

from fiotools import configuration
from typing import Dict

import logging
logger = logging.getLogger(__name__)


class OpenshiftCMDHandler(BaseHandler):

    _target = "Openshift"
    _cmd = 'oc'
    _connection_test = 'oc status'

    def __init__(self, mgr='fiomgr'):
        self.ns = configuration.settings.namespace
        self.mgr = mgr

    @property
    def usable(self) -> bool:
        return True

    @property
    def workers(self) -> Dict[str, int]:
        return self._get_workers()

    @property
    def _can_run(self) -> bool:
        return shutil.which(self._cmd) is not None

    @property
    def has_connection(self) -> bool:
        if self._can_run:
            r = subprocess.run(self._connection_test.split(' '), capture_output=True)
            return r.returncode == 0
        else:
            return False

    def _get_workers(self) -> Dict[str, int]:
        lookup = {}

        o = subprocess.run([
            self._cmd,
            '-n',
            'fio',
            'get',
            'pods',
            '--selector=app=fioloadgen',
            '-o=jsonpath="{range .items[*]}{.metadata.name}{\' \'}{.metadata.labels.storageclass}{\'\\n\'}{end}"'],
            capture_output=True)

        if o.returncode == 0:
            workers = o.stdout.decode('utf-8').strip('"').split('\n')
            for worker in workers:
                if worker:
                    pod_name, storageclass = worker.split()
                    if storageclass in lookup:
                        lookup[storageclass] += 1
                    else:
                        lookup[storageclass] = 1
        return lookup

    def startfio(self, profile, storageclass, workers, output):
        cmd = 'startfio'
        args = f"-p {profile} -s {storageclass} -o {output} -w {workers}"
        cmd_result = subprocess.run([self._cmd, '-n', self.ns, 'exec', self.mgr, '--', cmd, args])
        return cmd_result

    def fetch_report(self, output) -> int:
        source_file = os.path.join('/reports/', output)
        target_file = os.path.join('/tmp/', output)
        o = subprocess.run([self._cmd, 'cp', '{}/{}:{}'.format(self.ns, self.mgr, source_file), target_file])
        # o = subprocess.run(['oc', '-n', self.ns, 'rsync', '{}:/reports/{}'.format(self.mgr, output), '/tmp/.'])
        return o.returncode

    def copy_file(self, local_file, remote_file, namespace='fio', pod_name='fiomgr') -> int:
        o = subprocess.run([self._cmd, 'cp', local_file, '{}/{}:{}'.format(self.ns, self.mgr, remote_file)])
        return o.returncode

    def runcommand(self, command) -> None:
        pass

    def scale_workers(self, replica_count) -> int:
        raise NotImplementedError()
        # o = subprocess.run([self._cmd, '-n', self.ns, 'statefulsets', 'fioworker', '--replicas', replica_count])
        # return o.returncode

    def fio_valid(self, fiojob) -> bool:
        # don't check, just assume it's valid
        return True


class KubernetesCMDHandler(OpenshiftCMDHandler):
    _target = "Kubernetes"
    _cmd = 'kubectl'
    _connection_test = 'kubectl get ns'
