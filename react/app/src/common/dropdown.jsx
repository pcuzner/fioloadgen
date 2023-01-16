import React from 'react';
import '../app.scss';


export class DropDownOptions extends React.Component {
    //
    // Basic drop down component inspired by w3schools
    constructor(props) {
        super(props);
        this.state = {
            contentVisible: false
        };
    }

    optionsOff = () => {
        this.setState({
            contentVisible: false
        });

    }

    toggleOptions = () => {
        console.debug("show/hide dropdown options");
        this.setState({
            contentVisible: !this.state.contentVisible
        });

    }

    optionSelected = (opt) => {
        console.debug("dropdown:optionSelected: returning " + opt);
        this.setState({
            contentVisible: false
        });
        this.props.callback(opt);
    } 

    shouldComponentUpdate(nextProps, nextState) {
        if (JSON.stringify(nextProps.optionMap) !== JSON.stringify(this.props.optionMap)) {
            return true;
        }
        if (nextProps.disabled !== this.props.disabled) {
            return true;
        }
        if (this.state.contentVisible !== nextState.contentVisible) {
            return true;
        }
        return false;
    }
    

    render() {
        console.debug('dropdown:render: processing');
        let options;
        if (this.state.contentVisible) {
            options = "dropdown-content dropdown-content-visible";
        } else {
            options = "dropdown-content dropdown-content-hidden";
        }
        let dropDownOptions;
        if (this.state.contentVisible){
            dropDownOptions = this.props.optionMap.map((option, i) => {
                return (
                    <button key={i} className="button-link" onMouseDown={() => {this.optionSelected(option.name)}}>{option.text}</button> 
                    // <a href="#" key={i} onClick={() => {this.optionSelected(option.name)}}>{option.text}</a>
                );
            });

        } else {
            dropDownOptions = (<div />);
        }
        return (
            // }>
            //onMouseOut={() => {this.toggleOptions()}}
            <div className="dropdown" onBlur={() => {this.optionsOff()}}> 
                <button disabled={this.props.disabled} onClick={() => {this.toggleOptions()}} className="btn btn-secondary">{this.props.label}<span className="caret"/></button>
                <div className={options}>
                    {dropDownOptions}
                </div>
            </div>
        );
    }
}
