const OpenBlockExtension = require('./src/extension-server');
const OpenBlockDevice = require('./src/device-server');

class OpenblockResourceServer {
    constructor (userDataPath, devicesPath, extensionPath) {
        this.device = new OpenBlockDevice(userDataPath, devicesPath);
        this.extension = new OpenBlockExtension(userDataPath, extensionPath);
    }
}

module.exports = OpenblockResourceServer;
