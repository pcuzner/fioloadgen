import os
import sys

from configparser import ConfigParser, ParsingError

# create a settings object

global settings


def init(mode='dev'):
    global settings

    settings = Config(mode)


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
            "db_dir": "/var/lib/fioloadgen",
            "log_dir": "/var/log/fioloadgen",
            "ssl": True,
            "port": 8080,
            "debug": False,
        },
        "dev": {
            "db_dir": os.path.expanduser('~'),
            "log_dir": os.path.expanduser('~'),
            "ssl": True,
            "port": 8080,
            "debug": False,
        }
    }

    _client_defaults = {}

    def __init__(self, mode='dev'):
        # establish defaults based on the mode
        self.run_mode = mode
        self.db_dir = Config._global_defaults[mode].get('db_dir')
        self.log_dir = Config._global_defaults[mode].get('db_dir')
        self.ssl = Config._global_defaults[mode].get('ssl')
        self.port = Config._global_defaults[mode].get('port')
        self.debug = Config._global_defaults[mode].get('debug')

        self._apply_overrides()

    def _apply_overrides(self):

        def converted_value(value):
            bool_types = {
                "TRUE": True,
                "FALSE": False,
            }

            if value.isdigit():
                value = int(value)
            elif value.upper() in bool_types:
                value = bool_types[value.upper()]

            return value

        # define a list of valid vars
        valid_sections = ['global']
        global_vars = set()
        global_vars.update(Config._global_defaults['prod'].keys())
        global_vars.update(Config._global_defaults['dev'].keys())

        # Parse the any config files that are accessible
        parser = ConfigParser()
        try:
            config = parser.read(Config._config_dir_list[self.run_mode])
        except ParsingError:
            print("invalid ini file format, unable to parse")
            sys.exit(12)

        if config:
            sections = config.sections()
            if not sections or not all(s in valid_sections for s in sections):
                print("config file has missing/unsupported sections")
                print("valid sections are: {}".format(','.join(valid_sections)))
                sys.exit(12)

            # Apply the overrides
            for section_name in sections:
                if section_name == 'global':
                    for name, value in config.items(section_name):
                        if name in global_vars:
                            print("applying override for {}".format(name))
                            setattr(self, name, converted_value(value))
                        else:
                            print("-> {} is unsupported, ignoring")
        else:
            print("no configuration overrides, using defaults")
