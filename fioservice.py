#!/usr/bin/env python3

import os
import sys
# import time
# import daemon
# import daemon.pidfile
import signal
import argparse

from fiotools import __version__
from fiotools.server import FIOWebService
from fiotools.handlers import (  # NOQA: F401
    OpenshiftHandler,
    SSHHandler,
    LocalFIOHandler
)

from fiotools.utils import rfile, get_pid_file, port_in_use
import fiotools.configuration as configuration

# settings.init()
# import logging

DEFAULT_DIR = os.path.expanduser('~')
DEFAULT_NAMESPACE = 'fio'


def cmd_parser():
    parser = argparse.ArgumentParser(
        description='Manage the fio web service daemon',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        '--version',
        action='store_true',
        default=False,
        help="Show fioloadgen version"
    )
    parser.add_argument(
        '--mode',
        type=str,
        help="mode to run the service"
    )

    subparsers = parser.add_subparsers(help="sub-command")

    parser_start = subparsers.add_parser(
        'start',
        help="start the FIO web service")
    parser_start.set_defaults(func=command_start)
    parser_start.add_argument(
        '--type',
        required=False,
        choices=['oc', 'local', 'kube'],
        help="type of fioservice target",
    )
    parser_start.add_argument(
        '--namespace',
        required=False,
        type=str,
        help="Namespace for Openshift based tests",
    )
    parser_start.add_argument(
        '--debug',
        action='store_true',
        help="run standalone without a connection to help debug",
    )

    parser_stop = subparsers.add_parser(
        'stop',
        help="stop the FIO service")
    parser_stop.set_defaults(func=command_stop)

    parser_stop = subparsers.add_parser(
        'restart',
        help="restart the service")
    parser_stop.set_defaults(func=command_restart)
    parser_status = subparsers.add_parser(
        'status',
        help="show current state of the FIO service")
    parser_status.set_defaults(func=command_status)

    return parser


def pid_exists(pidfile):
    return os.path.exists(pidfile)


def command_status():
    pidfile = get_pid_file()

    if os.path.exists(pidfile):
        print("PID file : {}".format(pidfile))
        pid = rfile(pidfile)
        print("PID : {}".format(pid))
        if os.path.exists('/proc/{}'.format(pid)):
            state = "running"
        else:
            state = "not running"
        print("State : {}".format(state))
    else:
        print("Not running")
        return


def command_restart():
    pidfile = get_pid_file()
    if pid_exists(pidfile):
        command_stop()
        command_start()
    else:
        print("service not running")


def command_start():
    if not os.path.isdir(DEFAULT_DIR):
        os.makedirs(DEFAULT_DIR)

    if os.path.exists(get_pid_file()):
        raise OSError("Already running")

    configuration.init(args)

    if configuration.settings.type == 'oc':
        print("Using 'oc' command handler")
        handler = OpenshiftHandler(mgr='fiomgr')
    elif configuration.settings.type == 'local':
        print("Using 'local' fio handler")
        handler = LocalFIOHandler()  # ns=args.namespace)
    else:
        print("'{}' handler has not been implemented yet".format(configuration.settings.type))
        sys.exit(1)

    if not handler.has_connection:
        print("Handler is not usable: environment or configuration problem")
        sys.exit(1)

    print("Checking port {} is free".format(configuration.settings.port))
    if port_in_use(configuration.settings.port):
        print("-> port in use")
        sys.exit(1)

    server = FIOWebService(handler=handler)  #, debug_mode=args.debug_only)
    print("Checking connection to {}".format(handler._target))
    if server.ready or configuration.settings.debug:
        print("Starting the engine")
        # Call the run handler to start the web service
        server.run()
    else:
        print("{} connection unavailable, or workers not ready".format(handler._target))

    # NB. run() forks the daemon, so anything here is never reached


def command_stop():
    pidfile = get_pid_file()
    if not os.path.exists(pidfile):
        print("nothing to do")
        return

    with open(pidfile) as p:
        pid = p.read().strip()
    try:
        os.kill(int(pid), signal.SIGTERM)
    except Exception:
        print("kill for {} caused an exception")
        raise
    else:
        print("engine stopped")


if __name__ == '__main__':
    parser = cmd_parser()
    args = parser.parse_args()
    if args.version:
        print('fioloadgen version: {}'.format(__version__))
    elif 'func' in args:
        args.func()
    else:
        print("Unknown option(s) provided - try -h to show available options")
