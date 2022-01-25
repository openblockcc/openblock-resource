const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Start server
resourceServer.initialResources(console.log)
    .then(() => {
        resourceServer.listen();
    })
    .catch(err => {
        console.error('Error while initial resources: ', err);
    });
