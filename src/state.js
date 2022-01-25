const keyMirror = require('keyMirror');

const UPGRADE_STEP = keyMirror({
    downloading: null,
    deleting: null,
    extracting: null,
    checking: null,
    covering: null
});

const CHECKING_CONTENT = keyMirror({
    zip: null,
    directory: null
});

const INIT_RESOURCES_STEP = keyMirror({
    checking: null,
    copying: null
});

module.exports = {UPGRADE_STEP, CHECKING_CONTENT, INIT_RESOURCES_STEP};
