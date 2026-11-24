const { SlashCommandBuilder } = require('discord.js');
const { models } = require('../../utils/database');
const { supportServer } = require('../Cooldowns/cooldowns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('example')
        .setDescription('Example command using database')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name to save')
                .setRequired(true)),
    supportServer: true,
    async execute(interaction) {
        const name = interaction.options.getString('name');

        // Access the Example model from the models object
        const Example = models.Example;

        // Find or create example
        const example = await Example.findOrCreateExample(name);

        // Increment count
        await example.incrementCount();

        await interaction.reply({
            content: `✅ Example "${example.name}" has count: ${example.count}`,
            ephemeral: true
        });
    }
};