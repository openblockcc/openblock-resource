const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer1 = new OpenblockResourceServer();
const resourceServer2 = new OpenblockResourceServer();
const resourceServer3 = new OpenblockResourceServer();

// Test performance when launching multiple servers
resourceServer1.initializeResources(console.log)
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 1: Initialize resources error: ${err}`));
    });

resourceServer1.on('error', err => {
    console.error(clc.red(`ERR!: Resource Server 1: Resource server error: ${err}`));
});

resourceServer2.initializeResources(console.log)
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 2: Initialize resources error: ${err}`));
    });

resourceServer2.on('error', err => {
    console.error(clc.red(`ERR!: Resource Server 2: Resource server error: ${err}`));
});

resourceServer3.initializeResources(console.log)
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 3: Initialize resources error: ${err}`));
    });

resourceServer3.on('error', err => {
    console.error(clc.red(`ERR!: Resource Server 3: Resource server error: ${err}`));
});
