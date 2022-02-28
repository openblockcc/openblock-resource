const fs = require('fs-extra');
const path = require('path');
const hashFiles = require('hash-files');
const extract = require('extract-zip');
const fetch = require('node-fetch');
const parseMessage = require('openblock-parse-release-message');
const clc = require('cli-color');
const lockFile = require('proper-lockfile');
const Progress = require('node-fetch-progress');
const {AbortController} = require('node-abort-controller');

const {UPGRADE_STATE, UPGRADE_PROGRESS, UPGRADE_CONTENT} = require('./state');
const {checkDirHash} = require('./calc-dir-hash');
const {formatTime} = require('./format');
const {DIRECTORY_NAME} = require('./config');
const getConfigHash = require('./get-config-hash');

class ResourceUpdater {
    constructor (repo, cdn, workDir) {
        this._repo = repo;
        this._cdn = cdn;
        this._workDir = workDir;

        this.progress = 0; // 0 ~ 1

        const controller = new AbortController();
        this.fakeSignal = controller.signal;
    }

    getLatest (option) {
        if (!option.signal) {
            option.signal = this.fakeSignal;
        }

        let url = `https://api.github.com/repos/${this._repo}/releases/latest`;

        if (this._cdn) {
            url = `${this._cdn}/${url}`;
        }

        return new Promise((resolve, reject) => {
            fetch(url, {signal: option.signal})
                .then(res => resolve(res.json()))
                .catch(err => reject(err));
        });
    }

    checkUpdate (option = {}) {
        if (lockFile.checkSync(this._workDir)) {
            const e = 'Resource is upgrading';
            console.log(clc.yellow(e));
            return Promise.reject(e);
        }

        return new Promise((resolve, reject) => {
            this.getLatest(option)
                .then(info => {
                    if (info.tag_name) {
                        const version = info.tag_name;
                        const message = parseMessage(info.body);

                        return resolve({latestVersion: version, message: message});
                    }
                    return reject(`Cannot get valid releases from: ${this._repo}`);
                })
                .catch(err => reject(err));
        });
    }

    reportStatus (callback, data) {
        if (callback) {
            callback(data);
        }
    }

    download (url, dest, option) {
        if (this._cdn) {
            url = `${this._cdn}/${url}`;
        }

        this.reportStatus(option.callback, {
            phase: UPGRADE_STATE.downloading,
            progress: this.progress,
            info: {
                name: path.basename(dest)
            }
        });

        return new Promise((resolve, reject) => {
            fetch(url, {signal: option.signal})
                .then(res => {
                    if (res.status !== 200) {
                        return reject(`Got status code ${res.status}: ${res.statusText}`);
                    }
                    const fileStream = fs.createWriteStream(dest);

                    res.body.pipe(fileStream);
                    res.body.on('error', err => reject(err));

                    fileStream.on('finish', () => resolve());

                    const progress = new Progress(res, {throttle: 100});

                    progress.on('progress', state => {
                        if (this.progress >= UPGRADE_PROGRESS.start && this.progress < UPGRADE_PROGRESS.downloadResource) { // eslint-disable-line max-len
                            this.progress = UPGRADE_PROGRESS.start + (state.progress * (UPGRADE_PROGRESS.downloadResource - UPGRADE_PROGRESS.start)); // eslint-disable-line max-len
                        } else {
                            this.progress = UPGRADE_PROGRESS.downloadResource + (state.progress * (UPGRADE_PROGRESS.downloadChecksum - UPGRADE_PROGRESS.downloadResource)); // eslint-disable-line max-len
                        }

                        // Since the writing is still running after the fetch is completed, stop the report data
                        // when the progress is completed to 1 to prevent multiple download information from being
                        // mixed and reported.
                        if (state.progress !== 1) {
                            this.reportStatus(option.callback, {
                                phase: UPGRADE_STATE.downloading,
                                progress: this.progress,
                                state: {
                                    name: path.basename(dest),
                                    percent: state.progress,
                                    speed: state.rateh,
                                    total: state.totalh,
                                    done: state.doneh,
                                    remaining: formatTime(state.eta)
                                }
                            });
                        }
                    });
                })
                .catch(err => reject(err));
        });
    }

    handleAbort () {
        // lockFile.unlockSync(this._workDir);
        const err = new Error();
        err.code = err.ABORT_ERR;
        err.message = 'The user aborted a request.';
        return Promise.reject(err);
    }

    update (version, option = {}) {
        if (!option.signal) {
            option.signal = this.fakeSignal;
        }

        if (lockFile.checkSync(this._workDir)) {
            const e = 'A resource updater is already running';
            console.log(clc.yellow(e));
            return Promise.reject(e);
        }
        lockFile.lockSync(this._workDir);

        const shortVersion = version.replace(/v/g, '');

        const downloadPath = path.resolve(this._workDir, 'download');
        fs.ensureDirSync(downloadPath);

        const resourceName = `external-resources-${shortVersion}.zip`;
        const resourceUrl = `https://github.com/${this._repo}/releases/download/${version}/${resourceName}`;
        const resourcePath = path.join(downloadPath, resourceName);

        const checksumName = `${shortVersion}-checksums-sha256.txt`;
        const checksumUrl = `https://github.com/${this._repo}/releases/download/${version}/${checksumName}`;
        const checksumPath = path.join(downloadPath, checksumName);

        this.progress = UPGRADE_PROGRESS.start;
        this.reportStatus(option.callback, {
            phase: UPGRADE_STATE.downloading,
            progress: this.progress
        });

        if (option.signal.aborted){
            return this.handleAbort();
        }
        // Step 1: download zip and checksun file.
        return this.download(resourceUrl, resourcePath, option)
            .then(() => this.download(checksumUrl, checksumPath, option))
            .then(() => {
                // Step 2: check checksum of zip.
                if (option.signal.aborted){
                    return this.handleAbort();
                }
                this.progress = UPGRADE_PROGRESS.verifyZip;
                this.reportStatus(option.callback, {
                    phase: UPGRADE_STATE.verifying,
                    progress: this.progress,
                    state: {name: UPGRADE_CONTENT.zip}
                });
                const zipChecksum = fs.readFileSync(checksumPath, 'utf8').split('  ')[0];
                const hash = hashFiles.sync({files: resourcePath, algorithm: 'sha256'});

                if (zipChecksum === hash) {
                    // Step 3: delete old directory.
                    if (option.signal.aborted){
                        return this.handleAbort();
                    }
                    const extractPath = path.resolve(this._workDir, DIRECTORY_NAME);
                    this.progress = UPGRADE_PROGRESS.deletCache;
                    this.reportStatus(option.callback, {
                        phase: UPGRADE_STATE.deleting,
                        progress: this.progress,
                        state: {name: UPGRADE_CONTENT.cache}
                    });
                    fs.rmSync(extractPath, {recursive: true, force: true});

                    // Step 4: extract zip.
                    if (option.signal.aborted){
                        return this.handleAbort();
                    }
                    this.progress = UPGRADE_PROGRESS.extractZip;
                    this.reportStatus(option.callback, {
                        phase: UPGRADE_STATE.extracting,
                        progress: this.progress
                    });
                    return extract(resourcePath, {dir: extractPath})
                        .then(() => {
                            // Step 5: check checksum of extracted directory.
                            if (option.signal.aborted){
                                return this.handleAbort();
                            }
                            this.progress = UPGRADE_PROGRESS.verifyCache;
                            this.reportStatus(option.callback, {
                                phase: UPGRADE_STATE.verifying,
                                progress: this.progress,
                                state: {name: UPGRADE_CONTENT.cache}
                            });

                            const configFilePath = path.resolve(extractPath, 'config.json');
                            const dirHash = getConfigHash(configFilePath);
                            if (!dirHash) {
                                console.warn(clc.yellow(`WARN: no hash value found in ${configFilePath}`));
                                return Promise.resolve();
                            }
                            return checkDirHash(extractPath, dirHash);
                        })
                        .then(() => {
                            // Step 6.1: delete downloaded files.
                            this.progress = UPGRADE_PROGRESS.deletZip;
                            this.reportStatus(option.callback, {
                                phase: UPGRADE_STATE.deleting,
                                progress: this.progress,
                                state: {name: UPGRADE_CONTENT.zip}
                            });

                            fs.rmSync(resourcePath, {recursive: true, force: true});
                            fs.rmSync(checksumPath, {recursive: true, force: true});
                            lockFile.unlockSync(this._workDir);
                            return Promise.resolve();
                        })
                        .catch(err => {
                            // Step 6.2: if check failed, delete extracted directory.
                            this.reportStatus(option.callback, {
                                phase: UPGRADE_STATE.deleting,
                                progress: this.progress,
                                state: {name: UPGRADE_CONTENT.cache}
                            });
                            fs.rmSync(extractPath, {recursive: true, force: true});
                            lockFile.unlockSync(this._workDir);
                            return Promise.reject(err);
                        });
                }
                lockFile.unlockSync(this._workDir);
                return Promise.reject(`${resourcePath} has failed the checksum detection`);
            })
            .catch(err => {
                lockFile.unlockSync(this._workDir);
                return Promise.reject(err);
            });
    }
}

module.exports = ResourceUpdater;
