const path = require('path');
const fs = require('fs');
const OpenBlockResource = require('./resource');

const TYPE = 'devices';

// Path fields configuration for devices
const PATH_FIELDS = {
    relative: ['iconURL', 'connectionIconURL', 'connectionSmallIconURL', 'main', 'translations'],
    absolute: ['firmware', 'arduinoData'] // Used directly by the toolchain and uploader
};

/**
 * A server to provide local devices resource.
 */
class OpenBlockDevice extends OpenBlockResource {

    constructor () {
        super(TYPE, PATH_FIELDS);
    }

    /**
     * Assemble device data with ordering support
     * @param {string} dataPath - Path to data directory
     * @returns {object[]} Array of device data
     */
    assembleData (dataPath) {
        if (!fs.existsSync(dataPath)) {
            return [];
        }

        // Use parent class to load all devices
        let devicesThumbnailData = super.assembleData(dataPath);

        // Apply device ordering if index.js exists
        devicesThumbnailData = this._applyDeviceOrdering(dataPath, devicesThumbnailData);

        return devicesThumbnailData;
    }

    /**
     * Apply device ordering based on index.js configuration
     * @param {string} dataPath - Path to data directory
     * @param {object[]} devicesThumbnailData - Array of device data
     * @returns {object[]} Ordered array of device data
     * @private
     */
    _applyDeviceOrdering (dataPath, devicesThumbnailData) {
        const deviceIndexPath = path.join(dataPath, this.type, 'index.js');

        if (!fs.existsSync(deviceIndexPath)) {
            return devicesThumbnailData;
        }

        // Clear require cache to get fresh index
        delete require.cache[require.resolve(deviceIndexPath)];
        // eslint-disable-next-line global-require
        const index = require(deviceIndexPath);

        // Flatten the index (supports nested arrays for grouping)
        const flatIndex = index.flat(Infinity);

        // Map devices according to the order specified in index
        return flatIndex.map(deviceId => {
            const matchedItem = devicesThumbnailData.find(item => item.deviceId === deviceId);
            if (matchedItem) {
                matchedItem.isOrdered = true;
                return matchedItem;
            }
            return {deviceId: deviceId, isOrdered: true};
        });
    }
}

module.exports = OpenBlockDevice;
