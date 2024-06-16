#!/usr/bin/env node

/**
 * @fileoverview
 * Extract i18n content in external resource.
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 * use --strict to enable strict mode, the program will check for useless MSG and
 * case specification e.g: --strict=true
 */

const Walk = require('@root/walk');
const path = require('path');
const fs = require('fs-extra');
const parseArgs = require('../lib/parseArgs');
const locales = require('openblock-l10n').default;

const EXTENSIONS_INTERFACE_FILE = 'index.js';
const EXTENSIONS_BLOCKS_FILE = 'blocks.js';
const EXTENSIONS_TOOLBOX_FILE = 'toolbox.js';
const EXTENSIONS_MSG_FILE = 'msg.js';

const interfaceFormatMessages = [];

const {dir, strict} = parseArgs();

let workDir;
if (dir) {
    workDir = dir;
} else {
    workDir = './';
}

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
        if (!isOfficial(pathName)) {
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

const generateInterfaceMessageJson = _dir => new Promise(resolve => {
    Walk.walk(path.join(_dir), searchInterfaceFormatMessages)
        .then(() => {
            const interfaceMsg = {};
            interfaceFormatMessages.forEach(msg => {
                interfaceMsg[msg.id] = {
                    message: msg.default,
                    description: msg.default ? msg.default : null
                };
            });
            return resolve(interfaceMsg);
        });
});

const blocksFormatMessages = {};

const searchBlocksFormatMessages = (err, pathName, dirent) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    if (!dirent.isDirectory() && path.basename(pathName) === EXTENSIONS_BLOCKS_FILE) {
        if (!isOfficial(pathName)) {
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

            const msgFileData = fs.readFileSync(path.join(path.dirname(pathName), EXTENSIONS_MSG_FILE), 'utf8');
            const processedMsgFileData = msgFileData
                .slice(msgFileData.indexOf('function addMsg (Blockly) {') + 27, msgFileData.lastIndexOf('return Blockly;')) // eslint-disable-line max-len
                .split(/Object.assign\(Blockly.ScratchMsgs.locales./g)
                .filter(item => (/^\s*$/.test(item) === false));

            const msgObj = {};
            processedMsgFileData.forEach(msg => {
                const locale = msg.slice(0, msg.indexOf(', {'))
                    .replace(/\]/g, '')
                    .replace(/'/g, '');

                const value = msg.slice(msg.indexOf(', {') + 2, msg.lastIndexOf(');'))
                    .replace(/(\w+:)([\s]?)("|')/g, matchedStr => `"${matchedStr.substring(0, matchedStr.indexOf(':'))}":"`) // eslint-disable-line max-len
                    .replace(/(\w+ :)([\s]?)("|')/g, matchedStr => `"${matchedStr.substring(0, matchedStr.indexOf(':') - 1)}":"`) // eslint-disable-line max-len
                    .replace(/',/g, '",')
                    .replace(/'\n/g, '"\n')
                    .replace(/\\'/g, '\'')
                    .replace(/\\"/g, '"');
                msgObj[`${locale}`] = JSON.parse(value);
            });

            if (msgKeys) {
                if (!msgObj) {
                    console.error(`Missing translationfile ${path.join(path.dirname(pathName), EXTENSIONS_MSG_FILE)}`);
                    process.exit(1);
                }

                Object.keys(locales).forEach(locale => {
                    // If there is no translation for this language, use en as the default
                    if (!msgObj[`${locale}`]) {
                        msgObj[`${locale}`] = msgObj.en;
                        console.log(`Missing ${locale} translations in file: ${pathName} use en value as the default`);
                    }

                    // Check if there is unused message in the json file.
                    Object.keys(msgObj[`${locale}`]).forEach(key => {
                        if (!msgKeys.includes(key) && strict === 'true') {
                            console.warn(`\x1B[33mFind unused message: "${key}" in file: ${pathName}\x1B[0m`);
                        }
                    });

                    msgKeys.forEach(magKey => {
                        if (magKey.toUpperCase() !== magKey && strict === 'true') {
                            console.warn(`\x1B[33m${magKey} is not upper case\x1B[0m`);
                        }

                        if (msgObj[`${locale}`][magKey]) {
                            blocksFormatMessages[magKey] = msgObj[`${locale}`][magKey];
                        } else {
                            console.log('msgObj[`${locale}`]=', msgObj[`${locale}`]);
                            console.error(`Missing ${locale} of ${magKey} in ${path.join(path.dirname(pathName), EXTENSIONS_MSG_FILE)}`); // eslint-disable-line max-len
                            process.exit(1);
                        }
                    });
                });

                // todo 在这里将数据sort后写回对应文件中
            }
        }
    }
    return Promise.resolve();
};

const generateBlocksMessageJson = _dir => new Promise(resolve => {
    Walk.walk(path.join(_dir), searchBlocksFormatMessages)
        .then(() => resolve(blocksFormatMessages));
});

generateInterfaceMessageJson(workDir)
    .then(interfaceJson => {
        // 第三方interface内容
        // 与当前翻译文件内容合并写回

        // const filePath = path.resolve(workDir, 'translations/interface/en.json');
        // fs.ensureDirSync(path.dirname(filePath));
        // fs.writeFileSync(filePath, interfaceJson);
        // console.log(`Interface i18n is created: ${filePath}`);
    })
    .then(() => generateBlocksMessageJson(workDir))
    .then(blocksJson => {
        // const filePath = path.resolve(workDir, 'translations/blocks/en.json');
        // fs.ensureDirSync(path.dirname(filePath));
        // fs.writeFileSync(filePath, blocksJson);
        // console.log(`Blocks i18n is created: ${filePath}`);
    })
    .then(() => {
        console.log('Complete translate proccess');
    });
