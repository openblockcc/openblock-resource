const OpenBlockResourceServer = require('./server');
const requireAll = require('require-all');
const path = require('path');
const fs = require('fs');

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20120;

/**
 * Extenions class.
 * @readonly
 */
const EXTENSION_CLASS = ['sheild', 'actuator', 'sensor', 'communication', 'display', 'kit', 'other'];

/**
 * Device tyoe.
 * @readonly
 */
const DEVICE_TYPE = ['arduino', 'microbit'];

/**
 * A server to provide local extensions resource.
 */
class OpenBlockExtension extends OpenBlockResourceServer{

    /**
     * Construct a OpenBlock extension server object.
     * @param {string} userDataPath - the path of user data.
     */
    constructor (userDataPath) {
        super(userDataPath, 'extensions');

        this._socketPort = DEFAULT_PORT;
    }

    assembleData () {
        const extensionsThumbnailData = [];

        DEVICE_TYPE.forEach(deviceType => {
            EXTENSION_CLASS.forEach(extClass => {
                const extPath = path.join(this._userDataPath, deviceType, extClass);
                if (fs.existsSync(extPath)) {
                    const data = requireAll({dirname: extPath, filter: /index.js$/, recursive: true});
                    Object.entries(data).forEach(ext => {
                        // Modify the attribute to point to the real address.
                        const content = ext[1]['index.js'](this._formatMessage);
                        const basePath = path.join(deviceType, extClass, ext[0]);

                        if (content.iconURL) {
                            content.iconURL = path.join(basePath, content.iconURL);
                        }
                        content.blocks = path.join(basePath, content.blocks);
                        content.generator = path.join(basePath, content.generator);
                        content.toolbox = path.join(basePath, content.toolbox);
                        content.msg = path.join(basePath, content.msg);

                        if (content.library) {
                            content.library = path.join(extPath, ext[0], content.library);
                        }
                        extensionsThumbnailData.push(content);
                    });
                }
            });
        });

        return extensionsThumbnailData;
    }
}

module.exports = OpenBlockExtension;
