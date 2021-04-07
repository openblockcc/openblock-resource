const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Test the update funciton.
resourceServer.extension.checkAndDownloadUpdate().then(info => {
    console.log('info =', info);
    resourceServer.extension.update();
})
    .catch(err => {
        console.log('extension err =', err);
    });

resourceServer.device.checkAndDownloadUpdate().then(info => {
    console.log('info =', info);
    resourceServer.device.update();
})
    .catch(err => {
        console.log('device err =', err);
    });
