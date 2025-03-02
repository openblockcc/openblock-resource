// Function to preprocess and parse the formatMessage content
const parseFormatMessageContent = content => {
    // Remove comments first
    const cleanedContent = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');

    // Preprocess the message content:
    // - Remove newlines
    // - Replace single quotes with double quotes
    // - Handle concatenation expressions
    const preprocessedMsg = cleanedContent
        .slice(cleanedContent.indexOf('(') + 1, cleanedContent.lastIndexOf(')')) // Remove the parentheses
        .replace(/\n/g, '') // Remove newlines
        // eslint-disable-next-line max-len
        .replace(/(\w+:)/g, matchedStr => `"${matchedStr.substring(0, matchedStr.length - 1)}":`) // Add double quotes to keys
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/" *\+ *"/g, ''); // Remove string concatenation expressions

    try {
        return JSON.parse(preprocessedMsg);
    } catch (e) {
        console.error(`Error parsing the message: ${e}`);
        return null; // Return null, or you can throw an error depending on your needs
    }
};

module.exports = parseFormatMessageContent;
