const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hello')
        .setDescription('Replies with Hello!'),
    async execute(interaction) {
        await interaction.reply({
            content: 'Hello!',
            flags: MessageFlags.Ephemeral // Instead of ephemeral: true
        });
    }
};