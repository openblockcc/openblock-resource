const fs = require('fs-extra');
const Emitter = require('events');
const path = require('path');
const compareVersions = require('compare-versions');

const ResourceServer = require('./src/server');
const ResourceUpgrader = require('./src/upgrader');
const {DIRECTORY_NAME, DEFAULT_USER_DATA_PATH, DEFAULT_LOCALE} = require('./src/config');
const {checkDirHash} = require('./src/calc-dir-hash');
const {INIT_RESOURCES_STEP} = require('./src/state');


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
        const checksumFile = path.resolve(this._userDataPath, 'folder-checksum-sha256.txt');

        if (!fs.existsSync(checksumFile)){
            return Promise.reject(`Cannot find checksum file: ${checksumFile}`);
        }

        const dirHash = fs.readFileSync(checksumFile, 'utf8');

        return checkDirHash(this._userDataPath, dirHash);
    }

    initialResources (callback = null) {
        return new Promise((resolve, reject) => {
            if (callback) {
                callback({phase: INIT_RESOURCES_STEP.checking});
            }

            this.checkResources()
                .then(() => resolve())
                .catch(e => {
                    console.log(e);
                    if (fs.existsSync(this._userDataPath)){
                        fs.rmSync(this._userDataPath, {recursive: true, force: true});
                    }

                    console.log(`copy ${this._resourcesPath} to ${this._userDataPath}`);
                    if (callback) {
                        callback({phase: INIT_RESOURCES_STEP.copying});
                    }

                    // copy the initial resources to user data directory
                    fs.mkdirsSync(this._userDataPath);
                    fs.copySync(this._resourcesPath, this._userDataPath);

                    // check the integrity of the initial resources
                    this.checkResources()
                        .then(resolve)
                        .catch(reject);
                });
        });
    }

    checkUpdate () {
        const config = JSON.parse(fs.readFileSync(this._configPath, 'utf8'));

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
