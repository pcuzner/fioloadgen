import React from 'react';
import '../app.scss';
import {setAPIURL, summarizeLatency, sortByKey, decPlaces} from '../utils/utils.js';
import {Bar} from 'react-chartjs-2';

/* Masthead will contain a couple of items from the webservice status api
   to show mode, task active, job queue size
*/
var api_url = setAPIURL();

const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }

export class Jobs extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            jobs: [],
            currentJob: "",
            jobInfo: {}
        };
    // this.jobInfo = {};
    };

    fetchJobSummaryData() {
        fetch(api_url + "/api/job?fields=id,title,profile,status,started,type,provider,platform")
          .then((response) => {
              console.debug("Job listing fetch : ", response.status);
              if (response.status == 200) {
                  return response.json();
              } else {}
                  throw Error(`Fetch failed with HTTP status: ${response.status}`);
              })
          .then((jobs) => {
              /* Happy path */
              let srtd = jobs.data.sort(sortByKey('-started'));
              this.setState({
                  jobs: srtd
              });
              console.log(jobs);
          })
          .catch((error) => {
              console.error("Error:", error);
          });
    }

    manageJobOutput = (job_id, checked) => {
        if (checked) {
            console.log("show output for "+ job_id);
            this.fetchJobData(job_id);
        } else {
            console.debug("hide output for job id " + job_id);
            let tJobInfo = Object.assign({}, this.state.jobInfo);
            delete tJobInfo[job_id];
            this.setState({
                jobInfo: tJobInfo
            });
            // console.log("job map holds " + Object.keys(this.jobInfo).length + 'members');
            // console.debug(JSON.stringify(this.jobInfo));
        }
    }

    fetchJobData(job_id) {
        console.debug("fetch for job " + job_id);
        fetch(api_url + "/api/job/" + job_id)
            .then((response) => {
                console.debug("Job data fetch : ", response.status);
                if (response.status == 200) {
                    return response.json();
                } else {}
                    throw Error(`Fetch for job data failed with HTTP status: ${response.status}`);
                })
            .then((job) => {
                /* Happy path */
                let data = JSON.parse(job.data);
                // this.jobInfo[data.id] = data;
                let tJobInfo = Object.assign({}, this.state.jobInfo);
                tJobInfo[data.id] = data;
                this.setState({
                    currentJob: JSON.parse(job.data),
                    jobInfo: tJobInfo
                });

                // console.debug(JSON.stringify(this.jobInfo));
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }
    componentDidMount() {
        /* curl http://localhost:8080/api/job?fields=id,title,profile,status,started,type,provider,platform */
        this.fetchJobSummaryData();
    }

    render() {
        var rows;
        if (this.state.jobs.length > 0) {
            rows = this.state.jobs.map((job,i) => {
                // let t = new Date(job.started * 1000);
                // // let t_str = t.toLocaleString()
                // let t_str = t.getFullYear() + '/' +
                //             (t.getMonth() + 1).toString().padStart(2, '0') + '/' +
                //             t.getDate().toString().padStart(2, '0') + ' ' +
                //             t.getHours().toString().padStart(2, '0') + ':' +
                //             t.getMinutes().toString().padStart(2, '0') + ':' +
                //             t.getSeconds().toString().padStart(2, '0');
                // let d_str = new Intl.DateTimeFormat(options).format(t)
                // console.log(t + " = " + t_str + ", " + d_str);
                return (
                    <JobDataRow job={job} key={i} callBack={this.manageJobOutput} />
                );
                    // <tr key={i} onClick={() => {this.fetchJobData(job.id);}}>
                    //     <td className="job_id">{job.id}</td>
                    //     <td className="job_title">{job.title}</td>
                    //     <td className="job_provider" >{job.provider}</td>
                    //     <td className="job_platform">{job.platform}</td>
                    //     <td className="job_start">{t_str}</td>
                    //     <td className="job_status">{job.status}</td>
                    // </tr>);
            });
        } else {
            rows = (<tr />);
        }

        return (
            <div id="jobs" className={this.props.visibility}>
                <br />
                <div className="inline-block align-right">
                    <button className="btn btn-primary offset-right" onClick={()=>{ this.fetchJobSummaryData()}}>Refresh</button>
                    <table className="job_table">
                        <thead>
                            <tr>
                                <th>Sel</th>
                                <th className="job_id">Job ID</th>
                                <th className="job_title">Title</th>
                                <th className="job_provider">Provider</th>
                                <th className="job_platform">Platform</th>
                                <th className="job_start">Start Time</th>
                                <th className="job_status">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><i>{this.state.jobs.length} rows, {Object.keys(this.state.jobInfo).length} selected</i></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="jobsContainer">
                    <JobAnalysis data={this.state.jobInfo} />
                </div>
                
            </div>
        );
    }
}
class JobAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dummy: true
        };
    }
    render() {
        let jobDetails = [];
        Object.keys(this.props.data).forEach((key, idx) => {
            let component = (<FIOJobAnalysis key={idx} jobData={this.props.data[key]} />);
            jobDetails.push(component);
        });
        return (
            <div>
                {jobDetails}
            </div>
        );
    }
}
class FIOJobAnalysis extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            jobData: null
        };
    }

    static getDerivedStateFromProps(props, state) {
        if (JSON.stringify(props.jobData) != JSON.stringify(state.jobData)) {
            console.debug("setting job data");
            return {
                jobData: props.jobData
            }
        } else {
            return null;
        }
    }
    shouldComponentUpdate(nextProps, nextState) {
        // Only update if bricks change
        return !(JSON.stringify(nextProps.jobData) == JSON.stringify(this.state.jobData))
    }
    calcMedian(dataset, opType = "read", percentile="95.000000") {
        let values = [];
        dataset.forEach((client) => {
            values.push(client[opType].clat_ns.percentile[percentile]);
        });
        let idx = Math.ceil(0.5 * dataset.length);
        return values[idx];
    }
    render() {
        console.debug("Rendering job details for " + this.state.jobData.id);
        if (!this.state.jobData) {
            return (<div></div>);
        } else {
            let summary;
            let rawJSON;
            let lastItem;
            let clientSummary;
            let latencyData = [];
            let readMedian95 = 0;
            let writeMedian95 = 0;

            if (this.state.jobData.summary) {
    
                rawJSON = JSON.parse(this.state.jobData.raw_json);
                lastItem = Object.keys(rawJSON.client_stats).length -1; // always the all clients job summary element
                clientSummary = rawJSON.client_stats[lastItem];
                readMedian95 = decPlaces(this.calcMedian(rawJSON.client_stats.slice(0, lastItem))/ 1000000);
                writeMedian95 = decPlaces(this.calcMedian(rawJSON.client_stats.slice(0, lastItem), "write")/ 1000000);
                summary = JSON.parse(this.state.jobData.summary);
                let iops = Math.round(parseFloat(summary.total_iops));
                summary.total_iops = iops.toLocaleString();

                summary["read ms min/avg/max"] = summarizeLatency(clientSummary.read.lat_ns);
                summary["write ms min/avg/max"] = summarizeLatency(clientSummary.write.lat_ns);

                Object.keys(clientSummary['latency_us']).forEach((key) => {
                    let num = clientSummary['latency_us'][key];
                    let val = decPlaces(num);
                    latencyData.push(val);
                });
                Object.keys(clientSummary['latency_ms']).forEach((key) => {
                    let num = clientSummary['latency_ms'][key];
                    let val = decPlaces(num);
                    latencyData.push(val);
                });
            } else {
                summary = {
                    total_iops: 0,
                    "read ms min/avg/max": 'Unknown',
                    "write ms min/avg/max": 'Unknown',
                };
                latencyData = Array(22).fill(0);
            }

            let data = {
                labels: ['2us','4us','10us','20us','50us','100us','250us','500us','750us','1000us',
                            '2ms','4ms','10ms','20ms','50ms','100ms','250ms','500ms','750ms','1000ms','2000ms','>2000ms'],
                datasets: [
                    {
                        label:"IOPS %",
                        backgroundColor: 'rgba(73, 142, 163,0.6)',
                        borderColor: 'rgba(45, 89, 102,1)',
                        borderWidth: 1,
                        hoverBackgroundColor: 'rgba(73, 142, 163,0.8)',
                        hoverBorderColor: 'rgba(31, 60, 69,1)',
                        data : latencyData
                    }
                    
                ]
            };
 
            return (
                <div className="job-details-container">
                    <div className="inline-block job-summary align-top">
                        <div>Job ID : {this.state.jobData.id}</div>
                        <div className="inline-block align-top" style={{width: "15%"}}>Job Title:</div>
                        <div className="inline-block" style={{width: "85%"}}>{this.state.jobData.title}</div>
                        <div>Job Type : {this.state.jobData.type}</div>
                        <div>Job Profile Name : {this.state.jobData.profile}</div>
                        <br />
                        <div>Clients: {this.state.jobData.workers}</div>
                        <div>IOPS: {summary.total_iops.toLocaleString()}</div>
                        <div>Read Latency ms (min/avg/max): {summary['read ms min/avg/max']}</div>
                        <div>Median Read 95%ile (ms): {readMedian95}</div>
                        <div>Write Latency ms (min/avg/max): {summary['write ms min/avg/max']}</div>
                        <div>Median Write 95%ile (ms): {writeMedian95}</div>
                    </div>
                    <div className="inline-block chart-item">
                        <Bar 
                            data={data}
                            width={500}
                            height={250}
                            options={{
                                scaleBeginAtZero: false,
                                title: {
                                    display: true,
                                    text: ["I/O Latency Distribution", "\u25C0 is better"]
                                },
                                maintainAspectRatio: false,
                                legend: {
                                    display: false,
                                    position: 'top'
                                },
                                scales: {
                                    yAxes: [{
                                      scaleLabel: {
                                        display: true,
                                        labelString: '% of IOPS'
                                      },
                                      ticks: {
                                        beginAtZero: true}
                                      }],
                                    xAxes: [{
                                      scaleLabel: {
                                        display: true,
                                        labelString: 'IO Latency Groups'
                                      }
                                    }],
                                  }
                            }}
                        />
                    </div>
                </div>
            );
        }
    }
}

export default Jobs;

class JobDataRow extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selected: false
        };
    }

    toggleSelected(event) {
        console.debug("clicked a row - " + this.props.job.id);
        this.setState({
            selected: event.target.checked
        });
        this.props.callBack(this.props.job.id, event.target.checked);
    }

    render () {
        let t = new Date(this.props.job.started * 1000);
        // let t_str = t.toLocaleString()
        let t_str = t.getFullYear() + '/' +
                    (t.getMonth() + 1).toString().padStart(2, '0') + '/' +
                    t.getDate().toString().padStart(2, '0') + ' ' +
                    t.getHours().toString().padStart(2, '0') + ':' +
                    t.getMinutes().toString().padStart(2, '0') + ':' +
                    t.getSeconds().toString().padStart(2, '0');
        let rowClass;
        if (this.state.selected) {
            rowClass = "selectedRow";
        } else {
            rowClass = "notSelectedRow";
        }

        return (
            <tr className={rowClass}> 
                <td>
                    <input type="checkbox" onChange={() => {this.toggleSelected(event);}} />
                </td>
                <td className="job_id">{this.props.job.id}</td>
                <td className="job_title">{this.props.job.title}</td>
                <td className="job_provider" >{this.props.job.provider}</td>
                <td className="job_platform">{this.props.job.platform}</td>
                <td className="job_start">{t_str}</td>
                <td className="job_status">{this.props.job.status}</td>
            </tr>
        )
    }
}