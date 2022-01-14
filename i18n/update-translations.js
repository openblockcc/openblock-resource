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
const transifex = require('transifex');
const Walk = require('@root/walk');
const locales = require('openblock-l10n').default;
const {validateBlocksTranslations, flattenJson, validateTranslations} = require('./validate-tx-data');
const parseArgs = require('../script/parseArgs');

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
const BLOCKS_RESOURCE = 'blocks';
const MODE = {mode: 'reviewed'};

const TX = new transifex({
    project_slug: PROJECT,
    credential: `api:${process.env.TX_TOKEN}`
});

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

const getLocaleData = (resource, locale) => {
    const txLocale = localeMap[locale] || locale;
    return new Promise(((resolve, reject) => {
        TX.translationInstanceMethod(PROJECT, resource, txLocale, MODE, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    locale: locale,
                    translations: JSON.parse(data)
                });
            }
        });
    }));
};

const splitBlocksMsgs = async values => {

    const splitedMsgs = {};

    const walkMsgFiles = (e, pathName, dirent) => {
        if (e) {
            console.error(e);
            process.exit(1);
        }

        if (!dirent.isDirectory() && path.basename(pathName) === EXTENSIONS_MSG_FILE) {

            // Dont't add unofficial extension in to community translation
            let isOfficial = false;
            const indexContent = fs.readFileSync(
                path.join(path.dirname(pathName), EXTENSIONS_INTERFACE_FILE), 'utf8');

            const matchOfficial = indexContent.match(/official: \w+/g);
            if (matchOfficial && matchOfficial.length > 0) {
                isOfficial = matchOfficial[0].slice(matchOfficial[0].indexOf(':') + 2) === 'true';
            }

            if (isOfficial) {
                const msgKeys = Object.keys(JSON.parse(fs.readFileSync(pathName, 'utf8'))).sort();
                splitedMsgs[pathName] = {};

                values.forEach(translation => {
                    splitedMsgs[pathName][translation.locale] = {};

                    msgKeys.forEach(key => {
                        splitedMsgs[pathName][translation.locale][key] = translation.translations[key];
                    });

                });
            }
        }
        return Promise.resolve();
    };

    await Walk.walk(workDir, walkMsgFiles);
    return splitedMsgs;
};

const generateBlockMsgFiles = values => {
    // Verify translation data
    values.forEach(translation => {
        let en = fs.readFileSync(path.resolve(workDir, `translations/${BLOCKS_RESOURCE}/en.json`));
        en = JSON.parse(en);
        const enKeys = Object.keys(en).sort()
            .toString();

        validateBlocksTranslations(translation.translations, en, enKeys, translation.locale);
    });

    return splitBlocksMsgs(values).then(data => {
        Object.keys(data).forEach(filePath => {

            let file = `// This file was automatically generated.  Do not modify.
/* eslint-disable func-style */
/* eslint-disable require-jsdoc */
/* eslint-disable quote-props */
/* eslint-disable quotes */
/* eslint-disable dot-notation */

function addMsg (Blockly) {
`;

            Object.keys(data[filePath]).forEach(locale => {
                file += '\n';
                file += `    Object.assign(Blockly.ScratchMsgs.locales["${locale}"],\n`;
                file += `        ${JSON.stringify(data[filePath][locale], null, 4).replace(/\n/g, '\n        ')}\n`;
                file += '    );\n';
            });

            file += `
    return Blockly;
}

exports = addMsg;
// End of combined translations
`;

            fs.writeFileSync(path.resolve(path.dirname(filePath), 'msg.js'), file);
            console.log(`Blocks msg file is created in path: ${path.join(path.dirname(filePath), 'msg.js')}`);
        });
    });
};

const generateInterfaceTranslationsFile = values => {
    const combinedJson = {};
    const source = JSON.parse(flattenJson(values.find(elt => elt.locale === 'en').translations));
    values.forEach(translation => {
        const flattenedJson = flattenJson(translation.translations);
        validateTranslations({locale: translation.locale, translations: JSON.parse(flattenedJson)}, source);
        combinedJson[translation.locale] = JSON.parse(flattenedJson);
    });
    const filePath = path.resolve(workDir, 'locales.json');
    fs.writeFileSync(filePath, JSON.stringify(combinedJson, null, 4));
    console.log(`Interface translation file is created in path: ${filePath}`);
};

const fetchBlockTranslations = () => Promise.all(Object.keys(locales).map(key => getLocaleData(BLOCKS_RESOURCE, key)));
const fetchInterfaceTranslations =
    () => Promise.all(Object.keys(locales).map(key => getLocaleData(INTERFACE_RESOURCE, key)));

fetchBlockTranslations()
    .then(values => generateBlockMsgFiles(values))
    .then(() => fetchInterfaceTranslations())
    .then(values => generateInterfaceTranslationsFile(values))
    .then(() => {
        console.log('Complete translation update');
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
