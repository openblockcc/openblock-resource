const formatMessage = require('format-message');
const express = require('express');
const Emitter = require('events');
const path = require('path');
const OpenBlockDevice = require('./device');
const OpenBlockExtension = require('./extension');

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20120;

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
        this._socketPort = DEFAULT_PORT;
        this._formatMessage = formatMessage.namespace();

        this.extensions = new OpenBlockExtension();
        this.devices = new OpenBlockDevice();

        // eslint-disable-next-line global-require
        const translations = require(path.join(this._userDataPath, 'locales.js'));

        this._formatMessage.setup({
            locale: 'en',
            translations: translations
        });
    }

    /**
     * Start a server listening for connections.
     * @param {number} port - the port to listen.
     */
    listen (port) {
        if (port) {
            this._socketPort = port;
        }

        this._app = express();

        this._app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        this._app.use(express.static(`${this._userDataPath}`));

        this._app.get('/:type/:locale', (req, res) => {
            const locale = req.params.locale.slice(0, -5);
            const type = req.params.type;

            this._formatMessage.setup({locale: locale});

            if (type === this.extensions.type) {
                res.send(JSON.stringify(this.extensions.assembleData(this._userDataPath, this._formatMessage)));
            } else if (type === this.devices.type) {
                res.send(JSON.stringify(this.devices.assembleData(this._userDataPath, this._formatMessage)));
            }
        });

        this._app.listen(this._socketPort).on('error', e => {
            const info = `Error while trying to listen port ${this._socketPort}: ${e}`;
            this.emit('error', info);
        });

        this.emit('ready');
        console.log(`\n----------------------------------------`);
        console.log(`\x1B[32msocket server listend: http://0.0.0.0:${this._socketPort}\nOpenblock ${this._type} server start successfully\x1B[0m`);
        console.log(`----------------------------------------\n`);
    }
}

module.exports = OpenBlockResourceServer;
