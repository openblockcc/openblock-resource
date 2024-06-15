const path = require('path');

/**
 * The path of default cache resource.
 * @readonly
 */
const DEFAULT_CACHE_RESOURCES_PATH = path.join(__dirname, '../../.openblockData/external-resources');

/**
 * The path of default build-in resource.
 * @readonly
 */
const DEFAULT_BUILTIN_RESOURCES_PATH = path.join(__dirname, '../external-resources');

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
 * The time interval for recheck the state of initial
 * @readonly
 */
const RECHECK_INTERVAL = 1000 * 1;


module.exports = {
    DEFAULT_CACHE_RESOURCES_PATH,
    DEFAULT_BUILTIN_RESOURCES_PATH,
    DEFAULT_LOCALE,
    DEFAULT_HOST,
    DEFAULT_PORT,
    SERVER_NAME,
    REOPEN_INTERVAL,
    RECHECK_INTERVAL
};
