# import logging
import shutil
import subprocess


class BaseHandler(object):

    _target = "Base"
    _cmd = 'missing'
    _connection_test = 'missing command'

    @property
    def _can_run(self):
        return shutil.which(self._cmd) is not None

    @property
    def has_connection(self):
        if self._can_run:
            r = subprocess.run(self._connection_test.split(' '),
                               stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT)
            return r.returncode == 0
        else:
            return False

    def check(self):
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
