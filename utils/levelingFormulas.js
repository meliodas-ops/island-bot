// Stored keys are kept stable for servers that chose a curve before the labels changed.
const names = {
    amari: 'Quadratic growth (5L² + 50L + 100 XP)',
    'atom-bot': '50% growth per level (starts at 100 XP)',
    'arcane-bot': '80% growth per level (starts at 50 XP)'
};
module.exports = {
    choices: Object.entries(names).map(([value, name]) => ({ value, name })),
    label: key => names[key] || names.amari
};
