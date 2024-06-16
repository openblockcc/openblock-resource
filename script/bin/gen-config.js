#!/usr/bin/env node

/**
 * @fileoverview
 * Generate external-resource configuration files according to the instructions
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 * use --version to specify the version, e.g: --version=v0.0.1
 */

const path = require('path');
const fs = require('fs');
const parseArgs = require('../lib/parseArgs');


const {dir, version} = parseArgs();

if (version) {
    let workDir;
    if (dir) {
        workDir = dir;
    } else {
        workDir = './';
    }

    const originConfig = JSON.parse(fs.readFileSync(path.resolve(workDir, 'config.json'), 'utf8'));

    originConfig.version = version;

    fs.writeFileSync(path.resolve(workDir, 'config.json'), JSON.stringify(originConfig, null, 4));
    console.log(`Config file is created: ${path.resolve(workDir, 'config.json')}`);
} else {
    console.error('No version specified');
    process.exit(1);
}
