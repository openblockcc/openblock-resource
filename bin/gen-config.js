#!/usr/bin/env node

/**
 * @fileoverview
 * Generate external-resource configuration files according to the instructions
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 * use --repo to specify the download address, e.g: --repo=openblockcc/external-resources
 * use --cdn to specify the use of the cdn proxy server address, e.g: --cdn=https://cdn.openblock.cc/
 * use --version to specify the version, e.g: --version=v0.0.1
 */

const path = require('path');
const fs = require('fs');
const parseArgs = require('../script/parseArgs');


const {dir, version, repo, cdn} = parseArgs();

if (version) {
    const resourceConfig = {};

    resourceConfig.repo = repo;
    resourceConfig.version = version;
    resourceConfig.cdn = cdn;

    let workDir;
    if (dir) {
        workDir = dir;
    } else {
        workDir = './';
    }

    fs.writeFileSync(path.resolve(workDir, 'config.json'), JSON.stringify(resourceConfig, null, 4));
    console.log(`Config file is created: ${path.resolve(workDir, 'config.json')}`);
} else {
    console.error('No version specified');
}
