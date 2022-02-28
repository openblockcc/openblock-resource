const UPGRADE_STATE = {
    downloading: 'downloading',
    deleting: 'deleting',
    extracting: 'extracting',
    verifying: 'verifying'
};

const UPGRADE_PROGRESS = {
    start: 0.10,
    downloadResource: 0.75,
    downloadChecksum: 0.77,
    verifyZip: 0.80,
    deletCache: 0.82,
    extractZip: 0.85,
    verifyCache: 0.95,
    deletZip: 0.99
};


const UPGRADE_CONTENT = {
    zip: 'zip',
    cache: 'cache'
};

const INIT_RESOURCES_STEP = {
    verifying: 'verifying',
    copying: 'copying'
};

module.exports = {UPGRADE_STATE, UPGRADE_PROGRESS, UPGRADE_CONTENT, INIT_RESOURCES_STEP};
