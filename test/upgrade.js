const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Test the upgrade funciton.
resourceServer.checkUpdate().then(updateInfo => {
    if (updateInfo.extension || updateInfo.device){
        resourceServer.upgrade(downloadInfo => {
            console.log(`speed: ${(downloadInfo.speed / (1024 * 1024)).toFixed(2)} MB/s, ` +
        `transferred: ${(downloadInfo.transferred / (1024 * 1024)).toFixed(2)} MB/s`);
        })
            .then(() => {
                console.log('upgrade finish');
            });
    } else {
        console.log('extension and device are the latest version');
    }
})
    .catch(err => {
        console.error('Error while checking for update: ', err);
    });
