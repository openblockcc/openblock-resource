const OpenBlockExtension = require('./src/extension-server');
const OpenBlockDevice = require('./src/device-server');
const fs = require('fs');
const copydir = require('copy-dir');
const path = require('path');
const fetch = require('node-fetch');
const compareVersions = require('compare-versions');
const rimraf = require('rimraf');
const request = require('request');
const progress = require('request-progress');
const extract = require('extract-zip');

/**
 * Configuration the default user data path.
 * @readonly
 */
const DEFAULT_USER_DATA_PATH = path.join(__dirname, '../.openblockData');

class OpenblockResourceServer {
    constructor (userDataPath, initialResourcesPath) {
        if (userDataPath) {
            this._userDataPath = path.join(userDataPath, 'external-resources');
        } else {
            this._userDataPath = path.join(DEFAULT_USER_DATA_PATH, 'external-resources');
        }

        // path to store initial resources.
        if (initialResourcesPath) {
            this._resourcesPath = path.join(initialResourcesPath);
        } else {
            this._resourcesPath = path.join(__dirname, 'external-resources');
        }

        this._configPath = path.join(this._userDataPath, 'config.json');

        this._extensionTransferred = 0;

        this.device = new OpenBlockDevice(this._userDataPath, this._resourcesPath);
        this.extension = new OpenBlockExtension(this._userDataPath, this._resourcesPath);

        this.copyToUserDataPath();
    }

    copyToUserDataPath () {
        if (!fs.existsSync(this._configPath)) {
            console.log(`copy ${this._resourcesPath} to ${this._userDataPath}`);
            if (!fs.existsSync(this._userDataPath)) {
                fs.mkdirSync(this._userDataPath, {recursive: true});
            }
            copydir.sync(this._resourcesPath, this._userDataPath, {utimes: true, mode: true});
        }
    }

    checkUpdate () {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(this._configPath)) {

                this._config = require(this._configPath); // eslint-disable-line global-require

                if (this._config.release) {
                    // Get the latest version for remote server
                    fetch(this._config.release)
                        .then(response => response.json())
                        .then(info => {
                            const latestVersion = info.tag_name;

                            if (this._config.version) {
                                const curentVersion = this._config.version;
                                if (compareVersions.compare(latestVersion, curentVersion, '>')) {
                                    this._latestVersion = latestVersion;
                                    return resolve({version: latestVersion, describe: info.body});
                                }
                            } else {
                                return reject(`Cannot find version tag in: ${this._configPath}`);
                            }
                            return resolve();
                        })
                        .catch(err => reject(`Error while latest release from: ${this._config.release}: ${err}`));
                } else {
                    return reject(`Cannot find valid release url in: ${this._configPath}`);
                }
            } else {
                return reject(`Cannot find file: ${this._configPath}`);
            }
        });
    }

    upgrade (callback = null) {
        return new Promise((resolve, reject) => {
            if (!this._latestVersion) {
                return resolve();
            }

            const zipPath = path.join(this._userDataPath, '../download-external-resources.zip');
            const extractPath = path.join(this._userDataPath, '../');

            progress(request(this._config.download + this._latestVersion))
                .on('progress', state => {
                    if (callback) {
                        callback({phase: 'downloading', speed: state.speed, transferred: state.size.transferred});
                    }
                })
                .on('end', () => {
                    callback({phase: 'extracting'});
                    extract(zipPath, {dir: extractPath}).then(() => {
                        callback({phase: 'recovering'});

                        rimraf.sync(zipPath);
                        rimraf.sync(this._userDataPath);

                        const extractDir = path.join(extractPath,
                            `external-resources-${this._latestVersion.slice(1)}`);
                        copydir.sync(extractDir, this._userDataPath, {utimes: true, mode: true});
                        rimraf.sync(extractDir);

                        // write the new version tag to config.json to finitsh upload
                        const config = Object.assign({}, this._config);
                        config.version = this._latestVersion;
                        fs.writeFileSync(this._configPath, JSON.stringify(config));
                        return resolve();
                    })
                        .catch(err => reject(`Error while extract ${zipPath} to ${this._updaterPath}: ${err}`));
                })
                .on('error',
                    err => reject(`Error while downloading ${this._config.download}${this._latestVersion}: ${err}`))
                .pipe(fs.createWriteStream(zipPath));
        });
    }

    listen (deviceServerPort = null, extensionServerPort = null) {
        this.device.listen(deviceServerPort);
        this.extension.listen(extensionServerPort);
    }
}

module.exports = OpenblockResourceServer;
