// utils/emojis.js
const { emojis } = require('./botData');

/**
 * Get an emoji by name
 * @param {string} name - The name of the emoji
 * @returns {string} The emoji string (custom or unicode)
 */
function getEmoji(name) {
    return emojis[name] || name;
}

/**
 * Get multiple emojis at once
 * @param {string[]} names - Array of emoji names
 * @returns {Object} Object with emoji names as keys and emoji strings as values
 */
function getEmojis(names) {
    const result = {};
    names.forEach(name => {
        result[name] = getEmoji(name);
    });
    return result;
}

/**
 * Replace all emoji placeholders in a string
 * @param {string} text - Text containing emoji placeholders like {emoji.common-coin}
 * @returns {string} Text with emojis replaced
 */
function replaceEmojis(text) {
    return text.replace(/\{emoji\.([\w-]+)\}/g, (match, name) => {
        return getEmoji(name);
    });
}

/**
 * Get all emojis
 * @returns {Object} All emojis
 */
function getAllEmojis() {
    return { ...emojis };
}

module.exports = {
    getEmoji,
    getEmojis,
    replaceEmojis,
    getAllEmojis,
    emojis
};