const requireAll = require('require-all');
const path = require('path');

const TYPE = 'devices';

/**
 * A server to provide local devices resource.
 */
class OpenBlockDevice {

    constructor () {
        this.type = TYPE;
    }

    assembleData (userDataPath, formatMessage) {
        const devicesThumbnailData = [];

        const devices = requireAll({
            dirname: `${path.join(userDataPath, this.type)}`,
            filter: /index.js$/,
            recursive: true
        });

        // eslint-disable-next-line global-require
        const deviceList = require(path.join(userDataPath, this.type, 'device.js'));
        deviceList.forEach(listItem => {
            let matched = false;
            Object.entries(devices).forEach(catlog => {
                Object.entries(catlog[1]).forEach(dev => {
                    const content = dev[1]['index.js'](formatMessage);
                    if (content.deviceId === listItem) {
                        const basePath = path.join(this.type, catlog[0], dev[0]);

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
