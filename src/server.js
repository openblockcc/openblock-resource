const formatMessage = require('format-message');
const express = require('express');
const Emitter = require('events');
const path = require('path');
const fs = require('fs');
const OpenBlockDevice = require('./device');
const OpenBlockExtension = require('./extension');
const locales = require('openblock-l10n').default;
const {defaultsDeep} = require('lodash');
const fetch = require('node-fetch');
const http = require('http');

/**
 * Configuration the default host.
 * @readonly
 */
const DEFAULT_HOST = '0.0.0.0';

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20120;

/**
 * Translate file name.
 * @readonly
 */
const OFFICIAL_TRANSLATIONS_FILE = 'official-locales.json';
const THIRD_PARTY_TRANSLATIONS_FILE = 'third-party-locales.json';

/**
 * Server name, ues in root path.
 * @readonly
 */
const SERVER_NAME = 'openblock-resource-server';

/**
 * The time interval for retrying to open the port after the port is occupied by another openblock-resource server.
 * @readonly
 */
const REOPEN_INTERVAL = 1000 * 1;

/**
 * A server to provide local resource.
 */
class OpenBlockResourceServer extends Emitter{

    /**
     * Construct a OpenBlock resource server object.
     * @param {string} userDataPath - the path of user data.
     */
    constructor (userDataPath) {
        super();

        this._userDataPath = userDataPath;
        this._host = DEFAULT_HOST;
        this._port = DEFAULT_PORT;

        this.extensions = new OpenBlockExtension();
        this.devices = new OpenBlockDevice();

        let translations = {};

        try {
            translations = defaultsDeep(
                {},
                JSON.parse(fs.readFileSync(path.join(this._userDataPath, OFFICIAL_TRANSLATIONS_FILE), 'utf8')),
                // JSON.parse(fs.readFileSync(path.join(this._userDataPath, THIRD_PARTY_TRANSLATIONS_FILE), 'utf8'))
            );
        } catch (e) {
            this.emit('error', e);
            console.error(`Can not find ${OFFICIAL_TRANSLATIONS_FILE} or ${THIRD_PARTY_TRANSLATIONS_FILE} in path: ${this._userDataPath}, please check user data path.`); // eslint-disable-line max-len
        }

        this._formatMessage = {};
        this.deviceIndexData = {};
        this.extensionsIndexData = {};

        // Prepare data in advance to speed up data transmission
        Object.keys(locales).forEach(locale => {
            this._formatMessage[`${locale}`] = formatMessage.namespace();
            this._formatMessage[`${locale}`].setup({
                locale: locale,
                translations: translations
            });

            this.deviceIndexData[`${locale}`] =
                JSON.stringify(this.devices.assembleData(this._userDataPath, this._formatMessage[`${locale}`]));

            this.extensionsIndexData[`${locale}`] =
                JSON.stringify(this.extensions.assembleData(this._userDataPath, this._formatMessage[`${locale}`]));
        });
    }

    isCurrentServer (host, port) {
        return new Promise((resolve, reject) => {
            fetch(`http://${host}:${port}`)
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

        this._app = express();
        this._server = http.createServer(this._app);

        this._app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        this._app.use(express.static(`${this._userDataPath}`));

        this._app.get('/', (req, res) => {
            res.send(SERVER_NAME);
        });

        this._app.get('/:type/:locale', (req, res) => {

            const type = req.params.type;

            let locale;
            if (req.params.locale.indexOf('.') === -1) {
                locale = req.params.locale;
            } else {
                locale = req.params.locale.slice(0, req.params.locale.indexOf('.'));
            }

            if (type === this.extensions.type) {
                res.send(this.extensionsIndexData[`${locale}`]);
            } else if (type === this.devices.type) {
                res.send(this.deviceIndexData[`${locale}`]);
            }
        });

        this._server.listen(this._port, this._host, () => {
            this.emit('ready');
            console.log(`\x1B[32mOpenblock resource server start successfully\nSocket server listend: http://${this._host}:${this._port}\x1B[0m`);
        })
            .on('error', e => {
                this.isCurrentServer('127.0.0.1', this._port).then(isCurrent => {
                    if (isCurrent) {
                        this.emit('port-in-use');
                        console.log(`Port is already used by other openblock-resource server, try reopening after another ${REOPEN_INTERVAL} ms`); // eslint-disable-line max-len
                        setTimeout(() => {
                            this._server.close();
                            this._server.listen(this._port, this._host);
                        }, REOPEN_INTERVAL);
                    } else {
                        const info = `Error while trying to listen port ${this._port}: ${e}`;
                        this.emit('error', info);
                        console.error(info);
                    }
                });
            });
    }
}

module.exports = OpenBlockResourceServer;
