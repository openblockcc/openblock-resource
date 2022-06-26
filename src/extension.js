const requireAll = require('require-all');
const path = require('path');
const fs = require('fs');

/**
 * Extenions class.
 * @readonly
 */
const EXTENSION_CLASS = ['shield', 'actuator', 'sensor', 'communication', 'display', 'kit', 'other'];

/**
 * Device tyoe.
 * @readonly
 */
const DEVICE_TYPE = ['arduino', 'microbit', 'microPython'];

const TYPE = 'extensions';

/**
 * A server to provide local extensions resource.
 */
class OpenBlockExtension {

    constructor () {
        this.type = TYPE;
    }

    assembleData (userDataPath, formatMessage) {
        const extensionsThumbnailData = [];

        DEVICE_TYPE.forEach(deviceType => {
            EXTENSION_CLASS.forEach(extClass => {
                const extPath = path.join(userDataPath, this.type, deviceType, extClass);
                if (fs.existsSync(extPath)) {
                    const data = requireAll({dirname: extPath, filter: /index.js$/, recursive: true});
                    Object.entries(data).forEach(ext => {
                        // Modify the attribute to point to the real address.
                        const content = ext[1]['index.js'](formatMessage);
                        const basePath = path.join(this.type, deviceType, extClass, ext[0]);

                        if (content.iconURL) {
                            content.iconURL = path.join(basePath, content.iconURL);
                        }
                        content.blocks = path.join(basePath, content.blocks);
                        content.generator = path.join(basePath, content.generator);
                        content.toolbox = path.join(basePath, content.toolbox);
                        content.msg = path.join(basePath, content.msg);

                        if (content.funtions) {
                            content.funtions = path.join(basePath, content.funtions);
                        }
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
