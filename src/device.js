const OpenBlockResource = require('./resource');

const TYPE = 'devices';

// Path fields configuration for devices
const PATH_FIELDS = {
    relative: ['iconURL', 'connectionIconURL', 'connectionSmallIconURL', 'main', 'translations'],
    absolute: ['firmware', 'toolchain']
};

/**
 * A server to provide local devices resource.
 */
class OpenBlockDevice extends OpenBlockResource {

    constructor () {
        super(TYPE, PATH_FIELDS);
    }
}

module.exports = OpenBlockDevice;
