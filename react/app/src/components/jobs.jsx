import React from 'react';
import '../app.scss';
import {Kebab} from '../common/kebab.jsx';
import {GenericModal} from '../common/modal.jsx';
/* ref https://chartjs-plugin-datalabels.netlify.com/guide/ */
import 'chartjs-plugin-datalabels';
import {setAPIURL, summarizeLatency, sortByKey, decPlaces, handleAPIErrors} from '../utils/utils.js';
import {Bar, HorizontalBar} from 'react-chartjs-2';

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
            jobInfo: {},
            modalOpen: false,
            // visibility: 'inactive',
        };
        this.jobDetails = (<div />);
    };
    // shouldComponentUpdate(nextProps, PrevProps) {
    //     if (nextProps.visibility == "active"){
    //         console.debug("jobs should render");
    //         return true;
    //     } else {
    //         return false;
    //     }
    // }
    // static getDerivedStateFromProps(nextProps, stateProps) {
    //     console.log(nextProps.visibility);
    //     if (nextProps.visibility != stateProps.visibility) {
    //         console.log("jobs visibility changed");
    //         return {
    //             visibility: nextProps.visibility,
    //         }
    //     } else {
    //         console.log("no change");
    //         return null;
    //     };

    // }

    fetchJobSummaryData() {
        fetch(api_url + "/api/job?fields=id,title,profile,status,started,type,provider,platform,workers")
          .then(handleAPIErrors)
          .then((json) => {
              /* Happy path */
              let srtd = json.data.sort(sortByKey('-started'));
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
            // let tJobInfo = Object.assign({}, this.jobInfo);
            let tJobInfo = Object.assign({}, this.state.jobInfo);
            delete tJobInfo[job_id];
            // this.jobInfo = tJobInfo;
            this.setState({
                jobInfo: tJobInfo
            });
            // this.jobInfo = Object.assign({}, tJobInfo);
            // console.log("job map holds " + Object.keys(this.jobInfo).length + 'members');
            // console.debug(JSON.stringify(this.jobInfo));
        }
    }

    fetchJobData(job_id) {
        console.debug("fetch for job " + job_id);
        fetch(api_url + "/api/job/" + job_id)
            .then(handleAPIErrors)
            .then((json) => {
                /* Happy path */
                console.log("loading job data");
                let data = JSON.parse(json.data);
                // this.jobInfo[data.id] = data;
                let tJobInfo = Object.assign({}, this.state.jobInfo);
                // let tJobInfo = Object.assign({}, this.jobInfo);
                tJobInfo[data.id] = data;
                // this.jobInfo = tJobInfo;
                this.setState({
                    currentJob: JSON.parse(json.data),
                    jobInfo: tJobInfo
                });
            })
            .catch((error) => {
                console.error("fetchJobData failed with: ", error);
            });
    }
    componentDidMount() {
        /* curl http://localhost:8080/api/job?fields=id,title,profile,status,started,type,provider,platform */
        this.fetchJobSummaryData();
        this.downloadLink = React.createRef();
    }

    deleteJob = (jobID) => {
        console.log("delete job " + jobID);
        fetch(api_url + "/api/job/" + jobID, {
            method: 'delete',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            // body: JSON.stringify(parms)
        })
            .then(handleAPIErrors)
            .then((json) => {
                this.fetchJobSummaryData();
            })
            .catch((err) => {
                console.error("DELETE to /api/job failed : ", err);
            });
    }

    showJob = (jobID) => {
        console.log('show job' + jobID);
        // let jobData = Object.keys(this.state.jobs);
        fetch(api_url + "/api/job/" + jobID)
            .then(handleAPIErrors)
            .then((json) => {
                /* Happy path */
                let j = JSON.parse(json.data);
                let raw = JSON.parse(j.raw_json);
                this.jobDetails = JSON.stringify(raw, null, 2);
                this.openModal()
            })
            .catch((error) => {
                console.error("Show job failed: ", error);
            });
    }

    rerunJob = (jobID) => {
        console.log("rerun " + jobID);
        // loop through the jobs array to find the relevant job
        let jobObject = null;
        for (let job of this.state.jobs) {
            if (job.id == jobID) {
                jobObject = Object.assign({}, job);
                break;
            }
        };
        if (jobObject) {
            console.debug("found ", JSON.stringify(jobObject));
            console.debug(jobObject.title);
            let parms = {
                workers: jobObject.workers,
                title: jobObject.title,
                provider: jobObject.provider,
                platform: jobObject.platform,
            };
            console.log(JSON.stringify(parms));
            fetch(api_url + "/api/job/" + jobObject.profile, {
                method: 'post',
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(parms)
                })
                .then(handleAPIErrors)
                .then((json) => {
                    console.log("job rerun submitted");
                })
                .catch((err) => {
                    console.error("Job rerun failed - " + err);
                })
        } else {
            console.error("requested job with id " + jobID + " not found in jobs array?");
        }
    }
    exportJob = (jobID) => {
        console.log("export job " + jobID);
        fetch(api_url + "/api/db/" + jobID)
            .then((response) => {
                /* Happy path */
                if (!response.ok) {
                    throw Error("Unable to retrieve exported copy of job");
                }
                console.debug("download request ok");
                return response.blob();
            })
            .then((blob) => {
                console.debug("have response");
                const href = window.URL.createObjectURL(blob);
                const a = this.downloadLink.current;
                a.download = jobID + '.txt';
                a.href = href;
                a.click();
                a.href = '';
            })
            .catch((error) => {
                console.error("export job failed: ", JSON.stringify(error));
            });
    }

    openModal = () => {
        this.setState({
            modalOpen: true
        });
    }
    closeModal = () => {
        this.setState({
            modalOpen: false,
        });
        this.jobDetails = (<div />);
    }

    render() {
        // if (this.props.visibility != 'active') {
        //     return (
        //         <div />
        //     );
        // }

        console.log("render job table");
        var rows;
        console.log("jobs ", this.state.jobs.length);
        if (this.state.jobs.length > 0) {
            console.log("jobs > 0, processing to create jobdatarow components");
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
                    <JobDataRow 
                        job={job}
                        key={i}
                        viewCallback={this.manageJobOutput}
                        deleteJob={this.deleteJob}
                        exportJob={this.exportJob}
                        rerunJob={this.rerunJob}
                        showJob={this.showJob}/>
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
        let jobDetails;
        if (this.state.modalOpen) {
            jobDetails = (<div><pre><code>{this.jobDetails}</code></pre></div>);
        } else {
            jobDetails = (<div />);
        }

        return (
            <div id="jobs" className={this.props.visibility}>
                <a className="hidden" ref={this.downloadLink} />
                <GenericModal 
                    show={this.state.modalOpen} 
                    title={"FIO Job Output"}
                    content={jobDetails} 
                    closeHandler={this.closeModal} />
                <br />
                <div className="inline-block align-right" style={{marginLeft: "50px"}}>
                    <button className="btn btn-primary offset-right" onClick={()=>{ this.fetchJobSummaryData()}}>Refresh</button>
                    <table className="job_table">
                        <thead>
                            <tr>
                                <th className="job_selector">View</th>
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
                                <td>{this.state.jobs.length} rows, {Object.keys(this.state.jobInfo).length} selected</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="divider"></div>
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
        values.sort();
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
            let percentileData = [];
            let bandwidthData = [];
            let readMedian95 = 0;
            let writeMedian95 = 0;

            if (this.state.jobData.summary) {
    
                rawJSON = JSON.parse(this.state.jobData.raw_json);
                lastItem = Object.keys(rawJSON.client_stats).length -1; // always the all clients job summary element
                clientSummary = rawJSON.client_stats[lastItem];
                readMedian95 = decPlaces(this.calcMedian(rawJSON.client_stats.slice(0, lastItem))/ 1000000);
                writeMedian95 = decPlaces(this.calcMedian(rawJSON.client_stats.slice(0, lastItem), "write")/ 1000000);
                bandwidthData.push(decPlaces(clientSummary.read.bw_bytes / Math.pow(1024,2)));
                bandwidthData.push(decPlaces(clientSummary.write.bw_bytes / Math.pow(1024,2)));
                percentileData.push(readMedian95, writeMedian95);

                let iops = Math.round(parseFloat(clientSummary.read.iops + clientSummary.write.iops));

                summary = JSON.parse(this.state.jobData.summary);
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
                    "read ms min/avg/max": [0,0,0,0],
                    "write ms min/avg/max": [0,0,0,0],
                };
                latencyData = Array(22).fill(0);
                percentileData = Array(2).fill(0);
            }
            let bandwidth = {
                labels: ['read', 'write'],
                datasets: [
                    {
                        label: "Bandwidth",
                        backgroundColor: ['#3e95cd', '#c45850'],
                        data: bandwidthData
                    }
                ]
            }
            let percentiles = {
                labels: ['read', 'write'],
                datasets: [
                    {
                        label: "IO Latency ms",
                        backgroundColor: ['#3e95cd', '#c45850'],
                        data: percentileData
                    }
                ]
            };

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
                        
                        {/* <div className="inline-block align-top" style={{width: "15%"}}>Job Title:</div> */}
                        {/* <div className="inline-block" style={{width: "85%"}}>{this.state.jobData.title}</div> */}
                        <div className="align-center bold" style={{marginBottom: "10px"}}>{this.state.jobData.title}</div>
                        <div><span style={{display: "inline-block", minWidth: "50px"}}>ID</span>: {this.state.jobData.id}</div>
                        <div><span style={{display: "inline-block", minWidth: "50px"}}>Job</span>: {this.state.jobData.type} / {this.state.jobData.profile}</div>
                        <div><span style={{display: "inline-block", minWidth: "50px"}}>Clients</span>: {this.state.jobData.workers}</div>
                        <div><span style={{display: "inline-block", minWidth: "50px"}}>IOPS</span>: {summary.total_iops.toLocaleString()}</div>
                        <table className="lat-table">
                            <caption>Overall IO Breakdown (ms)</caption>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th></th>
                                    <th colSpan="4" className="align-center">Latency (ms)</th>
                                </tr>
                                <tr>
                                    <th className="lat-table-op"></th>
                                    <th className="lat-table-head">IOPS</th>
                                    <th className="lat-table-head">min</th>
                                    <th className="lat-table-head">avg</th>
                                    <th className="lat-table-head">max</th>
                                    <th className="lat-table-head">stddev</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="lat-table-op">read</td>
                                    <td>{Math.round(parseFloat(clientSummary.read.iops)).toLocaleString()}</td>
                                    <td>{summary["read ms min/avg/max"][0]}</td>
                                    <td>{summary["read ms min/avg/max"][1]}</td>
                                    <td>{summary["read ms min/avg/max"][2]}</td>
                                    <td>{summary["read ms min/avg/max"][3]}</td>
                                </tr>
                                <tr>
                                    <td className="lat-table-op">write</td>
                                    <td>{Math.round(parseFloat(clientSummary.write.iops)).toLocaleString()}</td>
                                    <td>{summary["write ms min/avg/max"][0]}</td>
                                    <td>{summary["write ms min/avg/max"][1]}</td>
                                    <td>{summary["write ms min/avg/max"][2]}</td>
                                    <td>{summary["write ms min/avg/max"][3]}</td>
                                </tr>
                            </tbody>
                        </table>
                        {/* <div>Read Latency ms (min/avg/max/stddev): {summary['read ms min/avg/max']}</div> */}
                        {/* <div>Median Read 95%ile (ms): {readMedian95}</div> */}
                        {/* <div>Write Latency ms (min/avg/max/stddev): {summary['write ms min/avg/max']}</div> */}
                        {/* <div>Median Write 95%ile (ms): {writeMedian95}</div> */}
                        {/* <Panel title="Clients" /> */}
                        {/* <Panel title="IOPS" /> */}
                    </div>
                    <div className="inline-block chart-item">
                        <Bar 
                            data={data}
                            width={450}
                            height={250}
                            options={{
                                plugins: {
                                    datalabels: {
                                       display: false
                                    }
                                },
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
                                        labelString: 'IO Latency Group'
                                      },
                                    //   ticks: {
                                    //       fontSize: 9,
                                    //       maxRotation: 90,
                                    //       minRotation: 90                                          
                                    //   }
                                    }],
                                  }
                            }}
                        />
                    </div>
                    <div className="inline-block chart-item">
                        <HorizontalBar
                            data={percentiles}
                            width={300}
                            height={250}
                            options={{
                                tooltips:{
                                    enabled: true
                                },
                                plugins: {
                                    datalabels: {
                                       display: "auto",
                                       anchor: "end",
                                       align: "left",
                                       offset: 4,
                                       color: "white",
                                       clip: true
                                    }
                                },
                                title: {
                                    display: true,
                                    text:["Median Latency @ 95%ile", "\u25C0 is better"]
                                },
                                legend: {
                                    display: false
                                },
                                scales: {
                                    xAxes: [{
                                        scaleLabel: {
                                            display: true,
                                            labelString: "Latency (ms)"
                                        },
                                        ticks: {
                                            beginAtZero: true,
                                            max: 50
                                        }
                                    }]
                                }
                            }}
                        />
                    </div>
                    <div className="inline-block chart-item">
                        <HorizontalBar
                            data={bandwidth}
                            width={300}
                            height={250}
                            options={{
                                tooltips:{
                                    enabled: false
                                },
                                plugins: {
                                    datalabels: {
                                       display: true,
                                       anchor: "end",
                                       align: "left",
                                       offset: 4,
                                       color: "white"
                                    }
                                },
                                title: {
                                    display: true,
                                    text:["Bandwidth", "\u25B6 is better"]
                                },
                                legend: {
                                    display: false
                                },
                                scales: {
                                    xAxes: [{
                                        scaleLabel: {
                                            display: true,
                                            labelString: "Bandwidth MB/s"
                                        },
                                        ticks: {
                                            beginAtZero: true
                                        }
                                    }]
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
            selected: false,
        };
    }

    toggleSelected(event) {
        console.debug("clicked a row - " + this.props.job.id);
        this.setState({
            selected: event.target.checked
        });
        this.props.viewCallback(this.props.job.id, event.target.checked);
    }

    render () {
        console.log("render job data row");
        let checkboxEnabled;
        let t_str;
        if (this.props.job.status != 'queued') {
            let t = new Date(this.props.job.started * 1000);
            // let t_str = t.toLocaleString()
            t_str = t.getFullYear() + '/' +
                    (t.getMonth() + 1).toString().padStart(2, '0') + '/' +
                    t.getDate().toString().padStart(2, '0') + ' ' +
                    t.getHours().toString().padStart(2, '0') + ':' +
                    t.getMinutes().toString().padStart(2, '0') + ':' +
                    t.getSeconds().toString().padStart(2, '0');
        } else {
            t_str = 'N/A';
        }
        
        let rowClass;
        if (this.state.selected) {
            rowClass = "selectedRow";
        } else {
            rowClass = "notSelectedRow";
        }
        if (this.props.job.status == 'complete') {
            checkboxEnabled=true
        } else {
            checkboxEnabled=false
        }
        let actions = [];
        switch (this.props.job.status) {
            case "complete":
                actions = [
                    { 
                        action: 'rerun',
                        callback: this.props.rerunJob,
                    },
                    { 
                        action: 'export',
                        callback: this.props.exportJob,
                    },
                    { 
                        action: 'show',
                        callback: this.props.showJob,
                    },
                ];
                break;
            case "failed":
                actions = [
                    { 
                        action: 'rerun',
                        callback: this.props.rerunJob,
                    },
                    { 
                        action: 'show',
                        callback: this.props.showJob,
                    },
                ];
                break;
            case "queued":
                actions = [
                    { 
                        action: 'delete',
                        callback: this.props.deleteJob,
                    },
                ];
                break;
            case "started":
                actions = [
                    { 
                        action: 'show',
                        callback: this.props.showJob,
                    },
                ];
                break;
        }

        return (
            <tr className={rowClass}> 
                <td className="job_selector">
                    <input type="checkbox" disabled={!checkboxEnabled} onChange={() => {this.toggleSelected(event);}} />
                </td>
                <td className="job_id">{this.props.job.id}</td>
                <td className="job_title">{this.props.job.title}</td>
                <td className="job_provider" >{this.props.job.provider}</td>
                <td className="job_platform">{this.props.job.platform}</td>
                <td className="job_start">{t_str}</td>
                <td className="job_status">{this.props.job.status}</td>
                <td className="job_actions">
                    <Kebab value={this.props.job.id} actions={actions} />
                </td>
            </tr>
        )
    }
}

// class Panel extends React.Component {
//     constructor(props) {
//         super(props);
//         self.state = {
//             dummy: true
//         };
//     }
//     render() {
//         return (
//             <div className="job-panel inline-block">
//                 <div><b>{this.props.title}</b></div>
//             </div>
//         );
//     }
// }