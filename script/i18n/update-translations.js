#!/usr/bin/env node

/**
 * @fileoverview
 * Pull translations from Transifex and generate translation files for plugins.
 *
 * Workflow:
 * 1. Pull translations from Transifex (interface, extensions, blocks)
 * 2. Scan plugin directories (extensions/ and devices/)
 * 3. Match translation keys to each plugin
 * 4. Generate src/translation.js for each plugin (ESM format)
 *
 * Environment:
 *   TX_TOKEN - Transifex API token (required)
 *
 * Usage:
 *   node update-translations-new.js [--dir=path/to/resources]
 */

const fs = require('fs-extra');
const path = require('path');
const locales = require('openblock-l10n').default;
const {txPull} = require('openblock-l10n/lib/transifex.js');

// Check if running in local mode (without Transifex) or pulling from Transifex
const isLocalMode = !process.env.TX_TOKEN;

if (isLocalMode) {
    console.log('Running in LOCAL mode (using local en.json files)\n');
    console.log('Note: Set TX_TOKEN environment variable to pull from Transifex\n');
} else {
    console.log('Running in TRANSIFEX mode (pulling from Transifex)\n');
}

// ============================================================================
// Configuration
// ============================================================================

const PROJECT = 'openblock-resources';
const RESOURCES = {
    INTERFACE: 'interface',
    EXTENSIONS: 'extensions',
    BLOCKS: 'blocks'
};
const MODE = 'reviewed';

const LOCALE_MAP = {
    'aa-dj': 'aa_DJ',
    'es-419': 'es_419',
    'pt-br': 'pt_BR',
    'zh-cn': 'zh_CN',
    'zh-tw': 'zh_TW'
};

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
            const objContent = `{${match[1]}}`;
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
            // Ignore parse errors
        }
    }
    return messages;
};

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

/**
 * Pull translations for a specific resource from Transifex
 * @param {string} resource - Resource name (interface/extensions/blocks)
 * @param {string} locale - Locale code
 * @returns {Promise<object>} Translation data
 */
const pullTranslation = async (resource, locale) => {
    const txLocale = LOCALE_MAP[locale] || locale;
    try {
        const data = await txPull(PROJECT, resource, txLocale, MODE);
        return data;
    } catch (error) {
        console.warn(`Warning: Failed to pull ${resource}/${locale}: ${error.message}`);
        return {};
    }
};

/**
 * Load local translations from en.json files
 * @param {string} workDir - Working directory
 * @returns {object} All translation data organized by resource and locale
 */
const loadLocalTranslations = workDir => {
    console.log('Loading local translations from en.json files...\n');

    const allTranslations = {
        [RESOURCES.INTERFACE]: {},
        [RESOURCES.EXTENSIONS]: {},
        [RESOURCES.BLOCKS]: {}
    };

    const localeList = Object.keys(locales);

    // Load en.json files
    const enFiles = {
        [RESOURCES.INTERFACE]: path.join(workDir, 'translations/interface/en.json'),
        [RESOURCES.EXTENSIONS]: path.join(workDir, 'translations/extensions/en.json'),
        [RESOURCES.BLOCKS]: path.join(workDir, 'translations/blocks/en.json')
    };

    for (const [resource, filePath] of Object.entries(enFiles)) {
        if (fs.existsSync(filePath)) {
            try {
                const enData = fs.readJsonSync(filePath);

                // For each locale, use English as fallback
                for (const locale of localeList) {
                    allTranslations[resource][locale] = {};

                    // Copy English data to all locales
                    Object.keys(enData).forEach(key => {
                        if (locale === 'en') {
                            // For English, use the message directly
                            allTranslations[resource][locale][key] = enData[key].message || enData[key];
                        } else {
                            // For other locales, use English as placeholder
                            allTranslations[resource][locale][key] = enData[key].message || enData[key];
                        }
                    });
                }

                console.log(`✓ Loaded ${resource} (${Object.keys(enData).length} keys)`);
            } catch (e) {
                console.warn(`⚠ Failed to load ${filePath}: ${e.message}`);
            }
        } else {
            console.warn(`⚠ File not found: ${filePath}`);
        }
    }

    console.log();
    return allTranslations;
};

/**
 * Pull all translations from Transifex
 * @returns {Promise<object>} All translation data organized by resource and locale
 */
const pullAllTranslations = async () => {
    console.log('Pulling translations from Transifex...\n');

    const allTranslations = {
        [RESOURCES.INTERFACE]: {},
        [RESOURCES.EXTENSIONS]: {},
        [RESOURCES.BLOCKS]: {}
    };

    const localeList = Object.keys(locales);

    for (const resource of Object.values(RESOURCES)) {
        console.log(`Pulling ${resource}...`);

        for (const locale of localeList) {
            const data = await pullTranslation(resource, locale);
            if (!allTranslations[resource][locale]) {
                allTranslations[resource][locale] = {};
            }
            Object.assign(allTranslations[resource][locale], data);
        }

        console.log(`✓ ${resource} complete (${localeList.length} locales)\n`);
    }

    return allTranslations;
};

/**
 * Read package.json from plugin directory
 * @param {string} pluginDir - Plugin directory path
 * @returns {object|null} Package.json content or null
 */
const readPackageJson = pluginDir => {
    const packagePath = path.join(pluginDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
        return null;
    }
    try {
        return fs.readJsonSync(packagePath);
    } catch (e) {
        console.warn(`Warning: Failed to parse ${packagePath}`);
        return null;
    }
};

/**
 * Extract translation keys from plugin
 * @param {string} pluginDir - Plugin directory path
 * @returns {object} Translation keys organized by type
 */
const extractPluginKeys = pluginDir => {
    const keys = {
        interface: [],
        extensions: [],
        blocks: []
    };

    const pkg = readPackageJson(pluginDir);
    if (!pkg || !pkg.openblock) {
        return keys;
    }

    const openblock = pkg.openblock;
    const resourceId = openblock.extensionId || openblock.deviceId;

    const files = openblock.files || {};

    // 1. Extract interface keys from name and description
    if (pkg.name) {
        keys.interface.push(`${resourceId}.name`);
    }
    if (pkg.description) {
        keys.interface.push(`${resourceId}.description`);
    }

    // 2. Extract extension keys from source files (main.js)
    if (files.main) {
        const mainJsPath = files.main.replace(/^dist\//, 'src/');
        const fullMainPath = path.join(pluginDir, mainJsPath);
        if (fs.existsSync(fullMainPath)) {
            try {
                const content = fs.readFileSync(fullMainPath, 'utf8');
                const messages = extractFormatMessages(content);
                messages.forEach(msg => {
                    keys.extensions.push(msg.id);
                });
            } catch (e) {
                // Ignore
            }
        }
    }

    // 3. Extract block keys from msg.json
    if (files.msg) {
        const msgPath = path.join(pluginDir, files.msg);
        if (fs.existsSync(msgPath)) {
            try {
                const msgJson = fs.readJsonSync(msgPath);
                keys.blocks = Object.keys(msgJson);
            } catch (e) {
                console.warn(`Warning: Failed to parse ${msgPath}`);
            }
        }
    }

    return keys;
};

/**
 * Parse existing translation file to extract current translations
 * @param {string} filePath - Path to existing translations.js file
 * @returns {object|null} Existing translations organized by type and locale, or null if file doesn't exist
 */
const parseExistingTranslations = filePath => {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const result = {
            interface: {},
            extensions: {},
            blocks: {}
        };

        // Extract getInterfaceTranslations
        const interfaceMatch = content.match(
            /export const getInterfaceTranslations = \(\) => \(([\s\S]*?)\);/
        );
        if (interfaceMatch) {
            // Convert single quotes to double quotes and parse
            const jsonStr = interfaceMatch[1].replace(/'/g, '"');
            result.interface = JSON.parse(jsonStr);
        }

        // Extract registerExtensionTranslations
        const extensionMatch = content.match(
            /export const registerExtensionTranslations = \(\) => \(([\s\S]*?)\);/
        );
        if (extensionMatch) {
            const jsonStr = extensionMatch[1].replace(/'/g, '"');
            result.extensions = JSON.parse(jsonStr);
        }

        // Extract registerBlocksMessages
        const blocksMatch = content.match(
            /const messages = ([\s\S]*?);[\s\S]*?Object\.keys\(messages\)/
        );
        if (blocksMatch) {
            // For blocks, we need to handle unquoted keys
            let jsonStr = blocksMatch[1];
            // Add quotes to unquoted keys (like BKY_XXX)
            jsonStr = jsonStr.replace(/([A-Z_][A-Z0-9_]*)\s*:/g, '"$1":');
            // Convert single quotes to double quotes
            jsonStr = jsonStr.replace(/'/g, '"');
            result.blocks = JSON.parse(jsonStr);
        }

        return result;
    } catch (e) {
        console.warn(`Warning: Failed to parse existing file ${filePath}: ${e.message}`);
        return null;
    }
};

/**
 * Merge new translations with existing ones (incremental update)
 * @param {object} newTranslations - New translations from Transifex or local
 * @param {object} existingTranslations - Existing translations from file
 * @param {object} keys - Translation keys for this plugin
 * @returns {object} Merged translations
 */
const mergeTranslations = (newTranslations, existingTranslations, keys) => {
    const result = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const localeList = Object.keys(locales);
    const types = ['interface', 'extensions', 'blocks'];

    for (const type of types) {
        const currentKeys = keys[type];

        for (const locale of localeList) {
            result[type][locale] = {};

            for (const key of currentKeys) {
                const newEnValue = newTranslations[type].en?.[key];
                const existingEnValue = existingTranslations?.[type]?.en?.[key];
                const existingValue = existingTranslations?.[type]?.[locale]?.[key];

                if (locale === 'en') {
                    // For English, always use new value
                    if (newEnValue) {
                        result[type][locale][key] = newEnValue;
                    }
                } else if (existingValue && existingEnValue === newEnValue) {
                    // English value unchanged - keep existing translation
                    result[type][locale][key] = existingValue;
                } else {
                    // Key doesn't exist or English value changed - use new en value as placeholder
                    result[type][locale][key] = newEnValue || '';
                }
            }
        }
    }

    return result;
};

/**
 * Extract English values directly from plugin source files
 * @param {string} pluginDir - Plugin directory path
 * @param {object} keys - Translation keys
 * @returns {object} English values for all keys
 */
const extractEnglishValues = (pluginDir, keys) => {
    const result = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const pkg = readPackageJson(pluginDir);
    if (!pkg || !pkg.openblock) {
        return result;
    }

    const openblock = pkg.openblock;
    const resourceId = openblock.extensionId || openblock.deviceId;
    const files = openblock.files || {};

    // Extract interface values from name and description
    if (pkg.name && keys.interface.includes(`${resourceId}.name`)) {
        result.interface[`${resourceId}.name`] = pkg.name;
    }
    if (pkg.description && keys.interface.includes(`${resourceId}.description`)) {
        result.interface[`${resourceId}.description`] = pkg.description;
    }

    // Extract extension values from source files (main.js)
    if (files.main) {
        const mainJsPath = files.main.replace(/^dist\//, 'src/');
        const fullMainPath = path.join(pluginDir, mainJsPath);
        if (fs.existsSync(fullMainPath)) {
            try {
                const content = fs.readFileSync(fullMainPath, 'utf8');
                const messages = extractFormatMessages(content);
                messages.forEach(msg => {
                    if (keys.extensions.includes(msg.id)) {
                        result.extensions[msg.id] = msg.default;
                    }
                });
            } catch (e) {
                // Ignore
            }
        }
    }

    // Extract block values from msg.json
    if (files.msg) {
        const msgPath = path.join(pluginDir, files.msg);
        if (fs.existsSync(msgPath)) {
            try {
                const msgJson = fs.readJsonSync(msgPath);
                Object.keys(msgJson).forEach(key => {
                    if (keys.blocks.includes(key)) {
                        result.blocks[key] = msgJson[key];
                    }
                });
            } catch (e) {
                // Ignore
            }
        }
    }

    return result;
};

/**
 * Build translation objects for a plugin (separated by type)
 * @param {string} pluginDir - Plugin directory path
 * @param {object} keys - Translation keys
 * @param {object} allTranslations - All translations from Transifex (not used in local mode)
 * @returns {object} Translation objects organized by type and locale
 */
const buildPluginTranslations = (pluginDir, keys, allTranslations) => {
    const result = {
        interface: {},
        extensions: {},
        blocks: {}
    };

    const localeList = Object.keys(locales);

    if (isLocalMode) {
        // In local mode, extract English values directly from source files
        const englishValues = extractEnglishValues(pluginDir, keys);

        for (const locale of localeList) {
            // Build interface translations
            result.interface[locale] = {};
            keys.interface.forEach(key => {
                const enValue = englishValues.interface[key];
                if (enValue) {
                    result.interface[locale][key] = enValue;
                }
            });

            // Build extension translations
            result.extensions[locale] = {};
            keys.extensions.forEach(key => {
                const enValue = englishValues.extensions[key];
                if (enValue) {
                    result.extensions[locale][key] = enValue;
                }
            });

            // Build block translations
            result.blocks[locale] = {};
            keys.blocks.forEach(key => {
                const enValue = englishValues.blocks[key];
                if (enValue) {
                    result.blocks[locale][key] = enValue;
                }
            });
        }
    } else {
        // In Transifex mode, use allTranslations
        for (const locale of localeList) {
            // Build interface translations
            result.interface[locale] = {};
            keys.interface.forEach(key => {
                const value = allTranslations[RESOURCES.INTERFACE][locale]?.[key];
                if (value) {
                    result.interface[locale][key] = value;
                }
            });

            // Build extension translations
            result.extensions[locale] = {};
            keys.extensions.forEach(key => {
                const value = allTranslations[RESOURCES.EXTENSIONS][locale]?.[key];
                if (value) {
                    result.extensions[locale][key] = value;
                }
            });

            // Build block translations
            result.blocks[locale] = {};
            keys.blocks.forEach(key => {
                const value = allTranslations[RESOURCES.BLOCKS][locale]?.[key];
                if (value) {
                    result.blocks[locale][key] = value;
                }
            });
        }
    }

    return result;
};

/**
 * Update package.json l10n field with interface translations
 * @param {string} pluginDir - Plugin directory path
 * @param {object} interfaceTranslations - Interface translations by locale
 * @param {object} keys - Translation keys
 */
const updatePackageJsonL10n = (pluginDir, interfaceTranslations, keys) => {
    const packagePath = path.join(pluginDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
        return;
    }

    const pkg = fs.readJsonSync(packagePath);
    if (!pkg.openblock) {
        return;
    }

    const resourceId = pkg.openblock.extensionId || pkg.openblock.deviceId;
    const localeList = Object.keys(locales);

    // Read existing l10n
    const existingL10n = pkg.openblock.l10n || {};

    // Build new l10n structure
    const newL10n = {};

    // Process name and description
    ['name', 'description'].forEach(field => {
        const key = `${resourceId}.${field}`;
        if (!keys.interface.includes(key)) {
            return;
        }

        newL10n[field] = {};

        // Get English value from top-level field
        const newEnValue = pkg[field];
        const existingEnValue = existingL10n[field]?.en;

        for (const locale of localeList) {
            if (locale === 'en') {
                // For English, always use value from top-level field
                newL10n[field][locale] = newEnValue;
            } else {
                const existingValue = existingL10n[field]?.[locale];

                if (existingValue && existingEnValue === newEnValue) {
                    // English value unchanged - keep existing translation
                    newL10n[field][locale] = existingValue;
                } else {
                    // English value changed or no existing translation
                    // Use translation from Transifex/local, or fallback to English
                    const translatedValue = interfaceTranslations[locale]?.[key];
                    newL10n[field][locale] = translatedValue || newEnValue;
                }
            }
        }
    });

    // Update package.json
    pkg.openblock.l10n = newL10n;

    // Write back to file with proper formatting
    fs.writeJsonSync(packagePath, pkg, {spaces: 2});
};

/**
 * Generate ESM translation file content
 * @param {object} translations - Translation objects separated by type
 * @returns {string} File content
 */
const generateTranslationFile = translations => {
    let header;
    if (isLocalMode) {
        header = `/* eslint-disable quote-props */
/**
 * Translation file for this resouce.
 *
 * IMPORTANT:
 * - The "en" (English) section is automatically generated from source files.
 *   Do NOT modify the "en" section manually.
 * - Other language sections (e.g., "zh-cn", "zh-tw", "ja", etc.) should be
 *   manually translated by you.
 * - When you run the extraction script again, only the "en" section will be
 *   updated. Your manual translations in other languages will be preserved.
 */
`;
    } else {
        header = `/* eslint-disable quote-props */
/**
 * Translation file - automatically generated from Transifex.
 * Do NOT modify this file manually.
 * All translations are managed on Transifex platform.
 */
`;
    }

    // Merge only extensions and blocks translations
    const mergedTranslations = {};
    const localeList = Object.keys(locales);

    for (const locale of localeList) {
        mergedTranslations[locale] = {
            ...translations.extensions[locale],
            ...translations.blocks[locale]
        };
    }

    // Format merged translations (all keys and values with single quotes)
    const formattedTranslations = JSON.stringify(mergedTranslations, null, 4).replace(/"/g, "'");

    // Build the default export
    const content = `${header}
export default ${formattedTranslations};
`;

    return content;
};

/**
 * Process a single plugin
 * @param {string} pluginDir - Plugin directory path
 * @param {object} allTranslations - All translations from Transifex
 * @returns {boolean} Success status
 */
const processPlugin = (pluginDir, allTranslations) => {
    const pkg = readPackageJson(pluginDir);
    if (!pkg || !pkg.openblock) {
        return false;
    }

    const resourceId = pkg.openblock.extensionId || pkg.openblock.deviceId;
    console.log(`Processing ${resourceId}...`);

    // Extract keys
    const keys = extractPluginKeys(pluginDir);
    const totalKeys = keys.interface.length + keys.extensions.length + keys.blocks.length;

    if (totalKeys === 0) {
        console.log(`  ⚠ No translation keys found, skipping\n`);
        return false;
    }

    const outputPath = path.join(pluginDir, 'src/translations.js');

    // Build new translations
    let translations = buildPluginTranslations(pluginDir, keys, allTranslations);

    // In local mode, merge with existing translations (incremental update)
    if (isLocalMode) {
        const existingTranslations = parseExistingTranslations(outputPath);
        if (existingTranslations) {
            console.log(`  → Merging with existing translations (incremental update)`);
            translations = mergeTranslations(translations, existingTranslations, keys);
        }
    }

    // Update package.json l10n field with interface translations
    if (keys.interface.length > 0) {
        updatePackageJsonL10n(pluginDir, translations.interface, keys);
        console.log(`  ✓ Updated package.json l10n (${keys.interface.length} interface keys)`);
    }

    // Generate translations.js file
    const content = generateTranslationFile(translations);

    fs.ensureDirSync(path.dirname(outputPath));
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log(`  ✓ Generated ${outputPath}`);
    const keyCounts = `${keys.extensions.length} extensions + ${keys.blocks.length} blocks`;
    console.log(`    ${keyCounts}\n`);

    return true;
};

/**
 * Check if directory is a plugin directory (has package.json with openblock field)
 * @param {string} dir - Directory path
 * @returns {boolean} True if it's a plugin directory
 */
const isPluginDirectory = dir => {
    const pkg = readPackageJson(dir);
    return pkg && pkg.openblock && (pkg.openblock.extensionId || pkg.openblock.deviceId);
};

/**
 * Main function
 */
const main = async () => {
    const {dir} = parseArgs();
    const workDir = path.resolve(dir || './');

    console.log(`Working directory: ${workDir}\n`);

    // Check if workDir is a single plugin directory
    const isSinglePlugin = isPluginDirectory(workDir);

    // Get translations (from Transifex or local files)
    let allTranslations;
    if (isLocalMode) {
        // In local mode, we don't need allTranslations for single plugin
        if (isSinglePlugin) {
            allTranslations = {
                [RESOURCES.INTERFACE]: {},
                [RESOURCES.EXTENSIONS]: {},
                [RESOURCES.BLOCKS]: {}
            };
        } else {
            allTranslations = loadLocalTranslations(workDir);
        }
    } else {
        allTranslations = await pullAllTranslations();
    }

    let processedCount = 0;

    if (isSinglePlugin) {
        // Single plugin mode
        console.log('Running in SINGLE RESOUCE mode\n');
        if (processPlugin(workDir, allTranslations)) {
            processedCount++;
        }
    } else {
        // Multi-plugin mode
        console.log('Running in MULTI RESOUCE mode\n');
        const resourceTypes = ['extensions', 'devices'];

        for (const type of resourceTypes) {
            const typeDir = path.join(workDir, type);
            if (!fs.existsSync(typeDir)) {
                console.log(`Skipping ${type}/ (not found)\n`);
                continue;
            }

            const plugins = fs.readdirSync(typeDir, {withFileTypes: true})
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            console.log(`Processing ${plugins.length} plugins in ${type}/\n`);

            for (const pluginName of plugins) {
                const pluginDir = path.join(typeDir, pluginName);
                if (processPlugin(pluginDir, allTranslations)) {
                    processedCount++;
                }
            }
        }
    }

    console.log(`\n✓ Complete! Processed ${processedCount} resouce${processedCount === 1 ? '' : 's'}`);
};

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
