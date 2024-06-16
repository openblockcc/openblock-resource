const fs = require('fs-extra');
const Emitter = require('events');
const path = require('path');
const compareVersions = require('compare-versions');

const ResourceServer = require('./src/server');
const ResourceUpdater = require('./src/updater');
const {
    DEFAULT_CACHE_RESOURCES_PATH,
    DEFAULT_BUILTIN_RESOURCES_PATH,
    DEFAULT_LOCALE
} = require('./src/config');

class OpenblockResourceServer extends Emitter{
    constructor (cacheResourcesPath, builtinResourcesPath, locale = DEFAULT_LOCALE) {
        super();

        if (cacheResourcesPath) {
            this._cacheResourcesPath = path.join(cacheResourcesPath);
        } else {
            this._cacheResourcesPath = path.join(DEFAULT_CACHE_RESOURCES_PATH);
        }

        if (builtinResourcesPath) {
            this._builtinResourcesPath = path.join(builtinResourcesPath);
        } else {
            this._builtinResourcesPath = path.join(DEFAULT_BUILTIN_RESOURCES_PATH);
        }

        // If 'OpenBlockExternalResources' exists in the upper-level directory, the content in this
        // directory will be used first, rather than the content in the software installation path.
        // This method is used when customizing by a third-party manufacturer, so as to avoid overwriting
        // the content of the third - party manufacturer when updating the software.
        const thirdPartyResourcesPath = path.join(this._builtinResourcesPath, '../../OpenBlockExternalResources');
        if (fs.existsSync(thirdPartyResourcesPath)) {
            this._builtinResourcesPath = thirdPartyResourcesPath;
        }

        if (fs.existsSync(this._cacheResourcesPath)) {
            this._configPath = path.join(this._cacheResourcesPath, 'config.json');
        } else {
            this._configPath = path.join(this._builtinResourcesPath, 'config.json');
        }

        this._locale = locale;

        this._latestVersion = null;
        this.updater = null;
    }

    checkUpdate (option) {
        let config;

        try {
            config = JSON.parse(fs.readFileSync(this._configPath, 'utf8'));
        } catch (e) {
            return Promise.reject(e);
        }

        if (!this.updater) {
            this.updater = new ResourceUpdater(
                this._locale === 'CN' && config.updater.cn ? config.updater.cn : config.updater.default,
                path.dirname(this._cacheResourcesPath));
        }

        return this.updater.checkUpdate(option)
            .then(info => {
                info.currentVersion = config.version;
                if (compareVersions(info.latestVersion, info.currentVersion) > 0) {
                    info.updateble = true;
                } else {
                    info.updateble = false;
                }
                this._latestVersion = info.latestVersion;
                return info;
            });
    }

    update (option) {
        return this.updater.update(this._latestVersion, option);
    }

    listen (port = null) {
        const server = new ResourceServer(this._cacheResourcesPath, this._builtinResourcesPath);

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
