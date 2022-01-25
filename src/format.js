const formatSize = size => {
    let formatedSize;
    if (size < 1024) {
        formatedSize = `${Math.round(size)} B`;
    } else if (size < 1024 * 1024) {
        formatedSize = `${Math.round(size / 1024)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
        formatedSize = `${Math.round(size / 1024 / 1024)} MB`;
    } else {
        formatedSize = `${Math.round(size / 1024 / 1024 / 1024)} GB`;
    }
    return formatedSize;
};

const formatTime = time => {
    let formatedTime;
    if (time < 60) {
        formatedTime = `${Math.round(time)}s`;
    } else {
        formatedTime = `${Math.round(time / 60)}min${Math.round(time % 60)}s`;
    }
    return formatedTime;
};

module.exports = {formatSize, formatTime};
