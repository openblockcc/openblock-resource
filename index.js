const OpenBlockExtension = require('./src/extension-server');
const OpenBlockDevice = require('./src/device-server');

class OpenblockResourceServer {
    constructor (userDataPath, initialResourcePath) {
        this.device = new OpenBlockDevice(userDataPath, initialResourcePath);
        this.extension = new OpenBlockExtension(userDataPath, initialResourcePath);

        this._extensionTransferred = 0;
    }

    listen (deviceServerPort = null, extensionServerPort = null) {
        this.device.listen(deviceServerPort);
        this.extension.listen(extensionServerPort);
    }

    checkUpdate () {
        return new Promise((resolve, reject) => {
            this.extension.checkShouldUpdate()
                .then(extension => {
                    this.device.checkShouldUpdate()
                        .then(device => resolve({extension, device}))
                        .catch(err => reject(`Error while check device update: ${err}`));
                })
                .catch(err => reject(`Error while check extension update: ${err}`));
        });
    }

    upgrade (callback) {
        const extensionCallback = sta => {
            this._extensionTransferred = sta.size.transferred;
            callback({speed: sta.speed, transferred: this._extensionTransferred});
        };
        const deviceCallback = sta => {
            this._transferred = sta.size.transferred + this._extensionTransferred;
            callback({speed: sta.speed, transferred: this._transferred});
        };
        return new Promise((resolve, reject) => {
            this.extension.upgrade(extensionCallback)
                .then(() => {
                    this.device.upgrade(deviceCallback)
                        .then(() => resolve())
                        .catch(err => reject(`Error while upgrade device: ${err}`));
                })
                .catch(err => reject(`Error while upgrade extension: ${err}`));
        });
    }
}

module.exports = OpenblockResourceServer;
