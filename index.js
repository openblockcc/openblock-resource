const fs = require('fs-extra');
const Emitter = require('events');
const path = require('path');
const clc = require('cli-color');

const ResourceServer = require('./src/server');
const {
    DEFAULT_CACHE_RESOURCES_PATH
} = require('./src/config');

class OpenblockResourceServer extends Emitter{
    constructor (cacheResourcesPath, builtinResourcesPath) {
        super();

        if (cacheResourcesPath) {
            this._cacheResourcesPath = path.join(cacheResourcesPath);
        } else {
            this._cacheResourcesPath = path.join(DEFAULT_CACHE_RESOURCES_PATH);
        }

        // Build array of builtin resource paths
        // Priority: OPENBLOCK_EXTERNAL_RESOURCES paths first, then builtinResourcesPath
        this._builtinResourcesPaths = [];

        // Parse OPENBLOCK_EXTERNAL_RESOURCES environment variable as multiple paths
        // Paths are separated by path.delimiter (';' on Windows, ':' on Linux/Mac)
        const envOpenBlockExternalResources = process.env.OPENBLOCK_EXTERNAL_RESOURCES;
        if (envOpenBlockExternalResources) {
            console.info(`$env:OPENBLOCK_EXTERNAL_RESOURCES = "${envOpenBlockExternalResources}"`);
            const envPaths = envOpenBlockExternalResources
                .split(path.delimiter)
                .map(p => p.trim())
                .filter(p => p.length > 0);
            this._builtinResourcesPaths.push(...envPaths);
        }

        // Add builtinResourcesPath as the last fallback
        if (builtinResourcesPath) {
            this._builtinResourcesPaths.push(path.join(builtinResourcesPath));
        }

        // Validate each path exists
        for (const resourcePath of this._builtinResourcesPaths) {
            if (!fs.existsSync(resourcePath)) {
                console.error(clc.red(`The external resource path does not exist: ${resourcePath}`));
            }
        }
    }

    listen (port = null) {
        // Combine all resource paths in priority order: cache first, then builtin paths
        const allResourcesPaths = [this._cacheResourcesPath, ...this._builtinResourcesPaths];

        const server = new ResourceServer(allResourcesPaths);
        console.info('Resource paths (in priority order):');
        allResourcesPaths.forEach((resourcePath, index) => {
            console.info(`  ${index + 1}. ${resourcePath}`);
        });

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
