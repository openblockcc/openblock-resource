const path = require('path');
const requireAll = require('require-all');
const formatMessage = require('format-message');
const fs = require('fs');
const copydir = require('copy-dir');

const buildPath = path.join(__dirname, '../dist/devices');
const translations = require(path.join(__dirname, '../external-resources/devices/locales.js'));

const parseArgs = () => {
    const scriptArgs = process.argv.slice(2); // remove `node` and `this-script.js`
    const builderArgs = [];
    let url = '0.0.0.0';

    for (const arg of scriptArgs) {
        const urlSplit = arg.split(/--url(\s+|=)/);
        if (urlSplit.length === 3) {
            url = urlSplit[2];
        } else {
            builderArgs.push(arg);
        }
    }

    return url;
};

const url = parseArgs();

Object.entries(translations).forEach(locale => {
    locale = locale[0];

    formatMessage.setup({
        locale: locale,
        translations: translations
    });

    const devices = requireAll({
        dirname: path.join(__dirname, '../external-resources/devices'),
        filter: /index.js$/,
        recursive: true
    });

    const devicesThumbnailData = [];

    // eslint-disable-next-line global-require
    const deviceList = require(path.join(__dirname, '../external-resources/devices/device.js'));
    deviceList.forEach(listItem => {
        let matched = false;
        Object.entries(devices).forEach(catlog => {
            Object.entries(catlog[1]).forEach(dev => {
                const content = dev[1]['index.js'](formatMessage);
                if (content.deviceId === listItem) {
                    const basePath = path.join(url, catlog[0], dev[0]);

                    if (content.iconURL) {
                        content.iconURL = path.join(basePath, content.iconURL);
                    }
                    if (content.connectionIconURL) {
                        content.connectionIconURL = path.join(basePath, content.connectionIconURL);
                    }
                    if (content.connectionSmallIconURL) {
                        content.connectionSmallIconURL = path.join(basePath, content.connectionSmallIconURL);
                    }
                    matched = true;
                    devicesThumbnailData.push(content);
                }
            });
        });
        if (!matched) {
            devicesThumbnailData.push({deviceId: listItem});
        }
    });


    if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, {recursive: true});
    }

    copydir.sync(path.join(__dirname, '../external-resources/devices'), buildPath, {
        utimes: true,
        mode: true,
        filter: (stat, filepath) => {
            // do not want copy .js files
            if (stat === 'file' && path.extname(filepath) === '.js') {
                return false;
            }
            return true;
        }
    });

    fs.writeFileSync(path.join(buildPath, `index.${locale}.json`), JSON.stringify(devicesThumbnailData));

});
