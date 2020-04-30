import os
import glob
import sqlite3
import datetime

from ..utils import rfile
import logging
logger = logging.getLogger("cherrypy.error")


def setup_db(dbpath):

    profiles_table = """ CREATE TABLE IF NOT EXISTS profiles (
                            name text PRIMARY KEY,
                            spec text,
                            created integer,
                            updated integer
                            ); """
    jobs_table = """ CREATE TABLE IF NOT EXISTS jobs (
                        id text PRIMARY KEY,
                        title text NOT NULL,
                        profile text NOT NULL,
                        workers integer NOT NULL,
                        status text NOT NULL,
                        started integer,
                        ended integer,
                        raw_json text,
                        summary text,
                        type text,
                        raw_output text,
                        provider text,
                        platform text,
                        FOREIGN KEY(profile) REFERENCES profiles (name)
                        ); """

    if not os.path.exists(dbpath):
        print("Creating results database @ {}".format(dbpath))
        with sqlite3.connect(dbpath) as c:
            c.execute(profiles_table)
            c.execute(jobs_table)
    else:
        print("Using existing database @ {}".format(dbpath))


def valid_fio_profile(profile_spec):
    # TODO validate the profile
    # is valid fio syntax
    # one workload, called workload
    # uses /mnt
    return True


def load_db_profiles(jobdir, dbpath, out='console'):

    def message(msg_string, output=out):
        if output == 'console':
            print(msg_string)
        else:
            logger.info(msg_string)

    changes = {
        "processed": [],
        "new": [],
        "deleted": [],
        "changed": [],
        "skipped": [],
        "errors": [],
    }

    message("Refreshing job profiles, syncing the db versions with the local files in {}".format(jobdir), out)

    profile_paths = glob.glob('{}/*'.format(jobdir))
    fs_profile_names = [os.path.basename(p) for p in profile_paths]

    with sqlite3.connect(dbpath) as c:
        c.row_factory = sqlite3.Row
        cursor = c.cursor()
        for profile in profile_paths:
            name = os.path.basename(profile)
            changes['processed'].append(profile)
            profile_spec = rfile(profile)

            if not valid_fio_profile(profile_spec):
                changes['errors'].append(profile)
                message("profile '{}' is invalid, and can not be loaded".format(profile))
                continue

            cursor.execute("SELECT * from profiles WHERE name=?;",
                           (name,))
            data = cursor.fetchone()
            if data is None:
                message("- loading profile {}".format(name), out)
                changes['new'].append(profile)
                now = int(datetime.datetime.now().strftime("%s"))
                cursor.execute("INSERT INTO profiles VALUES (?,?,?,?);",
                                (name, profile_spec, now, now))  # NOQA
            else:
                # if spec is the same - just skip it
                if data['spec'] == profile_spec:
                    message("- skipping identical profile {}".format(name), out)
                    changes['skipped'].append(profile)
                else:
                    # if not, apply the filesystem copy to the database
                    message("- refreshing profile '{}' in the db with filesystem copy".format(name), out)
                    changes['changed'].append(profile)
                    cursor.execute(""" UPDATE profiles
                                            SET
                                            spec=?,
                                            updated=?
                                            WHERE
                                            name=?;""",
                                   (profile_spec, int(datetime.datetime.now().strftime("%s")), name))

        stored_profiles = [p['name'] for p in fetch_all(dbpath, 'profiles', list(['name']))]
        # message("profiles in db are: {}".format(','.join(stored_profiles)))
        for db_profile_name in stored_profiles:
            if db_profile_name not in fs_profile_names:
                message('- deleting db profile {}'.format(db_profile_name))
                changes['deleted'].append(db_profile_name)
                # message("changes {}".format(json.dumps(changes)))
                cursor.execute(""" DELETE FROM profiles
                                        WHERE name=?;""",
                               (db_profile_name,))

    return changes


def fetch_all(dbpath, table, keys):
    assert isinstance(keys, list)
    if not keys:
        return list()

    data = list()
    with sqlite3.connect(dbpath) as c:
        c.row_factory = sqlite3.Row
        csr = c.cursor()
        fields = ",".join(keys)
        csr.execute(""" SELECT {} FROM {};""".format(fields, table))

    rows = csr.fetchall()
    for row in rows:
        data.append({k: row[k] for k in keys})

    return data


def fetch_row(dbpath, table, key=None, content=None):
    response = dict()
    if not key:
        return response
    available = [row[key] for row in fetch_all(dbpath, table, list([key]))]
    if not content or content not in available:
        return response
    else:
        query = "SELECT * FROM {} WHERE {} = ?;".format(table, key)
        with sqlite3.connect(dbpath) as c:
            c.row_factory = sqlite3.Row
            csr = c.cursor()
            csr.execute(query, (content,))
            row = csr.fetchall()[0]

        # convert the row object to a dict
        response = {k: row[k] for k in row.keys()}
        return response


def delete_row(dbpath, table=None, query=dict()):
    if not query or len(query) > 1:
        logger.info("delete_row called with empty query, or too many parameters - ignoring")
        return
    
    k = list(query)[0]
    sql = "DELETE FROM {} WHERE {}=?".format(table, k)

    with sqlite3.connect(dbpath) as c:
        csr = c.cursor()
        csr.execute(sql, (query[k],))
        c.commit()


def update_job_status(dbpath, job_uuid, status):

    with sqlite3.connect(dbpath) as c:
        csr = c.cursor()
        csr.execute(""" UPDATE jobs
                        SET status = ?,
                            started = ?
                        WHERE
                            id = ?;""", (status,
                                         int(datetime.datetime.now().strftime("%s")),
                                         job_uuid)
                    )


def prune_db(dbpath):
    # remove records from the database that represent queued jobs
    # cherrypy.log("Pruning jobs still in a queued/started state from the database")
    prune_query = "DELETE FROM jobs WHERE status = 'queued' OR status = 'started';"
    with sqlite3.connect(dbpath) as c:
        csr = c.cursor()
        csr.execute(prune_query)


def dump_table(dbpath,
               table_name='jobs',
               query={}):
    """ simple iterator function to dump specific row(s) from the job table """

    with sqlite3.connect(dbpath) as conn:
        csr = conn.cursor()
        yield('BEGIN TRANSACTION;')

        # sqlite_master table contains the SQL CREATE statements for the all the tables.
        q = """
        SELECT type, sql
            FROM sqlite_master
                WHERE sql NOT NULL AND
                type == 'table' AND
                name == :table_name
            """
        schema_res = csr.execute(q, {'table_name': table_name})

        # create the create table syntax (ignore the type value..just using it preserve output)
        for _, sql in schema_res.fetchall():
            # yield the create table syntax, if the request doesn't provide a query
            if not query:
                yield('{};'.format(sql))

            # fetch the column names of the table
            res = csr.execute("PRAGMA table_info('{}')".format(table_name))
            column_names = [str(table_info[1]) for table_info in res.fetchall()]

            # Create the Insert statements to repopulate the table
            q = "SELECT 'INSERT INTO \"{}\" VALUES(".format(table_name)
            q += ",".join(["'||quote(" + col + ")||'" for col in column_names])
            q += ")' FROM '{}'".format(table_name)

            if query:
                # FIXME query assumes the value is a string...is this a problem?
                key_values = ["{}='{}'".format(k, query[k]) for k in query.keys()]
                q += " WHERE {}".format(','.join(key_values))

            # Issue the query, then potentially filter to the desired row
            query_res = csr.execute(q % {'tbl_name': table_name})
            for row in query_res:
                yield("%s;" % row[0])

        yield('COMMIT;')
