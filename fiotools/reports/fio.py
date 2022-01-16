
from statistics import StatisticsError, mode
from typing import Dict, Any, Tuple, List


class FIOSummary:
    # When you make changes to the as_json content, remeber to bump the
    # _rev_, so the existing database entries can be automagically updated
    _rev_ = 1

    def __init__(self, fio_json: Dict[str, Any]):
        self._fio_json = fio_json
        self._client_stats = fio_json.get('client_stats', [])
        self._clients = None

        if self.clients == 1:
            self._client_summary = self._client_stats[0]
        else:
            self._client_summary = self._client_stats[-1]

        self._latency_distribution, self._latency_labels = self._create_latency_breakdown()

    def _create_latency_breakdown(self) -> Tuple[List[str], List[str]]:
        labels = []
        values = []
        latency_keys = ['latency_us', 'latency_ms']
        for latency_type in latency_keys:
            latency_group = self._client_summary[latency_type]
            for key in latency_group:
                values.append(f'{latency_group[key]:.2f}')
                labels.append(f'{key} {latency_type[-2:]}')
        return values, labels

    @property
    def latency_distribution(self):
        return self._latency_distribution

    @property
    def latency_labels(self):
        return self._latency_labels

    @property
    def clients(self) -> int:
        if self._clients:
            return self._clients

        client_entries = len(self._client_stats)
        if client_entries > 1:
            return client_entries - 1
        self._clients = client_entries
        return self._clients

    @property
    def read_95ile_ms(self) -> str:
        return f'{(self._calc_mode() / 1000000):.2f}'

    @property
    def write_95ile_ms(self) -> str:
        return f'{(self._calc_mode("write") / 1000000):.2f}'

    @property
    def read_iops(self) -> int:
        return int(self._client_summary['read']['iops'])

    @property
    def total_iops(self) -> int:
        return self.read_iops + self.write_iops

    @property
    def write_iops(self) -> int:
        return int(self._client_summary['write']['iops'])

    @property
    def read_bytes_per_sec(self) -> int:
        return self._client_summary['read']['bw_bytes']

    @property
    def write_bytes_per_sec(self) -> int:
        return self._client_summary['write']['bw_bytes']

    @property
    def read_ms_min_avg_max(self) -> str:
        return self._summary_latency_ms()

    @property
    def write_ms_min_avg_max(self) -> str:
        return self._summary_latency_ms('write')

    def _calc_mode(self, op_type: str = 'read', percentile='95.000000') -> str:
        values = []
        for client in self._client_stats[:self.clients]:
            op = client.get(op_type, {})
            if op:
                if 'percentile' in op['clat_ns']:
                    values.append(op['clat_ns']['percentile'][percentile])
                else:
                    values.append(0)
        try:
            mid_point = mode(values)
        except StatisticsError:
            mid_point = 0

        return mid_point

    def _summary_latency_ms(self, op_type: str = 'read') -> str:
        lat_min = lat_avg = lat_max = lat_std_dev = 0

        try:
            lat_min = self._client_summary[op_type]['lat_ns']['min'] / 1000000
            lat_avg = self._client_summary[op_type]['lat_ns']['mean'] / 1000000
            lat_max = self._client_summary[op_type]['lat_ns']['max'] / 1000000
            lat_std_dev = self._client_summary[op_type]['lat_ns']['stddev'] / 1000000
        except KeyError:
            pass

        return f'{lat_min:.2f}/{lat_avg:.2f}/{lat_max:.2f}/{lat_std_dev:.2f}'

    @classmethod
    def props(cls) -> List[str]:
        return [attr for attr, _val in cls.__dict__.items()
                if attr == '_rev_' or not attr.startswith('_')
                and not callable(getattr(FIOSummary, attr))]

    def as_json(self) -> Dict[str, Any]:
        return {a: getattr(self, a) for a in FIOSummary.props()}
