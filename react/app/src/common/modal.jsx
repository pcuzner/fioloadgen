import React from 'react';
import '../app.scss';


export class GenericModal extends React.Component {
    //
    // generic modal component, with title bar and close button
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        let showHideClass = this.props.show ? 'modal display-block' : 'modal display-none';
        let closeButton = (<div></div>);
        if (this.props.withClose) {
            closeButton = (<div>
                                <button className="modal-close btn btn-primary"
                                    onClick={this.props.closeHandler}>Close</button>
                           </div>);
        }
        return (
            <div className={showHideClass}>
                <div className="modal-main">
                    <WindowTitle title={this.props.title} closeHandler={this.props.closeHandler} />
                    <div className="modal-content-container">
                        <div className="modal-inner">
                            { this.props.content }
                            <br />
                        </div>
                    {closeButton}
                    </div>
                </div>
            </div>
        );
    }
}

export class WindowTitle extends React.Component {
    render () {
        return (
            <div className="modal-title-bar">
                <div className="float-left modal-title">{this.props.title}</div>
                <div className="float-right close-symbol" onClick={() => { this.props.closeHandler() }} />
            </div>
        );
    }
}