// utils/progressBar.js

// Custom emoji tags for the rounded progress bar pieces.
// Format is always <:name:id> — verify these match the shapes you uploaded.
const BAR = {
    leftFilled: '<:5988lbg:1525838968875253782>',
    leftEmpty: '<:5499lb2g:1525838966538895390>',
    midFilled: '<:3451lg:1525838964227833856>',
    midEmpty: '<:2827l2g:1525838956220907530>',
    rightFilled: '<:3166lb4g:1525838961287630938>',
    rightEmpty: '<:2881lb3g:1525838958934757427>'
};

/**
 * Builds a rounded progress bar string out of custom emojis.
 * @param {number} current - current value (e.g. XP, availableCount)
 * @param {number} max - max value
 * @param {number} length - number of middle segments (excludes the two caps), default 8
 * @returns {string} the emoji progress bar
 */
function buildProgressBar(current, max, length = 8) {
    const percent = max > 0 ? Math.min(Math.max(current / max, 0), 1) : 0;
    const filledSegments = Math.round(percent * length);

    let bar = percent > 0 ? BAR.leftFilled : BAR.leftEmpty;

    for (let i = 0; i < length; i++) {
        bar += i < filledSegments ? BAR.midFilled : BAR.midEmpty;
    }

    bar += filledSegments >= length ? BAR.rightFilled : BAR.rightEmpty;

    return bar;
}

module.exports = { buildProgressBar, BAR };