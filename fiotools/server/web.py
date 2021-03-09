#!/usr/bin/env python3

import cherrypy
from cherrypy.process import plugins
from cherrypy.lib.httputil import parse_query_string  # HTTPDate
from cherrypy.lib import static
from threading import Lock
import queue
import sys
import os
import json
import sqlite3
import uuid
import datetime
import time
# import glob
import tempfile

from ..utils import get_pid_file, rfile
from ..reports import latency_summary
from . import db
from fiotools import configuration

DEFAULT_DBPATH = os.path.join(os.path.expanduser('~'), 'fioservice.db')
# JOB_DIR = "./data/fio/jobs"

log = cherrypy.log
# logging.getLogger('cherrypy').propagate = False

job_active = False
work_queue = queue.Queue()
job_tracker = dict()  # job_id -> job object
job_tracker_lock = Lock()
active_job = None


# def fetch_all(dbpath, table, keys):
#     assert isinstance(keys, list)
#     if not keys:
#         return list()

#     data = list()
#     with sqlite3.connect(dbpath) as c:
#         c.row_factory = sqlite3.Row
#         csr = c.cursor()
#         fields = ",".join(keys)
#         csr.execute(""" SELECT {} FROM {};""".format(fields, table))

#     rows = csr.fetchall()
#     for row in rows:
#         data.append({k: row[k] for k in keys})

#     return data


# def fetch_row(dbpath, table, key=None, content=None):
#     response = dict()
#     if not key:
#         return response
#     available = [row[key] for row in fetch_all(dbpath, table, list([key]))]
#     if not content or content not in available:
#         return response
#     else:
#         query = "SELECT * FROM {} WHERE {} = ?;".format(table, key)
#         with sqlite3.connect(dbpath) as c:
#             c.row_factory = sqlite3.Row
#             csr = c.cursor()
#             csr.execute(query, (content,))
#             row = csr.fetchall()[0]

#         # convert the row object to a dict
#         response = {k: row[k] for k in row.keys()}
#         return response


# def update_job_status(dbpath, job_uuid, status):

#     with sqlite3.connect(dbpath) as c:
#         csr = c.cursor()
#         csr.execute(""" UPDATE jobs
#                         SET status = ?,
#                             started = ?
#                         WHERE
#                             id = ?;""", (status,
#                                          int(datetime.datetime.now().strftime("%s")),
#                                          job_uuid)
#                     )


# def prune_db(dbpath):
#     # remove records from the database that represent queued jobs
#     cherrypy.log("Pruning jobs still in a queued/started state from the database")
#     prune_query = "DELETE FROM jobs WHERE status = 'queued' OR status = 'started';"
#     with sqlite3.connect(dbpath) as c:
#         csr = c.cursor()
#         csr.execute(prune_query)


class AsyncJob(object):
    pass


# def setup_db(dbpath):

#     profiles_table = """ CREATE TABLE IF NOT EXISTS profiles (
#                             name text PRIMARY KEY,
#                             spec text,
#                             created integer,
#                             updated integer
#                             ); """
#     jobs_table = """ CREATE TABLE IF NOT EXISTS jobs (
#                         id text PRIMARY KEY,
#                         title text NOT NULL,
#                         profile text NOT NULL,
#                         workers integer NOT NULL,
#                         status text NOT NULL,
#                         started integer,
#                         ended integer,
#                         raw_json text,
#                         summary text,
#                         type text,
#                         raw_output text,
#                         provider text,
#                         platform text,
#                         FOREIGN KEY(profile) REFERENCES profiles (name)
#                         ); """

#     if not os.path.exists(dbpath):
#         print("Creating results database @ {}".format(dbpath))
#         with sqlite3.connect(dbpath) as c:
#             c.execute(profiles_table)
#             c.execute(jobs_table)
#     else:
#         print("Using existing database @ {}".format(dbpath))


# def valid_fio_profile(profile_spec):
#     # TODO validate the profile
#     # is valid fio syntax
#     # one workload, called workload
#     # uses /mnt
#     return True


# def load_db_profiles(jobdir=JOB_DIR, dbpath=DEFAULT_DBPATH, out='console'):

#     def message(msg_string, output=out):
#         if output == 'console':
#             print(msg_string)
#         else:
#             cherrypy.log(msg_string)

#     changes = {
#         "processed": [],
#         "new": [],
#         "deleted": [],
#         "changed": [],
#         "skipped": [],
#         "errors": [],
#     }

#     message("Refreshing job profiles, syncing the db versions with the local files in {}".format(jobdir), out)

#     profile_paths = glob.glob('{}/*'.format(jobdir))
#     fs_profile_names = [os.path.basename(p) for p in profile_paths]

#     with sqlite3.connect(dbpath) as c:
#         c.row_factory = sqlite3.Row
#         cursor = c.cursor()
#         for profile in profile_paths:
#             name = os.path.basename(profile)
#             changes['processed'].append(profile)
#             profile_spec = rfile(profile)

#             if not valid_fio_profile(profile_spec):
#                 changes['errors'].append(profile)
#                 message("profile '{}' is invalid, and can not be loaded".format(profile))
#                 continue

#             cursor.execute("SELECT * from profiles WHERE name=?;",
#                            (name,))
#             data = cursor.fetchone()
#             if data is None:
#                 message("- loading profile {}".format(name), out)
#                 changes['new'].append(profile)
#                 now = int(datetime.datetime.now().strftime("%s"))
#                 cursor.execute("INSERT INTO profiles VALUES (?,?,?,?);",
#                                 (name, profile_spec, now, now))  # NOQA
#             else:
#                 # if spec is the same - just skip it
#                 if data['spec'] == profile_spec:
#                     message("- skipping identical profile {}".format(name), out)
#                     changes['skipped'].append(profile)
#                 else:
#                     # if not, apply the filesystem copy to the database
#                     message("- refreshing profile '{}' in the db with filesystem copy".format(name), out)
#                     changes['changed'].append(profile)
#                     cursor.execute(""" UPDATE profiles
#                                             SET
#                                             spec=?,
#                                             updated=?
#                                             WHERE
#                                             name=?;""",
#                                    (profile_spec, int(datetime.datetime.now().strftime("%s")), name))

#         stored_profiles = [p['name'] for p in db.fetch_all(dbpath, 'profiles', list(['name']))]
#         # message("profiles in db are: {}".format(','.join(stored_profiles)))
#         for db_profile_name in stored_profiles:
#             if db_profile_name not in fs_profile_names:
#                 message('- deleting db profile {}'.format(db_profile_name))
#                 changes['deleted'].append(db_profile_name)
#                 # message("changes {}".format(json.dumps(changes)))
#                 cursor.execute(""" DELETE FROM profiles
#                                         WHERE name=?;""",
#                                (db_profile_name,))

#     return changes


# def delete_job(dbpath, uuid):
#     cherrypy.log("request to delete queued job {}".format(uuid))
#     sql = "DELETE FROM jobs WHERE id=?"
#     with sqlite3.connect(dbpath) as c:
#         csr = c.cursor()
#         csr.execute(sql, (uuid,))
#         c.commit()


def add_tracker(job):
    cherrypy.log("job {} added to the tracker".format(job.uuid))
    job_tracker_lock.acquire()
    job_tracker[job.uuid] = job
    job_tracker_lock.release()


def remove_tracker(job_uuid):
    cherrypy.log("job {} removed from the tracker".format(job_uuid))
    job_tracker_lock.acquire()
    del job_tracker[job_uuid]
    job_tracker_lock.release()


# def dump_table(dbpath=DEFAULT_DBPATH,
#                table_name='jobs',
#                query={}):
#     """ simple iterator function to dump specific row(s) from the job table """

#     with sqlite3.connect(dbpath) as conn:
#         csr = conn.cursor()
#         yield('BEGIN TRANSACTION;')

#         # sqlite_master table contains the SQL CREATE statements for the all the tables.
#         q = """
#         SELECT type, sql
#             FROM sqlite_master
#                 WHERE sql NOT NULL AND
#                 type == 'table' AND
#                 name == :table_name
#             """
#         schema_res = csr.execute(q, {'table_name': table_name})

#         # create the create table syntax (ignore the type value..just using it preserve output)
#         for _, sql in schema_res.fetchall():
#             # yield the create table syntax, if the request doesn't provide a query
#             if not query:
#                 yield('{};'.format(sql))

#             # fetch the column names of the table
#             res = csr.execute("PRAGMA table_info('{}')".format(table_name))
#             column_names = [str(table_info[1]) for table_info in res.fetchall()]

#             # Create the Insert statements to repopulate the table
#             q = "SELECT 'INSERT INTO \"{}\" VALUES(".format(table_name)
#             q += ",".join(["'||quote(" + col + ")||'" for col in column_names])
#             q += ")' FROM '{}'".format(table_name)

#             if query:
#                 # FIXME query assumes the value is a string...is this a problem?
#                 key_values = ["{}='{}'".format(k, query[k]) for k in query.keys()]
#                 q += " WHERE {}".format(','.join(key_values))

#             # Issue the query, then potentially filter to the desired row
#             query_res = csr.execute(q % {'tbl_name': table_name})
#             for row in query_res:
#                 yield("%s;" % row[0])

#         yield('COMMIT;')


@cherrypy.expose
class Root(object):
    pass


class APIroot(object):
    exposed = True

    # TODO add a get method to document the API
    def __init__(self, service_state, dbpath):
        self.job = Job(service_state, dbpath)  # handler)
        self.profile = Profile(service_state, dbpath)  # handler)
        self.status = Status(service_state)  # Web service metadata info
        self.db = DB(dbpath)  # db export/import handler


def jsonify_error(status, message, traceback, version):
    response = cherrypy.response
    response.headers['Content-Type'] = 'application/json'
    return json.dumps({'status': status, 'message': message})


def run_job(dbpath, handler, service_state):  #, debug_mode):

    # delay (secs) between a job end and the fetch function being executed
    # fetch_delay = 2

    if not work_queue.empty():

        if configuration.settings.mode == 'debug':
            return

        # not in debug mode, so we act on the content of the queue
        job = work_queue.get()
        if job.stale:
            remove_tracker(job.uuid)
            return

        service_state.task_active = True
        service_state.tasks_queued = work_queue.qsize()

        if job.type == 'startfio':
            cherrypy.log("job {} started processing".format(job.uuid))
            tf = tempfile.NamedTemporaryFile(delete=False)
            cherrypy.log("job {} fio job spec file created - {}".format(job.uuid, tf.name))
            job.status = 'prepare'
            db.update_job_status(job.uuid, job.status)
            with open(tf.name, 'w') as f:
                f.write('{}\n'.format(job.spec))
            cherrypy.log("job {} transferring spec to fiomgr pod".format(job.uuid))
            rc = handler.copy_file(tf.name, os.path.join(configuration.settings.job_dir, 'fioloadgen.job'))
            if rc != 0:

                cherrypy.log("job {} file copy failed : {}".format(job.uuid, rc))
                job.status = 'failed'
                db.update_job_status(job.uuid, job.status)
                remove_tracker(job.uuid)
                service_state.reset()
                return

            cherrypy.log("job {} file copy succcessful".format(job.uuid))
            # job spec transferred, so OK to continue
            job.status = 'started'
            service_state.active_job_type = 'FIO'
            db.update_job_status(job.uuid, job.status)

            cherrypy.log("job {} starting".format(job.uuid))
            run_job = handler.startfio('fioloadgen.job', job.workers, job.outfile)
            if run_job.returncode == 0:
                # on some systems, the time between job end and the fetch can return empty files
                # the delay makes the fetch more
                # cherrypy.log("job {} completed successfully, waiting {}s".format(job.uuid, fetch_delay))
                # time.sleep(fetch_delay)
                cherrypy.log("job {} fetching report data from file {}".format(job.uuid, job.outfile))
                fetchrc = handler.fetch_report(job.outfile)

                if fetchrc == 0:
                    cherrypy.log("job {} report size: {}bytes".format(job.uuid, os.stat('/tmp/{}'.format(job.outfile)).st_size))
                    cherrypy.log("job {} adding job results to db".format(job.uuid))
                    job_output = rfile('/tmp/{}'.format(job.outfile))

                    # ignore any errors in the json - present at the start
                    job_data = job_output[job_output.find('{', 0):]

                    try:
                        job_json = json.loads(job_data)
                    except json.decoder.JSONDecodeError:
                        cherrypy.log("job {} output file contained invalid JSON, unable to load".format(job.uuid))
                        job_status = 'incomplete'
                        summary = {
                            "clients": 0,
                            "total_iops": 0,
                            "read ms min/avg/max": "0.0/0.0/0.0",
                            "write ms min/avg/max": "0.0/0.0/0.0",
                        }
                    else:
                        job_status = 'complete'
                        summary = latency_summary(job_json)  # use default percentile

                    with sqlite3.connect(dbpath) as c:
                        csr = c.cursor()
                        csr.execute(""" UPDATE jobs
                                        SET status = ?,
                                            ended = ?,
                                            raw_json = ?,
                                            summary = ?
                                        WHERE
                                            id = ?;""", (job_status,
                                                         int(datetime.datetime.now().strftime("%s")),
                                                         job_data,
                                                         json.dumps(summary),
                                                         job.uuid)
                                    )
                    job.status = 'complete'
                    cherrypy.log("job {} processing successful".format(job.uuid))
            else:
                cherrypy.log("job {} failed with rc={}".format(job.uuid, run_job.returncode))
                job.status = 'failed'
                db.update_job_status(job.uuid, job.status)

            remove_tracker(job.uuid)

        else:
            cherrypy.log("WARNING: unknown job type requested - {} - ignoring".format(job.type))

        service_state.reset()


class Status(object):
    exposed = True

    def __init__(self, service_state):
        self.service_state = service_state

    @cherrypy.tools.json_out()
    def GET(self):
        # keep the data returned fast so it can be polled easily and quickly
        run_time = time.time() - self.service_state.start_time
        return {
            "data": {
                "target": self.service_state.target,
                "task_active": self.service_state.task_active,
                "tasks_queued": self.service_state.tasks_queued,
                "task_type": self.service_state.active_job_type,
                "run_time": run_time,
                "workers": self.service_state._handler.workers,
                "debug_mode": self.service_state.debug_mode,
            }
        }


# @cherrypy.expose
class Job(object):
    exposed = True

    def __init__(self, service_state, dbpath):
        self.service_state = service_state
        self.dbpath = dbpath

    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def GET(self, uuid=None, **params):
        qs = parse_query_string(cherrypy.request.query_string)
        # cherrypy.log(json.dumps(qs))
        if not qs or not qs.get('fields', None):
            fields = list(['id', 'status', 'title'])
        else:
            fields = qs['fields'].split(',')

        if uuid is None:
            return {"data": db.fetch_all('jobs', fields)}
        else:
            data = db.fetch_row('jobs', 'id', uuid)
            if data:
                return {"data": json.dumps(db.fetch_row('jobs', 'id', uuid))}
            else:
                raise cherrypy.HTTPError(404, "Invalid job id")

    # @cherrypy.tools.accept(media='application/json')
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def POST(self, profile, **params):
        # required payload
        required = ['title', 'provider', 'platform']

        js_in = cherrypy.request.json
        qs_in = parse_query_string(cherrypy.request.query_string)
        cherrypy.log("DEBUG: job request: {}".format(json.dumps(js_in)))

        parms = {**js_in, **qs_in}

        if not all([k in parms.keys() for k in required]):
            raise cherrypy.HTTPError(400, "missing fields in request")

        available_profiles = [p['name'] for p in db.fetch_all('profiles', list(['name']))]
        if profile not in available_profiles:
            # raise APIError(status=404, message="FIO workload profile '{}' not found in ./data/fio/jobs".format(profile))
            raise cherrypy.HTTPError(404, "profile not found")

        # if we have a jobspec passed to us, use that, otherwise read the spec from the profile in the db
        profile_spec = parms.get('spec', None)
        if not profile_spec:
            profile_spec = db.fetch_row('profiles', 'name', profile)['spec']

        job = AsyncJob()
        job.type = 'startfio'
        job.stale = False
        job.status = 'queued'
        job.uuid = str(uuid.uuid4())
        job.profile = profile
        job.spec = profile_spec
        job.outfile = '{}.{}'.format(job.uuid, profile)
        job.workers = parms.get('workers', 9999)  # FIX ME
        job.provider = parms.get('provider')
        job.platform = parms.get('platform')
        job.title = parms.get('title', '{} on {}'.format(profile, datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S")))

        with sqlite3.connect(self.dbpath) as c:
            csr = c.cursor()

            csr.execute(""" INSERT into jobs (id, title, profile, workers, status, type, provider, platform)
                              VALUES(?,?,?,?,?,?,?,?);""",
                        (job.uuid,
                         job.title,
                         profile,
                         job.workers,
                         job.status,
                         'fio',
                         job.provider,
                         job.platform,
                         ))

        # post request using a valid profile, place on the queue and in the tracker dict
        work_queue.put(job)
        add_tracker(job)
        cherrypy.log("job {} queued, for profile {}".format(job.uuid, profile))

        self.service_state.tasks_queued = work_queue.qsize()
        cherrypy.response.status = 202  # 202 = Accepted
        return {'data': {"message": "run requested, current work queue size {}".format(work_queue.qsize()),
                         "uuid": job.uuid}}

    @cherrypy.tools.json_out()
    def DELETE(self, uuid=None):
        if not uuid:
            raise cherrypy.HTTPError(400, "Request must provide a job id to act against")

        cherrypy.log("delete request for job {} received".format(uuid))
        if uuid in job_tracker.keys():
            job = job_tracker[uuid]
            if job.stale:
                cherrypy.log("delete requested, but job '{}' is already marked stale".format(uuid))
                raise cherrypy.HTTPError(400, "Job has already been marked for deletion")
            else:
                cherrypy.log("delete request marking queued job '{}' as stale".format(uuid))
                # mark the job as stale, so it's not processed
                job.stale = True

        # delete the job from the database

        err = db.delete_row('jobs', {"id": uuid})
        if err:
            cherrypy.log("delete request for job '{}' failed: {}".format(uuid, err))
            raise cherrypy.HTTPError(400, err)
        else:
            cherrypy.log("delete request for job '{}' successful".format(uuid))
            return {"data": {"msg": "job deleted from database"}}


# @cherrypy.tools.accept(media='application/json')
# @cherrypy.expose
class Profile(object):
    exposed = True

    def __init__(self, service_state, dbpath):
        self.service_state = service_state
        self.dbpath = dbpath

    @cherrypy.tools.json_out()
    def GET(self, profile=None, **params):
        qs = parse_query_string(cherrypy.request.query_string)
        # cherrypy.log(json.dumps(qs))

        if profile is None:
            response_data = {"data": db.fetch_all('profiles', list(['name']))}
            if qs.keys():
                refresh = qs.get('refresh', None)
                if refresh == 'true':
                    # need to refresh the profiles from the filesystem, before returning the profiles
                    summary = db.load_db_profiles(out='cherrypy')
                    # summary = db.load_db_profiles(JOB_DIR, dbpath=self.dbpath, out='cherrypy')
                    response_data['summary'] = summary
                else:
                    raise cherrypy.HTTPError(400, "profile endpoint only supports a refresh=true query string")

            return response_data
        else:
            return {"data": db.fetch_row('profiles', 'name', profile)['spec']}

    # def PUT(self):
    #     summary = load_db_profiles(dbpath=self.dbpath, out='cherrypy')

    #     if summary['new'] or summary['changed']:
    #         # TODO: need to sync the fiomgr pod with these changes
    #         # by submitting a background job
    #         pass

    #     return {"data": {"summary": summary}}


class DB(object):
    exposed = True

    def __init__(self, dbpath):
        self.dbpath = dbpath

    def GET(self, table='jobs', **params):
        # look at querystring to get the key/value
        qs = parse_query_string(cherrypy.request.query_string)
        # cherrypy.log(json.dumps(qs))

        tf = tempfile.NamedTemporaryFile(delete=False)
        cherrypy.log("export file created - {}".format(tf.name))

        with open(tf.name, 'w') as f:
            for line in db.dump_table(table_name=table, query=qs):
                f.write('{}\n'.format(line))

        return static.serve_file(
            tf.name,
            'text/plain',
            'attachment',
            os.path.basename(tf.name))

    @cherrypy.tools.json_out()
    def DELETE(self, table, **params):
        """ allow the caller to delete a database row """
        qstring = cherrypy.request.query_string
        qs = parse_query_string(qstring)
        if len(qs) != 1:
            raise cherrypy.HTTPError(400, "Invalid or missing query")

        if table == 'profiles' and not qs.get('name', None):
            raise cherrypy.HTTPError(400, "invalid key used for profiles table, must be name=")
        elif table == 'jobs' and not qs.get('id', None):
            raise cherrypy.HTTPError(400, "invalid key used for jobs table, must be id=")

        cherrypy.log("delete request for {}/{}".format(table, qstring))
        err = db.delete_row(table, qs)
        if err:
            cherrypy.log("delete request failed: {}".format(err))
            raise cherrypy.HTTPError(400, err)
        else:
            cherrypy.log("delete successful")
            return {"data": {"msg": "row successufully removed"}}

    @cherrypy.tools.json_out()
    @cherrypy.tools.json_in()
    def POST(self, table):  # **params):
        """ receive a record in script format to insert into the database """
        js_in = cherrypy.request.json

        # tf = tempfile.NamedTemporaryFile(delete=False)
        # cherrypy.log("sql script written to {}".format(tf.name))
        # with open(tf.name, 'w') as f:
        #     f.write(js_in['sql_script'])

        err = db.run_script(js_in['sql_script'])
        if err:
            raise cherrypy.HTTPError(500, "import script for '{}' table failed: {}".format(table, err))
        else:
            return {"data": {"msg": "import script successful"}}


def cors_handler():
    '''
    Handle both simple and complex CORS requests

    Add CORS headers to each response. If the request is a CORS preflight
    request swap out the default handler with a simple, single-purpose handler
    that verifies the request and provides a valid CORS response.
    '''
    req_head = cherrypy.request.headers
    resp_head = cherrypy.response.headers

    # Always set response headers necessary for 'simple' CORS.
    resp_head['Access-Control-Allow-Origin'] = req_head.get('Origin', '*')
    resp_head['Access-Control-Expose-Headers'] = 'GET, POST, DELETE'
    resp_head['Access-Control-Allow-Credentials'] = 'true'

    # Non-simple CORS preflight request; short-circuit the normal handler.
    if cherrypy.request.method == 'OPTIONS':
        ac_method = req_head.get('Access-Control-Request-Method', None)

        allowed_methods = ['GET', 'POST', 'DELETE']
        allowed_headers = [
               'Content-Type',
               'X-Auth-Token',
               'X-Requested-With',
        ]

        if ac_method and ac_method in allowed_methods:
            resp_head['Access-Control-Allow-Methods'] = ', '.join(allowed_methods)
            resp_head['Access-Control-Allow-Headers'] = ', '.join(allowed_headers)

            resp_head['Connection'] = 'keep-alive'
            resp_head['Access-Control-Max-Age'] = '3600'

        # CORS requests should short-circuit the other tools.
        cherrypy.response.body = ''.encode('utf8')
        cherrypy.response.status = 200
        cherrypy.serving.request.handler = None

        # Needed to avoid the auth_tool check.
        if cherrypy.request.config.get('tools.sessions.on', False):
            cherrypy.session['token'] = True
        return True


class ServiceStatus(object):
    def __init__(self, handler):  #, debug_mode):
        self._handler = handler
        self.target = self._handler._target
        self.task_active = False
        self.tasks_queued = 0
        self.active_job_type = None
        self.job_count = 0
        self.profile_count = 0
        self.start_time = time.time()
        self.debug_mode = True if configuration.settings.mode == 'debug' else False

    def reset(self):
        self.task_active = False
        self.active_job_type = 'N/A'


class FIOWebService(object):

    def __init__(self, handler=None, workdir=None):  #, debug_mode=False):
        self.handler = handler
        # self.debug_mode = debug_mode
        self.service_state = ServiceStatus(handler=handler)  #, debug_mode=configuration.settings.debug)
        # self.port = port
        self.root = Root()         # web UI
        self.dbpath = os.path.join(configuration.settings.db_dir, configuration.settings.db_name)
        self.root.api = APIroot(self.service_state, self.dbpath)  # API

        if workdir:
            self.workdir = workdir
        else:
            self.workdir = os.path.expanduser("~")

        self.worker = None  # long running worker thread - FIO JOBS
        self.conf = {
            'global': {
                'log.screen': False,
                'error_file': '',
                'access_file': '',
            },
            '/': {
                'request.show_tracebacks': False,
                'request.dispatch': cherrypy.dispatch.MethodDispatcher(),
                'tools.response_headers.on': True,
                'tools.staticdir.on': True,
                'tools.staticdir.dir': os.path.join(os.getcwd(), 'www'),
                'tools.staticdir.index': 'index.html',
                'tools.CORS.on': True,
            },
        }
        cherrypy.tools.CORS = cherrypy.Tool('before_handler', cors_handler)

        db.setup_db()  # self.dbpath)

        db.load_db_profiles()  # (JOB_DIR, dbpath=self.dbpath)

    def cleanup(self):
        # cancel the worker background thread based on current interval
        self.worker.cancel()

        # remove any jobs in a queued state during webservice shutdown
        cherrypy.log("Pruning jobs still in a queued/started state from the database")
        db.prune_db()

    @property
    def ready(self):

        # command missing
        if not self.handler._can_run:
            print("handler's can_run method returned False")
            return False

        # no external connection
        if not self.handler.has_connection:
            print("handler's has_connection method returned False")
            return False

        # no profiles in the db
        if not db.fetch_all('profiles', ['name']):
            print("handler reporting no profiles")
            return False

        # use the handler to determine the number of workers
        # rc = self.handler.num_workers()
        if self.handler.workers == 0:  # or rc != 0:
            print("handler not seeing any workers")
            return False

        return True

    def run(self):

        self.service_state.workers = self.handler.workers

        if configuration.settings.mode == 'dev':
            daemon = plugins.Daemonizer(
                cherrypy.engine,
                stdout=os.path.join(configuration.settings.log_dir, 'fioservice.access.log'),
                stderr=os.path.join(configuration.settings.log_dir, 'fioservice.log'),
                )

            daemon.subscribe()
        else:
            cherrypy.config.update({
                'log.screen': True,
                'log.access_file': os.path.join(configuration.settings.log_dir, 'fioservice.access.log'),
                'log.error_file': os.path.join(configuration.settings.log_dir, 'fioservice.log'),
            })

        cherrypy.log.error_log.propagate = False
        cherrypy.log.access_log.propagate = False
        cherrypy.server.socket_host = configuration.settings.ip_address
        cherrypy.tree.mount(self.root, config=self.conf)
        cherrypy.config.update({
            'engine.autoreload.on': False,
            'server.socket_host': configuration.settings.ip_address,
            'server.socket_port': configuration.settings.port,
            'error_page.default': jsonify_error,
            'tools.encode.encoding': 'utf-8',
            'cors.expose.on': True,
        })

        plugins.PIDFile(cherrypy.engine, get_pid_file(configuration.settings.pid_dir)).subscribe()
        plugins.SignalHandler(cherrypy.engine).subscribe()  # handle SIGTERM, SIGHUP etc

        self.worker = plugins.BackgroundTask(
            interval=1,
            function=run_job,
            args=[self.dbpath,
                  self.handler,
                  self.service_state,
            ]
        )
        cherrypy.engine.subscribe('stop', self.cleanup)

        try:
            cherrypy.engine.start()
        except Exception:
            sys.exit(1)
        else:
            self.worker.run()
            cherrypy.engine.block()


if __name__ == '__main__':

    svr = FIOWebService()
    svr.run()
