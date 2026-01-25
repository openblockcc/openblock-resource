const path = require('path');
const fs = require('fs');
const log = require('./log');

/**
 * Base class for OpenBlock resource loaders.
 * Loads resources from package.json with openblock field.
 */
class OpenBlockResource {

    /**
     * @param {string} type - Resource type ('devices' or 'extensions')
     * @param {object} pathFields - Path fields configuration {relative: [], absolute: []}
     */
    constructor (type, pathFields) {
        this.type = type;
        this.pathFields = pathFields;
    }

    /**
     * Read and parse package.json, return openblock config if valid
     * @param {string} dirPath - Directory path
     * @returns {object|null} {packageJson, openblock} or null if invalid
     */
    _readPackageConfig (dirPath) {
        const packageJsonPath = path.join(dirPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) return null;

        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (!packageJson.openblock) return null;
            return {packageJson, openblock: packageJson.openblock};
        } catch (e) {
            return null;
        }
    }

    /**
     * Transform file paths to full resource paths
     * @param {object} content - Content object
     * @param {string} basePath - Base path for relative URLs
     * @param {string} dataPath - Data path for absolute URLs
     * @returns {object} Content object with transformed paths
     */
    _transformPaths (content, basePath, dataPath) {
        const result = {...content};
        const {relative = [], absolute = []} = this.pathFields;

        for (const field of relative) {
            if (result[field]) result[field] = path.join(basePath, result[field]);
        }
        for (const field of absolute) {
            if (result[field]) result[field] = path.join(dataPath, basePath, result[field]);
        }
        return result;
    }

    /**
     * Load a single resource from directory
     * @param {string} dirPath - Resource directory path
     * @param {string} dataPath - Data path for absolute URLs
     * @returns {object|null} Resource object with metadata and file paths, or null if invalid
     */
    loadResource (dirPath, dataPath) {
        const config = this._readPackageConfig(dirPath);
        if (!config) return null;

        try {
            const {packageJson, openblock} = config;
            const basePath = path.join(this.type, path.basename(dirPath));

            // l10n directly from package.json openblock.l10n
            // Format: { name: { en: '...', 'zh-cn': '...' }, description: {...}, ... }
            const l10n = openblock.l10n || {};

            const content = {
                // Identifiers
                extensionId: openblock.extensionId,
                deviceId: openblock.deviceId,

                // Name and description
                name: openblock.name,
                description: openblock.description,

                // l10n - all translations in one object
                l10n,

                // Metadata
                version: packageJson.version,
                author: packageJson.author,

                // Config
                supportDevice: openblock.supportDevice,
                official: openblock.official,
                featured: openblock.featured,
                disabled: openblock.disabled,
                tags: openblock.tags,
                helpLink: openblock.helpLink,

                // Files
                iconURL: openblock.iconURL,
                connectionIconURL: openblock.connectionIconURL,
                connectionSmallIconURL: openblock.connectionSmallIconURL,
                blocks: openblock.blocks,
                toolbox: openblock.toolbox,
                main: openblock.main,
                generator: openblock.generator,
                translations: openblock.translations,
                libraries: openblock.libraries
            };

            // Remove undefined fields
            for (const key of Object.keys(content)) {
                if (typeof content[key] === 'undefined') delete content[key];
            }

            return this._transformPaths(content, basePath, dataPath);
        } catch (e) {
            log.error(`Failed to load resource from ${dirPath}: ${e.message}`);
            return null;
        }
    }

    /**
     * Assemble data from all resources in the directory
     * @param {string} dataPath - Path to data directory
     * @returns {object[]} Array of resource data
     */
    assembleData (dataPath) {
        const resourcePath = path.join(dataPath, this.type);
        if (!fs.existsSync(resourcePath)) return [];

        const dirs = fs.readdirSync(resourcePath, {withFileTypes: true})
            .filter(dirent => dirent.isDirectory() || dirent.isSymbolicLink());

        const results = dirs.map(dirent => this.loadResource(
            path.join(resourcePath, dirent.name),
            dataPath
        ));

        return results.filter(Boolean);
    }
}

module.exports = OpenBlockResource;
