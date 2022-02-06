const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer1 = new OpenblockResourceServer();
const resourceServer2 = new OpenblockResourceServer();

// Test the anti-duplicate upgrade function of the upgrader.
resourceServer1.checkUpdate()
    .then(info => {
        console.log('Resource Server 1: check update info:', info);
        if (info.upgradeble) {
            resourceServer1.upgrade(c => console.log('Resource Server 1: ', c))
                .then(() => {
                    console.log(clc.green('\nResource Server 1: Upgrade success'));
                })
                .catch(err => {
                    console.error(clc.red(`ERR!: Resource Server 1: upgrade failed: ${err}`));
                });
        } else {
            console.log('Resource Server 1: No need to upgrade.');
        }
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 1: Check update failed: ${err}`));
    });

resourceServer2.checkUpdate()
    .then(info => {
        console.log('Resource Server 2: check update info:', info);
        if (info.upgradeble) {
            resourceServer2.upgrade(c => console.log('Resource Server 2: ', c))
                .then(() => {
                    console.log(clc.green('\nResource Server 2:  Upgrade success'));
                })
                .catch(err => {
                    console.error(clc.red(`ERR!: Resource Server 2: upgrade failed: ${err}`));
                });
        } else {
            console.log('No need to upgrade.');
        }
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 2: Check update failed: ${err}`));
    });
