const formatMessage = require('format-message');
const osLocale = require('os-locale');
const express = require('express');
const Emitter = require('events');
const path = require('path');
const fs = require('fs');
const copydir = require('copy-dir');
const releaseDownloader = require('@fohlen/github-release-downloader');
const ghdownload = require('openblock-github-dl');
const rimraf = require('rimraf');
const compareVersions = require('compare-versions');

/**
 * Configuration the default user data path.
 * @readonly
 */
const DEFAULT_USER_DATA_PATH = path.join(__dirname, '../../.openblockData');

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20120;

/**
 * Configuration the default language.
 * @readonly
 */
const DEFAULT_LANGUAGE = 'en';

/**
 * A server to provide local resource.
 */
class OpenBlockResourceServer extends Emitter{

    /**
     * Construct a OpenBlock resource server object.
     * @param {string} userDataPath - the path of user data.
     * @param {string} resourcePath - the path of initial resource data.
     * @param {string} type - the resource type of server.
     * @param {string} port - the port of server.
     * @param {string} locale - the locale of server.
     */
    constructor (userDataPath, resourcePath, type, port = DEFAULT_PORT, locale = DEFAULT_LANGUAGE) {
        super();

        this._type = type;

        if (userDataPath) {
            this._userDataPath = path.join(userDataPath, this._type);
        } else {
            this._userDataPath = path.join(DEFAULT_USER_DATA_PATH, type);
        }

        this._updaterPath = path.join(this._userDataPath, '../updater', this._type);
        this._configPath = path.join(this._userDataPath, 'config.json');

        // path to store initial resources.
        if (resourcePath) {
            this._resourcePath = path.join(resourcePath, this._type);
        } else {
            this._resourcePath = path.join(__dirname, '../', this._type);
        }

        this._socketPort = port;
        this._locale = locale;
        this._formatMessage = formatMessage.namespace();

        if (this.checkFirstRun()) {
            this.copyToUserDataPath();
        }
    }

    checkFirstRun () {
        if (!fs.existsSync(this._userDataPath)) {
            console.log(`copy ${this._resourcePath} to ${this._userDataPath}`);
            return true;
        }
        return false;
    }

    copyToUserDataPath () {
        if (!fs.existsSync(this._userDataPath)) {
            fs.mkdirSync(this._userDataPath, {recursive: true});
        }
        copydir.sync(this._resourcePath, this._userDataPath, {utimes: true, mode: true});
    }

    setLocale () {
        return new Promise(resolve => {
            osLocale().then(locale => {
                if (locale === 'zh-CN') {
                    this._locale = 'zh-cn';
                } else if (locale === 'zh-TW') {
                    this._locale = 'zh-tw';
                } else {
                    this._locale = locale;
                }
                console.log('set locale:', this._locale);

                this._formatMessage.setup({
                    locale: this._locale,
                    // eslint-disable-next-line global-require
                    translations: require(path.join(this._userDataPath, 'locales.js'))
                });
                return resolve();
            });
        });
    }

    checkShouldUpdate () {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(this._configPath)) {

                this._config = require(this._configPath); // eslint-disable-line global-require

                if (this._config.user && this._config.repo) {
                    // Get the latest version for remote server
                    releaseDownloader.getReleaseList(`${this._config.user}/${this._config.repo}`)
                        .then(release => {
                            this._releaseDescribe = release[0].body;
                            const latestVersion = release[0].tag_name;
                            if (this._config.version) {
                                const curentVersion = this._config.version;
                                if (compareVersions.compare(latestVersion, curentVersion, '>')) {
                                    return resolve(latestVersion);
                                }
                            } else {
                                return reject(`Cannot find version tag in: ${this._configPath}`);
                            }
                            return resolve();
                        })
                        .catch(err => reject(`Error while getting realse list of ` +
                        `${this._config.user}/${this._config.repo}: ${err}`));
                } else {
                    return reject(`Cannot find valid git repo configuration in: ${this._configPath}`);
                }
            } else {
                return reject(`Cannot find file: ${this._configPath}`);
            }
        });
    }

    checkAndDownloadUpdate () {
        return new Promise((resolve, reject) => {
            this.checkShouldUpdate().then(version => {
                if (version) {
                    console.log(`new ${this._type} version detected: ${version}`);
                    this._updaterVersion = version;

                    const updaterResourceConfig = path.join(this._updaterPath, 'config.json');
                    if (fs.existsSync(updaterResourceConfig)) {
                        // read the resource version in updater
                        // eslint-disable-next-line global-require
                        const updaterResourceVersion = require(updaterResourceConfig).updaterVersion;
                        // the new version has been downloaded
                        if (updaterResourceVersion === version) {
                            return resolve({
                                log: 'skip download, the latest version has been downloaded',
                                message: this._releaseDescribe,
                                version: version
                            });
                        }
                    }

                    // if there is no updater dir, create it
                    if (!fs.existsSync(path.join(this._updaterPath, '../'))){
                        fs.mkdirSync(path.join(this._updaterPath, '../'), {recursive: true});
                    }

                    // clear temporary files that have been saved due to update failure
                    rimraf.sync(path.join(this._updaterPath, '../downloading*'));

                    // delet the old data and download new
                    rimraf.sync(this._updaterPath);
                    // download and unzip the new resource
                    ghdownload({user: this._config.user, repo: this._config.repo, ref: version}, this._updaterPath)
                        .on('error', err => reject(`Error while downloading ${this._config.user}/` +
                            `${this._config.repo} ${this._latestVersion}: ${err}`))
                        .on('zip', zipUrl => {
                            console.log(`${zipUrl} downloading...`);
                        })
                        .on('end', () => {
                            const config = Object.assign({}, this._config);
                            delete config.version;
                            config.updaterVersion = version;
                            fs.writeFileSync(updaterResourceConfig, JSON.stringify(config));
                            return resolve({
                                log: `${this._type} download finish`,
                                message: this._releaseDescribe,
                                version: version
                            });
                        });
                } else {
                    return reject('Already up to date.');
                }
            })
                .catch(err => reject(`Error while checking the update: ${err}`));
        });
    }

    update () {
        rimraf.sync(this._userDataPath);
        copydir.sync(this._updaterPath, this._userDataPath, {utimes: true, mode: true});
        rimraf.sync(this._updaterPath);
        // write the new version tag to config.json to finitsh upload
        const config = Object.assign({}, this._config);
        config.version = this._updaterVersion;
        fs.writeFileSync(this._configPath, JSON.stringify(config));
        console.log(`${this._type} update finish`);
    }

    // will be overwrite
    assembleData () {
        return [];
    }

    /**
     * Start a server listening for connections.
     * @param {number} port - the port to listen.
     */
    listen (port) {
        if (port) {
            this._socketPort = port;
        }

        this.setLocale().then(() => {
            const thumbnailData = this.assembleData();

            this._app = express();

            this._app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                next();
            });
            this._app.use(express.static(`${this._userDataPath}`));

            this._app.get('/', (req, res) => {
                res.send(JSON.stringify(thumbnailData));
            });

            this._app.listen(this._socketPort);

            this.emit('ready');
            console.log(`\n----------------------------------------`);
            console.log(`socket server listend: http://0.0.0.0:${this._socketPort}\nOpenblock ${this._type} server start successfully`);
            console.log(`----------------------------------------\n`);
        });
    }
}

module.exports = OpenBlockResourceServer;
