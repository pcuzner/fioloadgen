import React from 'react';

import {GenericModal} from '../common/modal.jsx';
import '../app.scss';
import { handleAPIErrors, setAPIURL } from '../utils/utils.js';
import { RadioSet} from '../common/radioset.jsx';
import { Tooltip } from '../common/tooltip.jsx';
import { RatioSlider } from '../common/ratioslider.jsx';

var api_url = setAPIURL();
const ioDepthTip="Changing the IO depth, varies the number of OS queues the FIO tool uses to drive I/O"
const ioTypeTip="Databases typical exhibit random I/O, whereas logging is sequential"
const runTimeTip="Required run time for the test (in minutes)"

export class Profiles extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            profiles: [],
            activeProfile: undefined,
            profileContent: '',
            modalOpen: false,
            workers: {},
        };
        this.spec = {
            runTime: 60,
            ioType: "Random",
            ioBlockSize: "4KB",
            ioPattern: 50,
            ioDepth: 4,
            profileName: '',
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

    checkProfile = (profileName) => {
        return this.state.profiles.includes(profileName);
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
                profileNames.push('custom');
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
                  workers: {},
              });
          })
    }

    selectProfile(event) {
        this.setState({
            activeProfile: event.target.value
        });

        if (event.target.value == "custom") {
            console.log("selected the custom profile type")
        } else {
            this.fetchProfile(event.target.value);
        }

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
    runJob = (parms) => {
        console.debug("run the job - issue a POST request to the API");
        // remove specific attributes from parms object
        delete parms.titleBorder;
        console.debug(JSON.stringify(this.spec))
        if (this.state.activeProfile == 'custom') {
            parms['spec'] = this.spec
        } else {
            parms['spec'] = this.state.profileContent;
        }
        // parms['spec'] = this.state.profileContent;
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
                if (e.status == 202) {
                    console.debug("request accepted (" + e.status + ")")
                    this.props.changeMenuCallback('jobs');
                } else {
                    console.error("POST request to submit job failed with http status " + e.status);
                }
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

    refreshProfiles= () => {
        console.debug("in refresh profiles");
        this.fetchAllProfiles();  // true);
        // clear content in the profile textarea
        // this.setState({
        //     profileContent: ''
        // });
    }
    updateSpec = (kv) => {
        console.log("updating spec ", JSON.stringify(kv))
        Object.assign(this.spec, kv);
    }

    render() {
        console.debug("render profiles called with visibility: ", this.props.visibility);
        if (this.props.visibility != 'active') {
            return (
                <div />
            );
        }
        console.log("workers is set to :" + JSON.stringify(this.props.workers))
        let profileSelector;
        // console.debug("client limit is " + this.props.clientLimit);
        if (this.state.profiles.length > 0) {
            let profileList = this.state.profiles.map((profile, i) => {
                return (<option key={i} value={profile} >{profile}</option>)
            });
            profileSelector = (
                <div className="profile-select">
                    {/* <label htmlFor="profiles">FIO Job profiles : </label> */}
                    <select id="profiles" autoFocus value={this.state.activeProfile} size="10" onChange={()=>{this.selectProfile(event);}}>
                        {profileList}
                    </select>
                    <button className="btn btn-default profile-reload" onClick={() => {this.refreshProfiles();}}>Reload</button><br />
                </div>
            );
        }
        let jobDefinition;
        if (this.state.modalOpen) {
            jobDefinition = (<JobParameters submitHandler={this.submitHandler} workerInfo={this.props.workers} closeHandler={this.closeModal}/>);
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
                        <div id="profile-content-container">
                            <CustomProfile visible={this.state.activeProfile == "custom"} callback={this.updateSpec} checkProfileCallback={this.checkProfile} refreshCallback={this.refreshProfiles}/>
                            <ProfileContent visible={this.state.activeProfile != "custom"} profileContent={this.state.profileContent} />
                        </div>
                    </div>
                    <button className="btn btn-primary profile-run" onClick={() => {this.getJobDetails();}}>Run</button><br />
                </div>
            </div>
        );
    }
}

class CustomProfile extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            ioType: "Random",
            ioPattern: 50,
            ioBlockSize: "4KB",
            runTime: 1,
            ioDepth: 4,
            profileName: '',
            profileStyle: {},
        };
        this.defaults = Object.assign({}, this.state);
        this.ioType = {
            description: "I/O Type:",
            options: ["Random", "Sequential"],
            name: "ioType",
            info: "", // Disk I/O can be issued in a sequential or random manner",
            tooltip: ioTypeTip,
            horizontal: true
        };

    }

    resetButtonHandler = () => {
        // event.preventDefault();
        console.log("defaults are " + JSON.stringify(this.defaults));
        this.setState({
            profileName: '',
            ioPattern: this.defaults.ioPattern,
            ioType: this.defaults.ioType,
            ioBlockSize: this.defaults.ioBlockSize,
            ioDepth: this.defaults.ioDepth,
            runTime: this.defaults.runTime,
            profileStyle:{},
        });

    }
    radioButtonHandler = (event) => {
        // if name is not set this is a select widget
        console.log("in option handler " + event.target.name + " / " + event.target.value);
        this.setState({ioType: event.target.value})
        this.props.callback({ioType: event.target.value});

    }
    sliderHandler = (event) => {
        console.log("in slider handler " + event.target.value);
        this.setState({ioPattern: event.target.value});
        this.props.callback({ioPattern: event.target.value});
    }
    selectHandler = (event) => {
        console.log("in select handler with " + event.target.value);
        this.setState({ioBlockSize: event.target.value});
        this.props.callback({ioBlockSize: event.target.value})
    }
    runtimeHandler = (event) => {
        console.log("in runtime handler " + event.target.name + " / " + event.target.value);
        this.setState({runTime: event.target.value})
        let mins = event.target.value * 60;
        console.log("runtime handler sending runtime of ", mins, "to parent");
        this.props.callback({runTime: mins})
    }
    ioDepthHandler = (event) => {
        console.log("in iodepth handler " + event.target.name + " / " + event.target.value);
        this.setState({ioDepth: event.target.value})
        this.props.callback({ioDepth: event.target.value})
    }
    profileNameUpdater = (event) => {
        let newState = {};
        newState.profileName = event.target.value;

        if (this.props.checkProfileCallback(event.target.value)) {
            console.error("profile exists!")
            newState.profileStyle = {borderColor: "red"};
        } else {
            if (Object.keys(this.state.profileStyle).length > 0) {
                newState.profileStyle = {}
            }
        }
        this.setState(newState);
    }
    profileNameHandler = (event) => {

        if (event.target.value) {
            if (event.target.value != this.state.profileName) {
                console.debug("Profile name updated to " + event.target.value);
                //
                // TODO check that the name doesn't conflict with an existing name
                //
                this.setState({
                    profileName: event.target.value,
                    profileStyle: {},
                });
                this.props.callback({profileName: event.target.value});
            }

        } else {
            if (Object.keys(this.state.profileStyle).length > 0) {
                this.setState({profileStyle: {}});
            }

        }
    }
    saveProfile() {
        let localState = JSON.parse(JSON.stringify(this.state))
        if (this.state.profileName == '') {
            console.debug("profile save requested but no name given")
            this.setState({profileStyle: {
                borderColor: "red"}
                // borderRadius: "5px"}
            });
            return
        }

        if (Object.keys(this.state.profileStyle).length > 0) {
            console.error("Can't save a profile which has been flagged as an error");
            return
        }

        delete localState.profileStyle;
        localState.runTime = localState.runTime * 60;
        console.log("save me " + JSON.stringify(localState))
        fetch(api_url + "/api/profile/" + this.state.profileName, {
            method: 'put',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({spec: localState})
        })
            .then((e) => {
                if (e.status == 200) {
                    console.debug("request accepted (" + e.status + ")")
                    this.props.refreshCallback()
                } else {
                    console.error("PUT request to store profile failed with http status " + e.status);
                }
            })
            .catch((e) => {
                console.error("PUT to /api/profile failed :" + e.message);
            });

    }

    render () {
        if (!this.props.visible) {
            return (
                <div className="hidden"></div>
            )
        }

        return (
            <div className="custom-profile-box">
                <h2>Custom Profile</h2>
                <p>In addition to the IO profiles listed on the left, the custom option allows
                    you to create and then execute one-off I/O profiles.</p>
                <p>Use the options below to define a profile.</p>
                <div className="custom-profile-options-container">
                    <div>
                        <label className="option-title" forhtml="custom-name">Profile Name:</label>
                        <input
                            style={this.state.profileStyle}
                            type="text"
                            autoFocus
                            placeholder="Optional"
                            //defaultValue={this.state.profileName}
                            value={this.state.profileName}
                            onChange={this.profileNameUpdater}
                            onBlur={this.profileNameHandler}
                            title="alphanumeric chars only">
                        </input>
                    </div>
                    <RadioSet config={this.ioType} default={this.state.ioType} callback={this.radioButtonHandler} />
                    <RatioSlider title="IO Pattern:" prefix="Read" suffix="Write" value={this.state.ioPattern} callback={this.sliderHandler}/>
                    <div>
                        <label className="option-title" forhtml="ioSize">I/O Block Size:</label>
                        <select id="ioSize" value={this.state.ioBlockSize} onChange={this.selectHandler}>
                            <option value="4KB">4KB</option>
                            <option value="8KB">8KB</option>
                            <option value="16KB">16KB</option>
                            <option value="32KB">32KB</option>
                            <option value="64KB">64KB</option>
                            <option value="128KB">128KB</option>
                            <option value="1MB">1MB</option>
                            <option value="2MB">2MB</option>
                            <option value="4MB">4MB</option>
                        </select>
                        <label className="option-title" forhtml="io-depth">
                            IO Depth:
                            <span><Tooltip text={ioDepthTip}/></span>
                        </label>
                        <input
                            type="number"
                            id="io-depth"
                            name="io-depth"
                            min="1"
                            max="128"
                            size="3"
                            value={this.state.ioDepth}
                            onChange={this.ioDepthHandler}/>
                    </div>
                    <div>
                        <label className="option-title" forhtml="run-time">
                            Run Time:
                            <span><Tooltip text={runTimeTip}/></span>
                        </label>
                        <input
                            type="number"
                            id="run-time"
                            name="run-time"
                            min="1"
                            max="10"
                            size="4"
                            value={this.state.runTime}
                            onChange={this.runtimeHandler}/>

                    </div>
                    <div>
                        <button className="btn btn-default" onClick={() => {this.resetButtonHandler();}}>Reset</button>
                        <button className="btn btn-default" style={{marginLeft: "10px"}} onClick={() => {this.saveProfile();}}>Save</button>
                    </div>
                </div>
            </div>
        )
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
        if (!this.props.visible) {
            return (
                <div className="hidden" />
            );
        }

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
            workers: 1,
            title: '',
            platform: 'openshift',
            storageclass: '',
            provider: 'aws',
            titleBorder: {},
            workerInfo: {},
        };
    }

    static getDerivedStateFromProps(props, state) {
        let newState = {};
        if (state.storageclass == '' && props.workerInfo) {
            // console.debug("Job Parameters: storageclass is empty but we have something to default to")
            newState.storageclass = Object.keys(props.workerInfo)[0];

        }

        if (JSON.stringify(props.workerInfo) != JSON.stringify(state.workerInfo)) {
            // console.debug("job parameters: setting workerinfo to new props value")
            newState.workerInfo = props.workerInfo;
        }

        return newState;
    }

    shouldComponentUpdate(nextProps, nextState) {
        // console.log("job parameters: should I update")
        if (JSON.stringify(nextProps.workerInfo) !== JSON.stringify(this.props.workerInfo)) {
            // console.debug("job parameters:YES")
            return true;
        }

        if (this.state.workers !== nextState.workers) {
            return true;
        }
        if (this.state.titleBorder !== nextState.titleBorder) {
            return true;
        }
        return false;
    }
    
    updateState = (event) => {
        console.debug("JobParameters:updateState: event target is " + event.target.id + " value is " + event.target.value);
        this.setState({
            [event.target.id]: event.target.value
        });

        if (event.target.id == "storageclass") {
            console.log("JobParameters:updateState: adjust the max workers for storageclass '" + event.target.value +"' to " + this.props.workerInfo[event.target.value]);
            this.maxWorkers = this.props.workerInfo[event.target.value];
        }

        if (event.target.id == 'title') {
            if (event.target.value == "") {
                this.setState({
                    titleBorder: { borderColor: "red", borderRadius: "5px"}
                });
                console.log("JobParameters:updateState: Error - title is empty - make it red");
            } else {
                this.setState({
                    titleBorder: {}
                });
                console.log("JobParameters:updateState: OK - title has content - make it normal");
            }
        }
    }


    callbackHandler = () => {
        if (!this.state.title) {
            this.setState({
                titleBorder: { borderColor: "red", borderRadius: "5px"}
            });
            console.log("JobParameters:callbackHandler: Error - need a title to proceed");
        } else {
            /* call the submitHandler */
            this.props.submitHandler(this.state);
        }
    }

    render() {
        let sc_options;

        if (this.props.workerInfo) {
            sc_options=Object.keys(this.props.workerInfo).map((sc_name, i) => {
                return (<option key={i} value={sc_name} >{sc_name}</option>)
            });
        } else {
            return (<div />);
        }

        let workerMax = this.props.workerInfo[this.state.storageclass];
        console.debug("JobParameters:render: Job Parameters: max workers set to ", workerMax, " for storageclass ", this.state.storageclass);
        console.log("JobParameters:render: workers = " + this.state.workers);
        console.log("JobParameters:render:worker information :" +JSON.stringify(this.props.workerInfo));
        return (
            <div>
                <div>
                    <label className="storageclass" forhtml="storageclass">Storageclass&nbsp; </label>
                    <select id="storageclass" onChange={() => {this.updateState(event);}}>
                        { sc_options }
                    </select>
                    <p />
                </div>
                <div>
                    {/* <div className="inline-block" style={{paddingRight: "10px"}}><b># of workers&nbsp;</b></div> */}
                    <div className="inline-block">
                        <label forhtml="workers"># workers&nbsp; </label>
                        <input id="workers"
                            className="workers-slider"
                            type="range"
                            min="1"
                            max={workerMax}
                            defaultValue={this.state.workers}
                            onChange={this.updateState}
                            step="1"/>
                        {/* {this.state.workers} */}
                        <div className="inline-block" style={{ color: "black", fontWeight: "bold", paddingLeft: "20px"}}>{this.state.workers}</div>
                    </div>

                </div>
                <div></div>
                <div>
                    <p />
                    <label forhtml="title">Job Title<span style={{color: "red", verticalAlign: "super", fontSize: ".8em"}}>*</span>&nbsp;</label>
                    <input
                        style={this.state.titleBorder}
                        type="text"
                        id="title"
                        size="80"
                        name="title"
                        autoFocus
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