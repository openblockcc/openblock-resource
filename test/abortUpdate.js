const OpenblockResourceServer = require('../index');
const clc = require('cli-color');
const {AbortController} = require('node-abort-controller');
const {UPGRADE_STATE} = require('../src/state');

const resourceServer = new OpenblockResourceServer();
const controller = new AbortController();

const ABORT_STEP = UPGRADE_STATE.verifying;

const report = res => {
    console.log(res);
    if (res.phase === ABORT_STEP) {
        console.log(clc.green('Abort update!'));
        controller.abort();
    }
};

// Test the update abort funciton.
resourceServer.checkUpdate({signal: controller.signal})
    .then(info => {
        console.log('check update info:', info);
        if (info.updateble) {
            resourceServer.update({signal: controller.signal, callback: report})
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
