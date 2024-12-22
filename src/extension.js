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

    assembleData (dataPath, formatMessage) {
        const extensionsThumbnailData = [];

        const extPath = path.join(dataPath, this.type);
        if (fs.existsSync(extPath)) {
            const data = requireAll({dirname: extPath, filter: /index.js$/, recursive: true});
            Object.entries(data).forEach(ext => {
                const translationsFile = path.join(extPath, ext[0], 'translations.js');
                let translations;
                if (fs.existsSync(translationsFile)){
                    // eslint-disable-next-line global-require
                    const locales = require(translationsFile);
                    translations = locales.getInterfaceTranslations();
                    formatMessage.setup({
                        translations: translations
                    });
                }

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
                if (content.library) {
                    // Used directly by the toolchain and uploader, requires an absolute address
                    content.library = path.join(dataPath, basePath, content.library);
                }
                if (content.main) {
                    content.main = path.join(basePath, content.main);
                }
                if (content.translations) {
                    content.translations = path.join(basePath, content.translations);
                }

                extensionsThumbnailData.push(content);
            });
        }

        return extensionsThumbnailData;
    }
}

module.exports = OpenBlockExtension;
