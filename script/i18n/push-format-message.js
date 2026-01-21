#!/usr/bin/env node

/**
 * @fileoverview
 * Push extracted i18n content to Transifex.
 *
 * Pushes the following translation files to Transifex:
 * - translations/interface/en.json → openblock-resources/interface
 * - translations/extensions/en.json → openblock-resources/extensions
 * - translations/blocks/en.json → openblock-resources/blocks
 *
 * Usage:
 *   node push-format-message.js [--dir=path/to/resources]
 */

const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');

// ============================================================================
// Utilities
// ============================================================================

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
 * Execute a command synchronously
 * @param {string} cmd - Command to execute
 * @returns {boolean} True if successful, false otherwise
 */
const runCommand = cmd => {
    try {
        const output = execSync(cmd, {encoding: 'utf8'});
        if (output) {
            console.log(output);
        }
        return true;
    } catch (error) {
        console.error(`Error executing: ${cmd}`);
        console.error(error.message);
        return false;
    }
};

// ============================================================================
// Main
// ============================================================================

/**
 * Main function to push translations to Transifex
 */
const main = () => {
    const {dir} = parseArgs();
    const workDir = dir || './';
    const workDirResolved = path.resolve(workDir);

    console.log(`Pushing translations from: ${workDirResolved}\n`);

    // Define translation resources to push
    const resources = [
        {
            name: 'interface',
            file: path.join(workDirResolved, 'translations/interface/en.json')
        },
        {
            name: 'extensions',
            file: path.join(workDirResolved, 'translations/extensions/en.json')
        },
        {
            name: 'blocks',
            file: path.join(workDirResolved, 'translations/blocks/en.json')
        }
    ];

    // Validate files exist
    const missingFiles = resources.filter(r => !fs.existsSync(r.file));
    if (missingFiles.length > 0) {
        console.error('Error: Missing translation files:');
        missingFiles.forEach(r => console.error(`  - ${r.file}`));
        process.exit(1);
    }

    // Push each resource to Transifex
    let allSuccess = true;
    for (const resource of resources) {
        console.log(`Pushing ${resource.name}...`);
        const cmd = `tx-push-src openblock-resources ${resource.name} ${resource.file}`;
        const success = runCommand(cmd);

        if (success) {
            console.log(`✓ ${resource.name} pushed successfully\n`);
        } else {
            console.error(`✗ Failed to push ${resource.name}\n`);
            allSuccess = false;
        }
    }

    // Final status
    if (allSuccess) {
        console.log('✓ All translations pushed to Transifex successfully!');
        process.exit(0);
    } else {
        console.error('✗ Some translations failed to push');
        process.exit(1);
    }
};

main();
