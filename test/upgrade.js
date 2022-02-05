const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer = new OpenblockResourceServer();

// Test the upgrade funciton.
resourceServer.checkUpdate()
    .then(info => {
        console.log('check update info:', info);
        if (info.upgradeble) {
            resourceServer.upgrade(console.log)
                .then(() => {
                    console.log(clc.green('\nUpgrade success'));
                })
                .catch(err => {
                    console.error(clc.red(`ERR!: upgrade failed: ${err}`));
                });
        } else {
            console.log('No need to upgrade.');
        }
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Check update failed: ${err}`));
    });
