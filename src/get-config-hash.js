const fs = require('fs-extra');

const getConfigHash = path => {

    if (!fs.existsSync(path)) {
        return;
    }

    const dirHash = JSON.parse(fs.readFileSync(path, 'utf8')).sha256;
    return dirHash;
};

module.exports = getConfigHash;
