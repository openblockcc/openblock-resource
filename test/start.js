const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Start server
resourceServer.device.listen();
resourceServer.extension.listen();
