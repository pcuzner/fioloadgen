#!/usr/bin/env python3


def latency_summary(fio_json, percentile=95):
    """determine latency summary stats from fio output (dict/json)"""

    def get_item(response, path):
        for item in path:
            response = response[item]
        return response

    def fmt_latency(latencies, num_clients):

        return "{:.2f}/{:.2f}/{:.2f}".format(min(latencies) / 1000000,
                                             (sum(latencies) / num_clients) / 1000000,
                                             max(latencies) / 1000000)

    vars_list = [
        "read/iops",
        "read/clat_ns/percentile/{:.6f}".format(percentile),
        "write/iops",
        "write/clat_ns/percentile/{:.6f}".format(percentile),
    ]

    client_stats = fio_json['client_stats']
    extract = list()
    for item in client_stats:
        if item['jobname'].lower() == 'all clients':
            continue
        hostname = item['hostname']
        hostdata = {
            "hostname": hostname,
        }
        for v in vars_list:
            path = v.split('/')
            path_value = get_item(item, path)
            hostdata[v] = str(path_value)
        extract.append(hostdata)

    total_iops = 0
    read_latencies = list()
    write_latencies = list()
    num_clients = len(extract)
    for client in extract:
        total_iops += float(client['read/iops']) + float(client['write/iops'])
        read_latencies.append(float(client['read/clat_ns/percentile/{:.6f}'.format(percentile)]))
        write_latencies.append(float(client['write/clat_ns/percentile/{:.6f}'.format(percentile)]))

    summary = {
        "clients": num_clients,
        "total_iops": total_iops,
        "read ms min/avg/max": fmt_latency(read_latencies, num_clients),
        "write ms min/avg/max": fmt_latency(write_latencies, num_clients)
    }
    return summary
