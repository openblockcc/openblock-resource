const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Test the update funciton.
resourceServer.extension.checkAndDownloadUpdate().then(info => {
    console.log('extension log =', info.log);
    resourceServer.extension.upgrade();
})
    .catch(err => {
        console.log('extension err =', err);
    });

resourceServer.device.checkAndDownloadUpdate().then(info => {
    console.log('device log =', info.log);
    resourceServer.device.upgrade();
})
    .catch(err => {
        console.log('device err =', err);
    });
