import React from 'react';
import '../app.scss';

export class RatioSlider extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: props.value,
            prefixValue: props.value,
            suffixValue: props.value,
        };
    }
    //
    // Simple tooltip widget
    // constructor(props) {
    //     super(props);

    //     this.state = {
    //         timer: 0,
    //         active: false
    //     };
    //     this.loadInterval = 0;
    // }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.value !== this.props.value) {
            console.log("value changed! :" + this.props.value);
            this.setState({
                value: this.props.value,
                prefixValue: 100 - this.props.value,
                suffixValue: this.props.value,
            });
            // this.updateDefault(this.props.default);
        }
    }
    updateHandler = (event) => {
        console.log("slider changed " + event.target.value);

        this.setState({
            value: event.target.value,
            prefixValue: 100 - event.target.value,
            suffixValue: event.target.value,
        });
        this.props.callback(event);
    }

    render() {
        console.debug("in ratioslider render")
        return (
            <div>
                <div className="inline-block">
                    <span className="option-title"><b>{this.props.title}</b></span>
                </div>
                <div className="inline-block">
                    <span className="ratio-text">{this.props.prefix}</span>
                    <span className="ratio-value">{this.state.prefixValue}%</span>
                </div>
                <div className="inline-block">
                    <input
                        className="inline-block ratio-slider"
                        type="range"
                        min="0"
                        max="100"
                        value={this.props.value}
                        onChange={this.updateHandler}>
                    </input>
                </div>
                <div className="inline-block">
                    <span className="ratio-text">{this.props.suffix}</span>
                    <span className="ratio-value">{this.state.suffixValue}%</span>
                </div>
            </div>);
    }
}
