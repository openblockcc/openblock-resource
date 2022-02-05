const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer = new OpenblockResourceServer();

// Start server
resourceServer.initialResources(console.log)
    .then(() => {
        resourceServer.listen();
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Initial resources error: ${err}`));
    });

resourceServer.on('error', err => {
    console.error(clc.red(`ERR!: Resource server error: ${err}`));
});
