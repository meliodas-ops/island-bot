// commands/Community/bot.js
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');
const pidusage = require('pidusage');
const process = require('process');
const { sequelize } = require('../../utils/database');
const { serverSequelize } = require('../../utils/serverDatabase');

// Read bot version from package.json
const packageJson = require('../../package.json');
const botVersion = packageJson.version;

// Shared nav row, reused across views
function buildNavRow(disabled = false) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('bot_info')
                .setLabel('Bot Info')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('bot_database')
                .setLabel('Database')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🗄️')
                .setDisabled(disabled)
        );
}

async function buildInfoContainer(client) {
    const totalSeconds = Math.floor(client.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (totalSeconds % 60).toFixed(1);

    const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    const restartDate = `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:F>`;
    const developer = '<@663231875707568139> (meliodas.)';

    const stats = await pidusage(process.pid);
    const cpuUsage = `${stats.cpu.toFixed(1)}%`;
    const ramUsage = `${(stats.memory / 1024 / 1024).toFixed(1)} MB`;

    return new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## 🤖 ${client.user.username}#${client.user.discriminator}`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`Bot Version: **${botVersion}**  •  discord.js`)
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder({
                        media: { url: client.user.displayAvatarURL({ extension: 'png', size: 256 }) }
                    })
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**⏱️ Uptime**\n${uptime}\n` +
                `**🔄 Restarted At**\n${restartDate}`
            )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**👨‍💻 Developer**\n${developer}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**📦 Stats**\n` +
                `Commands: ${client.commands.size}\n` +
                `Guilds: ${client.guilds.cache.size}\n` +
                `Users: ${client.users.cache.size}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ID: ${client.user.id}`)
        )
        .addActionRowComponents(buildNavRow());
}

async function buildDatabaseContainer(counts = null) {
    const container = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## 🗄️ Database Information')
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Database:** bots.sqlite\n` +
                        `Status: ✅ Connected`
                    )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder({
                        media: { url: 'https://ik.imagekit.io/hxvezoqrx/database-icon-database-free-download-png-79d4fd68ccb469d80526b17e912e8005.png' }
                    })
                )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

    if (counts) {
        // Main Database Tables
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**📊 Player tables**\n` +
                `Players: ${counts.playerCount}\n` +
                `Economy: ${counts.economyCount}\n` +
                `Levels: ${counts.levelCount}\n` +
                `Prestige: ${counts.prestigeCount}\n` +
                `Promo Codes: ${counts.promoCodeCount}\n` +
                `Promo Redemptions: ${counts.promoRedemptionCount}\n` +
                `User Badges: ${counts.userBadgeCount}`
            )
        );

        // Server Database Tables
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**📊 Server tables**\n` +
                `Server Settings: ${counts.serverSettingsCount}\n` +
                `Server Leveling: ${counts.serverLevelingCount}`
            )
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**📊 Player tables**\n` +
                `Players: Fetching...\n` +
                `Economy: Fetching...\n` +
                `Levels: Fetching...\n` +
                `Prestige: Fetching...\n` +
                `Promo Codes: Fetching...\n` +
                `Promo Redemptions: Fetching...\n` +
                `User Badges: Fetching...`
            )
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**📊 Server tables**\n` +
                `Server Settings: Fetching...\n` +
                `Server Leveling: Fetching...`
            )
        );
    }

    container
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Database Status: Operational • v${botVersion}`)
        )
        .addActionRowComponents(buildNavRow());

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Bot-related commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get information about the bot')),

    async execute(interaction) {
        const { client } = interaction;

        const infoContainer = await buildInfoContainer(client);

        // Send initial message with bot info
        await interaction.reply({
            components: [infoContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

        const reply = await interaction.fetchReply();

        // Create collector for button interactions
        const collector = reply.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 120000 // 2 minutes
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'bot_info') {
                const refreshedInfoContainer = await buildInfoContainer(client);
                await i.update({
                    components: [refreshedInfoContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else if (i.customId === 'bot_database') {
                try {
                    const { models } = require('../../utils/database');
                    const { serverModels } = require('../../utils/serverDatabase');

                    // Main Database Counts
                    const playerCount = await models.Player.count();
                    const economyCount = await models.Economy.count();
                    const levelCount = await models.Level.count();
                    const prestigeCount = await models.Prestige ? await models.Prestige.count() : 0;
                    const promoCodeCount = await models.PromoCode ? await models.PromoCode.count() : 0;
                    const promoRedemptionCount = await models.PromoRedemption ? await models.PromoRedemption.count() : 0;
                    const userBadgeCount = await models.UserBadge ? await models.UserBadge.count() : 0;

                    // Server Database Counts
                    const serverSettingsCount = await serverModels.ServerSettings ? await serverModels.ServerSettings.count() : 0;
                    const serverLevelingCount = await serverModels.Leveling ? await serverModels.Leveling.count() : 0;

                    const dbContainer = await buildDatabaseContainer({
                        playerCount,
                        economyCount,
                        levelCount,
                        prestigeCount,
                        promoCodeCount,
                        promoRedemptionCount,
                        userBadgeCount,
                        serverSettingsCount,
                        serverLevelingCount
                    });

                    await i.update({
                        components: [dbContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (error) {
                    console.error('Error fetching database counts:', error);
                    const dbContainer = await buildDatabaseContainer(null);
                    await i.update({
                        components: [dbContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
        });

        collector.on('end', async () => {
            // Rebuild the info container (last known view) with nav buttons disabled
            const finalContainer = await buildInfoContainer(client);

            const components = finalContainer.components;
            const actionRow = components[components.length - 1];
            if (actionRow && actionRow.components) {
                for (const btn of actionRow.components) {
                    btn.data.disabled = true;
                }
            }

            await interaction.editReply({
                components: [finalContainer],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => { });
        });
    }
};