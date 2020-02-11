import React from 'react';
import { sortByKey } from "../utils/utils.js";
import '../app.scss';

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
            currentJob: ""
        };
    };

    fetchJobSummaryData() {
        fetch("http://localhost:8080/api/job?fields=id,title,profile,status,started,type,provider,platform")
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

    fetchJobData(job_id) {
        console.debug("fetch for job " + job_id);
        fetch("http://localhost:8080/api/job/" + job_id)
            .then((response) => {
                console.debug("Job data fetch : ", response.status);
                if (response.status == 200) {
                    return response.json();
                } else {}
                    throw Error(`Fetch for job data failed with HTTP status: ${response.status}`);
                })
            .then((job) => {
                /* Happy path */
                this.setState({
                    currentJob: JSON.parse(job.data)
                });

                // console.log(job);
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
                let t = new Date(job.started * 1000);
                // let t_str = t.toLocaleString()
                let t_str = t.getFullYear() + '/' +
                            (t.getMonth() + 1).toString().padStart(2, '0') + '/' +
                            t.getDate().toString().padStart(2, '0') + ' ' +
                            t.getHours().toString().padStart(2, '0') + ':' +
                            t.getMinutes().toString().padStart(2, '0') + ':' +
                            t.getSeconds().toString().padStart(2, '0');
                // let d_str = new Intl.DateTimeFormat(options).format(t)
                // console.log(t + " = " + t_str + ", " + d_str);
                return (
                    <tr key={i} onClick={() => {this.fetchJobData(job.id);}}>
                        <td className="job_id">{job.id}</td>
                        <td className="job_title">{job.title}</td>
                        <td className="job_provider" >{job.provider}</td>
                        <td className="job_platform">{job.platform}</td>
                        <td className="job_start">{t_str}</td>
                        <td className="job_status">{job.status}</td>
                    </tr>);
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
                                <td><i>{this.state.jobs.length} rows in total</i></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <JobDetails jobData={this.state.currentJob} />
            </div>
        );
    }
}

class JobDetails extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            job: null
        };
    }
    render() {
        if (!this.props.jobData) {
            return (<div></div>);
        } else {
            let summary;
            if (this.props.jobData.summary) {
                summary = JSON.parse(this.props.jobData.summary);
                let iops = Math.round(parseFloat(summary.total_iops));
                summary.total_iops = iops.toLocaleString();
            } else {
                summary = {
                    total_iops: 0,
                    "read ms min/avg/max": 'Unknown',
                    "write ms min/avg/max": 'Unknown',
                };
            }
                
            return (
                <div>
                    <div>Job ID : {this.props.jobData.id}</div>
                    <div>Job Type : {this.props.jobData.type}</div>
                    <div>Job Profile Name : {this.props.jobData.profile}</div>
                    <br />
                    <div>Clients: {this.props.jobData.workers}</div>
                    <div>IOPS: {summary.total_iops.toLocaleString()}</div>
                    <div>Read Latency ms (min/avg/max): {summary['read ms min/avg/max']}</div>
                    <div>Read Latency ms (min/avg/max): {summary['write ms min/avg/max']}</div>
                </div>
            );
        }
    }
}

export default Jobs;

