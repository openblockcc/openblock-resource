const formatMessage = require('format-message');
const osLocale = require('os-locale');
const express = require('express');
const Emitter = require('events');
const path = require('path');

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
     * @param {string} type - the resource type of server.
     * @param {string} port - the port of server.
     * @param {string} locale - the locale of server.
     */
    constructor (userDataPath, type, port = DEFAULT_PORT, locale = DEFAULT_LANGUAGE) {
        super();

        this._type = type;
        this._userDataPath = path.join(userDataPath, this._type);

        this._socketPort = port;
        this._locale = locale;
        this._formatMessage = formatMessage.namespace();
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
