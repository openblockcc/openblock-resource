const requireAll = require('require-all');
const path = require('path');
const fs = require('fs');

const TYPE = 'devices';

/**
 * A server to provide local devices resource.
 */
class OpenBlockDevice {

    constructor () {
        this.type = TYPE;
    }

    assembleData (dataPath, formatMessage) {
        let devicesThumbnailData = [];

        if (!fs.existsSync(dataPath)) {
            return devicesThumbnailData;
        }

        const deviceResourcePath = path.join(dataPath, this.type);
        if (fs.existsSync(deviceResourcePath)) {
            const data = requireAll({dirname: deviceResourcePath, filter: /index.js$/, recursive: true});
            Object.entries(data).forEach(dev => {
                // Filter out index files in the specified device order
                if (dev[0] === 'index.js') {
                    return;
                }

                const translationsFile = path.join(deviceResourcePath, dev[0], 'translations.js');
                let translations;
                if (fs.existsSync(translationsFile)) {
                    // eslint-disable-next-line global-require
                    const locales = require(translationsFile);
                    translations = locales.getInterfaceTranslations();
                    formatMessage.setup({
                        translations: translations
                    });
                }

                const content = dev[1]['index.js'](formatMessage);

                const processDeviceData = deviceData => {
                    const basePath = path.join(this.type, dev[0]);

                    // Convert a local file path to a network address
                    if (deviceData.iconURL) {
                        deviceData.iconURL = path.join(basePath, deviceData.iconURL);
                    }
                    if (deviceData.connectionIconURL) {
                        deviceData.connectionIconURL = path.join(basePath, deviceData.connectionIconURL);
                    }
                    if (deviceData.connectionSmallIconURL) {
                        deviceData.connectionSmallIconURL = path.join(basePath,
                            deviceData.connectionSmallIconURL);
                    }
                    if (deviceData.main) {
                        deviceData.main = path.join(basePath, deviceData.main);
                    }
                    if (deviceData.translations) {
                        deviceData.translations = path.join(basePath, deviceData.translations);
                    }
                    if (deviceData.firmware) {
                        deviceData.firmware = path.join(basePath, deviceData.firmware);
                    }
                    if (deviceData.arduinoData) {
                        deviceData.arduinoData = path.join(basePath, deviceData.arduinoData);
                    }
                    devicesThumbnailData.push(deviceData);
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
        }

        const deviceIndexPath = path.join(dataPath, this.type, 'index.js');
        if (fs.existsSync(deviceIndexPath)) {
            const flatIndex = [];
            // eslint-disable-next-line global-require
            const index = require(path.join(dataPath, this.type, 'index.js'));
            index.forEach(deviceId => {
                if (typeof deviceId === 'object') {
                    deviceId.forEach(id => {
                        flatIndex.push(id);
                    });
                } else {
                    flatIndex.push(deviceId);
                }
            });

            devicesThumbnailData = flatIndex.map(deviceId => {
                const matchedItem = devicesThumbnailData.find(item => item.deviceId === deviceId);
                if (matchedItem) {
                    matchedItem.isOrdered = true;
                    return matchedItem;
                }
                return {deviceId: deviceId, isOrdered: true};
            });
        }
        return devicesThumbnailData;
    }
}

module.exports = OpenBlockDevice;
