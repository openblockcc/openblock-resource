#!/usr/bin/env node

/**
 * @fileoverview
 * Get translations from transifex and generate and update local translation files.
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 */

const fs = require('fs');
const path = require('path');
const Walk = require('@root/walk');
const locales = require('openblock-l10n').default;
const {txPull} = require('openblock-l10n/lib/transifex.js');
const validateTranslations = require('../lib/validate');
const parseArgs = require('../lib/parseArgs');
const isOfficial = require('../lib/is-official');

const usage = `
 Pull supported language translations from Transifex. Usage:
   node update-translations.js
   NOTE: TX_TOKEN environment variable needs to be set with a Transifex API token.
 `;
// Fail immediately if the TX_TOKEN is not defined
if (!process.env.TX_TOKEN) {
    process.stdout.write(usage);
    process.exit(1);
}

// Globals
const PROJECT = 'openblock-resources';
const INTERFACE_RESOURCE = 'interface';
const EXTENSION_RESOURCE = 'extensions';
const BLOCKS_RESOURCE = 'blocks';
const MODE = 'reviewed';
const SOURCE_LOCALE = 'en';

const INTERFACE_FILE = 'index.js';
const BLOCKS_MSGS_FILE = 'msg.json';
const EXTENSIONS_FILE = 'main.js';

const DIST_FILE = 'msg.json';

const {dir} = parseArgs();

let workDir;
if (dir) {
    workDir = dir;
} else {
    workDir = './';
}

const localeMap = {
    'aa-dj': 'aa_DJ',
    'es-419': 'es_419',
    'pt-br': 'pt_BR',
    'zh-cn': 'zh_CN',
    'zh-tw': 'zh_TW'
};

const getLocaleData = async function (resource, locale) {
    const txLocale = localeMap[locale] || locale;
    const data = await txPull(PROJECT, resource, txLocale, MODE);
    return {
        locale: locale,
        translations: data
    };
};

const getAllLocaleData = async () => {
    const localeData = {};
    localeData[INTERFACE_RESOURCE] = await Promise.all(
        Object.keys(locales).map(async key => await getLocaleData(INTERFACE_RESOURCE, key)));
    localeData[EXTENSION_RESOURCE] = await Promise.all(
        Object.keys(locales).map(async key => await getLocaleData(EXTENSION_RESOURCE, key)));
    localeData[BLOCKS_RESOURCE] = await Promise.all(
        Object.keys(locales).map(async key => await getLocaleData(BLOCKS_RESOURCE, key)));

    return localeData;
};

const splitLocales = async localeData => {
    const splitedLocales = {};

    const walkMsgFiles = (e, pathName, dirent) => {
        if (e) {
            console.error(e);
            process.exit(1);
        }

        if (!dirent.isDirectory() && path.basename(pathName) === INTERFACE_FILE) {
            const interfaceFile = path.join(path.dirname(pathName), INTERFACE_FILE);

            const official = isOfficial(interfaceFile);

            // TODO 如果不是 official 则不读取 翻译内容，而是 直接将blocks msg和interface extension中的默认内容直接赋英文。
            // if (official) {
            splitedLocales[pathName] = {};

            /* Step1: Generate interface content */
            splitedLocales[pathName][INTERFACE_RESOURCE] = {};

            const indexContent = fs.readFileSync(interfaceFile, 'utf8');

            const matchedIndexContent = indexContent.match(/formatMessage\({([\s\S]*?)}\)/g);
            if (matchedIndexContent) {
                const interfaceMsgs = matchedIndexContent.map(msg => {
                    const preproccessedMsg = msg.slice(msg.indexOf('(') + 1, msg.lastIndexOf(')'))
                        .replace(/\n/g, '')
                        .replace(/(\w+:)/g, matchedStr => `"${matchedStr.substring(0, matchedStr.length - 1)}":`)
                        .replace(/'/g, '"')
                        .replace(/" *\+ *"/g, ''); // combine addition expression

                    return JSON.parse(preproccessedMsg);
                });

                // Read translations from Locales data
                localeData[INTERFACE_RESOURCE].forEach(translation => {
                    splitedLocales[pathName][INTERFACE_RESOURCE][translation.locale] = {};

                    interfaceMsgs.forEach(msg => {
                        if (official) {
                            // Read translations from Locales data
                            splitedLocales[pathName][INTERFACE_RESOURCE][translation.locale][msg.id] = translation.translations[msg.id].message; // eslint-disable-line max-len
                        } else {
                            // Directly use data from extracted content
                            splitedLocales[pathName][INTERFACE_RESOURCE][translation.locale][msg.id] = msg.default; // eslint-disable-line max-len
                        }
                    });
                });
            }

            /* Step2: Generate extensions content */
            splitedLocales[pathName][EXTENSION_RESOURCE] = {};
            const extensionsFile = path.join(path.dirname(pathName), EXTENSIONS_FILE);

            if (fs.existsSync(extensionsFile)) {
                const extensionsContent = fs.readFileSync(extensionsFile, 'utf8');
                const matchedExtensionsContent = extensionsContent.match(/formatMessage\({([\s\S]*?)}\)/g);
                if (matchedExtensionsContent) {
                    const extensionsMsgs = matchedExtensionsContent.map(msg => {
                        const preproccessedMsg = msg.slice(msg.indexOf('(') + 1, msg.lastIndexOf(')'))
                            .replace(/\n/g, '')
                            .replace(/(\w+:)/g, matchedStr => `"${matchedStr.substring(0, matchedStr.length - 1)}":`) // eslint-disable-line max-len
                            .replace(/'/g, '"')
                            .replace(/" *\+ *"/g, ''); // combine addition expression

                        return JSON.parse(preproccessedMsg);
                    });

                    localeData[EXTENSION_RESOURCE].forEach(translation => {
                        splitedLocales[pathName][EXTENSION_RESOURCE][translation.locale] = {};

                        extensionsMsgs.forEach(msg => {
                            // TODO双编程类型的设备翻译及extension文件名称不是translationjs这是个大问题
                            // 都应该提取出来然后保存到一个文件中
                            // 翻译文件要不还是改名为msg合适与l10n构架相同
                            console.log('msg', msg);
                            if (official) {
                                console.log('id11111', msg.id);
                                // Read translations from Locales data
                                splitedLocales[pathName][EXTENSION_RESOURCE][translation.locale][msg.id] = translation.translations[msg.id].message; // eslint-disable-line max-len
                            } else {
                                console.log('msg333', msg.id, msg.default);
                                // Directly use data from extracted content
                                splitedLocales[pathName][EXTENSION_RESOURCE][translation.locale][msg.id] = msg.default; // eslint-disable-line max-len
                            }
                        });

                    });
                }
            }

            // /* Step3: Generate blocks content */
            // splitedLocales[pathName][BLOCKS_RESOURCE] = {};

            // const blocksMsgsFile = path.join(path.dirname(pathName), BLOCKS_MSGS_FILE);

            // if (fs.existsSync(blocksMsgsFile)) {
            //     const blocksMsgsKeys = Object.keys(JSON.parse(fs.readFileSync(blocksMsgsFile, 'utf8'))).sort();

            //     localeData[BLOCKS_RESOURCE].forEach(translation => {
            //         splitedLocales[pathName][BLOCKS_RESOURCE][translation.locale] = {};

            //         blocksMsgsKeys.forEach(key => {
            //             splitedLocales[pathName][BLOCKS_RESOURCE][translation.locale][key] = translation.translations[key]; // eslint-disable-line max-len
            //         });

            //     });
            // }
            // }
        }
        return Promise.resolve();
    };

    await Walk.walk(workDir, walkMsgFiles);
    return splitedLocales;
};

const generateTranslationsFile = async () => {
    try {

        const localeData = await getAllLocaleData();

        const verifyTranslationData = resource => {
            localeData[resource].forEach(translation => {
                const en = JSON.parse(fs.readFileSync(path.resolve(workDir, `translations/${resource}/en.json`)));
                validateTranslations({locale: translation.locale, translations: translation.translations}, en);
            });
        };

        verifyTranslationData(INTERFACE_RESOURCE);
        verifyTranslationData(EXTENSION_RESOURCE);
        verifyTranslationData(BLOCKS_RESOURCE);

        return splitLocales(localeData).then(data => {
            Object.keys(data).forEach(filePath => {
                const interfaceTranslations = JSON.stringify(
                    data[filePath][INTERFACE_RESOURCE], null, 4).replace(/\n/g, '\n    ');

                // const extensionTranslations = '';
                const extensionTranslations = JSON.stringify(
                    data[filePath][EXTENSION_RESOURCE], null, 4).replace(/\n/g, '\n    ');

                let blocksMessages = '';
                Object.keys(data[filePath][BLOCKS_RESOURCE]).forEach(locale => {
                    blocksMessages += '\n';
                    blocksMessages += `    Object.assign(Blockly.ScratchMsgs.locales["${locale}"],\n`;
                    blocksMessages += `        ${JSON.stringify(data[filePath][BLOCKS_RESOURCE][locale], null, 4).replace(/\n/g, '\n        ')}\n`; // eslint-disable-line max-len
                    blocksMessages += '    );\n';
                });

                const content = `// This file was automatically generated. Do not modify.
/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/* eslint-disable quotes */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */
/* eslint-disable max-len */
function getInterfaceMsgs () {
    return ${interfaceTranslations}
    ;
}

function registerScratchExtensionMsgs () {
    return ${extensionTranslations};
}

function registerBlocksMsgs (Blockly) { ${blocksMessages}
    return Blockly;
}

if (typeof module !== 'undefined') {
    module.exports = {getInterfaceMsgs};
}
exports = registerScratchExtensionMsgs;
exports = registerBlocksMsgs;
`;

                // fs.writeFileSync(path.resolve(path.dirname(filePath), DIST_FILE), content);
                console.log(`Blocks msg file is created in path: ${path.resolve(path.dirname(filePath), DIST_FILE)}`); // eslint-disable-line max-len
            });
        });

    } catch (err) {
        process.stdout.write(err.message);
        process.exit(1);
    }
};

generateTranslationsFile();
