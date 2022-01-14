#!/usr/bin/env node

/**
 * @fileoverview
 * Extract i18n content in external resource.
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 */

const Walk = require('@root/walk');
const path = require('path');
const fs = require('fs-extra');
const parseArgs = require('../script/parseArgs');

const EXTENSIONS_INTERFACE_FILE = 'index.js';
const EXTENSIONS_BLOCKS_FILE = 'blocks.js';
const EXTENSIONS_TOOLBOX_FILE = 'toolbox.js';
const EXTENSIONS_MSG_FILE = 'msg.json';

const interfaceFormatMessages = [];

// Dont't add unofficial content in to community translation
const isOfficial = filePath => {
    let official = false;
    const indexContent = fs.readFileSync(path.join(path.dirname(filePath), EXTENSIONS_INTERFACE_FILE), 'utf8');
    const matchOfficial = indexContent.match(/official: \w+/g);
    if (matchOfficial && matchOfficial.length > 0) {
        official = matchOfficial[0].slice(matchOfficial[0].indexOf(':') + 2) === 'true';
    }
    return official;
};

const searchInterfaceFormatMessages = (err, pathName, dirent) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    if (!dirent.isDirectory() && path.basename(pathName) === EXTENSIONS_INTERFACE_FILE) {
        if (isOfficial(pathName)) {
            const content = fs.readFileSync(pathName, 'utf8');
            const matchedContent = content.match(/formatMessage\({([\s\S]*?)}\)/g);
            if (matchedContent) {
                matchedContent.forEach(msg => {
                    const preproccessedMsg = msg.slice(msg.indexOf('(') + 1, msg.lastIndexOf(')'))
                        .replace(/\n/g, '')
                        .replace(/(\w+:)/g, matchedStr => `"${matchedStr.substring(0, matchedStr.length - 1)}":`)
                        .replace(/'/g, '"')
                        .replace(/" *\+ *"/g, ''); // combine addition expression
                    try {
                        const msgObj = JSON.parse(preproccessedMsg);
                        interfaceFormatMessages.push(msgObj);
                    } catch (e) {
                        console.error(`Error parsing ${msg} in ${pathName}: ${e}`);
                        process.exit(1);
                    }
                });
            }
        }
    }
    return Promise.resolve();
};

const generateInterfaceMessageJson = dir => new Promise(resolve => {
    Walk.walk(path.join(dir), searchInterfaceFormatMessages)
        .then(() => {
            const interfaceMsg = {};
            interfaceFormatMessages.forEach(msg => {
                interfaceMsg[msg.id] = {
                    message: msg.default,
                    description: msg.default ? msg.default : null
                };
            });

            const interfaceJson = JSON.stringify(interfaceMsg, null, 4);
            return resolve(interfaceJson);
        });
});

const blocksFormatMessages = {};

const searchBlocksFormatMessages = (err, pathName, dirent) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    if (!dirent.isDirectory() && path.basename(pathName) === EXTENSIONS_BLOCKS_FILE) {
        if (isOfficial(pathName)) {
            const blocksContent = fs.readFileSync(pathName, 'utf8');
            let blocksMsgKeys = blocksContent.match(/Blockly.Msg.\w+/g);
            if (blocksMsgKeys) {
                blocksMsgKeys = blocksMsgKeys.map(key => key.slice(key.lastIndexOf('.') + 1));
            }

            const toolboxContent = fs.readFileSync(path.resolve(path.dirname(pathName),
                EXTENSIONS_TOOLBOX_FILE), 'utf8');
            let toolboxMsgKeys = toolboxContent.match(/%{BKY_\w+_\w+}/g);
            if (toolboxMsgKeys) {
                toolboxMsgKeys = toolboxMsgKeys.map(key => key.slice(key.indexOf('_') + 1, -1));
            }

            const msgKeys = blocksMsgKeys.concat(toolboxMsgKeys);
            const msgJsonFileData = JSON.parse(fs.readFileSync(path.join(path.dirname(pathName),
                EXTENSIONS_MSG_FILE), 'utf8'));
            if (msgKeys) {
                if (!msgJsonFileData) {
                    console.error(`Missing translationfile ${path.join(path.dirname(pathName), EXTENSIONS_MSG_FILE)}`);
                    process.exit(1);
                }

                // Check if there is unused message in the json file.
                Object.keys(msgJsonFileData).forEach(key => {
                    if (!msgKeys.includes(key)) {
                        console.warn(`\x1B[33mFind unused message: "${key}" in file: ${pathName}\x1B[0m`);
                    }
                });

                msgKeys.forEach(magKey => {
                    if (magKey.toUpperCase() !== magKey) {
                        console.warn(`${magKey} is not upper case`);
                    }

                    if (msgJsonFileData[magKey]) {
                        blocksFormatMessages[magKey] = msgJsonFileData[magKey];
                    } else {
                        console.error(`Missing ${magKey} in ${path.join(path.dirname(pathName), EXTENSIONS_MSG_FILE)}`);
                        process.exit(1);
                    }
                });
            }
        }
    }
    return Promise.resolve();
};

const generateBlocksMessageJson = dir => new Promise(resolve => {
    Walk.walk(path.join(dir), searchBlocksFormatMessages)
        .then(() => {
            const blocksJson = JSON.stringify(blocksFormatMessages, null, 4);
            return resolve(blocksJson);
        });
});

const {dir} = parseArgs();

let workDir;
if (dir) {
    workDir = dir;
} else {
    workDir = './';
}

generateInterfaceMessageJson(workDir)
    .then(interfaceJson => {
        const filePath = path.resolve(workDir, 'translations/interface/en.json');
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeFileSync(filePath, interfaceJson);
        console.log(`Interface i18n is created: ${filePath}`);
    })
    .then(() => generateBlocksMessageJson(workDir))
    .then(blocksJson => {
        const filePath = path.resolve(workDir, 'translations/blocks/en.json');
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeFileSync(filePath, blocksJson);
        console.log(`Blocks i18n is created: ${filePath}`);
    })
    .then(() => {
        console.log('Complete translate proccess');
    });
