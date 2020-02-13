import React from 'react';
import {GenericModal} from '../common/modal.jsx';
import '../app.scss';

export class Profiles extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            profiles: [],
            activeProfile: '',
            profileContent: '',
            modalOpen: false
        };
    };

    openModal() {
        this.setState({
            modalOpen: true
        });
    }
    closeModal = () => {
        this.setState({
            modalOpen: false
        });
    }

    componentDidMount() {
        fetch("http://localhost:8080/api/profile")
          .then((response) => {
              console.debug("Profile fetch : ", response.status);
              if (response.status == 200) {
                  return response.json();
              } else {}
                  throw Error(`Fetch failed with HTTP status: ${response.status}`);
              })
          .then((profiles) => {
              /* Happy path */
              let profileNames = [];
              profiles.data.forEach(profile => {
                profileNames.push(profile.name);
              });
              this.setState({
                profiles: profileNames
              });
              console.log(profiles);
          })
          .catch((error) => {
              console.error("Error:", error);
          });
    }

    selectProfile(event) {
        this.fetchProfile(event.target.value);
    }

    fetchProfile(profileName) {
        console.debug("fetching profile " + profileName);
        fetch("http://localhost:8080/api/profile/" + profileName)
          .then((response) => {
              console.debug("Profile fetch : ", response.status);
              if (response.status == 200) {
                  return response.json();
              } else {}
                  throw Error(`Fetch failed with HTTP status: ${response.status}`);
              })
          .then((profile) => {
              /* Happy path */
              this.setState({
                  activeProfile: profileName,
                  profileContent: profile.data
              });
          })
          .catch((error) => {
              console.error("Profile fetch error:", error);
          });
    }
    runJob() {
        console.debug("run the job - issue a put request to the API");
    }

    getJobDetails() {
        if (this.state.activeProfile) {
            this.openModal();
        }
    }
    submitHandler = (parms) => {
        console.debug("in submit handler " + JSON.stringify(parms));
        this.closeModal()
        this.runJob()
    }

    render() {
        let profileSelector;
        if (this.state.profiles.length > 0) {
            let profileList = this.state.profiles.map((profile, i) => {
                return (<option key={i} value={profile}>{profile}</option>)
            });
            profileSelector = (
                <div className="profile-select">
                    {/* <label htmlFor="profiles">FIO Job profiles : </label> */}
                    <select id="profiles" size="10" onChange={()=>{this.selectProfile(event);}}>
                        {profileList}
                    </select>
                    <button className="btn btn-default profile-reload" onClick={() => {alert('refresh profile list');}}>Reload</button><br />
                </div>
            );
        }
        let jobDefinition;
        if (this.state.modalOpen) {
            jobDefinition = (<JobParameters submitHandler={this.submitHandler}/>); 
        } else {
            jobDefinition = (<div />);
        }
        
        return (
            <div id="profiles" className={this.props.visibility}>
                <GenericModal 
                    show={this.state.modalOpen} 
                    title={"Runtime Parameters : " + this.state.activeProfile} 
                    content={jobDefinition} 
                    closeHandler={this.closeModal} />
                <br />
                <div className="profile-container">
                    <div style={{ display: "flex"}}>
                        {profileSelector}
                        <ProfileContent profileContent={this.state.profileContent} />
                    </div>
                    <button className="btn btn-primary profile-run" onClick={() => {this.getJobDetails();}}>Run</button><br />
                </div>
            </div>
        );
    }
}

class ProfileContent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            readonly: true,
            profileContent: ''
        };
    }

    render () {
        return (
            <div className="profile-info">
                <textarea style={{resize: "none"}} rows="30" cols="60" readOnly={this.state.readonly} value={this.props.profileContent} />
            </div>
        );
    }
}

export default Profiles;


class JobParameters extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            example: true,
            workers: 5
        };
    }
    updateWorkers(event) {
        this.setState({
            workers: event.target.value
        });
    }

    callbackHandler = () => {
        this.props.submitHandler(this.state);
    }

    render() {
        return (
            <div>
                <div>
                    <div className="inline-block" style={{paddingRight: "10px"}}><b># of workers/clients:</b></div>
                    <div className="inline-block">
                        <input id="workers" className="workers-slider" type="range" min="1" max="10" value={this.state.workers} onChange={() => {this.updateWorkers(event);}}></input>
                        <div className="inline-block" style={{ color: "red", paddingLeft: "20px"}}>{this.state.workers}</div>
                    </div>
                </div>
                <div>
                    <p />
                    <label forhtml="title">Job Title:</label>
                    <input type="text" id="title" size="80" name="title" />
                    <p />
                    <label forhtml="platform">Platform:</label>
                    <select id="platform">
                        <option value="openshift">Openshift</option>
                        <option value="kubernetes">Kubernetes</option>
                    </select>
                    <p />
                    <label forhtml="provider">Infrastructure Provider:</label>
                    <select id="provider">
                        <option value="aws">AWS</option>
                        <option value="vmware">VMware</option>
                        <option value="baremetal">Bare metal</option>
                    </select> 
                    <button className="modal-close btn btn-primary"
                        onClick={this.callbackHandler}>Submit</button>
                </div>
            </div>
        );
    }
}