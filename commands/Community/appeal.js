const { SlashCommandBuilder } = require('discord.js');
const { start } = require('../../utils/appeals');

module.exports = {
    data: new SlashCommandBuilder().setName('appeal').setDescription('Start, resume, or check your bot ban appeal'),
    execute: start
};
