const OpenBlockResource = require('./resource');

const TYPE = 'extensions';

// Path fields configuration for extensions
const PATH_FIELDS = {
    relative: ['iconURL', 'blocks', 'generator', 'toolbox', 'main', 'translations'],
    absolute: ['libraries'] // Used directly by the toolchain and uploader
};

/**
 * A server to provide local extensions resource.
 */
class OpenBlockExtension extends OpenBlockResource {

    constructor () {
        super(TYPE, PATH_FIELDS);
    }
}

module.exports = OpenBlockExtension;
