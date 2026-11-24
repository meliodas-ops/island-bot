// events/interactionCreate.js
const { EmbedBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { models } = require('../utils/database');
const { settings, contributors } = require('../utils/botData');
const commandsData = settings('commands');
const owners = contributors('owners');
const admins = contributors('admins');
const testers = contributors('testers');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            const commandName = interaction.commandName;
            const commandData = commandsData[commandName];
            const userId = interaction.user.id;

            // CHECK: Is this command disabled?
            if (commandData?.disabled === true) {
                const disabledEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚫 Command Disabled')
                    .setDescription(`The \`/${commandName}\` command is currently disabled.`)
                    .addFields(
                        { name: 'Reason', value: 'This command has been temporarily disabled by the bot owner.', inline: false },
                        { name: 'Try Again Later', value: 'Please check back later when the command is re-enabled.' }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Command Disabled' });

                return await interaction.reply({
                    embeds: [disabledEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            // CHECK: Is this command owner-only?
            if (commandData?.ownerOnly === true) {
                if (!owners.includes(userId)) {
                    const ownerOnlyEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('👑 Owner Only Command')
                        .setDescription(`The \`/${commandName}\` command is restricted to the bot owner.`)
                        .addFields(
                            { name: 'Permission Required', value: '👑 Bot Owner', inline: true },
                            { name: 'Your Status', value: '❌ Not Authorized', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Owner Only' });

                    return await interaction.reply({
                        embeds: [ownerOnlyEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // CHECK: Is this command admin-only?
            if (commandData?.adminOnly === true) {
                const isAdmin = admins.includes(userId) || owners.includes(userId);
                if (!isAdmin) {
                    const adminOnlyEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🛡️ Admin Only Command')
                        .setDescription(`The \`/${commandName}\` command is restricted to administrators.`)
                        .addFields(
                            { name: 'Permission Required', value: '🛡️ Admin', inline: true },
                            { name: 'Your Status', value: '❌ Not Authorized', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Admin Only' });

                    return await interaction.reply({
                        embeds: [adminOnlyEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // CHECK: Is this command tester-only?
            if (commandData?.testerOnly === true) {
                const isTester = testers.includes(userId) || admins.includes(userId) || owners.includes(userId);
                if (!isTester) {
                    const testerOnlyEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('🧪 Tester Only Command')
                        .setDescription(`The \`/${commandName}\` command is restricted to testers.`)
                        .addFields(
                            { name: 'Permission Required', value: '🧪 Tester', inline: true },
                            { name: 'Your Status', value: '❌ Not Authorized', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Tester Only' });

                    return await interaction.reply({
                        embeds: [testerOnlyEmbed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // CHECK: Is this command restricted to support server?
            const supportGuildId = process.env.GUILD_ID;
            if (command.supportServer === true && interaction.guildId !== supportGuildId) {
                const supportEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Support Server Only')
                    .setDescription(`The \`/${commandName}\` command is only available in the official support server.`)
                    .addFields(
                        { name: 'Where to Use', value: 'Join the support server to use this command.', inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Support Server Only' });

                return await interaction.reply({
                    embeds: [supportEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                const reply = {
                    content: 'There was an error executing this command!',
                    flags: MessageFlags.Ephemeral
                };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
            return;
        }

        // Handle button interactions
        if (interaction.isButton()) {
            const Player = models.Player;
            const Economy = models.Economy;
            const Level = models.Level;
            const PromoRedemption = models.PromoRedemption;

            // Handle registration acceptance
            if (interaction.customId.startsWith('accept_rules_')) {
                try {
                    const userId = interaction.customId.split('_')[2];

                    if (interaction.user.id !== userId) {
                        return await interaction.reply({
                            content: '❌ This registration is for another user!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const player = await Player.findOne({
                        where: { playerId: interaction.user.id }
                    });

                    if (!player) {
                        return await interaction.reply({
                            content: '❌ You need to run `/player register` first!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (player.isRegistered) {
                        return await interaction.reply({
                            content: '✅ You are already registered!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await player.completeRegistration();

                    // Give 1000 coins bonus
                    const economy = await Economy.getOrCreate(interaction.user.id);
                    await economy.addBalance(1000, 'registration_bonus');

                    // Create level record
                    const level = await Level.getOrCreate(interaction.user.id);

                    // Create Components V2 container instead of embed
                    const successContainer = new ContainerBuilder()
                        .setAccentColor(0x00FF00)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('## ✅ Registration Complete!')
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`**${interaction.user.username}**, you are now registered as a player!`)
                        )
                        .addSeparatorComponents(
                            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Player Number:** #${player.playerNumber}\n` +
                                `**💰 Bonus:** 1000 coins\n` +
                                `**📊 Level:** Level ${level.level}\n` +
                                `**Username:** ${player.username}\n` +
                                `**Registered At:** <t:${Math.floor(player.registeredAt.getTime() / 1000)}:F>`
                            )
                        )
                        .addSeparatorComponents(
                            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('-# Welcome to the game! 🎮')
                        );

                    await interaction.update({
                        components: [successContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (error) {
                    console.error('Error in accept_rules_ handler:', error);
                    try {
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({
                                content: '❌ There was an error completing your registration. Please try again or contact support.',
                                flags: MessageFlags.Ephemeral
                            });
                        } else {
                            await interaction.reply({
                                content: '❌ There was an error completing your registration. Please try again or contact support.',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    } catch (e) {
                        console.error('Failed to send error message for accept_rules_:', e);
                    }
                }
                return;
            }

            // ==================== DELETE PLAYER BUTTON ====================
            if (interaction.customId.startsWith('delete_player_')) {
                const targetUserId = interaction.customId.split('_')[2];
                const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
                const OWNER_ID = '663231875707568139';

                // Check if user has permission
                const isOwner = interaction.user.id === OWNER_ID;
                const adminsList = contributors('admins');
                const isAdmin = adminsList.includes(interaction.user.id) || isOwner;

                if (!isAdmin) {
                    return await interaction.reply({
                        content: '❌ You do not have permission to delete player data!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Show confirmation using a Components V2 container. The message being
                // edited (the profile) was originally sent with IsComponentsV2, so every
                // subsequent update must also use components + that flag — an 'embeds'
                // field can never be mixed into a message once it's in V2 mode.
                const confirmContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('## ⚠️ WARNING: Delete All Data')
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `Are you sure you want to delete **ALL** data for ${targetUser ? targetUser.username : targetUserId}?`
                        )
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**This will delete:**\n` +
                            `• All coins\n• All XP\n• Level progress\n• Cooldowns\n• Daily streak\n• Promo code redemptions`
                        )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**⚠️ This action cannot be undone!**\nClick confirm to proceed.`
                        )
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`confirm_delete_${targetUserId}`)
                                .setLabel('⚠️ Confirm Delete')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🗑️'),
                            new ButtonBuilder()
                                .setCustomId(`cancel_delete_${targetUserId}`)
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('❌')
                        )
                    );

                await interaction.update({
                    components: [confirmContainer],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // ==================== CONFIRM DELETE ====================
            if (interaction.customId.startsWith('confirm_delete_')) {
                const targetUserId = interaction.customId.split('_')[2];
                const { Economy, Level, Player, PromoRedemption } = models;

                try {
                    // Delete all data
                    let deleted = [];

                    const economy = await Economy.findOne({ where: { playerId: targetUserId } });
                    const level = await Level.findOne({ where: { playerId: targetUserId } });
                    const player = await Player.findOne({ where: { playerId: targetUserId } });

                    if (economy) {
                        await economy.destroy();
                        deleted.push('Economy data (coins, cooldowns, streak)');
                    }
                    if (level) {
                        await level.destroy();
                        deleted.push('Level data (XP, level)');
                    }
                    // Optional: uncomment to delete player registration
                    // if (player) {
                    //     await player.destroy();
                    //     deleted.push('Player registration');
                    // }

                    const redemptions = await PromoRedemption.findAll({ where: { playerId: targetUserId } });
                    if (redemptions.length > 0) {
                        await PromoRedemption.destroy({ where: { playerId: targetUserId } });
                        deleted.push(`${redemptions.length} promo redemption(s)`);
                    }

                    if (deleted.length === 0) {
                        const noDataContainer = new ContainerBuilder()
                            .setAccentColor(0xFFA500)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('## ℹ️ No Data Found')
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`No data found for <@${targetUserId}>.`)
                            );

                        return await interaction.update({
                            components: [noDataContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }

                    const successContainer = new ContainerBuilder()
                        .setAccentColor(0x00FF00)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('## 🗑️ Data Deleted Successfully')
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`All data has been deleted for <@${targetUserId}>`)
                        )
                        .addSeparatorComponents(
                            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Deleted:**\n${deleted.map(d => `• ${d}`).join('\n')}`
                            )
                        );

                    await interaction.update({
                        components: [successContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (error) {
                    console.error('Error deleting user data:', error);
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('## ❌ Error')
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('Error deleting data. Please try again.')
                        );

                    await interaction.update({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
                return;
            }

            // ==================== CANCEL DELETE ====================
            if (interaction.customId.startsWith('cancel_delete_')) {
                const cancelledContainer = new ContainerBuilder()
                    .setAccentColor(0xFFA500)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('## ❌ Deletion Cancelled')
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('The deletion has been cancelled.')
                    );

                await interaction.update({
                    components: [cancelledContainer],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // IMPORTANT: Do NOT handle these buttons here!
            // They are handled by their respective collectors:
            // - leaderboard_* : handled by player.js
            // - refresh_cooldowns_* : handled by cooldowns.js
            // - guide_* : handled by guide.js
            // - changelog_* : handled by changelogs.js
            // - bot_info / bot_database : handled by bot.js (community command)
            // - mine_* : handled by gamble.js (mine subcommand)
            const isHandledByCollector =
                interaction.customId.startsWith('leaderboard_') ||
                interaction.customId.startsWith('refresh_cooldowns_') ||
                interaction.customId.startsWith('guide_') ||
                interaction.customId.startsWith('changelog_') ||
                interaction.customId.startsWith('mine_') ||
                interaction.customId === 'bot_info' ||
                interaction.customId === 'bot_database';

            if (isHandledByCollector) {
                // Let the collector handle it - do nothing here
                return;
            }

            // If no button handler matched, acknowledge
            await interaction.deferUpdate();
        }
    }
};