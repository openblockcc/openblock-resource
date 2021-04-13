const OpenBlockExtension = require('./src/extension-server');
const OpenBlockDevice = require('./src/device-server');

class OpenblockResourceServer {
    constructor (userDataPath, initialResourcePath) {
        this.device = new OpenBlockDevice(userDataPath, initialResourcePath);
        this.extension = new OpenBlockExtension(userDataPath, initialResourcePath);
    }
}

module.exports = OpenblockResourceServer;
