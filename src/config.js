const path = require('path');

/**
 * Configuration the name of upgrade lock file.
 * @readonly
 */
const UPGRADE_LOCK_FILE = 'resource-upgrade.lock';

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

/**
 * Configuration the default host.
 * @readonly
 */
const DEFAULT_HOST = '0.0.0.0';

/**
 * Configuration the default port.
 * @readonly
 */
const DEFAULT_PORT = 20112;

/**
 * Server name, ues in root path.
 * @readonly
 */
const SERVER_NAME = 'openblock-resource-server';

/**
 * The time interval for retrying to open the port after the port is occupied by another openblock-resource server.
 * @readonly
 */
const REOPEN_INTERVAL = 1000 * 1;

/**
 * Translate file name.
 * @readonly
 */
const OFFICIAL_TRANSLATIONS_FILE = 'official-locales.json';
const THIRD_PARTY_TRANSLATIONS_FILE = 'third-party-locales.json';

/**
 * Configuration the name of initial resources lock file.
 * @readonly
 */
const INIT_RESOURCE_LOCK_FILE = 'initial-resources.lock';

/**
 * The time interval for recheck the state of initial
 * @readonly
 */
const RECHECK_INTERVAL = 1000 * 1;


module.exports = {
    UPGRADE_LOCK_FILE,
    DIRECTORY_NAME,
    DEFAULT_USER_DATA_PATH,
    DEFAULT_LOCALE,
    DEFAULT_HOST,
    DEFAULT_PORT,
    SERVER_NAME,
    REOPEN_INTERVAL,
    OFFICIAL_TRANSLATIONS_FILE,
    THIRD_PARTY_TRANSLATIONS_FILE,
    INIT_RESOURCE_LOCK_FILE,
    RECHECK_INTERVAL
};
