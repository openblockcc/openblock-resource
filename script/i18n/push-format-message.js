#!/usr/bin/env node

/**
 * @fileoverview
 * Push the extracted 18n content in external resource to transifex.
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 */

const {execSync} = require('child_process');
const path = require('path');
const parseArgs = require('../lib/parseArgs');

const {dir} = parseArgs();

let workDir;
if (dir) {
    workDir = dir;
} else {
    workDir = './';
}

let exitCode = 0;

const runCliSync = cmd => {
    try {
        return execSync(cmd).toString();
    } catch (error) {
        if (error.message) {
            console.log('message=', error.message.toString());
            exitCode = 1;
        }
    }
};

const txPushSrc = path.resolve(__dirname, '../node_modules/openblock-l10n/scripts/tx-push-src.js');
const pushBlocksContent = `node ${txPushSrc} openblock-resources blocks ${path.resolve(workDir)}/translations/blocks/en.json`; // eslint-disable-line max-len
const pushInterfaceContent = `node ${txPushSrc} openblock-resources interface ${path.resolve(workDir)}/translations/interface/en.json`; // eslint-disable-line max-len
const pushExtensionsContent = `node ${txPushSrc} openblock-resources extensions ${path.resolve(workDir)}/translations/extensions/en.json`; // eslint-disable-line max-len

runCliSync(pushBlocksContent);
runCliSync(pushInterfaceContent);
runCliSync(pushExtensionsContent);

if (exitCode === 0) {
    console.log('\nSuccessfully pushed to transifex');
}
