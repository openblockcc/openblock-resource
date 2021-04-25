const releaseDownloader = require('@fohlen/github-release-downloader');
const ghdownload = require('openblock-github-dl');
const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, '../external-resources/config.json');

const config = {};
config.user = 'openblockcc';
config.repo = 'resource';

releaseDownloader.getReleaseList(`${config.user}/${config.repo}`)
    .then(release => {
        const latestVersion = release[0].tag_name;

        rimraf(path.join(__dirname, '../external-resources'), () => {

            ghdownload({user: config.user, repo: config.repo, ref: latestVersion},
                path.join(__dirname, '../external-resources'))
                .on('error', err => {
                    console.error(`error while downloading ${config.user}/${config.repo} ${latestVersion}:`, err);
                })
                .on('zip', zipUrl => {
                    console.log(`${zipUrl} downloading...`);
                })
                .on('end', () => {
                    console.log('finish');

                    const resourceConfig = require(configPath); // eslint-disable-line global-require
                    resourceConfig.version = latestVersion;
                    fs.writeFileSync(configPath, JSON.stringify(resourceConfig));
                });
        });
    })
    .catch(err => {
        console.log(err);
    });
