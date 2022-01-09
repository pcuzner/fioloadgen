import json
from configparser import ConfigParser
from typing import List, Dict, Any
from ..utils.data_types import ExportType


class JobData:
    exported_fields = 'id,title,profile,type,provider,platform,status,storageclass,clients,total_iops,read_ms_min,read_ms_avg,read_ms_max,write_ms_min,write_ms_avg,write_ms_max,blocksize,qdepth'

    def __init__(self, raw_data: List[Dict[Any, Any]]) -> None:
        self.raw_data = raw_data
        self.data = self._process_data()
        self.func_map = {
            'csv': self.as_csv,
            'json': self.as_json
        }

    def _process_data(self):
        data = self.raw_data.copy()
        for row in data:
            summary = json.loads(row.get("summary"))
            row['clients'] = summary.get('clients')
            row['total_iops'] = summary.get('total_iops')
            row['read_ms_min'], row['read_ms_avg'], row['read_ms_max'] = summary.get("read ms min/avg/max").split('/')
            row['write_ms_min'], row['write_ms_avg'], row['write_ms_max'] = summary.get("write ms min/avg/max").split('/')
            spec = row.get('profile_spec', None)
            row['blocksize'] = ''
            row['qdepth'] = ''
            if not row['storageclass']:
                row['storageclass'] = ''

            if spec:
                # extract blocksize, queuedepth from the jobs spec.
                profile = ConfigParser(allow_no_value=True)
                profile.read_string(spec)
                try:
                    workload = profile['workload']
                    row['blocksize'] = workload.get('blocksize', '')
                    row['qdepth'] = workload.get('iodepth', '')
                except ValueError:
                    # Bad/missing workload config section, ignore it
                    # we don't default to the entry in the profile table, since it
                    # could have changed since the job we're looking at ran
                    pass
        return data

    def export_as(self, export_type: ExportType):
        func = self.func_map[export_type]
        return func()

    def as_csv(self) -> str:
        fmtd = f'{self.exported_fields}\n'
        for row in self.data:
            for field_name in self.exported_fields.split(','):
                fmtd += f'{row.get(field_name)},'
            fmtd = fmtd[:-1] + '\n'
        return fmtd

    def as_json(self) -> List[Dict[Any, Any]]:
        data = []
        for row in self.data:
            out = {}
            for field_name in self.exported_fields.split(','):
                out[field_name] = row[field_name]
            data.append(out)
        return json.dumps(data)
