const formatTime = time => {
    let formatedTime;
    if (time < 60) {
        formatedTime = `${Math.round(time)}s`;
    } else {
        formatedTime = `${Math.round(time / 60)}min${Math.round(time % 60)}s`;
    }
    return formatedTime;
};

module.exports = {formatTime};
