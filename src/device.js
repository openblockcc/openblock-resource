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

        const parseDeviceList = [];
        deviceList.forEach(deviceId => {
            if (typeof deviceId === 'object') {
                deviceId.forEach(id => {
                    parseDeviceList.push(id);
                });
            } else {
                parseDeviceList.push(deviceId);
            }
        });

        parseDeviceList.forEach(deviceId => {
            let matched = false;
            Object.entries(devices).forEach(catlog => {
                Object.entries(catlog[1]).forEach(dev => {
                    const content = dev[1]['index.js'](formatMessage);

                    const processDeviceData = deviceData => {
                        if (deviceData.deviceId === deviceId) {

                            const basePath = path.join(this.type, catlog[0], dev[0]);

                            if (deviceData.iconURL) {
                                deviceData.iconURL = path.join(basePath, deviceData.iconURL);
                            }
                            if (deviceData.connectionIconURL) {
                                deviceData.connectionIconURL = path.join(basePath, deviceData.connectionIconURL);
                            }
                            if (deviceData.connectionSmallIconURL) {
                                deviceData.connectionSmallIconURL = path.join(basePath, deviceData.connectionSmallIconURL);
                            }
                            if (deviceData.scExt) {
                                deviceData.scExt = path.join(basePath, deviceData.scExt);
                            }

                            matched = true;
                            devicesThumbnailData.push(deviceData);
                        }
                    };

                    // Support for multiple frameworks device data
                    if (content.length > 1) {
                        content.forEach(deviceData => {
                            processDeviceData(deviceData);
                        });
                    } else {
                        processDeviceData(content);
                    }
                });
            });
            if (!matched) {
                devicesThumbnailData.push({deviceId: deviceId});
            }
        });

        return devicesThumbnailData;
    }
}

module.exports = OpenBlockDevice;
