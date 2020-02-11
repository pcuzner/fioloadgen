#!/usr/bin/env python3
import sys
import argparse
import requests
import datetime
import json
import time


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
    parser_profile.add_argument(
        '--refresh',
        action='store_true',
        help="apply fio profiles in data/fio/jobs to the local database and the remote fiomgr pod",
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
        default=9999,
        required=False,
        help="number of workers to use for the profile",
    )
    parser_run.add_argument(
        '--provider',
        required=False,
        default='aws',
        type=str,
        choices=['aws', 'vmware', 'baremetal', 'azure', 'gcp'],
        help="Infrastructure provider where the test is running",
    )
    parser_run.add_argument(
        '--platform',
        required=False,
        default='openshift',
        type=str,
        choices=['openshift', 'kubernetes', 'ssh'],
        help="platform running the workload",
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
    elif args.refresh:
        # refresh the profiles from the local filesystem
        r = requests.put("{}/profile".format(url))
        if r.status_code == 200:
            print("Profiles refreshed from the filesystem versions")
            summary = r.json()['data']['summary']
            for k in summary:
                print(" - {:<11s}: {:>2}".format(k, len(summary[k])))
        else:
            print("Profile refresh failed")


def show_summary(api_response):
    keys_to_show = ['id', 'title', 'started', 'profile', 'workers', 'status']  # NOQA
    data = json.loads(api_response.json()['data'])
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


def job_wait(job_uuid):
    while True:
        r = requests.get("{}/job/{}".format(url, job_uuid))
        if r.status_code != 200:
            break
        js = json.loads(r.json()['data'])
        if js['status'] in ['complete', 'failed']:
            break
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(2)
    print("\n")
    return r


def command_run():
    print("Run fio workload profile {}".format(args.profile))
    headers = {'Content-type': 'application/json'}
    r = requests.post('{}/job/{}'.format(url, args.profile),
                      json={
                          "workers": args.workers,
                          "title": args.title,
                          "provider": args.provider,
                          "platform": args.platform
                      },
                      headers=headers)

    if r.status_code == 200:
        response = r.json()['data']
        print("- Request queued with uuid = {}".format(response['uuid']))
        if args.wait:
            print("Running.", end="")
            completion = job_wait(response['uuid'])
            if completion.status_code == 200:
                show_summary(completion)
            else:
                print("- Request failed with status code {}".format(completion.status_code))
    else:
        print("- Request failed")


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
        r = requests.get("{}/job/{}".format(url, args.show))
        if r.status_code == 200:
            show_summary(r)
            if args.raw:
                jstr = json.loads(r.json()['data'])['raw_json']
                js = json.loads(jstr)
                try:
                    print(json.dumps(js, indent=2))
                except BrokenPipeError:
                    pass
        elif r.status_code == 404:
            print("Job with id '{}', does not exist in the database".format(args.show))
        else:
            print("Unknown status returned : {}".format(r.status_code))
    elif args.raw:
        print("Syntax error: the --raw parameter can only be used with --show <job id>")


if __name__ == '__main__':
    json_headers = {'Content-type': 'application/json'}
    url = 'http://localhost:8080/api'
    try:
        r = requests.get('http://localhost:8080/api/profile')
    except (requests.exceptions.ConnectionError, ConnectionRefusedError):
        print("Please start the fioservice, before using the cli")
        sys.exit(1)
    
    profiles = [p['name'] for p in r.json()['data']]

    parser = cmd_parser()
    args = parser.parse_args()

    if 'func' in args:
        args.func()
    else:
        print("skipped")
