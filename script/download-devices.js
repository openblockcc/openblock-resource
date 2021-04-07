const releaseDownloader = require('@fohlen/github-release-downloader');
const ghdownload = require('github-download');
const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');
const compareVersions = require('compare-versions');

const configPath = path.join(__dirname, '../devices/config.json');

let config = {};

if (fs.existsSync(configPath)) {
    // eslint-disable-next-line global-require
    config = require(configPath);
} else {
    config.user = 'openblockcc';
    config.repo = 'device';
    config.version = 'v0.0.1';
}

releaseDownloader.getReleaseList(`${config.user}/${config.repo}`)
    .then(release => {
        const latestVersion = release[0].tag_name;
        const curentVersion = config.version;

        if (compareVersions.compare(latestVersion, curentVersion, '>')) {
            console.log(`new deivce version detected: ${latestVersion}`);

            rimraf(path.join(__dirname, '../devices'), () => {

                ghdownload({user: config.user, repo: config.repo, ref: latestVersion},
                    path.join(__dirname, '../devices'))
                    .on('error', err => {
                        console.error(`error while downloading ${config.user}/${config.repo} ${latestVersion}:`, err);
                    })
                    .on('zip', zipUrl => {
                        console.log(`${zipUrl} downloading...`);
                    })
                    .on('end', () => {
                        console.log('finish');

                        config.version = latestVersion;
                        fs.writeFileSync(configPath, JSON.stringify(config));
                    });
            });
        }
    })
    .catch(err => {
        console.log(err);
    });
