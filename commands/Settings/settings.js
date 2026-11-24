// commands/Settings/leveling.js
const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');
const { serverModels } = require('../../utils/serverDatabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage server settings (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group => group
            .setName('leveling')
            .setDescription('Leveling system settings')
            .addSubcommand(sub => sub
                .setName('toggle')
                .setDescription('Enable or disable the leveling system')
            )
            .addSubcommand(sub => sub
                .setName('xp')
                .setDescription('Set the XP range per message')
                .addIntegerOption(option =>
                    option.setName('min')
                        .setDescription('Minimum XP per message (1-50)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(1000)
                )
                .addIntegerOption(option =>
                    option.setName('max')
                        .setDescription('Maximum XP per message (1-50)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(5000)
                )
            )
            .addSubcommand(sub => sub
                .setName('interval')
                .setDescription('Set the cooldown between XP gains')
                .addIntegerOption(option =>
                    option.setName('seconds')
                        .setDescription('Cooldown in seconds (30-300)')
                        .setRequired(true)
                        .setMinValue(30)
                        .setMaxValue(300)
                )
            )
            .addSubcommand(sub => sub
                .setName('channel')
                .setDescription('Set the channel for level up announcements')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Text channel for level ups')
                        .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('formula')
                .setDescription('Set the XP formula for leveling')
                .addStringOption(option =>
                    option.setName('formula')
                        .setDescription('Choose a leveling formula')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Amari Bot (5x² + 50x + 100)', value: 'amari' },
                            { name: 'Atom Bot (100 × 1.5^(level-1))', value: 'atom-bot' },
                            { name: 'Arcane Bot (50 × 1.8^(level-1))', value: 'arcane-bot' }
                        )
                )
            )
            // REMOVED: message subcommand
        ),

    supportServer: true,

    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (subcommandGroup !== 'leveling') {
            return await interaction.reply({
                content: '❌ Unknown settings group!',
                flags: MessageFlags.Ephemeral
            });
        }

        switch (subcommand) {
            case 'toggle':
                await handleToggle(interaction);
                break;
            case 'xp':
                await handleXP(interaction);
                break;
            case 'interval':
                await handleInterval(interaction);
                break;
            case 'channel':
                await handleChannel(interaction);
                break;
            case 'formula':
                await handleFormula(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown subcommand!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
};

// ------------------ TOGGLE ------------------
async function handleToggle(interaction) {
    const Settings = serverModels.ServerSettings;

    try {
        const settings = await Settings.getOrCreate(interaction.guild.id, interaction.guild.name);
        await settings.toggleLeveling();

        const container = new ContainerBuilder()
            .setAccentColor(settings.levelingEnabled ? 0x00FF00 : 0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${settings.levelingEnabled ? '🟢' : '🔴'} Leveling ${settings.levelingEnabled ? 'Enabled' : 'Disabled'}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Server leveling is now **${settings.levelingEnabled ? 'enabled' : 'disabled'}**!\n\n` +
                    `-# ${interaction.guild.name}`
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleToggle:', error);
        await interaction.reply({
            content: '❌ Error toggling leveling. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ XP RANGE ------------------
async function handleXP(interaction) {
    const Settings = serverModels.ServerSettings;
    const min = interaction.options.getInteger('min');
    const max = interaction.options.getInteger('max');

    if (min > max) {
        return await interaction.reply({
            content: '❌ The minimum XP cannot be greater than the maximum XP!',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        const settings = await Settings.getOrCreate(interaction.guild.id, interaction.guild.name);
        settings.levelingMinXP = min;
        settings.levelingMaxXP = max;
        await settings.save();

        const container = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ✅ XP Range Updated')
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**New XP Range**\n` +
                    `Min: ${min} XP\n` +
                    `Max: ${max} XP\n\n` +
                    `-# ${interaction.guild.name}`
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleXP:', error);
        await interaction.reply({
            content: '❌ Error updating XP range. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ INTERVAL ------------------
async function handleInterval(interaction) {
    const Settings = serverModels.ServerSettings;
    const seconds = interaction.options.getInteger('seconds');

    try {
        const settings = await Settings.getOrCreate(interaction.guild.id, interaction.guild.name);
        settings.levelingInterval = seconds;
        await settings.save();

        const container = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ✅ Cooldown Updated')
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**New Cooldown**\n` +
                    `${seconds} seconds between XP gains\n\n` +
                    `-# ${interaction.guild.name}`
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleInterval:', error);
        await interaction.reply({
            content: '❌ Error updating cooldown. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ CHANNEL ------------------
async function handleChannel(interaction) {
    const Settings = serverModels.ServerSettings;
    const channel = interaction.options.getChannel('channel');

    if (!channel.isTextBased()) {
        return await interaction.reply({
            content: '❌ Please select a text channel!',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        const settings = await Settings.getOrCreate(interaction.guild.id, interaction.guild.name);
        settings.levelUpChannel = channel.id;
        await settings.save();

        const container = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ✅ Level Up Channel Set')
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Channel**\n${channel}\n\n` +
                    `Level up announcements will be sent here!\n\n` +
                    `-# ${interaction.guild.name}`
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleChannel:', error);
        await interaction.reply({
            content: '❌ Error setting level up channel. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ FORMULA ------------------
async function handleFormula(interaction) {
    const Settings = serverModels.ServerSettings;
    const formula = interaction.options.getString('formula');

    try {
        const settings = await Settings.getOrCreate(interaction.guild.id, interaction.guild.name);
        settings.levelingFormula = formula;
        await settings.save();

        const formulaNames = {
            'amari': 'Amari Bot (5x² + 50x + 100)',
            'atom-bot': 'Atom Bot (100 × 1.5^(level-1))',
            'arcane-bot': 'Arcane Bot (50 × 1.8^(level-1))'
        };

        const container = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ✅ Formula Updated')
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**New Formula**\n${formulaNames[formula]}\n\n` +
                    `-# ${interaction.guild.name}`
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleFormula:', error);
        await interaction.reply({
            content: '❌ Error updating formula. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}