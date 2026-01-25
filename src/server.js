const express = require('express');
const Emitter = require('events');
const fetch = require('node-fetch');
const http = require('http');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const OpenBlockDevice = require('./device');
const OpenBlockExtension = require('./extension');
const log = require('./log');
const {
    DEFAULT_HOST,
    DEFAULT_PORT,
    SERVER_NAME,
    REOPEN_INTERVAL
} = require('./config');

/**
 * A server to provide local resource.
 */
class ResourceServer extends Emitter{

    /**
     * Construct a OpenBlock resource server object.
     * @param {string[]} resourcesPaths - array of resource paths ordered by priority (first = highest priority).
     */
    constructor (resourcesPaths) {
        super();

        this._resourcesPaths = resourcesPaths;
        this._host = DEFAULT_HOST;
        this._port = DEFAULT_PORT;

        this.extensions = new OpenBlockExtension();
        this.devices = new OpenBlockDevice();

        this.deviceData = null;
        this.extensionData = null;
    }

    /**
     * Get the primary cache path (first path in resourcesPaths).
     * This is where dev symlinks will be created.
     * @returns {string} Primary cache path
     */
    get cachePath () {
        return this._resourcesPaths[0];
    }

    /**
     * Clear all symbolic links in the devices and extensions directories of the cache path.
     * Called at server startup to clean up any development links from previous sessions.
     */
    clearSymlinks () {
        const types = ['devices', 'extensions'];
        let removedCount = 0;

        for (const type of types) {
            const typePath = path.join(this.cachePath, type);
            if (!fs.existsSync(typePath)) continue;

            const entries = fs.readdirSync(typePath, {withFileTypes: true});
            for (const entry of entries) {
                if (entry.isSymbolicLink()) {
                    const linkPath = path.join(typePath, entry.name);
                    try {
                        fs.unlinkSync(linkPath);
                        removedCount++;
                    } catch (err) {
                        log.error(`Failed to remove symlink: ${linkPath}`);
                        log.detail('Reason', err.message);
                    }
                }
            }
        }

        if (removedCount > 0) {
            log.info(`Cleared ${removedCount} dev symlink(s) from previous session`);
            log.blank();
        }
    }

    /**
     * Create a symbolic link for development plugin.
     * @param {string} type - Resource type ('devices' or 'extensions')
     * @param {string} name - Name of the link (directory name in cache)
     * @param {string} target - Target path to link to (the actual plugin directory)
     * @returns {{success: boolean, message: string}} Result of the operation
     */
    createDevLink (type, name, target) {
        if (!['devices', 'extensions'].includes(type)) {
            return {success: false, message: `Invalid type: ${type}. Must be 'devices' or 'extensions'`};
        }

        // Validate target exists
        if (!fs.existsSync(target)) {
            return {success: false, message: `Target path does not exist: ${target}`};
        }

        // Ensure type directory exists in cache
        const typeDir = path.join(this.cachePath, type);
        if (!fs.existsSync(typeDir)) {
            fs.mkdirSync(typeDir, {recursive: true});
        }

        const linkPath = path.join(typeDir, name);

        // Remove existing link/directory if exists
        if (fs.existsSync(linkPath)) {
            const stat = fs.lstatSync(linkPath);
            if (stat.isSymbolicLink()) {
                fs.unlinkSync(linkPath);
            } else {
                return {success: false, message: `Path already exists and is not a symlink: ${linkPath}`};
            }
        }

        try {
            // Create symbolic link (use 'junction' on Windows for directory links without admin rights)
            fs.symlinkSync(target, linkPath, 'junction');
            log.success(`Created dev symlink: ${linkPath} -> ${target}`);

            // Reassemble data to include the new plugin
            this.assembleData();

            return {success: true, message: `Successfully linked ${name} to ${target}`};
        } catch (err) {
            return {success: false, message: `Failed to create symlink: ${err.message}`};
        }
    }

    /**
     * Assemble all resource data at startup.
     * Iterates through all resource paths in priority order, merging results.
     * Priority: first path > second path > third path > ...
     */
    assembleData () {
        const allDevices = [];
        const allExtensions = [];

        for (const resourcePath of this._resourcesPaths) {
            allDevices.push(...this.devices.assembleData(resourcePath));
            allExtensions.push(...this.extensions.assembleData(resourcePath));
        }

        const deviceData = _.unionBy(allDevices, 'deviceId');
        const extensionData = _.unionBy(allExtensions, 'extensionId');

        this.deviceData = JSON.stringify(deviceData);
        this.extensionData = JSON.stringify(extensionData);

        log.success(`Assembled ${deviceData.length} devices and ${extensionData.length} extensions`);
        log.blank();
    }

    isSameServer (host, port) {
        const agent = new http.Agent({
            rejectUnauthorized: false
        });

        return new Promise((resolve, reject) => {
            fetch(`http://${host}:${port}`, {agent})
                .then(res => res.text())
                .then(text => {
                    if (text === SERVER_NAME) {
                        return resolve(true);
                    }
                    return resolve(false);
                })
                .catch(err => reject(err));
        });
    }

    /**
     * Start a server listening for connections.
     * @param {number} port - the port to listen.
     * @param {number} host - the host to listen.
     */
    listen (port, host) {
        if (port) {
            this._port = port;
        }
        if (host) {
            this._host = host;
        }

        // Clear all dev symlinks from previous sessions
        this.clearSymlinks();

        // Assemble all data at startup
        this.assembleData();

        this._app = express();
        this._server = http.createServer(this._app);

        // Parse JSON body for POST requests
        this._app.use(express.json());

        this._app.use((_req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            next();
        });

        // Register static file directories
        for (const resourcePath of this._resourcesPaths) {
            this._app.use(express.static(resourcePath));
        }

        this._app.get('/', (_req, res) => {
            res.send(SERVER_NAME);
        });

        this._app.get('/devices.json', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(this.deviceData);
        });

        this._app.get('/extensions.json', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(this.extensionData);
        });

        this._app.post('/link', (req, res) => {
            const {type, name, target} = req.body;

            if (!type || !name || !target) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: type, name, target'
                });
            }

            const result = this.createDevLink(type, name, target);
            const status = result.success ? 200 : 400;
            return res.status(status).json(result);
        });

        this._server.listen(this._port, this._host, () => {
            log.success(`Server listening on: http://${this._host}:${this._port}`);
            log.separator();
            this.emit('ready');
        })
            .on('error', err => {
                this.isSameServer('127.0.0.1', this._port).then(isSame => {
                    if (isSame) {
                        log.warn(`Port is already used by other openblock-resource server, will try reopening after ${REOPEN_INTERVAL} ms`); // eslint-disable-line max-len
                        setTimeout(() => {
                            this._server.close();
                            this._server.listen(this._port, this._host);
                        }, REOPEN_INTERVAL);
                        this.emit('port-in-use');
                    } else {
                        log.error(`Error while trying to listen port ${this._port}: ${err}`);
                        this.emit('error', `ERR!: error while trying to listen port ${this._port}: ${err}`);
                    }
                });
            });
    }
}

module.exports = ResourceServer;
