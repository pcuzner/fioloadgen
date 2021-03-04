import os
import sys

from configparser import ConfigParser, ParsingError

# create a settings object

# TODO
# settings fron env vars coming too late, and not resetting all the variables, so dev taking precedence
# if env says mode, use it first
# else if args say mode
# else default to 'dev'

global settings


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


class Config(object):

    _config_dir_list = {
        "prod": [
            "/etc/fioloadgen/fioservice.ini",
            os.path.join(os.path.expanduser('~'), 'fioservice.ini'),
        ],
        "dev": [
            os.path.join(os.path.expanduser('~'), 'fioservice.ini'),
        ]
    }

    _global_defaults = {
        "prod": {
            "db_name": "fioservice.db",
            "db_dir": "/var/lib/fioloadgen",
            "job_dir": "/var/lib/fioloadgen/jobs",
            "log_dir": "/var/log/fioloadgen",
            "pid_dir": "/var/run/fioloadgen",
            "ssl": False,
            "ip_address": "0.0.0.0",
            "port": 8080,
            "debug": False,
            "runtime": "package",
            "namespace": "fio",
            "type": "local",
        },
        "dev": {
            "db_name": "fioservice.db",
            "db_dir": os.path.expanduser('~'),
            "job_dir": os.path.join(os.getcwd(), "data", "fio", "jobs"),
            "log_dir": os.path.expanduser('~'),
            "pid_dir": os.path.expanduser('~'),
            "ssl": False,
            "ip_address": "0.0.0.0",
            "port": 8080,
            "debug": False,
            "runtime": "package",
            "namespace": "fio",
            "type": "oc",
        }
    }

    _client_defaults = {}

    def __init__(self, args=None):

        if os.getenv('MODE'):
            print("setting mode from environment variable")
            mode = os.getenv('MODE')
        elif args:
            if args.mode:
                print("settings mode from args")
                mode = args.mode
        else:
            print("using default mode of dev")
            mode = 'dev'

        # establish defaults based on the mode
        self.mode = mode
        self.db_name = Config._global_defaults[mode].get('db_name')
        self.db_dir = Config._global_defaults[mode].get('db_dir')
        self.log_dir = Config._global_defaults[mode].get('log_dir')
        self.pid_dir = Config._global_defaults[mode].get('pid_dir')
        self.ssl = Config._global_defaults[mode].get('ssl')
        self.port = Config._global_defaults[mode].get('port')
        self.debug = Config._global_defaults[mode].get('debug')
        self.job_dir = Config._global_defaults[mode].get('job_dir')
        self.ip_address = Config._global_defaults[mode].get('ip_address')
        self.runtime = Config._global_defaults[mode].get('runtime')
        self.namespace = Config._global_defaults[mode].get('namespace')
        self.type = Config._global_defaults[mode].get('type')

        self._apply_file_overrides()
        self._apply_env_vars()
        self._apply_args(args)

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
                    print("applying runtime override for {} of {}".format(k, v))
                    setattr(self, k, v)

    def _apply_env_vars(self):
        # we'll assume the env vars are all upper case by convention
        vars = [v.upper() for v in self.__dict__]
        for v in vars:
            env_setting = os.getenv(v)
            if env_setting:
                print("using env setting {} = {}".format(v, convert_value(env_setting)))
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
            print("invalid ini file format, unable to parse")
            sys.exit(12)

        if config:
            sections = parser.sections()
            if not sections or not all(s in valid_sections for s in sections):
                print("config file has missing/unsupported sections")
                print("valid sections are: {}".format(','.join(valid_sections)))
                sys.exit(12)

            # Apply the overrides
            for section_name in sections:
                if section_name == 'global':
                    for name, value in parser.items(section_name):
                        if name in global_vars:
                            print("[CONFIG] applying override: {}={}".format(name, value))
                            setattr(self, name, convert_value(value))
                        else:
                            print("-> {} is unsupported, ignoring")
        else:
            print("no configuration overrides from local files")

    def __str__(self):
        s = ''
        vars = self.__dict__
        for k in vars:
            s += "{} = {}\n".format(k, vars[k])
        return s
