#!/usr/bin/env node

/**
 * @fileoverview
 * Optimize the size of external resource files, scan the contents of the current working
 * folder, delete useless files.
 *
 * The default scan path is the path where the current command is executed,
 * but you can use --dir to specify the download address, e.g: --dir=external-resources
 */


const Walk = require('@root/walk');
const path = require('path');
const fs = require('fs-extra');
const parseArgs = require('../script/parseArgs');

// Extensions for useful files in lib folder
const USEFUL_LIB_FILE_EXTENSIONS = ['.c', '.cpp', '.h', '.hpp', '.py'];

// Useless files or folder names
const USELESS_FILES_AND_DIR = ['.git', '.github', '.gitignore'];

// walkFunc must be async, or return a Promise
const delUselessLibFilesAndDirs = (err, pathName, dirent) => {
    if (err) {
        throw err;
    }

    if (!dirent.isDirectory() && path.dirname(pathName).includes('lib')) {
        let match = false;
        USEFUL_LIB_FILE_EXTENSIONS.forEach(ext => {
            if (dirent.name.endsWith(ext)) {
                match = true;
            }
        });

        if (!match) {
            fs.remove(pathName, e => {
                if (e) throw e;
                console.log(`DELETED ${pathName}`);
            });
        }
    }

    if (dirent.isDirectory() && path.dirname(pathName).includes('lib')) {
        fs.readdir(pathName, (rde, files) => {
            if (rde) throw rde;
            if (!files.length) {
                fs.remove(pathName, rme => {
                    if (rme) throw rme;
                    console.log(`DELETED ${pathName}`);
                });
            }
        });
    }

    return Promise.resolve();
};

const delUselessFilesAndDirs = dir => new Promise(resolve => {
    fs.readdir(dir, (rde, files) => {
        if (rde) throw rde;

        files.forEach(file => {
            if (USELESS_FILES_AND_DIR.includes(file)) {
                try {
                    fs.removeSync(path.join(dir, file));
                } catch (e) {
                    throw e;
                }
                console.log(`DELETED ${path.join(dir, file)}`);
            }
        });

        return resolve();
    });
});

const {dir} = parseArgs();

let workDir;
if (dir) {
    workDir = dir;
} else {
    workDir = './';
}

// run three times to make sure all empty dirs are deleted
Walk.walk(workDir, delUselessLibFilesAndDirs)
    .then(() => Walk.walk(workDir, delUselessLibFilesAndDirs))
    .then(() => Walk.walk(workDir, delUselessLibFilesAndDirs))
    .then(() => delUselessFilesAndDirs(workDir))
    .then(() => {
        console.log('Complete optimization');
    });

// TODO: We can continue to compress the js code to reduce the file size.
