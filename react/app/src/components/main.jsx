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
            current: 'profiles'
        };
    };

    menuSelect(item) {
        if (item != this.state.current) {
            let newState = {
                current: item,
                profiles: 'inactive',
                jobs:'inactive'
            };
            newState[item] = 'active';
            console.log(item);
            this.setState(newState);
        }
    }

    render() {
        return (
            <div>
                <MastHead />
                <ul id="menu">
                    <li className={"menu_" + this.state.profiles} onClick={() => {this.menuSelect('profiles');}}>FIO Profiles</li>
                    <li className={"menu_" + this.state.jobs} onClick={()=>{this.menuSelect('jobs');}}>Job Summary</li>
                </ul>
                <div id="container">
                    <Profiles visibility={this.state.profiles}/>
                    <Jobs visibility={this.state.jobs}/>
                </div>
                
            </div>
        );
    }
}


export default App;

