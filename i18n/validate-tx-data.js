const assert = require('assert');
const parse = require('format-message-parse');

// Check that translation is valid:
// entry: array [key, translation]  corresponding to a single string from <locale>.json
// - messages with placeholders have the same number of placeholders
// - messages must not have newlines embedded
const validateEntry = function (entry, en) {
    const re = /(%\d)/g;
    const [key, translation] = entry;
    const enMatch = en[key].match(re);
    const tMatch = translation.match(re);
    const enCount = enMatch ? enMatch.length : 0;
    const tCount = tMatch ? tMatch.length : 0;
    assert.strictEqual(tCount, enCount, `${key}:${en[key]} - "${translation}" placeholder mismatch`);
    if (enCount > 0) {

        assert.notStrictEqual(tMatch, null, `${key} is missing a placeholder: ${translation}`);
        assert.strictEqual(
            tMatch.sort().toString(),
            enMatch.sort().toString(),
            `${key} is missing or has duplicate placeholders: ${translation}`
        );
    }
    assert.strictEqual(translation.match(/[\n]/), null, `${key} contains a newline character ${translation}`);
};

const validateBlocksTranslations = function (json, en, enKeys, name) {
    assert.strictEqual(Object.keys(json).sort()
        .toString(), enKeys, `${name}: Locale json keys do not match en.json`);
    Object.entries(json).forEach(element => validateEntry(element, en));
};

const flattenJson = translations => {
    const messages = Object.keys(translations).reduce((collection, id) => {
        collection[id] = translations[id].message;
        return collection;
    }, {});
    return JSON.stringify(messages, null, 4);
};

// filter placeholders out of a message
// parse('a message with a {value} and {count, plural, one {one} other {more}}.')
// returns an array:
// [ 'a message with a ',
//   [ 'value' ],
//   ' and ',
//   [ 'count', 'plural', 0, { one: [Array], other: [Array] } ],
//   '.'
// ]
// placeholders are always an array, so filter for array elements to find the placeholders
const placeholders = message => (
    // this will throw an error if the message is not valid ICU
    // single quote (as in French l'année) messes up the parse and is not
    // relevant for this check, so strip them out
    parse(message.replace(/'/g, '')).filter(item => Array.isArray(item))
);

const validMessage = (message, source) => {
    const transPlaceholders = placeholders(message);
    const srcPlaceholders = placeholders(source);
    // different number of placeholders
    if (transPlaceholders.length !== srcPlaceholders.length) {
        return false;
    }
    // TODO: Add checking to make sure placeholders in source have not been translated
    return true;
};

const validateTranslations = (translation, source) => {
    const locale = translation.locale;
    const translations = translation.translations;
    const transKeys = Object.keys(translations);
    const sourceKeys = Object.keys(source);
    assert.strictEqual(transKeys.length, sourceKeys.length, `locale ${locale} has a different number of message keys`);
    transKeys.map(item => assert(sourceKeys.includes(item), `locale ${locale} has key ${item} not in the source`));
    sourceKeys.map(item => assert(transKeys.includes(item), `locale ${locale} is missing key ${item}`));
    sourceKeys.map(item => assert(
        validMessage(translations[item], source[item]),
        `locale ${locale}: "${translations[item]}" is not a valid translation for "${source[item]}"`)
    );
};

module.exports = {validateBlocksTranslations, flattenJson, validateTranslations};
