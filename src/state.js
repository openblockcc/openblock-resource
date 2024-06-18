const UPGRADE_STATE = {
    downloading: 'downloading',
    deleting: 'deleting',
    extracting: 'extracting',
    verifying: 'verifying'
};

const UPGRADE_PROGRESS = {
    start: 0.05,
    downloadResource: 0.75,
    downloadChecksum: 0.77,
    verifyZip: 0.80,
    deletCache: 0.85,
    extractZip: 0.90,
    deletZip: 0.99
};


const UPGRADE_CONTENT = {
    zip: 'zip',
    cache: 'cache'
};

module.exports = {UPGRADE_STATE, UPGRADE_PROGRESS, UPGRADE_CONTENT};
