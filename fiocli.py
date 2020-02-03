#!/usr/bin/env python3

import argparse
import requests
import datetime
import json


def cmd_parser():
    parser = argparse.ArgumentParser(
        description='Interact with the fio web service',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    subparsers = parser.add_subparsers(help="sub-command")

    parser_profile = subparsers.add_parser(
        'profile',
        help='view and manage the fio profiles')
    parser_profile.set_defaults(func=command_profile)
    parser_profile.add_argument(
        '--show',
        type=str,
        choices=profiles,
        help="show content of an fio profile",
    )
    parser_profile.add_argument(
        '--ls',
        action='store_true',
        help="list available fio profiles",
    )

    parser_run = subparsers.add_parser(
        'run',
        help="run a given fio profile")
    parser_run.set_defaults(func=command_run)
    parser_run.add_argument(
        '--profile',
        required=True,
        help="fio profile for the fio workers to execute against",
    )
    parser_run.add_argument(
        '--workers',
        required=False,
        help="number of workers to use for the profile",
    )
    parser_run.add_argument(
        '--title',
        required=True,
        type=str,
        help="title of the run (metadata)",
    )
    parser_run.add_argument(
        '--wait',
        action='store_true',
        help="wait for the run to complete - NOT IMPLEMENTED YET",
    )

    parser_job = subparsers.add_parser(
        'job',
        help="show fio job information")
    parser_job.set_defaults(func=command_job)
    parser_job.add_argument(
        '--ls',
        action="store_true",
        help="list jobs",
    )
    parser_job.add_argument(
        '--show',
        type=str,
        help="show content of an job",
    )
    parser_job.add_argument(
        '--raw',
        action='store_true',
        help="show raw json from the run",
    )
    return parser


def command_profile():
    if args.ls:
        r = requests.get("{}/profile".format(url))
        data = r.json()['data']
        for p in data:
            print("- {}".format(p['name']))
    elif args.show:
        r = requests.get("{}/profile/{}".format(url, args.show))
        data = r.json()['data']
        print(data)


def command_run():
    print("run fio workload profile {}".format(args.profile))
    headers = {'Content-type': 'application/json'}
    r = requests.post('{}/job/{}'.format(url, args.profile),
                      json={"workers": args.workers, "title": args.title},
                      headers=headers)
    print(json.dumps(r.json()))
    print(r.status_code)
    if r.status_code == 200:
        print("run request queued")
        if args.wait:
            print("should wait for completion")
    else:
        print("run request failed")


def command_job():
    if args.ls:
        r = requests.get("{}/job?fields=id,status,title".format(url))
        data = r.json()['data']
        for p in data:
            print("")
            for k in p:
                print("{}: {}".format(k, p[k]))
    elif args.show:
        # show a specific job record
        keys_to_show = ['id', 'title', 'started', 'profile', 'workers', 'status']  # NOQA
        r = requests.get("{}/job/{}".format(url, args.show))
        data = json.loads(r.json()['data'])
        for k in keys_to_show:
            if k == 'started':
                print("Run Date: {}".format(datetime.datetime.fromtimestamp(data[k]).strftime('%Y-%m-%d %H:%M:%S')))  # NOQA
            else:
                print("{}: {}".format(k.title(), data[k]))
        if data.get('summary', None):
            print("Summary:")
            js = json.loads(data['summary'])
            for k in js.keys():
                print("  {}: {}".format(k.title(), js[k]))
        else:
            print("Summary: Unavailable (missing)")
        if args.raw:
            js = json.loads(data['raw_json'])
            print(json.dumps(js, indent=2))


if __name__ == '__main__':
    json_headers = {'Content-type': 'application/json'}
    url = 'http://localhost:8080/api'
    r = requests.get('http://localhost:8080/api/profile')
    profiles = [p['name'] for p in r.json()['data']]

    parser = cmd_parser()
    args = parser.parse_args()

    if 'func' in args:
        args.func()
    else:
        print("skipped")
