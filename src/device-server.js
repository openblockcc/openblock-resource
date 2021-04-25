const OpenBlockResourceServer = require('./server');
const requireAll = require('require-all');
const path = require('path');

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20122;

/**
 * A server to provide local devices resource.
 */
class OpenBlockDevice extends OpenBlockResourceServer{

    /**
     * Construct a OpenBlock device server object.
     * @param {string} userDataPath - the path of user data.
     */
    constructor (userDataPath) {
        super(userDataPath, 'devices');

        this._socketPort = DEFAULT_PORT;
    }

    assembleData () {
        const devicesThumbnailData = [];

        const devices = requireAll({
            dirname: `${this._userDataPath}`,
            filter: /index.js$/,
            recursive: true
        });

        // eslint-disable-next-line global-require
        const deviceList = require(path.join(this._userDataPath, 'device.js'));
        deviceList.forEach(listItem => {
            let matched = false;
            Object.entries(devices).forEach(catlog => {
                Object.entries(catlog[1]).forEach(dev => {
                    const content = dev[1]['index.js'](this._formatMessage);
                    if (content.deviceId === listItem) {
                        const basePath = path.join(catlog[0], dev[0]);

                        if (content.iconURL) {
                            content.iconURL = path.join(basePath, content.iconURL);
                        }
                        if (content.connectionIconURL) {
                            content.connectionIconURL = path.join(basePath, content.connectionIconURL);
                        }
                        if (content.connectionSmallIconURL) {
                            content.connectionSmallIconURL = path.join(basePath, content.connectionSmallIconURL);
                        }
                        matched = true;
                        devicesThumbnailData.push(content);
                    }
                });
            });
            if (!matched) {
                devicesThumbnailData.push({deviceId: listItem});
            }
        });

        return devicesThumbnailData;
    }
}

module.exports = OpenBlockDevice;
