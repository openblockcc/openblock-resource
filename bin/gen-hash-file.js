#!/usr/bin/env node

/**
 * @fileoverview
 * Generate the sha256 file hash of the current working folder
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 */

const path = require('path');
const fs = require('fs-extra');
const {calcDirHash} = require('../src/calc-dir-hash');
const parseArgs = require('../script/parseArgs');


const {dir} = parseArgs();

let workDir;
if (dir) {
    workDir = dir;
} else {
    workDir = './';
}

calcDirHash(workDir).then(hash => {
    fs.writeFileSync(path.resolve(workDir, 'folder-checksum-sha256.txt'), `${hash}`);
    console.log(`Checksum file is created: ${path.resolve(workDir, 'folder-checksum-sha256.txt')}`);
});
