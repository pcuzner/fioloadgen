/**
 * Function to sort alphabetically an array of objects by some specific key.
 *
 * @param {String} property Key of the object to sort.
 */
export function sortByKey(property) {
    var sortOrder = 1;

    if (property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }

    return function (a, b) {
        a[property] = a[property] || 9999999999;
        b[property] = b[property] || 9999999999;
        if (sortOrder === -1) {
            return b[property].toString().localeCompare(a[property].toString());
        } else {
            return a[property].toString().localeCompare(b[property].toString());
        }
    };
}

export function setAPIURL() {
    let u = new URL(window.location.href);
    console.log("Attached to url : ", u.host);
    var api_url = u.protocol + '//' + u.hostname;
    if ( u.port !== null ) {
        api_url += ':8080';
    }
    console.log('Setting API URL to ', api_url);
    return api_url;
}

export function summarizeLatency(latency) {
    // reformat latency object into list
    return [decPlaces(latency.min / 1000000), decPlaces(latency.mean/1000000), decPlaces(latency.max/1000000), decPlaces(latency.stddev/1000000)];
}

export function decPlaces(num, precision = 2) {
    // 2 dec places by default
    let m = Math.pow(10, precision);
    return Math.round( ( num + Number.EPSILON ) * m ) / m;
}

export function handleAPIErrors(response) {
    if (!response.ok) {
        throw Error(response.statusText);
    }
    return response.json();
}

export function copyToClipboard(text) {
    console.log("copying to clipboard");
    var textField = document.createElement('textarea');
    textField.innerText = text;
    document.body.appendChild(textField);
    textField.select();
    document.execCommand('copy');
    textField.remove();
}

export function formatTimestamp(timestamp) {
    let t = new Date(timestamp * 1000);
    // let t_str = t.toLocaleString()
    return t.getFullYear() + '/' +
            (t.getMonth() + 1).toString().padStart(2, '0') + '/' +
            t.getDate().toString().padStart(2, '0') + ' ' +
            t.getHours().toString().padStart(2, '0') + ':' +
            t.getMinutes().toString().padStart(2, '0') + ':' +
            t.getSeconds().toString().padStart(2, '0');
}

export function getElapsed(start, end) {
    let elapsedDate = (end - start);
    let t = new Date(elapsedDate * 1000);
    return t.getMinutes().toString() + 'm ' + t.getSeconds().toString() + 's';
}

export function shortJobID(jobUUID) {
    return jobUUID.split('-')[0];
}

export function capitalise(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}