const keyMirror = require('keyMirror');

const UPGRADE_STEP = keyMirror({
    downloading: null,
    deleting: null,
    extracting: null,
    checking: null,
    covering: null
});

const CONTENT = keyMirror({
    downloadedFile: null,
    userDirectory: null
});

const INIT_RESOURCES_STEP = keyMirror({
    checking: null,
    copying: null
});

module.exports = {UPGRADE_STEP, CONTENT, INIT_RESOURCES_STEP};
