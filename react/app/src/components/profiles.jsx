import React from 'react';

import {GenericModal} from '../common/modal.jsx';
import '../app.scss';
import { setAPIURL } from '../utils/utils.js';

var api_url = setAPIURL();

export class Profiles extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            profiles: [],
            activeProfile: undefined,
            profileContent: '',
            modalOpen: false,
            workers: 1,
        };
    };

    // shouldComponentUpdate(nextProps, PrevProps) {
    //     if (nextProps.visibility == "active"){
    //         console.debug("profiles should render");
    //         return true;
    //     } else {
    //         return false;
    //     }
    // }

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

    fetchAllProfiles() {  //refresh = false) {
        // let endpoint = (refresh == true) ? '/api/profile?refresh=true' : '/api/profile';
        fetch(api_url + '/api/profile')
            .then((response) => {
                console.debug("Profile fetch : ", response.status);
                if (response.status == 200) {
                    return response.json();
                } else {}
                    throw Error(`Profile fetch failed with HTTP status: ${response.status}`);
                })
            .then((profiles) => {
                /* Happy path */
                let profileNames = [];
                profiles.data.forEach(profile => {
                    profileNames.push(profile.name);
                });
                this.setState({
                    profiles: profileNames,
                });
                console.log(profiles);
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    componentDidMount() {

        this.fetchAllProfiles();

        fetch(api_url + "/api/status")
          .then((response) => {
              console.log("Initial status call ", response.status);
            //   console.log(JSON.stringify(response.json()));
              return response.json();
          })
          .then((status) => {
              console.log(status.data);
              this.setState({
                  workers: status.data.workers,
              });
          })
          .catch((error) => {
              console.error("initial status call failure, unable to fetch worker info, using default of 0");
              this.setState({
                  workers: 0,
              });
          })
    }

    selectProfile(event) {
        this.setState({activeProfile: event.target.value});
        this.fetchProfile(event.target.value);
    }

    fetchProfile(profileName) {
        console.debug("fetching profile " + profileName);
        fetch(api_url + "/api/profile/" + profileName)
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
                  profileContent: profile.data
              });
          })
          .catch((error) => {
              console.error("Profile fetch error:", error);
          });
    }
    runJob(parms) {
        console.debug("run the job - issue a put request to the API");
        // remove specific attributes from parms object
        delete parms.titleBorder;
        parms['spec'] = this.state.profileContent;
        console.debug("in runJob handler " + JSON.stringify(parms));
        console.debug("profile is " + this.state.activeProfile);

        fetch(api_url + "/api/job/" + this.state.activeProfile, {
            method: 'post',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(parms)
        })
            .then((e) => {
                console.log("request submitted")
            })
            .catch((e) => {
                console.log(JSON.stringify(e));
                console.error("Post to /api/job failed " + e.status);
            });

    }

    getJobDetails() {
        if (this.state.activeProfile) {
            this.openModal();
        }
    }
    submitHandler = (parms) => {
        console.debug("in submit handler " + JSON.stringify(parms));
        this.closeModal()
        this.runJob(parms)
    }

    refreshProfiles() {
        console.debug("in refresh profiles");
        this.fetchAllProfiles();  // true);
        // clear content in the profile textarea
        // this.setState({
        //     profileContent: ''
        // });
    }

    render() {
        console.debug("render profiles called with visibility: ", this.props.visibility);
        if (this.props.visibility != 'active') {
            return (
                <div />
            );
        }

        let profileSelector;
        // console.debug("client limit is " + this.props.clientLimit);
        if (this.state.profiles.length > 0) {
            let profileList = this.state.profiles.map((profile, i) => {
                return (<option key={i} value={profile} >{profile}</option>)
            });
            profileSelector = (
                <div className="profile-select">
                    {/* <label htmlFor="profiles">FIO Job profiles : </label> */}
                    <select id="profiles" value={this.state.activeProfile} size="10" onChange={()=>{this.selectProfile(event);}}>
                        {profileList}
                    </select>
                    <button className="btn btn-default profile-reload" onClick={() => {this.refreshProfiles();}}>Reload</button><br />
                </div>
            );
        }
        let jobDefinition;
        if (this.state.modalOpen) {
            jobDefinition = (<JobParameters submitHandler={this.submitHandler} clientLimit={this.props.workers} closeHandler={this.closeModal}/>);
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
            profileContent: '',
        };
    }

    render () {
        let content;
        if (this.props.profileContent == '') {
            content = (<div className="profile-msg">&nbsp;Choose a profile to view the FIO specification</div>);
        } else {
            content = (<pre>{this.props.profileContent}</pre>);
        }

        return (
            <div className="profile-info">
                {content}
                {/* <textarea style={{resize: "none"}} rows="30" cols="60" readOnly={this.state.readonly} value={content} /> */}
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
            workers: props.clientLimit,
            title: '',
            platform: 'openshift',
            provider: 'aws',
            titleBorder: {},
        };
    }

    updateState(event) {
        /* Could add additional logic here to validate content? */
        this.setState({
            [event.target.id]: event.target.value
        });
        if (event.target.id == 'title') {
            if (event.target.value == "") {
                this.setState({
                    titleBorder: { borderColor: "red", borderRadius: "5px"}
                });
                console.log("title is empty - make it red");
            } else {
                this.setState({
                    titleBorder: {}
                });
                console.log("title has content - make it normal");
            }
        }
    }

    callbackHandler = () => {
        if (!this.state.title) {
            this.setState({
                titleBorder: { borderColor: "red", borderRadius: "5px"}
            });
            console.log("need a title to proceed");
        } else {
            /* call the submitHandler */
            this.props.submitHandler(this.state);
        }
    }

    render() {
        return (
            <div>
                <div>
                    <div className="inline-block" style={{paddingRight: "10px"}}><b># of workers/clients&nbsp;</b></div>
                    <div className="inline-block">
                        <input id="workers"
                            className="workers-slider"
                            type="range"
                            min="1"
                            max={this.props.clientLimit}
                            value={this.state.workers}
                            onChange={() => {this.updateState(event);}}>
                        </input>
                        <div className="inline-block" style={{ color: "red", paddingLeft: "20px"}}>{this.state.workers}</div>
                    </div>
                </div>
                <div>
                    <p />
                    <label forhtml="title">Job Title<span style={{color: "red", verticalAlign: "super", fontSize: ".8em"}}>*</span>&nbsp;</label>
                    <input
                        style={this.state.titleBorder}
                        type="text"
                        id="title"
                        size="80"
                        name="title"
                        placeholder="Enter a title that uniquely describes the test run"
                        onChange={() => {this.updateState(event);}}/>
                    <p />

                    <label forhtml="platform">Platform&nbsp; </label>
                    <select id="platform" onChange={() => {this.updateState(event);}}>
                        <option value="openshift">Openshift</option>
                        <option value="kubernetes">Kubernetes</option>
                    </select>
                    <p />
                    <label forhtml="provider" >Provider&nbsp; </label>
                    <select id="provider" onChange={() => {this.updateState(event);}}>
                        <option value="aws">AWS</option>
                        <option value="vmware">VMware</option>
                        <option value="baremetal">Bare metal</option>
                    </select>
                    <div>
                        <button className="float-right modal-close btn btn-primary"
                            onClick={this.callbackHandler}>Submit</button>
                        <button className="float-right modal-close btn btn-default"
                            onClick={this.props.closeHandler}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }
}