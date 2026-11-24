const { interactionBan } = require('../../utils/bans');
// commands/Player/player.js
const {
    SlashCommandBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');
const { models } = require('../../utils/database');
const { buildProgressBar } = require('../../utils/progressBar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('player')
        .setDescription('Player management commands')
        .addSubcommand(sub => sub
            .setName('register')
            .setDescription('Register as a player')
        )
        .addSubcommand(sub => sub
            .setName('profile')
            .setDescription('View your player profile')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('User to view profile for')
                    .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('level')
            .setDescription('View your level progress')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('User to check level for')
                    .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('leaderboard')
            .setDescription('View the level leaderboard')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'register':
                await handleRegister(interaction);
                break;
            case 'profile':
                await handleProfile(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'level':
                await handleLevel(interaction);
                break;
            case 'leaderboard':
                await handleLeaderboard(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown subcommand!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
};

// Helper to build a "not registered" container, reused across subcommands
function buildNotRegisteredContainer(targetUser) {
    return new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## ❌ Player Not Registered')
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${targetUser.username} is not registered as a player.\n\n` +
                `**How to Register**\nUse \`/player register\` to become a player!`
            )
        );
}

// ------------------ REGISTER SUBCOMMAND ------------------
async function handleRegister(interaction) {
    const Player = models.Player;

    let player = await Player.registerPlayer(
        interaction.user.id,
        interaction.user.username,
        interaction.user.discriminator
    );

    if (player.isRegistered) {
        const registeredContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ✅ You are already registered!')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`You are player #${player.playerNumber}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Username:** ${player.username}\n` +
                    `**Player ID:** #${player.playerNumber}\n` +
                    `**Registered Since:** <t:${Math.floor(player.registeredAt.getTime() / 1000)}:F>`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# User ID: ${interaction.user.id}`)
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('already_registered')
                        .setLabel('✅ Already Registered')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                )
            );

        return await interaction.reply({
            components: [registeredContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }

    const rulesContainer = new ContainerBuilder()
        .setAccentColor(0x0099FF)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## 📋 Player Registration')
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**${interaction.user.username}!** You are now registering.`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## **🎮 Game Rules**\n` +
                `- **Fair Play:** Cheating, exploiting bugs is prohibited.\n\n` +
                `- **Bug Reporting:** Report any bugs to the Developers or Moderation Team.\n\n` +
                `- **Moderation:** Players may receive warnings for minor infractions, repeated or serious violations may result in temporary bans and severe or repeated violations can lead to permanent bans from the events.\n` +
                `-# Please follow the server rules as well to be able to participate in future events!\n\n` +
                `- **Appeal Process:** Players have the right to appeal any Moderation. You will be able to appeal from your profile.\n\n` +
                `- **Rule Changes:** The moderation team reserves the right to update or change the rules as necessary. Players will be notified of any changes in the respective channels.`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**📝 How to Register**\nClick the button below if you agree to the rules in order to register as a player!`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(false)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# User ID: ${interaction.user.id}`)
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_rules_${interaction.user.id}`)
                    .setLabel('✅ Accept Rules & Register')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            )
        );

    await interaction.reply({
        components: [rulesContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
}

// ------------------ PROFILE SUBCOMMAND ------------------
async function handleProfile(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const Player = models.Player;
    const Level = models.Level;
    const Economy = models.Economy;
    const UserBadge = models.UserBadge;
    const Prestige = models.Prestige;

    try {
        const player = await Player.findOne({
            where: { playerId: targetUser.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(targetUser)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const level = await Level.getOrCreate(targetUser.id);
        await level.fixXP();
        const progress = level.getProgress();
        const xpNeeded = level.getXPNeeded();
        const safeProgress = Math.min(Math.max(progress, 0), 100);
        const progressBar = buildProgressBar(safeProgress, 100, 10);

        // Get prestige data
        const prestige = await Prestige.getOrCreate(targetUser.id);

        const registeredDate = Math.floor(player.registeredAt.getTime() / 1000);
        const now = Math.floor(Date.now() / 1000);
        const diffYears = Math.floor((now - registeredDate) / (365 * 24 * 60 * 60));
        const diffMonths = Math.floor((now - registeredDate) / (30 * 24 * 60 * 60));
        const diffDays = Math.floor((now - registeredDate) / (24 * 60 * 60));

        let timeAgo;
        if (diffYears > 0) {
            timeAgo = `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
        } else if (diffMonths > 0) {
            timeAgo = `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
        } else if (diffDays > 0) {
            timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            timeAgo = 'Today';
        }

        // Get user badges
        const userBadges = await UserBadge.getUserBadges(targetUser.id);

        // Sort badges by badgeId in ascending order (lowest to highest)
        userBadges.sort((a, b) => a.badgeId - b.badgeId);

        // Build badges display
        let badgesDisplay = '';
        let profileColor = 0x00FF00; // Default green

        if (userBadges.length > 0) {
            // Get the first badge (lowest ID after ascending sort)
            const firstBadge = userBadges[0];
            if (firstBadge && firstBadge.info && firstBadge.info.color) {
                const hex = firstBadge.info.color.replace('#', '');
                profileColor = parseInt(hex, 16);
            }

            const badgeStrings = userBadges.map(b => {
                const info = b.info;
                if (info) {
                    return `${info.icon || '🔹'} ${info.name}`;
                }
                return null;
            }).filter(Boolean);

            badgesDisplay = `**Acknowledgements**\n${badgeStrings.join('  |  ')}`;
        }

        // Check if user is admin/owner for delete button
        const OWNER_ID = '663231875707568139';
        const isOwner = interaction.user.id === OWNER_ID;

        const admins = require('../../utils/botData').contributors('admins');
        const isAdmin = admins.includes(interaction.user.id) || isOwner;

        // Build the main container with the badge color
        const profileContainer = new ContainerBuilder()
            .setAccentColor(profileColor)
            // Header: name + avatar
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ✔ ${player.username}'s Profile`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `> **Player ID:** \`#${player.playerNumber}\`\n> **User ID:** \`${player.playerId}\``
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder({
                            media: { url: targetUser.displayAvatarURL({ extension: 'png', size: 256 }) }
                        })
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            // Level + XP progress bar
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Level ${level.level}**\n` +
                    `${progressBar}\n` +
                    `${level.currentXP.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  •  ${safeProgress}%\n\n` +
                    `> -# **Total XP:** \`${level.totalXP.toLocaleString()} XP\``
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `> **Prestige Level**: ${prestige.prestigeLevel}\n` +
                    `> -# **Multiplier** \`${prestige.multiplier > 0 ? `${prestige.multiplier}x` : 'None'}\``
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`> **Registered**: \`${timeAgo}\``)
            );

        // Add badges section if user has any
        if (badgesDisplay) {
            profileContainer
                .addSeparatorComponents(
                    new SeparatorBuilder()
                        .setDivider(true)
                        .setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(badgesDisplay)
                );
        }

        // Footer
        profileContainer
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Requested by ${interaction.user.username}`)
            );

        // Add delete button if admin/owner
        if (isAdmin) {
            const deleteRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delete_player_${targetUser.id}`)
                        .setLabel('🗑️ Delete All Data')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.reply({
                components: [profileContainer, deleteRow],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({
                components: [profileContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

    } catch (error) {
        console.error('Error in handleProfile:', error);
        await interaction.reply({
            content: '❌ There was an error fetching your profile. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ LEVEL SUBCOMMAND ------------------
async function handleLevel(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const Player = models.Player;
    const Level = models.Level;
    const Prestige = models.Prestige;

    try {
        const player = await Player.findOne({
            where: { playerId: targetUser.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(targetUser)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const level = await Level.getOrCreate(targetUser.id);
        await level.fixXP();
        const progress = level.getProgress();
        const xpNeeded = level.getXPNeeded();

        const safeProgress = Math.min(Math.max(progress, 0), 100);

        // Emoji progress bar - 10 segments gives a good resolution for a percentage
        const progressBar = buildProgressBar(safeProgress, 100, 10);

        // Get prestige data
        const prestige = await Prestige.getOrCreate(targetUser.id);

        const levelContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## 📊 ${targetUser.username}'s Level`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Level:** ${level.level}\n` +
                            `**XP:** ${level.currentXP.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`
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
                    `**Progress:** ${safeProgress}%\n${progressBar}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**📈 Total XP**\n${level.totalXP.toLocaleString()} XP`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**⭐ Prestige Level**\n${prestige.prestigeLevel}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📊 Multiplier**\n${prestige.multiplier > 0 ? `${prestige.multiplier}x` : 'None'}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**👤 Player**\n#${player.playerNumber}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📅 Registered**\n<t:${Math.floor(player.registeredAt.getTime() / 1000)}:R>`
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
            components: [levelContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleLevel:', error);
        await interaction.reply({
            content: '❌ There was an error fetching your level data. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ LEADERBOARD SUBCOMMAND ------------------
async function handleLeaderboard(interaction) {
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 5; // 5 players per page
    const maxPlayers = 100; // Only show top 100
    const Level = models.Level;

    try {
        // Get top 100 players by level and totalXP
        const levels = await Level.findAll({
            order: [
                ['level', 'DESC'],
                ['totalXP', 'DESC']
            ],
            limit: maxPlayers
        });

        if (levels.length === 0) {
            return await interaction.reply({
                content: '📋 No players have earned XP yet!',
                flags: MessageFlags.Ephemeral
            });
        }

        const totalPages = Math.ceil(levels.length / pageSize);

        // Validate page number
        if (page < 1 || page > totalPages) {
            return await interaction.reply({
                content: `❌ Invalid page number! Please enter a page between 1 and ${totalPages}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Send the initial leaderboard
        await sendLeaderboardPage(interaction, page, levels, totalPages, true);

    } catch (error) {
        console.error('Error in handleLeaderboard:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ There was an error fetching the leaderboard. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

// Builds the Components V2 container for a leaderboard page
function buildLeaderboardContainer(pageLevels, playerMap, economyMap, start, validPage, totalPages, levels, maxPlayers) {
    const container = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## 🏆 Level Leaderboard')
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        );

    let rank = start + 1;

    pageLevels.forEach((level, i) => {
        const player = playerMap[level.playerId];
        const economy = economyMap[level.playerId];

        let medal;
        if (rank === 1) medal = '🥇';
        else if (rank === 2) medal = '🥈';
        else if (rank === 3) medal = '🥉';
        else medal = `#${rank}`;

        const username = player && player.isRegistered ? player.username : 'Unknown User';
        const playerNumber = player ? `#${player.playerNumber}` : 'N/A';
        const balance = economy ? economy.balance.toLocaleString() : '0';
        const levelNum = level.level;
        const totalXP = level.totalXP.toLocaleString();

        // Mini progress bar toward the next level for this player
        const progress = Math.min(Math.max(level.getProgress ? level.getProgress() : 0, 0), 100);
        const miniBar = buildProgressBar(progress, 100, 5);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${medal} **${username}**\n` +
                `> **Player ID:** ${playerNumber}\n` +
                `> **Balance:** ${balance} 🪙\n` +
                `> **Level:** ${levelNum} (${progress}% to next)\n` +
                `> ${miniBar}\n` +
                `> **Total XP:** ${totalXP} XP`
            )
        );

        if (i < pageLevels.length - 1) {
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            );
        }

        rank++;
    });

    container
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# Showing top ${Math.min(levels.length, maxPlayers)} players • Page ${validPage}/${totalPages}`
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('leaderboard_first')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(validPage === 1),
                new ButtonBuilder()
                    .setCustomId('leaderboard_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(validPage === 1),
                new ButtonBuilder()
                    .setCustomId('leaderboard_page')
                    .setLabel(`${validPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('leaderboard_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(validPage === totalPages),
                new ButtonBuilder()
                    .setCustomId('leaderboard_last')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(validPage === totalPages)
            )
        );

    return container;
}

// Helper function to send/update leaderboard page
async function sendLeaderboardPage(interaction, page, levels, totalPages, isInitial = false) {
    const pageSize = 5;
    const maxPlayers = 100;
    const Player = models.Player;
    const Economy = models.Economy;

    try {
        // Ensure page is within bounds
        const validPage = Math.max(1, Math.min(page, totalPages));

        const start = (validPage - 1) * pageSize;
        const end = Math.min(start + pageSize, levels.length);
        const pageLevels = levels.slice(start, end);

        const playerIds = pageLevels.map(l => l.playerId);
        const players = await Player.findAll({
            where: { playerId: playerIds }
        });
        const economies = await Economy.findAll({
            where: { playerId: playerIds }
        });

        const playerMap = {};
        players.forEach(p => {
            playerMap[p.playerId] = p;
        });

        const economyMap = {};
        economies.forEach(e => {
            economyMap[e.playerId] = e;
        });

        const leaderboardContainer = buildLeaderboardContainer(
            pageLevels, playerMap, economyMap, start, validPage, totalPages, levels, maxPlayers
        );

        // Send or update the message
        let message;
        let newInteraction = interaction;

        if (isInitial) {
            // Initial reply from slash command
            await interaction.reply({
                components: [leaderboardContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
            message = await interaction.fetchReply();
        } else if (interaction.isButton()) {
            // Button interaction - update the existing message
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    components: [leaderboardContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.update({
                    components: [leaderboardContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            message = await interaction.fetchReply();
        } else {
            // Fallback for other interactions
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    components: [leaderboardContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.reply({
                    components: [leaderboardContainer],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }
            message = await interaction.fetchReply();
        }

        // Remove existing collector if any
        if (message._collector) {
            message._collector.stop();
            delete message._collector;
        }

        // Create collector for button interactions
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === newInteraction.user.id,
            time: 120000 // 2 minutes
        });

        message._collector = collector;

        collector.on('collect', async (buttonInteraction) => {
            if (interactionBan(buttonInteraction)) return;
            let newPage = validPage;

            switch (buttonInteraction.customId) {
                case 'leaderboard_first':
                    newPage = 1;
                    break;
                case 'leaderboard_prev':
                    newPage = Math.max(1, validPage - 1);
                    break;
                case 'leaderboard_next':
                    newPage = Math.min(totalPages, validPage + 1);
                    break;
                case 'leaderboard_last':
                    newPage = totalPages;
                    break;
                default:
                    await buttonInteraction.deferUpdate();
                    return;
            }

            // Only update if the page actually changed
            if (newPage !== validPage) {
                // Stop the current collector
                collector.stop();
                // Send the new page using the button interaction
                await sendLeaderboardPage(buttonInteraction, newPage, levels, totalPages, false);
            } else {
                // No change needed, just acknowledge
                await buttonInteraction.deferUpdate();
            }
        });

        collector.on('end', async () => {
            // Rebuild the container with all nav buttons disabled
            const finalContainer = buildLeaderboardContainer(
                pageLevels, playerMap, economyMap, start, validPage, totalPages, levels, maxPlayers
            );

            const components = finalContainer.components;
            const actionRow = components[components.length - 1];
            if (actionRow && actionRow.components) {
                for (const btn of actionRow.components) {
                    btn.data.disabled = true;
                }
            }

            try {
                await message.edit({
                    components: [finalContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (error) {
                // Ignore if message was deleted
            }
        });

    } catch (error) {
        console.error('Error in sendLeaderboardPage:', error);
        // Try to handle the error gracefully
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: '❌ There was an error fetching the leaderboard. Please try again.',
                    flags: MessageFlags.Ephemeral
                });
            } else if (interaction.isButton()) {
                await interaction.editReply({
                    content: '❌ There was an error fetching the leaderboard. Please try again.',
                    components: []
                });
            }
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
}