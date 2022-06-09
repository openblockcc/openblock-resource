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

                    const processContent = ct => {
                        if (ct.deviceId === listItem) {

                            const basePath = path.join(this.type, catlog[0], dev[0]);

                            if (ct.iconURL) {
                                ct.iconURL = path.join(basePath, ct.iconURL);
                            }
                            if (ct.connectionIconURL) {
                                ct.connectionIconURL = path.join(basePath, ct.connectionIconURL);
                            }
                            if (ct.connectionSmallIconURL) {
                                ct.connectionSmallIconURL = path.join(basePath, ct.connectionSmallIconURL);
                            }
                            matched = true;
                            devicesThumbnailData.push(ct);
                        }
                    };

                    if (Object.keys(content)[0] === '0') {
                        Object.values(content).forEach(ct => {
                            processContent(ct);
                        });
                    } else {
                        processContent(content);
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
