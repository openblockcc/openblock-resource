const OpenblockResourceServer = require('../index');

const resourceServer = new OpenblockResourceServer();

// Test the upgrade funciton.
resourceServer.checkUpdate().then(updateInfo => {
    if (updateInfo){
        console.log('updateInfo:', updateInfo);
        resourceServer.upgrade(downloadInfo => {
            console.log(`phase: ${downloadInfo.phase}, ` +
                `speed: ${(downloadInfo.speed / (1024 * 1024)).toFixed(2)} MB/s, ` +
                `transferred: ${(downloadInfo.transferred / (1024 * 1024)).toFixed(2)} MB`);
        })
            .then(() => {
                console.log('upgrade finish');
            });
    } else {
        console.log('External-resources are the latest version');
    }
})
    .catch(err => {
        console.error('Error while checking for update: ', err);
    });
