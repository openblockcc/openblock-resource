const path = require('path');
const fs = require('fs-extra');
const esprima = require('esprima');

const INTERFACE_FILE = 'index.js';

const extractOfficialValue = jsCode => {
    const ast = esprima.parseScript(jsCode, {comment: true, tokens: true, range: true});

    const officialValues = [];

    for (let i = 0; i < ast.tokens.length; i++) {
        const token = ast.tokens[i];

        if (token.type === 'Identifier' && token.value === 'official') {
            const colonToken = ast.tokens[i + 1];
            if (colonToken && colonToken.type === 'Punctuator' && colonToken.value === ':') {
                const valueToken = ast.tokens[i + 2];
                if (valueToken && (valueToken.type === 'Boolean' ||
                    valueToken.type === 'Identifier' || valueToken.type === 'Numeric')) {
                    officialValues.push(valueToken.value);
                }
            }
        }
    }

    return officialValues;
};


// Check if the resources are official maintenance content
const isOfficial = filePath => {
    let official = false;
    const indexContent = fs.readFileSync(path.join(path.dirname(filePath), INTERFACE_FILE), 'utf8');

    if (extractOfficialValue(indexContent)[0]) {
        official = true;
    }

    const matchOfficial = indexContent.match(/official: \w+/g);
    if (matchOfficial && matchOfficial.length > 0) {
        official = matchOfficial[0].slice(matchOfficial[0].indexOf(':') + 2) === 'true';
    }
    return official;
};

module.exports = isOfficial;
