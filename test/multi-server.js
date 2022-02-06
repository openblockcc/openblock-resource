const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer1 = new OpenblockResourceServer();
const resourceServer2 = new OpenblockResourceServer();
const resourceServer3 = new OpenblockResourceServer();

// Test performance when launching multiple servers
resourceServer1.initialResources(console.log)
    .then(() => {
        resourceServer1.listen();
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 1: Initial resources error: ${err}`));
    });

resourceServer1.on('error', err => {
    console.error(clc.red(`ERR!: Resource Server 1: Resource server error: ${err}`));
});

resourceServer2.initialResources(console.log)
    .then(() => {
        resourceServer2.listen();
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 2: Initial resources error: ${err}`));
    });

resourceServer2.on('error', err => {
    console.error(clc.red(`ERR!: Resource Server 2: Resource server error: ${err}`));
});


resourceServer3.initialResources(console.log)
    .then(() => {
        resourceServer3.listen(20113);
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 3: Initial resources error: ${err}`));
    });

resourceServer3.on('error', err => {
    console.error(clc.red(`ERR!: Resource Server 3: Resource server error: ${err}`));
});
