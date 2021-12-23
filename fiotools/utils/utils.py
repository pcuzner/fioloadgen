import os
import socket
from typing import Dict, Any


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


def generate_fio_profile(spec: Dict[str, Any]) -> str:
    global_section = """
[global]
refill_buffers
size=5g
directory=/mnt
direct=1
time_based=1
ioengine=libaio
group_reporting
"""
    workload_section = f"""
[workload]
blocksize={spec['ioBlockSize']}
runtime={spec['runTime']}
iodepth={spec['ioDepth']}
numjobs=1
"""
    if spec['ioType'].lower() == 'random':
        if spec['ioPattern'] == 0:
            # 100% random read
            workload_section += "rw=randread\n"
        elif spec['ioPattern'] == 100:
            # 100% random write
            workload_section += "rw=randwrite\n"
        else:
            # mixed random
            workload_section += "rw=randrw\n"
            workload_section += f"rwmixwrite={spec['ioPattern']}\n"
    else:
        # sequential workloads
        if spec['ioPattern'] == 0:
            # 100% seqential read
            workload_section += "rw=read\n"
        elif spec['ioPattern'] == 100:
            # 100% seqential writes
            workload_section += "rw=write\n"
        else:
            # mixed sequential
            workload_section += "rw=readwrite\n"
            workload_section += f"rwmixwrite={spec['ioPattern']}\n"

    return global_section + workload_section
