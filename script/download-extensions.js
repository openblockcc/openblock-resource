const releaseDownloader = require('@fohlen/github-release-downloader');
const ghdownload = require('openblock-github-dl');
const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');
const compareVersions = require('compare-versions');

const configPath = path.join(__dirname, '../extensions/config.json');

let config = {};

if (fs.existsSync(configPath)) {
    // eslint-disable-next-line global-require
    config = require(configPath);
} else {
    config.user = 'openblockcc';
    config.repo = 'extension';
    config.version = 'v0.0.1';
}

releaseDownloader.getReleaseList(`${config.user}/${config.repo}`)
    .then(release => {
        const latestVersion = release[0].tag_name;
        const curentVersion = config.version;

        if (compareVersions.compare(latestVersion, curentVersion, '>')) {
            console.log(`new extension version detected: ${latestVersion}`);

            rimraf.sync(path.join(__dirname, '../extensions'));

            ghdownload({user: config.user, repo: config.repo, ref: latestVersion},
                path.join(__dirname, '../extensions'))
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
        }
    })
    .catch(err => {
        console.log(err);
    });
