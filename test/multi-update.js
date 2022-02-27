const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer1 = new OpenblockResourceServer();
const resourceServer2 = new OpenblockResourceServer();

// Test the anti-duplicate update function of the updater.
resourceServer1.checkUpdate()
    .then(info => {
        console.log('Resource Server 1: check update info:', info);
        if (info.updateble) {
            resourceServer1.update({callback: c => console.log('Resource Server 1: ', c)})
                .then(() => {
                    console.log(clc.green('\nResource Server 1: Update success'));
                })
                .catch(err => {
                    console.error(clc.red(`ERR!: Resource Server 1: update failed: ${err}`));
                });
        } else {
            console.log('Resource Server 1: No need to update.');
        }
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 1: Check update failed: ${err}`));
    });

resourceServer2.checkUpdate()
    .then(info => {
        console.log('Resource Server 2: check update info:', info);
        if (info.updateble) {
            resourceServer2.update({callback: c => console.log('Resource Server 2: ', c)})
                .then(() => {
                    console.log(clc.green('\nResource Server 2:  Update success'));
                })
                .catch(err => {
                    console.error(clc.red(`ERR!: Resource Server 2: update failed: ${err}`));
                });
        } else {
            console.log('No need to update.');
        }
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Resource Server 2: Check update failed: ${err}`));
    });
