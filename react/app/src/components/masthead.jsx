import React from 'react';
import '../app.scss';
import {setAPIURL} from '../utils/utils.js';

/* Masthead will contain a couple of items from the webservice status api
   to show mode, task active, job queue size
*/
var api_url = setAPIURL();

export class MastHead extends React.Component {
    constructor(props) {
        super(props);
        this.interval = 0;
        this.state = {
            task_active: false,
            tasks_queued: 0,
            task_type: 'N/A',
            target: '',
            run_time: 0,
            workers: 0,
            apiAvailable: true
        };
    };

    getStatus() {
        fetch(api_url + "/api/status")
          .then((response) => {
              console.debug("status fetch : ", response.status);
              if (response.status == 200) {
                  return response.json();
              } else {}
                  throw Error(`status API call failed with HTTP status: ${response.status}`);
              })
          .then((status) => {
              /* Happy path */
              state = status.data;
              state['apiAvailable'] = true;
            //   console.debug("state returned " + JSON.stringify(state));
              this.setState(state);
            //   console.debug("masthead status returned worker count of " + state.workers);
              this.props.workerCB(this.state.workers);
            //   console.log(JSON.stringify(state));
          })
          .catch((error) => {
              console.error("Error:", error);
              console.error("killing interval based status checking");
              this.setState({
                  apiAvailable: false
              });
              clearInterval(this.interval);
          });

    }

    intervalHandler = () => {
        this.getStatus();
    }

    componentDidMount() {
        console.log("starting interval based call to the /status API endpoint");
        console.log("here's the env var setting " + api_url);
        this.getStatus();
        this.interval = setInterval(this.intervalHandler, 5000);
    }

    render() {
        return (
            <div id="masthead">
                <div>
                    <div className="page-heading">LoadGen</div><span className="pficon pficon-ok"></span>
                    <ServiceState state={this.state}/>
                </div>
                <div style={{clear: 'both'}}/>
            </div>    
        );
    }
}

class ServiceState extends React.Component {
    constructor(props) {
        super(props);
        self.state = {
            dummy: false
        };
    }
    render() {
        let taskText = this.props.state.task_active ? "Yes" : "no";
        let apiSymbol = this.props.state.apiAvailable ? "fa fa-lg fa-check-circle-o state-ok" : "fa fa-lg fa-times-circle-o state-failed";
        return (
            <div className="status-area">
                <div className="float-right status-spacing">API:&nbsp;<span className={apiSymbol}></span></div>
                <div className="float-right status-spacing">Job Active:&nbsp;{taskText}</div>
                <div className="float-right status-spacing">Queued:&nbsp;{this.props.state.tasks_queued}</div>
                <div className="float-right status-spacing">Target Platform:&nbsp;{this.props.state.target}</div>
            </div>
        )
    }
}

export default MastHead;

