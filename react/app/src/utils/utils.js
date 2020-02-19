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
        if (sortOrder == -1) {
            return b[property].toString().localeCompare(a[property].toString());
        } else {
            return a[property].toString().localeCompare(b[property].toString());
        }
    };
}

export function setAPIURL() {
    if (process.env.NODE_ENV == 'development') {
        return 'http://localhost:8080';
    } else {
        return '';
    }
};

export function summarizeLatency(latency) {
    // reformat latency object into string of min/avg/max
    return decPlaces(latency.min / 1000000) + '/' + decPlaces(latency.mean/1000000) + "/" + decPlaces(latency.max/1000000);
}

export function decPlaces(num, precision = 2) {
    // 2 dec places by default
    let m = Math.pow(10, precision);
    return Math.round( ( num + Number.EPSILON ) * m ) / m;
}