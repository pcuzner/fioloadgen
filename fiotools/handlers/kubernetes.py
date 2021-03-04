#!/usr/bin/env python3

from .base import BaseHandler

# import shutil
import os
import shutil
import subprocess

from fiotools import configuration


class OpenshiftHandler(BaseHandler):

    _target = "Openshift"
    _cmd = 'oc'
    _connection_test = 'oc status'

    def __init__(self, mgr='fiomgr'):
        self.ns = configuration.settings.namespace
        self.mgr = mgr

    @property
    def usable(self):
        return True

    @property
    def workers(self):
        return self._get_workers()

    @property
    def _can_run(self):
        return shutil.which(self._cmd) is not None

    @property
    def has_connection(self):
        if self._can_run:
            r = subprocess.run(self._connection_test.split(' '), capture_output=True)
            return r.returncode == 0
        else:
            return False

    def _get_workers(self):
        o = subprocess.run(['oc', '-n', self.ns, 'get', 'pods', '--selector=app=fioloadgen', '--no-headers'],
                           capture_output=True)
        if o.returncode == 0:
            return len(o.stdout.decode('utf-8').strip().split('\n'))
        else:
            return 0

    def startfio(self, profile, workers, output):
        cmd = 'startfio'
        args = '-p {} -o {} -w {}'.format(profile, output, workers)
        oc_command = subprocess.run(['oc', '-n', self.ns, 'exec', self.mgr, '--', cmd, args])

        return oc_command

    def fetch_report(self, output):
        source_file = os.path.join('/reports/', output)
        target_file = os.path.join('/tmp/', output)
        o = subprocess.run(['oc', 'cp', '{}/{}:{}'.format(self.ns, self.mgr, source_file), target_file])
        # o = subprocess.run(['oc', '-n', self.ns, 'rsync', '{}:/reports/{}'.format(self.mgr, output), '/tmp/.'])
        return o.returncode

    def copy_file(self, local_file, remote_file, namespace='fio', pod_name='fiomgr'):
        o = subprocess.run(['oc', 'cp', local_file, '{}/{}:{}'.format(self.ns, self.mgr, remote_file)])
        return o.returncode

    def runcommand(self, command):
        pass


class KubernetesHandler(OpenshiftHandler):
    _target = "Kubernetes"
    _cmd = 'kubectl'
    _connection_test = 'kubectl status'
