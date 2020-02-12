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
        console.log("run the job");
    }

    getJobDetails() {
        this.openModal();
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
        return (
            <div id="profiles" className={this.props.visibility}>
                <GenericModal show={this.state.modalOpen} title="hello" content="hello" closeHandler={this.closeModal} />
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

