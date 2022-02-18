const fs = require('fs-extra');
const Emitter = require('events');
const path = require('path');
const compareVersions = require('compare-versions');
const clc = require('cli-color');

const ResourceServer = require('./src/server');
const ResourceUpgrader = require('./src/upgrader');
const {DIRECTORY_NAME, DEFAULT_USER_DATA_PATH, DEFAULT_LOCALE} = require('./src/config');
const {checkDirHash} = require('./src/calc-dir-hash');
const {INIT_RESOURCES_STEP} = require('./src/state');
const getConfigHash = require('./src/get-config-hash');


class OpenblockResourceServer extends Emitter{
    constructor (userDataPath, initialResourcesPath, locale = DEFAULT_LOCALE) {
        super();

        if (userDataPath) {
            this._userDataPath = path.join(userDataPath, DIRECTORY_NAME);
        } else {
            this._userDataPath = path.join(DEFAULT_USER_DATA_PATH, DIRECTORY_NAME);
        }
        this._configPath = path.join(this._userDataPath, 'config.json');

        // The path that store initial resources.
        if (initialResourcesPath) {
            this._resourcesPath = path.join(initialResourcesPath);
        } else {
            this._resourcesPath = path.join(__dirname, DIRECTORY_NAME);
        }

        this._locale = locale;

        this._latestVersion = null;
        this.upgrader = null;
    }

    checkResources () {
        if (!fs.existsSync(this._configPath)){
            return Promise.reject(`Cannot find config file: ${this._configPath}`);
        }

        const dirHash = getConfigHash(this._configPath);

        // If no hash value in config file, report a warning but don't stop the process.
        if (!dirHash) {
            console.warn(clc.yellow(`WARN: no hash value found in ${this._configPath}`));
            return Promise.resolve();
        }

        return checkDirHash(this._userDataPath, dirHash);
    }

    initialResources (callback = null) {
        if (callback) {
            callback({phase: INIT_RESOURCES_STEP.checking});
        }

        const copyResources = () => {
            console.log(`copy ${this._resourcesPath} to ${this._userDataPath}`);
            if (callback) {
                callback({phase: INIT_RESOURCES_STEP.copying});
            }

            // copy the initial resources to user data directory
            return fs.mkdirs(this._userDataPath)
                .then(() => fs.copy(this._resourcesPath, this._userDataPath))
                .then(() => this.checkResources());
        };

        return this.checkResources()
            .catch(e => {
                console.log(clc.yellow(`WARN: Check resources failed, try to initial resources: ${e}`));
                if (fs.existsSync(this._userDataPath)){
                    return fs.rm(this._userDataPath, {recursive: true, force: true})
                        .then(() => copyResources());
                }
                return copyResources();
            });
    }

    checkUpdate () {
        let config;

        try {
            config = JSON.parse(fs.readFileSync(this._configPath, 'utf8'));
        } catch (e) {
            return Promise.reject(e);
        }

        if (!this.upgrader) {
            this.upgrader = new ResourceUpgrader(config.repo, config.cdn, path.dirname(this._userDataPath));
        }

        return this.upgrader.checkUpdate()
            .then(info => {
                info.currentVersion = config.version;
                if (compareVersions(info.latestVersion, info.currentVersion) > 0) {
                    info.upgradeble = true;
                } else {
                    info.upgradeble = false;
                }
                this._latestVersion = info.latestVersion;
                return info;
            });
    }

    upgrade (callback = null) {
        return this.upgrader.upgrade(this._latestVersion, callback);
    }

    listen (port = null) {
        const server = new ResourceServer(this._userDataPath);

        server.on('error', e => {
            this.emit('error', e);
        });
        server.on('ready', () => {
            this.emit('ready');
        });
        server.on('port-in-use', () => {
            this.emit('port-in-use');
        });

        server.listen(port);
    }
}

module.exports = OpenblockResourceServer;
