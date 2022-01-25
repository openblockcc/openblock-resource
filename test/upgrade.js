const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Test the upgrade funciton.
resourceServer.checkUpdate()
    .then(info => {
        console.log('check update info:', info);
        if (info.upgradeble) {
            resourceServer.upgrade(console.log)
                .then(() => {
                    console.log('upgrade success');
                })
                .catch(err => {
                    console.error('upgrade failed:', err);
                });
        } else {
            console.log('No need to upgrade.');
        }
    })
    .catch(err => {
        console.log('check update failed:', err);
    });
