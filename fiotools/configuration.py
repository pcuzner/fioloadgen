import os
import sys
import shutil
from typing import Optional

from configparser import ConfigParser, ParsingError

import logging
logger = logging.getLogger(__name__)

global settings

cmd_lookup = {
    "oc": "Openshift",
    "kubectl": "kubernetes"
}


def init(args=None):
    global settings

    settings = Config(args)


def convert_value(value):
    bool_types = {
        "TRUE": True,
        "FALSE": False,
    }

    if value.isdigit():
        value = int(value)
    elif value.upper() in bool_types:
        value = bool_types[value.upper()]

    return value


def cmd_handler() -> Optional[str]:
    if shutil.which('oc'):
        return 'oc'
    elif shutil.which('kubectl'):
        return 'kubectl'
    else:
        return None


class Config(object):

    _config_dir_list = {
        "prod": [
            "/etc/fioloadgen/fioservice.ini",
            os.path.join(os.path.expanduser('~'), 'fioservice.ini'),
        ],
        "dev": [
            os.path.join(os.path.expanduser('~'), 'fioservice.ini'),
        ],
        "debug": [
            os.path.join(os.path.expanduser('~'), 'fioservice.ini'),
        ]
    }

    _global_defaults = {
        "prod": {
            "db_name": "fioservice.db",
            "db_dir": "/var/lib/fioloadgen",
            "job_dir": "/var/lib/fioloadgen/jobs",
            "job_src": "/var/lib/fioloadgen/jobs",
            "log_dir": "/var/log/fioloadgen",
            "pid_dir": "/var/run/fioloadgen",
            "ssl": False,
            "ip_address": "0.0.0.0",
            "port": 8080,
            "debug": False,
            "runtime": "package",
            "namespace": "fio",
            "type": "native",
            "environment": ""
        },
        "dev": {
            "db_name": "fioservice.db",
            "db_dir": os.path.expanduser('~'),
            "job_dir": os.path.join("fio", "jobs"),
            "job_src": os.path.join(os.getcwd(), "data", "fio", "jobs"),
            "log_dir": os.path.expanduser('~'),
            "pid_dir": os.path.expanduser('~'),
            "ssl": False,
            "ip_address": "0.0.0.0",
            "port": 8080,
            "debug": False,
            "runtime": "package",
            "namespace": "fio",
            "type": cmd_handler(),
            "environment": ""
        }
    }

    _global_defaults.update({"debug": _global_defaults['dev']})

    _client_defaults = {}

    def __init__(self, args=None):

        if os.getenv('MODE'):
            logger.debug("setting mode from environment variable")
            # print("setting mode from environment variable")
            mode = os.getenv('MODE')
        elif args.mode:
            logger.debug("settings mode from args")
            # print("settings mode from args")
            mode = args.mode
        else:
            logger.debug("using default mode of dev")
            # print("using default mode of dev")
            mode = 'dev'

        # establish defaults based on the mode
        self.mode = mode
        self.db_name = Config._global_defaults[mode].get('db_name')
        self.db_dir = Config._global_defaults[mode].get('db_dir')
        self.log_dir = Config._global_defaults[mode].get('log_dir')
        self.pid_dir = Config._global_defaults[mode].get('pid_dir')
        self.ssl = Config._global_defaults[mode].get('ssl')
        self.port = Config._global_defaults[mode].get('port')
        # self.debug = Config._global_defaults[mode].get('debug')
        self.job_dir = Config._global_defaults[mode].get('job_dir')
        self.job_src = Config._global_defaults[mode].get('job_src')
        self.ip_address = Config._global_defaults[mode].get('ip_address')
        self.runtime = Config._global_defaults[mode].get('runtime')
        self.namespace = Config._global_defaults[mode].get('namespace')
        self.type = Config._global_defaults[mode].get('type')
        self.environment = cmd_lookup.get(self.type, "Unknown")

        self._apply_file_overrides()
        self._apply_env_vars()
        self._apply_args(args)

        logger.debug(str(self))

    @property
    def dbpath(self):
        return os.path.join(self.db_dir, 'fioservice.db')

    def _apply_args(self, args):
        if not args:
            return

        for k in args.__dict__.keys():
            if hasattr(self, k):
                v = getattr(args, k)
                if v is not None:
                    logger.debug("Applying runtime override : {} = {}".format(k, v))
                    setattr(self, k, v)

    def _apply_env_vars(self):
        # we'll assume the env vars are all upper case by convention
        vars = [v.upper() for v in self.__dict__]
        for v in vars:
            env_setting = os.getenv(v)
            if env_setting:
                logger.debug("Using env setting {} = {}".format(v, convert_value(env_setting)))
                setattr(self, v.lower(), convert_value(env_setting))

    def _apply_file_overrides(self):

        # define a list of valid vars
        valid_sections = ['global']
        global_vars = set()
        global_vars.update(Config._global_defaults['prod'].keys())
        global_vars.update(Config._global_defaults['dev'].keys())

        # Parse the any config files that are accessible
        parser = ConfigParser()
        try:
            config = parser.read(Config._config_dir_list[self.mode])
        except ParsingError:
            logger.error("invalid ini file format, unable to parse")
            sys.exit(12)

        if config:
            sections = parser.sections()
            if not sections or not all(s in valid_sections for s in sections):
                logger.error("config file has missing/unsupported sections")
                logger.error("valid sections are: {}".format(','.join(valid_sections)))
                sys.exit(12)

            # Apply the overrides
            for section_name in sections:
                if section_name == 'global':
                    for name, value in parser.items(section_name):
                        if name in global_vars:
                            logger.debug("[CONFIG] applying override: {}={}".format(name, value))
                            setattr(self, name, convert_value(value))
                        else:
                            logger.warning("-> {} is unsupported, ignoring")
        else:
            logger.debug("No configuration overrides from local files")

    def __str__(self):
        s = ''
        vars = self.__dict__
        for k in vars:
            s += "{} = {}\n".format(k, vars[k])
        return s
