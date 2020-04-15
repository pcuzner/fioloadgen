import os
import socket


def rfile(file_path):
    with open(file_path, 'r') as f:
        data = f.read().strip()
    return data


def get_pid_file(prefix=None):
    if not prefix:
        prefix = os.path.expanduser('~')
    return os.path.join(prefix, 'fioservice.pid')


def port_in_use(port_num):
    """Detect whether a port is in use on the local machine - IPv4 only"""

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(('0.0.0.0', port_num))
    except OSError:
        return True
    else:
        return False
