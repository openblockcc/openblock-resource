const formatMessage = require('format-message');
const osLocale = require('os-locale');
const express = require('express');
const Emitter = require('events');
const path = require('path');
const fs = require('fs');
const copydir = require('copy-dir');
const fetch = require('node-fetch');
const rimraf = require('rimraf');
const compareVersions = require('compare-versions');
const request = require('request');
const progress = require('request-progress');
const extract = require('extract-zip');

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

        this._updaterPath = path.join(this._userDataPath, '../updater');
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

            // if there is no updater dir, create it
            if (!fs.existsSync(path.join(this._updaterPath))){
                fs.mkdirSync(path.join(this._updaterPath), {recursive: true});
            }

            const zipPath = path.join(this._updaterPath, `${this._type}.zip`);

            progress(request(this._config.download + this._latestVersion))
                .on('progress', state => {
                    if (callback) {
                        callback(state);
                    }
                })
                .on('end', () => {
                    extract(zipPath, {dir: this._updaterPath}).then(() => {
                        rimraf.sync(zipPath);
                        rimraf.sync(this._userDataPath);

                        const extractDir = path.join(this._updaterPath,
                            `${this._type.slice(0, -1)}-${this._latestVersion.slice(1)}`);
                        copydir.sync(extractDir, this._userDataPath, {utimes: true, mode: true});
                        rimraf.sync(extractDir);

                        // write the new version tag to config.json to finitsh upload
                        const config = Object.assign({}, this._config);
                        config.version = this._latestVersion;
                        fs.writeFileSync(this._configPath, JSON.stringify(config));

                        console.log(`${this._type} update finish`);
                        return resolve();
                    })
                        .catch(err => reject(`Error while extract ${zipPath} to ${this._updaterPath}: ${err}`));
                })
                .on('error',
                    err => reject(`Error while downloading ${this._config.download}${this._latestVersion}: ${err}`))
                .pipe(fs.createWriteStream(zipPath));
        });
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
