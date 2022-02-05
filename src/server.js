const formatMessage = require('format-message');
const express = require('express');
const Emitter = require('events');
const path = require('path');
const fs = require('fs');
const locales = require('openblock-l10n').default;
const {defaultsDeep} = require('lodash');
const fetch = require('node-fetch');
const http = require('http');
const clc = require('cli-color');

const OpenBlockDevice = require('./device');
const OpenBlockExtension = require('./extension');

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
class ResourceServer extends Emitter{

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

        this._formatMessage = {};
        this.deviceIndexData = {};
        this.extensionsIndexData = {};
    }

    // Prepare data in advance to speed up data transmission
    generateCache () {
        let officialTranslations;
        let thirdPartyTranslations;

        try {
            officialTranslations = JSON.parse(fs.readFileSync(path.join(this._userDataPath, OFFICIAL_TRANSLATIONS_FILE), 'utf8')); // eslint-disable-line max-len
            thirdPartyTranslations = JSON.parse(fs.readFileSync(path.join(this._userDataPath, THIRD_PARTY_TRANSLATIONS_FILE), 'utf8')); // eslint-disable-line max-len

        } catch (e) {
            console.error(clc.red(`ERR!: ${e}`)); // eslint-disable-line max-len
            this.emit('error', e);
        }

        const translations = defaultsDeep(
            {},
            officialTranslations,
            thirdPartyTranslations
        );

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

        this.generateCache();

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

            // socket server listen on the same port
            console.log(clc.green(`Openblock resource server start successfully, socket listen on: http://${this._host}:${this._port}`));
        })
            .on('error', e => {
                this.isCurrentServer('127.0.0.1', this._port).then(isCurrent => {
                    if (isCurrent) {
                        console.log(`Port is already used by other openblock-resource server, will try reopening after ${REOPEN_INTERVAL} ms`); // eslint-disable-line max-len
                        setTimeout(() => {
                            this._server.close();
                            this._server.listen(this._port, this._host);
                        }, REOPEN_INTERVAL);
                        this.emit('port-in-use');
                    } else {
                        const info = `ERR!: error while trying to listen port ${this._port}: ${e}`;
                        console.error(clc.red(info));
                        this.emit('error', info);
                    }
                });
            });
    }
}

module.exports = ResourceServer;
