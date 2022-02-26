const keyMirror = require('keyMirror');

const UPGRADE_STATE = keyMirror({
    downloading: null,
    deleting: null,
    extracting: null,
    verifying: null,
    covering: null
});

const UPGRADE_PROGRESS = {
    start: 0.05,
    downloadResource: 0.75,
    downloadChecksum: 0.77,
    verifyZip: 0.80,
    deletCache: 0.82,
    extractZip: 0.85,
    verifyCache: 0.95,
    deletZip: 0.99
};


const UPGRADE_CONTENT = keyMirror({
    zip: null,
    cache: null
});

const INIT_RESOURCES_STEP = keyMirror({
    verifying: null,
    copying: null
});

module.exports = {UPGRADE_STATE, UPGRADE_PROGRESS, UPGRADE_CONTENT, INIT_RESOURCES_STEP};
