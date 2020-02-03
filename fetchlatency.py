#!/usr/bin/env python3

import os
import sys
import json
import argparse
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)
sh = logging.StreamHandler(sys.stdout)
logger.addHandler(sh)


vars_list = [
    "read/iops",
    "read/clat_ns/percentile/95.000000",
    "write/iops",
    "write/clat_ns/percentile/95.000000",
]


def cmd_parser():
    parser = argparse.ArgumentParser(description="fetch latencies from fio output")
    parser.add_argument(
        '--debug',
        action='store_true',
        default=False,
        help="provide debug output during processing")
    parser.add_argument(
        '--file',
        type=str,
        required=True,
        help="filepath")
    parser.add_argument(
        '--format',
        choices=['csv', 'json'],
        default='csv',
        help='output format')
    parser.add_argument(
        '--outfile',
        type=str,
        required=False,
        help='output file name')

    return parser


def get_item(response, path):
    for item in path:
        response = response[item]
    return response


def dump(output):
    if args.format == 'csv':
        out = format_csv(output)
    elif args.format == 'json':
        out = format_json(output)
    logger.info("dumping to summary file")
    with open(args.out, 'w') as f:
        f.write(out)


def summarize(extracted):
    """print some quick summary stats"""
    logger.debug("starting summarization")
    num_clients = len(extracted)
    total_iops = 0
    total_read_lat = 0
    total_write_lat = 0
    for client in extracted:
        total_iops += float(client['read/iops']) + float(client['write/iops'])
        total_read_lat += float(client['read/clat_ns/percentile/95.000000'])
        total_write_lat += float(client['write/clat_ns/percentile/95.000000'])

    logger.info("Clients found       : {}".format(num_clients))
    logger.info("Aggregate IOPS      : {}".format(int(total_iops)))
    logger.info("AVG IOPS per client : {}".format(int(total_iops/num_clients)))
    logger.info("AVG Read Latency    : {:.2f}ms".format((total_read_lat / num_clients) / 1000000))
    logger.info("AVG Write Latency   : {:.2f}ms".format((total_write_lat / num_clients) / 1000000))


def format_json(output):
    logger.debug("creating json output")
    out = dict()
    out['data'] = output
    return json.dumps(out,indent=2)


def format_csv(output):
    logger.debug("creating csv output")
    headers = output[0].keys()
    csv = list()
    csv.append(','.join(headers))
    for data in output:
        out = []
        for k in data:
            out.append(data[k])
        csv.append(','.join(out))
    return '\n'.join(csv)


def main():
    logger.info("Starting..\n")
    if not os.path.exists(args.file):
        print("Error: file not found")
        return
    logger.debug("reading file")
    with open(args.file) as f:
        data = f.read()

    logger.debug("parsing json")
    try:
        fio_json = json.loads(data)
    except ValueError:
        print("Error: Invalid file format - must be json")
        sys.exit(4)

    if "client_stats" not in fio_json:
        print("Error: Invalid fio output - client stats are missing")
        sys.exit(8)
    client_stats = fio_json['client_stats']
    extract = list()
    for item in client_stats:
        if item['jobname'].lower() == 'all clients':
            continue
        hostname = item['hostname']
        logger.debug("- processing host {}".format(hostname))
        hostdata = {
            "hostname": hostname,
        }
        for v in vars_list:
            path = v.split('/')
            path_value = get_item(item, path)
            hostdata[v] = str(path_value)
            logger.debug("  {}: {}".format(v, path_value))
        extract.append(hostdata)

    summarize(extract)
    if args.outfile:
        dump(extract)
    logger.info("\nComplete")


if __name__ == '__main__':
    parser = cmd_parser()
    args = parser.parse_args()
    if args.debug:
        logger.setLevel(logging.DEBUG)
        logger.debug("setting debug on")
    main()
