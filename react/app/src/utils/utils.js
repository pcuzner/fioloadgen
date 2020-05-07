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
        if (sortOrder == -1) {
            return b[property].toString().localeCompare(a[property].toString());
        } else {
            return a[property].toString().localeCompare(b[property].toString());
        }
    };
}

export function setAPIURL() {
    if (process.env.NODE_ENV == 'development') {
        let port = (process.env.API_PORT || 8080);
        return 'http://localhost:' + port;
    } else {
        return '';
    }
};

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