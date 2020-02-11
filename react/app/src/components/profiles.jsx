import React from 'react';
import '../app.scss';

export class Profiles extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            profiles: []
        };
    };

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

    render() {
        let profileSelector;
        if (this.state.profiles.length > 0) {
            let profileList = this.state.profiles.map((profile, i) => {
                return (<option key={i} value={profile}>{profile}</option>)
            });
            profileSelector = (
                <div>
                    <label htmlFor="profiles">FIO Job profiles : </label>
                    <select id="profiles">
                        {profileList}
                    </select>
                </div>
            );
        } 
        return (
            <div id="profiles" className={this.props.visibility}>
                <br />
                {profileSelector}
                <p />
                <button type="button" onClick={() => {alert('refresh profile list');}}>Reload</button><br />
                <button type="button" onClick={() => {alert('show profile details');}}>Show</button><br />
                <button type="button" onClick={() => {alert('run a profile');}}>Execute</button><br />
            </div>
        );
    }
}

export default Profiles;

