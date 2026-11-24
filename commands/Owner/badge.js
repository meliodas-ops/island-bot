// commands/Owner/badge.js
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { models } = require('../../utils/database');
const fs = require('fs');
const path = require('path');

const OWNER_ID = '663231875707568139';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('badge')
        .setDescription('Manage user badges (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add a badge to a user')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to give the badge to')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('badgeid')
                    .setDescription('The badge ID to give')
                    .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a badge from a user')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to remove the badge from')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('badgeid')
                    .setDescription('The badge ID to remove')
                    .setRequired(true)
                    .setMinValue(1)
            )
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all available badges')
        )
        .addSubcommand(sub => sub
            .setName('userbadges')
            .setDescription('List all badges a user has')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to check')
                    .setRequired(true)
            )
        ),
    supportServer: true,

    async execute(interaction) {
        // Check if user is the owner
        if (interaction.user.id !== OWNER_ID) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command! This command is owner-only.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await handleBadgeAdd(interaction);
                break;
            case 'remove':
                await handleBadgeRemove(interaction);
                break;
            case 'list':
                await handleBadgeList(interaction);
                break;
            case 'userbadges':
                await handleUserBadges(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown subcommand!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
};

const { badges: loadBadges } = require('../../utils/botData');

// ==================== BADGE - ADD ====================
async function handleBadgeAdd(interaction) {
    const UserBadge = models.UserBadge;
    const user = interaction.options.getUser('user');
    const badgeId = interaction.options.getInteger('badgeid');

    try {
        const badgeData = UserBadge.getBadgeData(badgeId);

        if (!badgeData) {
            return await interaction.reply({
                content: `❌ Badge with ID **${badgeId}** does not exist! Use \`/badge list\` to see all badges.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user is registered
        const Player = models.Player;
        const player = await Player.findOne({
            where: { playerId: user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                content: `❌ ${user.username} is not registered as a player! They need to use \`/player register\` first.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Add the badge
        const badge = await UserBadge.addBadge(user.id, badgeId, interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(badgeData.color || 0x00FF00)
            .setTitle('✅ Badge Added!')
            .setDescription(`Added **${badgeData.icon} ${badgeData.name}** to ${user.username}`)
            .addFields(
                { name: 'Badge ID', value: `${badgeId}`, inline: true },
                { name: 'Badge Name', value: badgeData.name, inline: true },
                { name: 'Icon', value: badgeData.icon || 'None', inline: true },
                { name: 'Description', value: badgeData.description || 'No description', inline: false },
                { name: 'Granted By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Earned At', value: `<t:${Math.floor(badge.earnedAt.getTime() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleBadgeAdd:', error);
        await interaction.reply({
            content: `❌ ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== BADGE - REMOVE ====================
async function handleBadgeRemove(interaction) {
    const UserBadge = models.UserBadge;
    const user = interaction.options.getUser('user');
    const badgeId = interaction.options.getInteger('badgeid');

    try {
        const badgeData = UserBadge.getBadgeData(badgeId);

        if (!badgeData) {
            return await interaction.reply({
                content: `❌ Badge with ID **${badgeId}** does not exist!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user has the badge
        const hasBadge = await UserBadge.hasBadge(user.id, badgeId);
        if (!hasBadge) {
            return await interaction.reply({
                content: `❌ ${user.username} does not have the **${badgeData.icon} ${badgeData.name}** badge!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Remove the badge
        await UserBadge.removeBadge(user.id, badgeId);

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Badge Removed!')
            .setDescription(`Removed **${badgeData.icon} ${badgeData.name}** from ${user.username}`)
            .addFields(
                { name: 'Badge ID', value: `${badgeId}`, inline: true },
                { name: 'Badge Name', value: badgeData.name, inline: true },
                { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleBadgeRemove:', error);
        await interaction.reply({
            content: `❌ ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== BADGE - LIST ====================
async function handleBadgeList(interaction) {
    const badges = loadBadges();
    const badgeIds = Object.keys(badges);

    if (badgeIds.length === 0) {
        return await interaction.reply({
            content: '❌ No badges found in the badge table!',
            flags: MessageFlags.Ephemeral
        });
    }

    let badgeList = '';
    badgeIds.forEach(id => {
        const badge = badges[id];
        badgeList += `**${id}.** ${badge.icon || '🔹'} **${badge.name}**`;
        if (badge.description) {
            badgeList += ` - ${badge.description}`;
        }
        badgeList += '\n';
    });

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('📋 Available Badges')
        .setDescription(badgeList)
        .setFooter({ text: `Total: ${badgeIds.length} badges` })
        .setTimestamp();

    await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
    });
}

// ==================== BADGE - USER BADGES ====================
async function handleUserBadges(interaction) {
    const UserBadge = models.UserBadge;
    const user = interaction.options.getUser('user');

    try {
        // Check if user is registered
        const Player = models.Player;
        const player = await Player.findOne({
            where: { playerId: user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                content: `❌ ${user.username} is not registered as a player!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const userBadges = await UserBadge.getUserBadges(user.id);

        if (userBadges.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`📋 ${user.username}'s Badges`)
                .setDescription(`${user.username} has no badges yet.`)
                .setTimestamp();

            return await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }

        let badgeList = '';
        userBadges.forEach(badge => {
            const info = badge.info;
            if (info) {
                badgeList += `${info.icon || '🔹'} **${info.name}**`;
                if (info.description) {
                    badgeList += ` - ${info.description}`;
                }
                badgeList += `\n> Earned: <t:${Math.floor(badge.earnedAt.getTime() / 1000)}:R>\n\n`;
            }
        });

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`📋 ${user.username}'s Badges (${userBadges.length})`)
            .setDescription(badgeList)
            .setFooter({ text: `User ID: ${user.id}` })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleUserBadges:', error);
        await interaction.reply({
            content: '❌ Error fetching user badges. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}