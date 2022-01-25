/**
 * @fileoverview
 * Download external-resrouce from the specified repository, extract it and check the comparison checksum
 *
 * use --repo to specify the download address, e.g: --repo=openblockcc/external-resources
 * use --cdn to specify the use of the cdn proxy server address, e.g: --cdn=https://cdn.openblock.cc/
 */

const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const request = require('request');
const progress = require('request-progress');
const ProgressBar = require('progress');
const extract = require('extract-zip');
const hashFiles = require('hash-files');

const {checkDirHash} = require('../src/calc-dir-hash');
const {formatSize, formatTime} = require('../src/format');
const parseArgs = require('./parseArgs');


const {repo, cdn} = parseArgs();

const getLatest = () => {
    let url = `https://api.github.com/repos/${repo}/releases/latest`;

    if (cdn) {
        url = `${cdn}/${url}`;
    }

    return new Promise((resolve, reject) => {
        fetch(url)
            .then(res => resolve(res.json()))
            .catch(err => reject(err));
    });
};

const download = (url, dest) => {
    const green = '\u001b[42m \u001b[0m';
    const red = '\u001b[41m \u001b[0m';

    if (cdn) {
        url = `${cdn}/${url}`;
    }

    return new Promise((resolve, reject) => {
        const bar = new ProgressBar('downloading [:bar] :tokenSpeed    :tokenSize   :tokenRemaining', {
            complete: green,
            incomplete: red,
            total: 100,
            clear: true
        });

        console.log('download from url:', url);
        progress(request(url))
            .on('progress', state => {
                const tokenSpeed = `${formatSize(state.speed)}/s`;
                const tokenSize = `${formatSize(state.size.transferred).replace(/(?: |B|K|M|G)/g, '')}/${formatSize(state.size.total)}`; // eslint-disable-line max-len
                const tokenRemaining = formatTime(state.time.remaining);

                bar.update(state.percent, {
                    tokenSpeed: tokenSpeed,
                    tokenSize: tokenSize,
                    tokenRemaining: tokenRemaining
                });
            })
            .on('error', err => {
                bar.terminate();
                return reject(err);
            })
            .on('end', () => {
                bar.update(1);
                const destSplit = dest.split(/[\\/]/);
                const fileName = destSplit[destSplit.length - 1];
                console.log(`${fileName} download complete`);
                return resolve();
            })
            .pipe(fs.createWriteStream(dest));
    });
};

getLatest()
    .then(data => {
        const assets = data.assets;

        let resource;
        let checksum;

        assets.forEach(asset => {
            if (asset.name.includes('checksums')) {
                checksum = asset;
            } else if (asset.name.includes('external-resources')) {
                resource = asset;
            }
        });

        const downloadPath = path.resolve('./', 'download');
        fs.ensureDirSync(downloadPath);

        const resourceUrl = resource.browser_download_url;
        const resourceName = resource.name;
        const resourcePath = path.join(downloadPath, resourceName);

        const checksumUrl = checksum.browser_download_url;
        const checksumName = checksum.name;
        const checksumPath = path.join(downloadPath, checksumName);

        const extractPath = path.resolve('./', 'external-resources');

        return download(resourceUrl, resourcePath)
            .then(() => download(checksumUrl, checksumPath))
            .then(() => {
                // Compare archive checksums
                const zipChecksum = fs.readFileSync(checksumPath, 'utf8').split('  ')[0];
                hashFiles({files: resourcePath, algorithm: 'sha256'}, (error, hash) => {
                    if (error) {
                        throw error;
                    }

                    if (zipChecksum === hash) {
                        console.info(`${resourcePath} has passed the checksum detection`);
                        extract(resourcePath, {dir: extractPath})
                            .then(() => {
                                // Compare folder checksums
                                const dirHash = fs.readFileSync(path.resolve(extractPath, 'folder-checksum-sha256.txt'), 'utf8'); // eslint-disable-line max-len

                                checkDirHash(extractPath, dirHash)
                                    .then(() => {
                                        fs.rmSync(downloadPath, {recursive: true, force: true});

                                        console.log(`\nexternal resource has been successfully downloaded and extracted to path: ${extractPath}`); // eslint-disable-line max-len
                                    })
                                    .catch(() => {
                                        console.error(`${extractPath} has failed the folder checksum detection`);
                                        process.exit(1);
                                    });
                            });
                    } else {
                        console.error(`${resourcePath} has failed the checksum detection`);
                        process.exit(1);
                    }
                });
            });

    })
    .catch(err => console.log('err+', err));
