const path = require('path');


/**
 * The name of reousce directory.
 * @readonly
 */
const DIRECTORY_NAME = 'external-resources';

/**
 * The path of default user data directory.
 * @readonly
 */
const DEFAULT_USER_DATA_PATH = path.join(__dirname, '../../.openblockData');

/**
 * The locale of default.
 * @readonly
 */
const DEFAULT_LOCALE = 'en';


module.exports = {DIRECTORY_NAME, DEFAULT_USER_DATA_PATH, DEFAULT_LOCALE};
