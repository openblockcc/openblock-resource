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

const INTERFACE_FILE = 'index.js';
const BLOCKS_MSGS_FILE = 'msg.json';

const DIST_FILE = 'translations.js';

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

        // Filter node_modules folder
        if (pathName.startsWith('node_modules')) {
            return Promise.resolve();
        }

        const resourcePath = path.dirname(pathName);
        if (!dirent.isDirectory() && path.basename(pathName) === INTERFACE_FILE) {
            const interfaceFile = path.join(resourcePath, INTERFACE_FILE);

            const official = isOfficial(interfaceFile);
            splitedLocales[resourcePath] = {};

            /* Step1: Generate interface content */
            splitedLocales[resourcePath][INTERFACE_RESOURCE] = {};

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
                    splitedLocales[resourcePath][INTERFACE_RESOURCE][translation.locale] = {};

                    interfaceMsgs.forEach(msg => {
                        if (official) {
                            // Read translations from Locales data
                            splitedLocales[resourcePath][INTERFACE_RESOURCE][translation.locale][msg.id] = translation.translations[msg.id].message; // eslint-disable-line max-len
                        } else {
                            // Directly use data from extracted content
                            splitedLocales[resourcePath][INTERFACE_RESOURCE][translation.locale][msg.id] = msg.default; // eslint-disable-line max-len
                        }
                    });
                });
            }

            /* Step2: Generate scratch extensions content */
            splitedLocales[resourcePath][EXTENSION_RESOURCE] = {};

            const mainRegex = /\.main\s*=\s*['"](.+?)['"]|main:\s*['"](.+?)['"]/g;

            let match;
            const mainFiles = [];
            let extensionsContent = '';

            while ((match = mainRegex.exec(indexContent)) !== null) {
                mainFiles.push(match[1] || match[2]);
            }
            mainFiles.forEach(mainFile => {
                if (fs.existsSync(path.join(resourcePath, mainFile))) {
                    extensionsContent += fs.readFileSync(path.join(resourcePath, mainFile), 'utf8');
                }
            });

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
                    splitedLocales[resourcePath][EXTENSION_RESOURCE][translation.locale] = {};

                    extensionsMsgs.forEach(msg => {
                        if (official) {
                            // Read translations from locales data
                            splitedLocales[resourcePath][EXTENSION_RESOURCE][translation.locale][msg.id] = translation.translations[msg.id].message; // eslint-disable-line max-len
                        } else {
                            // Directly use data from extracted content
                            splitedLocales[resourcePath][EXTENSION_RESOURCE][translation.locale][msg.id] = msg.default; // eslint-disable-line max-len
                        }
                    });
                });
            }

            /* Step3: Generate blocks content */
            splitedLocales[resourcePath][BLOCKS_RESOURCE] = {};

            const blocksMsgsFile = path.join(resourcePath, BLOCKS_MSGS_FILE);

            if (fs.existsSync(blocksMsgsFile)) {
                const blocksMsgs = JSON.parse(fs.readFileSync(blocksMsgsFile, 'utf8'));
                const blocksMsgsKeys = Object.keys(blocksMsgs).sort();

                localeData[BLOCKS_RESOURCE].forEach(translation => {
                    splitedLocales[resourcePath][BLOCKS_RESOURCE][translation.locale] = {};

                    blocksMsgsKeys.forEach(key => {
                        if (official) {
                            splitedLocales[resourcePath][BLOCKS_RESOURCE][translation.locale][key] = translation.translations[key]; // eslint-disable-line max-len
                        } else {
                            splitedLocales[resourcePath][BLOCKS_RESOURCE][translation.locale][key] = blocksMsgs[`${key}`]; // eslint-disable-line max-len
                        }
                    });

                });
            }
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
function getInterfaceTranslations () {
    return ${interfaceTranslations};
}

function registerScratchExtensionTranslations () {
    return ${extensionTranslations};
}

function registerBlocksMessages (Blockly) {${blocksMessages}
    return Blockly;
}

if (typeof module !== 'undefined') {
    module.exports = {getInterfaceTranslations};
}
exports = registerScratchExtensionTranslations;
exports = registerBlocksMessages;
`;

                fs.writeFileSync(path.resolve(filePath, DIST_FILE), content);
                console.log(`Translations file is created in path: ${path.resolve(filePath, DIST_FILE)}`); // eslint-disable-line max-len
            });
        });

    } catch (err) {
        process.stdout.write(err.message);
        process.exit(1);
    }
};

generateTranslationsFile();
