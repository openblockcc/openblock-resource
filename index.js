const fs = require('fs');
const copydir = require('copy-dir');
const path = require('path');
const compareVersions = require('compare-versions');
const rimraf = require('rimraf');

const ResourceServer = require('./src/server');
const GIT = require('./src/git');

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

        this.copyToUserDataPath();
    }

    copyToUserDataPath () {
        if (!fs.existsSync(this._configPath)) {
            console.log(`copy ${this._resourcesPath} to ${this._userDataPath}`);
            if (!fs.existsSync(this._userDataPath)) {
                fs.mkdirSync(this._userDataPath, {recursive: true});
            }
            copydir.sync(this._resourcesPath, this._userDataPath);
        }
    }

    checkUpdate () {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(this._configPath)) {

                this._config = require(this._configPath); // eslint-disable-line global-require

                if (this._config.repository) {
                    if (this.git) {
                        delete this.git;
                    }
                    this.device.setLocale().then(() => {
                        this.git = new GIT(this._config.repository, this.device._locale);

                        this.git.getLatestReleases()
                            .then(info => {
                                if (info.version) {
                                    console.log('info=', info);
                                    const latestVersion = info.version;

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
                                }
                                return reject(`Cannot get valid releases from: ${this._config.repository}`);
                            })
                            .catch(err => reject(err));
                    });

                } else {
                    return reject(`Cannot find valid repository in: ${this._configPath}`);
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

            if (callback) {
                callback({phase: 'downloading'});
            }
            const downloadPath = path.join(this._userDataPath, '../tmp/download-external-resources');

            if (fs.existsSync(downloadPath)) {
                rimraf.sync(downloadPath);
            } else {
                fs.mkdirSync(downloadPath, {recursive: true});
            }

            this.git.cloneLatestReleases(downloadPath)
                .then(() => {
                    if (callback) {
                        callback({phase: 'covering'});

                        // rm the old data
                        rimraf.sync(this._userDataPath);

                        copydir.sync(downloadPath, this._userDataPath,
                            {
                                filter: (stat, filepath, filename) => {
                                    // do not want copy .git directories
                                    if (stat === 'directory' && filename === '.git') {
                                        return false;
                                    }
                                    return true; // remind to return a true value when file check passed.
                                }
                            });

                        // write the new version tag to config.json to finitsh upload
                        const config = Object.assign({}, this._config);
                        config.version = this._latestVersion;
                        fs.writeFileSync(this._configPath, JSON.stringify(config));
                        return resolve();
                    }
                })
                .catch(err => reject(err));
        });
    }

    listen (port = null) {
        const server = new ResourceServer(this._userDataPath);

        server.on('error', e => {
            console.warn(e);
        });

        server.listen(port);
    }
}

module.exports = OpenblockResourceServer;
