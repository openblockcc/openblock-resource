const path = require('path');
const fs = require('fs-extra');

const INTERFACE_FILE = 'index.js';

// Check if the resources are official maintenance content
const isOfficial = filePath => {
    let official = false;
    const indexContent = fs.readFileSync(path.join(path.dirname(filePath), INTERFACE_FILE), 'utf8');
    const matchOfficial = indexContent.match(/official: \w+/g);
    if (matchOfficial && matchOfficial.length > 0) {
        official = matchOfficial[0].slice(matchOfficial[0].indexOf(':') + 2) === 'true';
    }
    return official;
};

module.exports = isOfficial;
