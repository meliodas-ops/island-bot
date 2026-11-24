// commands/Leveling/leveling.js
const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');
const { serverModels } = require('../../utils/serverDatabase');
const { buildProgressBar } = require('../../utils/progressBar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leveling')
        .setDescription('Server leveling commands')
        .addSubcommand(sub => sub
            .setName('rank')
            .setDescription('Check your rank in this server')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('User to check rank for')
                    .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('leaderboard')
            .setDescription('View the server level leaderboard')
            .addIntegerOption(option =>
                option.setName('page')
                    .setDescription('Page number')
                    .setRequired(false)
                    .setMinValue(1)
            )
        )
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('View server leveling stats')
        ),

    supportServer: false,

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'rank':
                await handleRank(interaction);
                break;
            case 'leaderboard':
                await handleLeaderboard(interaction);
                break;
            case 'stats':
                await handleStats(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown subcommand!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
};

// ------------------ RANK SUBCOMMAND ------------------
async function handleRank(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const Leveling = serverModels.Leveling;
    const Settings = serverModels.ServerSettings;

    try {
        // Check if leveling is enabled
        const settings = await Settings.findOne({
            where: { guildId: interaction.guild.id }
        });

        if (!settings || !settings.levelingEnabled) {
            return await interaction.reply({
                content: '❌ Server leveling is not enabled! Ask an admin to enable it with `/settings leveling toggle`.',
                flags: MessageFlags.Ephemeral
            });
        }

        const leveling = await Leveling.findOne({
            where: {
                userId: targetUser.id,
                guildId: interaction.guild.id
            }
        });

        if (!leveling) {
            return await interaction.reply({
                content: `ℹ️ ${targetUser.username} hasn't earned any XP in this server yet!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Get user's rank
        const allUsers = await Leveling.findAll({
            where: { guildId: interaction.guild.id },
            order: [
                ['level', 'DESC'],
                ['totalXP', 'DESC']
            ]
        });

        const rank = allUsers.findIndex(u => u.userId === targetUser.id) + 1;

        // Get XP needed for next level
        const xpNeeded = Leveling.getXPNeededForLevel(leveling.level);
        const progress = Math.min(Math.floor((leveling.currentXP / xpNeeded) * 100), 100);
        const progressBar = buildProgressBar(progress, 100, 10);

        const container = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## 📊 ${targetUser.username}'s Rank`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Level:** ${leveling.level}\n` +
                            `**Rank:** #${rank} / ${allUsers.length}`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder({
                            media: { url: targetUser.displayAvatarURL({ extension: 'png', size: 128 }) }
                        })
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 XP Progress**\n` +
                    `${progressBar}\n` +
                    `${leveling.currentXP.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  •  ${progress}%`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📊 Stats**\n` +
                    `Total XP: ${leveling.totalXP.toLocaleString()}\n` +
                    `Messages: ${leveling.messageCount.toLocaleString()}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Requested by ${interaction.user.username}`)
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleRank:', error);
        await interaction.reply({
            content: '❌ There was an error fetching your rank. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ LEADERBOARD SUBCOMMAND ------------------
async function handleLeaderboard(interaction) {
    const Leveling = serverModels.Leveling;
    const Settings = serverModels.ServerSettings;
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;

    try {
        // Check if leveling is enabled
        const settings = await Settings.findOne({
            where: { guildId: interaction.guild.id }
        });

        if (!settings || !settings.levelingEnabled) {
            return await interaction.reply({
                content: '❌ Server leveling is not enabled! Ask an admin to enable it with `/settings leveling toggle`.',
                flags: MessageFlags.Ephemeral
            });
        }

        const allUsers = await Leveling.findAll({
            where: { guildId: interaction.guild.id },
            order: [
                ['level', 'DESC'],
                ['totalXP', 'DESC']
            ]
        });

        if (allUsers.length === 0) {
            return await interaction.reply({
                content: '📋 No one has earned XP in this server yet!',
                flags: MessageFlags.Ephemeral
            });
        }

        const totalPages = Math.ceil(allUsers.length / pageSize);
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, allUsers.length);
        const pageUsers = allUsers.slice(start, end);

        let leaderboard = '';
        let rank = start + 1;

        for (const user of pageUsers) {
            let medal;
            if (rank === 1) medal = '🥇';
            else if (rank === 2) medal = '🥈';
            else if (rank === 3) medal = '🥉';
            else medal = `#${rank}`;

            const userObj = await interaction.client.users.fetch(user.userId).catch(() => null);
            const username = userObj ? userObj.username : 'Unknown User';

            leaderboard += `${medal} **${username}**\n`;
            leaderboard += `> Level ${user.level} • ${user.totalXP.toLocaleString()} XP\n\n`;
            rank++;
        }

        const container = new ContainerBuilder()
            .setAccentColor(0x0099FF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 🏆 Server Leaderboard`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(leaderboard || 'No users on this page')
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Page ${page}/${totalPages} • ${pageSize} per page`)
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleLeaderboard:', error);
        await interaction.reply({
            content: '❌ There was an error fetching the leaderboard. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ STATS SUBCOMMAND ------------------
async function handleStats(interaction) {
    const Leveling = serverModels.Leveling;
    const Settings = serverModels.ServerSettings;

    try {
        const settings = await Settings.findOne({
            where: { guildId: interaction.guild.id }
        });

        if (!settings) {
            return await interaction.reply({
                content: '❌ Server settings not found. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }

        const allUsers = await Leveling.findAll({
            where: { guildId: interaction.guild.id }
        });

        const totalUsers = allUsers.length;
        const totalXP = allUsers.reduce((sum, u) => sum + u.totalXP, 0);
        const totalMessages = allUsers.reduce((sum, u) => sum + u.messageCount, 0);
        const highestLevel = allUsers.length > 0 ? Math.max(...allUsers.map(u => u.level)) : 0;
        const averageLevel = allUsers.length > 0 ? (allUsers.reduce((sum, u) => sum + u.level, 0) / allUsers.length) : 0;

        const container = new ContainerBuilder()
            .setAccentColor(0x0099FF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 📊 Server Leveling Stats`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 Overview**\n` +
                    `Total Users: ${totalUsers.toLocaleString()}\n` +
                    `Total XP Earned: ${totalXP.toLocaleString()}\n` +
                    `Total Messages: ${totalMessages.toLocaleString()}\n\n` +
                    `**🏆 Top Stats**\n` +
                    `Highest Level: ${highestLevel}\n` +
                    `Average Level: ${averageLevel.toFixed(1)}\n\n` +
                    `**⚙️ Settings**\n` +
                    `Status: ${settings.levelingEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
                    `XP Range: ${settings.levelingMinXP} - ${settings.levelingMaxXP} XP\n` +
                    `Cooldown: ${settings.levelingInterval}s\n` +
                    `Formula: ${settings.levelingFormula}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${interaction.guild.name}`)
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleStats:', error);
        await interaction.reply({
            content: '❌ There was an error fetching server stats. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}