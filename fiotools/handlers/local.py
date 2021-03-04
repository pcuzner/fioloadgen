#!/usr/bin/env python3
import os
import subprocess
import shutil
import tempfile

from .base import BaseHandler
from fiotools import configuration

try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    from kubernetes.config.config_exception import ConfigException
except ImportError:
    kubernetes_imported = False
    client = None
    config = None
else:
    kubernetes_imported = True


class LocalFIOHandler(BaseHandler):
    _target = "Openshift"

    def __init__(self):  # , namespace):
        self.namespace = configuration.settings.namespace
        self.job_dir = configuration.settings.job_dir
        self.reports = os.path.join(configuration.settings.db_dir, 'reports')
        self.replicaset = None

        if kubernetes_imported:
            try:
                config.load_incluster_config()
            except ConfigException:
                self.k8s = None
                self.beta = None
            else:
                self.k8s = client.CoreV1Api()
                self.beta = client.ExtensionsV1beta1Api()
            # self.init()
        else:
            self.k8s = None
            self.beta = None

    # def init(self):
    #     # determine the replicaset name for the workers
    #     pass

    @property
    def _can_run(self):
        return kubernetes_imported is True

    @property
    def has_connection(self):
        return self.k8s is not None

    def fio_valid(self, fiojob):
        """run fio in parse-only mode to syntax check the job file"""

        tf = tempfile.NamedTemporaryFile(delete=False)
        with open(tf.name, 'w') as t:
            t.write(fiojob)

        result = subprocess.run(['fio', '--parse-only', tf.name])
        return result.returncode

    def _list_namespaced_pod(self):
        try:
            response = self.k8s.list_namespaced_pod(self.namespace, label_selector='app=fioloadgen')
        except ApiException:
            return None
        else:
            return response

    @property
    def workers(self):
        return len(self._list_namespaced_pod().items)

    def num_workers(self):
        """determine the number of workers"""
        # get pods that have an app=fioworker set
        return len(self._list_namespaced_pod().items)

    def fetch_pods(self):
        response = self._list_namespaced_pod()
        return response.items

    # def whoknows(self):
    #     pods = self.fetch_pods()
    #     for pod in pods:
    #         name = pod.metadata.name
    #         host_ip = pod.status.host_ip
    #         pod_ip = pod.status.pod_ip

    def startfio(self, profile, workers, output):
        """start an fio run"""
        pods = self.fetch_pods()
        working_set = pods[0:workers]
        tf = tempfile.NamedTemporaryFile(delete=False)
        with open(tf.name, 'w') as t:
            for pod in working_set:
                t.write("{}\n".format(pod.status.pod_ip))

        result = subprocess.run(['fio',
                                 '--client={}'.format(tf.name),
                                 os.path.join(self.job_dir, profile),
                                 '--output-format=json',
                                 '--output={}'.format(os.path.join(self.reports, output))]
                                )
        return result

    def fetch_report(self, output):
        """ retrieve report"""
        report = os.path.join(self.reports, output)
        try:
            shutil.copyfile(report, os.path.join('/tmp', output))
        except Exception:
            return 4
        else:
            return 0

    def copy_file(self, local_file, remote_file, namespace='fio', pod_name='fiomgr'):
        """copy file"""
        try:
            shutil.copy2(local_file, remote_file)
        except Exception:
            return 4
        else:
            return 0

    def scale_workers(self, new_worker_count):
        # beta=client.ExtensionsV1beta1Api()
        # d=beta.list_namespaced_deployment('fio', label_selector='app=fioworker')
        patch = {
            "spec": {
                "replicas": new_worker_count,
            },
        }
        self.beta.patch_namespaced_deployment('fioworker', self.namespace, body=patch)
