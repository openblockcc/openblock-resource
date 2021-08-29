const path = require('path');
const requireAll = require('require-all');
const fs = require('fs');
const {spawnSync} = require('child_process');
const rimraf = require('rimraf');

const extractPath = path.join(__dirname, '../translation');

const generateDevicesThumbnailData = () => {
    const devices = requireAll({
        dirname: path.join(__dirname, '../external-resources/devices'),
        filter: /index.js$/,
        recursive: true
    });

    const devicesThumbnailData = [];

    // eslint-disable-next-line global-require
    const deviceList = require(path.join(__dirname, '../external-resources/devices/device.js'));
    deviceList.forEach(listItem => {
        Object.entries(devices).forEach(catlog => {
            Object.entries(catlog[1]).forEach(dev => {
                const content = dev[1]['index.js'](data => `formatMessage(${JSON.stringify(data)})`);
                if (content.deviceId === listItem) {
                    devicesThumbnailData.push(content);
                }
            });
        });
    });

    return devicesThumbnailData;
};

const generateExtensionsThumbnailData = () => {
    const EXTENSION_CLASS = ['sheild', 'actuator', 'sensor', 'communication', 'display', 'kit', 'other'];
    const DEVICE_TYPE = ['arduino', 'microbit'];

    const extensionsThumbnailData = [];

    DEVICE_TYPE.forEach(deviceType => {
        EXTENSION_CLASS.forEach(extClass => {
            const extPath = path.join(__dirname, '../external-resources/extensions', deviceType, extClass);
            if (fs.existsSync(extPath)) {
                const data = requireAll({dirname: extPath, filter: /index.js$/, recursive: true});
                Object.entries(data).forEach(ext => {
                    // Modify the attribute to point to the real address.
                    const content = ext[1]['index.js'](_data => `formatMessage(${JSON.stringify(_data)})`);

                    if (content.library) {
                        content.library = path.join(extPath, ext[0], content.library);
                    }
                    extensionsThumbnailData.push(content);
                });
            }
        });
    });

    return extensionsThumbnailData;
};


if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath, {recursive: true});
}

/**
 * Step1: require all code in to one file.
 *  */
const tmpFileHead = 'const formatMessage = require(\'format-message\');\nmodule.exports = ';
const thumbnailData = JSON.stringify(generateDevicesThumbnailData().concat(generateExtensionsThumbnailData()))
    .replace(/\\"/g, '"')
    .replace(/"formatMessage/g, 'formatMessage')
    .replace(/\)"/g, ')');

fs.writeFileSync(path.join(extractPath, `tmp.js`), tmpFileHead + thumbnailData);

/**
 * Step2: Use format-message-cli extract all formatMessage.
 *  */
const result = spawnSync('format-message', [
    'extract',
    path.join(extractPath, '/*.js'),
    '-o', path.join(extractPath, 'en.json')
], {
    shell: true,
    stdio: 'inherit'
});

if (result.error) {
    throw result.error;
}
if (result.signal) {
    throw new Error(`Child process terminated due to signal ${result.signal}`);
}
if (result.status) {
    throw new Error(`Child process returned status code ${result.status}`);
}

rimraf.sync(path.join(extractPath, `tmp.js`));

/**
 * Step3: Generate standard translation file.
 *  */
const originalData = JSON.parse(fs.readFileSync(path.join(extractPath, 'en.json')));

const processedData = Object.entries(originalData)
    .map(msg => {
        const data = `'${msg[0]}': '${msg[1].message}'`;
        return data;
    })
    .join(',\n        ');

const localesFileHead = `/* eslint-disable max-len */\nmodule.exports = {\n    'en': {\n        `;
const localesFileMiddle = `\n    },\n    'zh-cn': {\n        `;
const localesFileTail = `\n    }\n};\n`;

fs.writeFileSync(path.join(extractPath, `locales.js`),
    localesFileHead +
    processedData +
    localesFileMiddle +
    processedData +
    localesFileTail
);

rimraf.sync(path.join(extractPath, 'en.json'));

console.log(`\n---------------------------`);
console.log(`\x1B[32mThe tranlation file locales.js has been` +
    ` generated in ${path.join(extractPath, `locales.js`)}\x1B[0m\n`);
