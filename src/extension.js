const requireAll = require('require-all');
const path = require('path');
const fs = require('fs');

const TYPE = 'extensions';

/**
 * A server to provide local extensions resource.
 */
class OpenBlockExtension {

    constructor () {
        this.type = TYPE;
    }

    assembleData (userDataPath, edition, formatMessage) {
        const extensionsThumbnailData = [];

        const extPath = path.join(userDataPath, this.type);
        if (fs.existsSync(extPath)) {
            const data = requireAll({dirname: extPath, filter: /index.js$/, recursive: true});
            Object.entries(data).forEach(ext => {
                // Modify the attribute to point to the real address.
                const content = ext[1]['index.js'](formatMessage);
                const basePath = path.join(this.type, ext[0]);

                // Convert a local file path to a network address
                if (content.iconURL) {
                    content.iconURL = path.join(basePath, content.iconURL);
                }
                if (content.blocks) {
                    content.blocks = path.join(basePath, content.blocks);
                }
                if (content.generator) {
                    content.generator = path.join(basePath, content.generator);
                }
                if (content.toolbox) {
                    content.toolbox = path.join(basePath, content.toolbox);
                }
                if (content.msg) {
                    content.msg = path.join(basePath, content.msg);
                }
                if (content.library) {
                    content.library = path.join(userDataPath, basePath, content.library);
                }
                if (content.main) {
                    content.main = path.join(basePath, content.main);
                }
                if (content.translations) {
                    content.translations = path.join(basePath, content.translations);
                }

                // filter data based on the edition accessed
                if (edition === 'cmtye') {
                    // if the extension only has main.js but no blocks.js,
                    // the plugin should be blocked
                    if (!!content.main && !content.blocks) {
                        return;
                    }
                }

                extensionsThumbnailData.push(content);
            });
        }

        return extensionsThumbnailData;
    }
}

module.exports = OpenBlockExtension;
