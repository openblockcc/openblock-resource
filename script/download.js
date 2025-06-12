const downloadRelease = require('download-github-release');
const path = require('path');
const fs = require('fs');

let user = 'openblockcc';
let repo = 'external-resources-v3';

process.argv.forEach(arg => {
    if (arg.startsWith('--repo=')) {
        const value = arg.split('=')[1];
        if (value && value.includes('/')) {
            [user, repo] = value.split('/');
        }
    }
});

const outputdir = path.resolve('./external-resources');
const leaveZipped = false;

const filterRelease = release => release.prerelease === false;

const filterAsset = asset => asset.name.indexOf('external-resources') >= 0;

if (!fs.existsSync(outputdir)) {
    fs.mkdirSync(outputdir, {recursive: true});
}

downloadRelease(user, repo, outputdir, filterRelease, filterAsset, leaveZipped)
    .then(() => {
        console.log('External resources download complete');
    })
    .catch(err => {
        console.error(err.message);
    });
