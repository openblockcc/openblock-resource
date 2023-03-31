const formatMessage = require('format-message');
const express = require('express');
const Emitter = require('events');
const path = require('path');
const fs = require('fs');
const {defaultsDeep} = require('lodash');
const fetch = require('node-fetch');
const http = require('http');
const clc = require('cli-color');

const OpenBlockDevice = require('./device');
const OpenBlockExtension = require('./extension');
const {
    DEFAULT_HOST,
    DEFAULT_PORT,
    SERVER_NAME,
    REOPEN_INTERVAL,
    OFFICIAL_TRANSLATIONS_FILE,
    THIRD_PARTY_TRANSLATIONS_FILE
} = require('./config');

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

    // If the 18n cache is not exist, generate it.
    generate18nCache (locale) {
        if (this.deviceIndexData[`${locale}`] && this.extensionsIndexData[`${locale}`]) {
            return;
        }

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

        this._formatMessage[`${locale}`] = formatMessage.namespace();
        this._formatMessage[`${locale}`].setup({
            locale: locale,
            translations: translations
        });

        this.deviceIndexData[`${locale}`] =
                JSON.stringify(this.devices.assembleData(this._userDataPath, this._formatMessage[`${locale}`]));

        this.extensionsIndexData[`${locale}`] =
                JSON.stringify(this.extensions.assembleData(this._userDataPath, this._formatMessage[`${locale}`]));
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
                this.generate18nCache(locale);
                res.send(this.extensionsIndexData[`${locale}`]);
            } else if (type === this.devices.type) {
                this.generate18nCache(locale);
                res.send(this.deviceIndexData[`${locale}`]);
            }
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
