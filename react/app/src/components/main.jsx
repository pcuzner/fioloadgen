import React from 'react';
import '../app.scss';
import { MastHead } from './masthead.jsx';
import { Profiles } from './profiles.jsx';
import { Jobs } from './jobs.jsx';


export class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            profiles: 'active',
            jobs: 'inactive',
            current: 'profiles',
            workers: 0,
            activeJobId: undefined,
        };
        // this.workers = 2;
    };

    menuSelect = (item) => {
        if (item != this.state.current) {
            let newState = {
                current: item,
                profiles: 'inactive',
                jobs:'inactive'
            };
            newState[item] = 'active';
            console.log(item);
            this.setState(newState);
            console.log(JSON.stringify(newState));
        }
    }

    // updateWorker = (workerCount) => {
    //     this.workers = workerCount;
    //     this.setState({
    //         workers: workerCount
    //     });
    // }

    updateWorkers = (count) => {
        console.debug("updating workers to ", count);
        this.setState({
            workers: count,
        });
    }

    jobStateChange = (jobID) => {
        console.debug("job state has changed ", jobID);
        this.setState({
            activeJobId: jobID,
        });
    }

    render() {
        console.log("render main. env vars: " + JSON.stringify(process.env));
        return (
            <div id="app">
                <div id="masthead-container">
                    <MastHead workersCallback={this.updateWorkers} jobChangeCallback={this.jobStateChange}/>
                    <ul id="menu">
                        <li className={"menu menu_" + this.state.profiles} onClick={() => {this.menuSelect('profiles');}}>FIO Profiles</li>
                        <li className={"menu menu_" + this.state.jobs} onClick={()=>{this.menuSelect('jobs');}}>Job Summary</li>
                    </ul>
                </div>
                <div id="container">
                    <Profiles visibility={this.state.profiles} workers={this.state.workers} changeMenuCallback={this.menuSelect}/>
                    <Jobs visibility={this.state.jobs} activeJobId={this.state.activeJobId}/>
                </div>

            </div>
        );
    }
}


export default App;

