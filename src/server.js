const express = require('express');
const Emitter = require('events');
const fetch = require('node-fetch');
const http = require('http');
const clc = require('cli-color');
const _ = require('lodash');

const OpenBlockDevice = require('./device');
const OpenBlockExtension = require('./extension');
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

        console.log(clc.green(
            `Assembled ${allDevices.length} devices and ${allExtensions.length} extensions ` +
            `(deduplicated to ${deviceData.length} devices and ${extensionData.length} extensions)`
        ));
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

        // Assemble all data at startup
        this.assembleData();

        this._app = express();
        this._server = http.createServer(this._app);

        this._app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });

        // Register static file directories
        for (const resourcePath of this._resourcesPaths) {
            this._app.use(express.static(resourcePath));
        }

        this._app.get('/', (req, res) => {
            res.send(SERVER_NAME);
        });

        this._app.get('/devices.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(this.deviceData);
        });

        this._app.get('/extensions.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(this.extensionData);
        });

        this._server.listen(this._port, this._host, () => {
            console.log(clc.green(`Openblock resource server start successfully, socket listen on: http://${this._host}:${this._port}`));
            this.emit('ready');
        })
            .on('error', err => {
                this.isSameServer('127.0.0.1', this._port).then(isSame => {
                    if (isSame) {
                        console.log(`Port is already used by other openblock-resource server, will try reopening after ${REOPEN_INTERVAL} ms`); // eslint-disable-line max-len
                        setTimeout(() => {
                            this._server.close();
                            this._server.listen(this._port, this._host);
                        }, REOPEN_INTERVAL);
                        this.emit('port-in-use');
                    } else {
                        const info = `ERR!: error while trying to listen port ${this._port}: ${err}`;
                        console.error(clc.red(info));
                        this.emit('error', info);
                    }
                });
            });
    }
}

module.exports = ResourceServer;
