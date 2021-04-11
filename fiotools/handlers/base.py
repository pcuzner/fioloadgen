# import logging
import shutil
import subprocess


class BaseHandler(object):

    _target = "Base"
    _cmd = 'missing'
    _connection_test = 'missing'

    @property
    def _can_run(self) -> bool:
        return shutil.which(self._cmd) is not None

    @property
    def has_connection(self) -> bool:
        return False

    def check(self) -> bool:
        """check the stored config against the target environment"""
        # can we pick up where we left off?
        return True

    def ls(self):
        """list the workers"""
        raise NotImplementedError

    def fetch(self):
        """fetch a file"""
        raise NotImplementedError

    def store(self):
        """send a file to an fio server target"""
        raise NotImplementedError

    def create(self):
        """Deploy an fio engine"""
        raise NotImplementedError

    def delete(self):
        """delete an fio server instance"""
        raise NotImplementedError

    def command(self):
        """Issue command on remote"""
        raise NotImplementedError

    def config(self):
        """fetch ceph config"""
        raise NotImplementedError

    def execute(self):
        """run fio workload"""
        raise NotImplementedError

    def reset(self):
        """reset the engines state to teardown the test environment"""
        raise NotImplementedError

    def fio_valid(self, fiojob):
        """check whether an fiojob 'deck' syntax is valid"""
        raise NotImplementedError

    def startfio(self, profile, workers, output):
        return None

    def fetch_report(self, output) -> int:
        return 0

    def copy_file(self, local_file, remote_file, namespace='fio', pod_name='fiomgr'):
        return 0

    def scale_workers(self, replica_count):
        raise NotImplementedError