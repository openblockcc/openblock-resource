const path = require('path');
const requireAll = require('require-all');
const formatMessage = require('format-message');
const fs = require('fs');
const copydir = require('copy-dir');

const buildPath = path.join(__dirname, '../dist/extensions');
const translations = require(path.join(__dirname, '../external-resources/locales.js'));

const EXTENSION_CLASS = ['sheild', 'actuator', 'sensor', 'communication', 'display', 'kit', 'other'];
const DEVICE_TYPE = ['arduino', 'microbit', 'microPython'];

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
    const extensionsThumbnailData = [];

    DEVICE_TYPE.forEach(deviceType => {
        EXTENSION_CLASS.forEach(extClass => {
            const extPath = path.join(__dirname, '../external-resources/extensions', deviceType, extClass);
            if (fs.existsSync(extPath)) {
                const data = requireAll({dirname: extPath, filter: /index.js$/, recursive: true});
                Object.entries(data).forEach(ext => {
                    // Modify the attribute to point to the real address.
                    const content = ext[1]['index.js'](formatMessage);
                    const basePath = path.join(url, deviceType, extClass, ext[0]);

                    if (content.iconURL) {
                        content.iconURL = path.join(basePath, content.iconURL);
                    }
                    content.blocks = path.join(basePath, content.blocks);
                    content.generator = path.join(basePath, content.generator);
                    content.toolbox = path.join(basePath, content.toolbox);
                    content.msg = path.join(basePath, content.msg);

                    if (content.library) {
                        content.library = path.join(extPath, ext[0], content.library);
                    }
                    extensionsThumbnailData.push(content);
                });
            }
        });
    });

    if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, {recursive: true});
    }

    copydir.sync(path.join(__dirname, '../external-resources/extensions'), buildPath, {
        utimes: true,
        mode: true,
        filter: (stat, filepath, filename) => {
            // do not want copy .js files
            if (stat === 'file' && (filename === 'index.js' || filename === 'locales.js')) {
                return false;
            }
            if (stat === 'directory' && filename === 'lib') {
                return false;
            }
            return true;
        }
    });
    fs.writeFileSync(path.join(buildPath, `${locale}.json`), JSON.stringify(extensionsThumbnailData));

});
