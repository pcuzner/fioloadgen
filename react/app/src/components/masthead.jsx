import React from 'react';
import '../app.scss';
/* Masthead will contain a couple of items from the webservice status api
   to show mode, task active, job queue size
*/

export class MastHead extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            version: 1
        };
    };
    componentDidMount() {
        fetch("http://localhost:8080/api/status")
          .then((response) => {
              console.debug("status fetch : ", response.status);
              if (response.status == 200) {
                  return response.json();
              } else {}
                  throw Error(`status API call failed with HTTP status: ${response.status}`);
              })
          .then((status) => {
              /* Happy path */
              console.log(JSON.stringify(status));
          })
          .catch((error) => {
              console.error("Error:", error);
          });
    }

    render() {
        return (
            <div id="masthead">
                <h1>LoadGen</h1>
            </div>
        );
    }
}

export default MastHead;

