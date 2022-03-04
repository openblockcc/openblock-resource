const OpenblockResourceServer = require('../index');
const clc = require('cli-color');

const resourceServer = new OpenblockResourceServer(null, null, 'CN');

// Test the update funciton.
resourceServer.checkUpdate()
    .then(info => {
        console.log('check update info:', info);
        if (info.updateble) {
            resourceServer.update({callback: console.log})
                .then(() => {
                    console.log(clc.green('\nUpdate success'));
                })
                .catch(err => {
                    console.error(clc.red(`ERR!: update failed: ${err}`));
                });
        } else {
            console.log('No need to update.');
        }
    })
    .catch(err => {
        console.error(clc.red(`ERR!: Check update failed: ${err}`));
    });
