// Function to preprocess and parse the formatMessage content
const parseFormatMessageContent = content => {
    // 1. Remove comments
    const cleanedContent = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');

    // 2. Extract content inside parentheses and remove newlines
    const contentInParentheses = cleanedContent
        .slice(cleanedContent.indexOf('(') + 1, cleanedContent.lastIndexOf(')'))
        .replace(/\n/g, '');

    // 3. Core fix: Handle single-quoted strings, preserve escaped single quotes, and escape internal double quotes
    const processSingleQuotedStrings = input => input.replace(/'((?:\\'|[^'])*?)'/g, (match, inner) => {
        // Convert escaped single quotes (\') to normal single quotes (')
        const unescapedSingle = inner.replace(/\\'/g, "'");
        // Escape internal double quotes (") to \"
        const escapedDouble = unescapedSingle.replace(/"/g, '\\"');
        // Wrap with double quotes
        return `"${escapedDouble}"`;
    });

    // 4. Preprocessing steps
    const preprocessedMsg = processSingleQuotedStrings(contentInParentheses)
        // Process keys (ensure keys are wrapped in double quotes)
        .replace(/(\w+):\s*/g, '"$1":')
        // Remove string concatenation expressions
        .replace(/" *\+ *"/g, '');

    try {
        return JSON.parse(preprocessedMsg);
    } catch (e) {
        console.error(`Error parsing JSON: ${e}\nProcessed content: ${preprocessedMsg}`);
        return null;
    }
};

module.exports = parseFormatMessageContent;
