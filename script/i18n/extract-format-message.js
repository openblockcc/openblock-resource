#!/usr/bin/env node

/**
 * @fileoverview
 * Extract i18n content from plugin.
 *
 * Extraction sources:
 * 1. package.json - openblock.l10n fields
 * 2. main - formatMessage() calls
 * 3. msg- Block message definitions
 *
 * Output files:
 * - translations/interface/en.json
 * - translations/extensions/en.json
 * - translations/blocks/en.json
 *
 * Usage:
 *   node extract-translations.js [--dir=path/to/resources]
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * Parse command line arguments
 * @returns {object} Parsed arguments
 */
const parseArgs = () => {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            args[key] = value || true;
        }
    });
    return args;
};

const {dir} = parseArgs();
const workDir = dir || './';

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse formatMessage({id, default}) calls from JS content
 * @param {string} content - JavaScript source code content
 * @returns {Array<{id: string, default: string}>} Array of extracted messages
 */
const extractFormatMessages = content => {
    const messages = [];
    const regex = /formatMessage\s*\(\s*\{([^}]+)\}\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        try {
            // Extract the object content and parse it
            const objContent = `{${match[1]}}`;
            // Convert single quotes to double quotes and handle keys
            const normalized = objContent
                .replace(/'/g, '"')
                .replace(/(\w+):/g, '"$1":');
            const parsed = JSON.parse(normalized);

            if (parsed.id && parsed.default) {
                messages.push({
                    id: parsed.id,
                    default: parsed.default
                });
            }
        } catch (e) {
            console.warn(`Failed to parse formatMessage: ${match[0]}`);
        }
    }
    return messages;
};


// ============================================================================
// Resource Scanners
// ============================================================================

/**
 * Scan a single plugin directory
 * @param {string} pluginDir - Path to the plugin directory
 * @returns {{interface: Array, extensions: Array, blocks: object}} Extracted translation data
 */
const scanPlugin = pluginDir => {
    const result = {
        interface: [],
        extensions: [],
        blocks: {}
    };

    // 1. Extract from package.json
    const packageJsonPath = path.join(pluginDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = fs.readJsonSync(packageJsonPath);
            const openblock = pkg.openblock;

            if (openblock) {
                const resourceId = openblock.extensionId || openblock.deviceId;

                // Interface translations - extract from name and description
                if (pkg.name) {
                    result.interface.push({
                        id: `${resourceId}.name`,
                        default: pkg.name
                    });
                }
                if (pkg.description) {
                    result.interface.push({
                        id: `${resourceId}.description`,
                        default: pkg.description
                    });
                }
            }
        } catch (e) {
            console.error(`Failed to parse ${packageJsonPath}:`, e.message);
        }
    }

    // 2. Extract from main and msg (using paths from package.json)
    if (packageJsonPath && fs.existsSync(packageJsonPath)) {
        try {
            const pkg = fs.readJsonSync(packageJsonPath);
            const files = pkg.openblock?.files || {};

            // Extract from main
            if (files.main) {
                const mainJsPath = files.main.replace(/^dist\//, 'src/');
                const fullMainPath = path.join(pluginDir, mainJsPath);
                if (fs.existsSync(fullMainPath)) {
                    const content = fs.readFileSync(fullMainPath, 'utf8');
                    result.extensions.push(...extractFormatMessages(content));
                }
            }

            // Extract from msg
            if (files.msg) {
                const msgJsonPath = path.join(pluginDir, files.msg);
                if (fs.existsSync(msgJsonPath)) {
                    try {
                        const msgJson = fs.readJsonSync(msgJsonPath);
                        Object.assign(result.blocks, msgJson);
                    } catch (e) {
                        console.error(`Failed to parse ${msgJsonPath}:`, e.message);
                    }
                }
            }
        } catch (e) {
            // Already logged in step 1
        }
    }

    return result;
};

/**
 * Scan all plugins in extensions/ and devices/ directories
 * @returns {{interface: object, extensions: object, blocks: object}} All extracted translations
 */
const scanAllPlugins = () => {
    const allResults = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const resourceTypes = ['extensions', 'devices'];

    for (const type of resourceTypes) {
        const typeDir = path.join(workDir, type);
        if (!fs.existsSync(typeDir)) {
            console.log(`Skipping ${type}/ (not found)`);
            continue;
        }

        const plugins = fs.readdirSync(typeDir, {withFileTypes: true})
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        console.log(`Scanning ${plugins.length} resouces in ${type}/`);

        for (const pluginName of plugins) {
            const pluginDir = path.join(typeDir, pluginName);
            const result = scanPlugin(pluginDir);

            // Merge interface messages
            result.interface.forEach(msg => {
                allResults.interface[msg.id] = {
                    message: msg.default,
                    description: msg.default
                };
            });

            // Merge extension messages
            result.extensions.forEach(msg => {
                allResults.extensions[msg.id] = {
                    message: msg.default,
                    description: msg.default
                };
            });

            // Merge block messages
            Object.assign(allResults.blocks, result.blocks);
        }
    }

    return allResults;
};

// ============================================================================
// Main
// ============================================================================

/**
 * Main function to extract translations and write to files
 */
const main = () => {
    console.log(`Extracting translations from: ${path.resolve(workDir)}\n`);

    const results = scanAllPlugins();

    // Write interface translations
    const interfacePath = path.join(workDir, 'translations/interface/en.json');
    fs.ensureDirSync(path.dirname(interfacePath));
    fs.writeJsonSync(interfacePath, results.interface, {spaces: 4});
    console.log(`\n✓ Interface translations: ${interfacePath}`);
    console.log(`  ${Object.keys(results.interface).length} messages`);

    // Write extension translations
    const extensionsPath = path.join(workDir, 'translations/extensions/en.json');
    fs.ensureDirSync(path.dirname(extensionsPath));
    fs.writeJsonSync(extensionsPath, results.extensions, {spaces: 4});
    console.log(`\n✓ Extension translations: ${extensionsPath}`);
    console.log(`  ${Object.keys(results.extensions).length} messages`);

    // Write block translations
    const blocksPath = path.join(workDir, 'translations/blocks/en.json');
    fs.ensureDirSync(path.dirname(blocksPath));
    fs.writeJsonSync(blocksPath, results.blocks, {spaces: 4});
    console.log(`\n✓ Block translations: ${blocksPath}`);
    console.log(`  ${Object.keys(results.blocks).length} messages`);

    console.log('\n✓ Extraction complete!');
};

main();
