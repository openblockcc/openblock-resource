const clc = require('cli-color');

/**
 * Logger utility for consistent console output formatting.
 * Provides structured, color-coded logging for the resource server.
 */
const log = {
    /**
     * Log an informational message with info symbol.
     * @param {string} message - Message to log
     */
    info (message) {
        console.log(clc.cyan(`i ${message}`));
    },

    /**
     * Log a success message with checkmark.
     * @param {string} message - Message to log
     */
    success (message) {
        console.log(clc.green(`√ ${message}`));
    },

    /**
     * Log a warning message with warning symbol.
     * @param {string} message - Message to log
     */
    warn (message) {
        console.log(clc.yellow(`! ${message}`));
    },

    /**
     * Log an error message with cross symbol.
     * @param {string} message - Message to log
     */
    error (message) {
        console.error(clc.red(`x ${message}`));
    },

    /**
     * Log a section title with separator line.
     * @param {string} title - Section title
     */
    title (title) {
        console.log('');
        console.log(`${title}`);
        console.log(clc.blackBright('─'.repeat(50)));
    },

    /**
     * Log a list item with bullet.
     * @param {string} item - Item text
     */
    item (item) {
        console.log(`  - ${item}`);
    },

    /**
     * Log multiple list items.
     * @param {string[]} items - Array of items
     */
    items (items) {
        items.forEach(item => {
            console.log(`  - ${item}`);
        });
    },

    /**
     * Log a numbered list with title.
     * @param {string} title - Title of the list
     * @param {string[]} items - Array of items to list
     */
    list (title, items) {
        console.log(clc.cyan(`i ${title}`));
        items.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item}`);
        });
    },

    /**
     * Log a detail line (indented key-value pair).
     * @param {string} label - Label/key
     * @param {string} value - Value
     */
    detail (label, value) {
        console.log(`  ${label}: ${value}`);
    },

    /**
     * Print an empty line for visual separation.
     */
    blank () {
        console.log('');
    },

    /**
     * Print a separator line.
     */
    separator () {
        console.log(clc.blackBright('─'.repeat(50)));
    }
};

module.exports = log;
