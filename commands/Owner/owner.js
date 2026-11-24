const { interactionBan } = require('../../utils/bans');
// commands/Owner/owner.js
const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const { models } = require('../../utils/database');
const { getEmoji } = require('../../utils/emojis');
const { generateUniqueCode } = require('../../utils/promoCode');

const OWNER_ID = '663231875707568139';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Owner only commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('restart-bot')
            .setDescription('Restart the bot')
        )
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('View bot statistics')
        )
        .addSubcommandGroup(group => group
            .setName('promocode')
            .setDescription('Manage promo codes')
            .addSubcommand(sub => sub
                .setName('create')
                .setDescription('Create a new promo code')
                .addStringOption(option =>
                    option.setName('currency')
                        .setDescription('What the code gives (coin, xp, or coin,xp)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Coins', value: 'coin' },
                            { name: 'XP', value: 'xp' },
                            { name: 'Coins & XP', value: 'coin,xp' }
                        )
                )
                .addStringOption(option =>
                    option.setName('amount')
                        .setDescription('Amount (e.g., "100", "random 100-200")')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('custom')
                        .setDescription('Custom code (leave empty for auto-generated)')
                        .setRequired(false)
                        .setMaxLength(16)
                )
                .addIntegerOption(option =>
                    option.setName('uses')
                        .setDescription('Max uses (leave empty for unlimited)')
                        .setRequired(false)
                        .setMinValue(1)
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User this code is restricted to (optional)')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('expires')
                        .setDescription('Days until expiry (optional)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(365)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description for the code (optional)')
                        .setRequired(false)
                        .setMaxLength(200)
                )
            )
            .addSubcommand(sub => sub
                .setName('list')
                .setDescription('List all promo codes')
                .addIntegerOption(option =>
                    option.setName('page')
                        .setDescription('Page number')
                        .setRequired(false)
                        .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('delete')
                .setDescription('Delete a promo code')
                .addStringOption(option =>
                    option.setName('code')
                        .setDescription('The promo code to delete')
                        .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('toggle')
                .setDescription('Enable or disable a promo code')
                .addStringOption(option =>
                    option.setName('code')
                        .setDescription('The promo code to toggle')
                        .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('info')
                .setDescription('Get info about a promo code')
                .addStringOption(option =>
                    option.setName('code')
                        .setDescription('The promo code to check')
                        .setRequired(true)
                )
            )
        )
        .addSubcommandGroup(group => group
            .setName('coin')
            .setDescription('Manage user coins (Owner only)')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add coins to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to add coins to')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of coins to add')
                        .setRequired(true)
                        .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('set')
                .setDescription('Set a user\'s coins to a specific amount')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to set coins for')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to set')
                        .setRequired(true)
                        .setMinValue(0)
                )
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove coins from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove coins from')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of coins to remove')
                        .setRequired(true)
                        .setMinValue(1)
                )
            )
            .addSubcommand(sub => sub
                .setName('reset')
                .setDescription('Reset a user\'s coins to 0')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to reset coins for')
                        .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('delete')
                .setDescription('Delete a user\'s entire economy data (coins, stats, etc.)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to delete data for')
                        .setRequired(true)
                )
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

        // Check if it's a subcommand group
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        if (subcommandGroup === 'promocode') {
            // Handle promo code subcommands
            switch (subcommand) {
                case 'create':
                    await handlePromoCreate(interaction);
                    break;
                case 'list':
                    await handlePromoList(interaction);
                    break;
                case 'delete':
                    await handlePromoDelete(interaction);
                    break;
                case 'toggle':
                    await handlePromoToggle(interaction);
                    break;
                case 'info':
                    await handlePromoInfo(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand!',
                        flags: MessageFlags.Ephemeral
                    });
            }
            return;
        }

        if (subcommandGroup === 'coin') {
            // Handle coin subcommands
            switch (subcommand) {
                case 'add':
                    await handleCoinAdd(interaction);
                    break;
                case 'set':
                    await handleCoinSet(interaction);
                    break;
                case 'remove':
                    await handleCoinRemove(interaction);
                    break;
                case 'reset':
                    await handleCoinReset(interaction);
                    break;
                case 'delete':
                    await handleCoinDelete(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand!',
                        flags: MessageFlags.Ephemeral
                    });
            }
            return;
        }

        // Handle regular owner subcommands
        switch (subcommand) {
            case 'restart-bot':
                await handleRestart(interaction);
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
    },

};

// Helper functions
function getRestartEmoji() {
    return getEmoji('restart') || '🔄';
}

function getStatsEmoji() {
    return getEmoji('stats') || '📊';
}


// Simple single-message container for quick success/error replies
function buildSimpleContainer(title, description, color) {
    return new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${title}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description)
        );
}

// ==================== RESTART BOT ====================
async function handleRestart(interaction) {
    const restartEmoji = getRestartEmoji();

    // Build restart confirmation container
    const restartContainer = new ContainerBuilder()
        .setAccentColor(0xFFA500)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${restartEmoji} Bot Restart Initiated`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `The bot is being restarted. This may take a few seconds...\n\n` +
                `**⚠️ Warning**\n` +
                `All running processes will be terminated and restarted.`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Initiated By**\n${interaction.user.tag}\n\n` +
                `**Time**\n${new Date().toLocaleString()}`
            )
        );

    await interaction.reply({
        components: [restartContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });

    // Log the restart
    console.log(`🔄 Bot restart initiated by ${interaction.user.tag}`);

    // Gracefully restart the bot
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// ==================== STATS ====================
async function handleStats(interaction) {
    const statsEmoji = getStatsEmoji();
    const client = interaction.client;

    try {
        const Player = models.Player;
        const Economy = models.Economy;
        const PromoCode = models.PromoCode;

        const playerCount = await Player.count();
        const economyCount = await Economy.count();
        const promoCodeCount = await PromoCode.count();
        const guildCount = client.guilds.cache.size;
        const userCount = client.users.cache.size;
        const channelCount = client.channels.cache.size;

        // Calculate total coins in circulation
        const economies = await Economy.findAll();
        let totalBalances = 0;
        economies.forEach(econ => {
            totalBalances += econ.balance || 0;
        });

        // Memory usage
        const memoryUsage = process.memoryUsage();
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);

        // Uptime
        const uptime = process.uptime();
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = Math.floor(uptime % 60);
        const uptimeString = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;

        const statsContainer = new ContainerBuilder()
            .setAccentColor(0x00BFFF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${statsEmoji} Bot Statistics`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📊 Server Stats**\n` +
                    `• Guilds: ${guildCount}\n` +
                    `• Users: ${userCount}\n` +
                    `• Channels: ${channelCount}\n\n` +
                    `**💰 Economy Stats**\n` +
                    `• Registered Players: ${playerCount}\n` +
                    `• Economy Records: ${economyCount}\n` +
                    `• Total Coins in Circulation: ${totalBalances.toLocaleString()}\n\n` +
                    `**🎫 Promo Code Stats**\n` +
                    `• Total Promo Codes: ${promoCodeCount}\n\n` +
                    `**⚙️ System Stats**\n` +
                    `• Uptime: ${uptimeString}\n` +
                    `• Heap Used: ${heapUsed} MB\n` +
                    `• Heap Total: ${heapTotal} MB\n` +
                    `• RSS: ${rss} MB\n\n` +
                    `**🕒 Last Updated**\n${new Date().toLocaleString()}`
                )
            );

        await interaction.reply({
            components: [statsContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleStats:', error);
        await interaction.reply({
            content: '❌ Failed to fetch statistics.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== PROMO CODE - CREATE ====================
async function handlePromoCreate(interaction) {
    const PromoCode = models.PromoCode;

    const currency = interaction.options.getString('currency');
    const amount = interaction.options.getString('amount');
    const customCode = interaction.options.getString('custom');
    const uses = interaction.options.getInteger('uses') || null;
    const user = interaction.options.getUser('user') || null;
    const expires = interaction.options.getInteger('expires') || null;
    const description = interaction.options.getString('description') || null;

    try {
        let code;

        if (customCode) {
            code = customCode.toUpperCase();
            const existing = await PromoCode.findOne({ where: { code } });
            if (existing) {
                return await interaction.reply({
                    components: [buildSimpleContainer(
                        '❌ Code Already Exists',
                        `The code \`${code}\` already exists! Please use a different code.`,
                        0xFF0000
                    )],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });
            }
        } else {
            const length = 8;
            code = await generateUniqueCode(length);
        }

        let expiresAt = null;
        if (expires) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expires);
        }

        const promoCode = await PromoCode.sequelize.transaction(transaction => PromoCode.create({
            code,
            uses,
            userId: user ? user.id : null,
            currency,
            amount,
            createdBy: interaction.user.id,
            expiresAt,
            description,
            isActive: true,
            usedCount: 0
        }, { transaction }));

        const container = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ✅ Promo Code Created!')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`Code: \`${code}\``)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Currency:** ${currency}\n` +
                    `**Amount:** ${amount}\n` +
                    `**Uses:** ${uses ? `${uses} uses` : 'Unlimited'}\n` +
                    `**Restricted To:** ${user ? `<@${user.id}>` : 'Anyone'}\n` +
                    `**Expires:** ${expires ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Never'}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Description**\n${description || 'None'}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Created by ${interaction.user.username}`)
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error creating promo code:', error);
        await interaction.reply({
            content: `❌ Error creating promo code: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== PROMO CODE - LIST ====================
async function handlePromoList(interaction) {
    const PromoCode = models.PromoCode;
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;

    try {
        const { count, rows: codes } = await PromoCode.findAndCountAll({
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize
        });

        if (codes.length === 0) {
            return await interaction.reply({
                content: '📋 No promo codes found!',
                flags: MessageFlags.Ephemeral
            });
        }

        const totalPages = Math.ceil(count / pageSize);

        let list = '';
        codes.forEach((code) => {
            const status = code.isActive ? '🟢' : '🔴';
            const expiry = code.expiresAt && new Date() > code.expiresAt ? ' (Expired)' : '';
            const user = code.userId ? `<@${code.userId}>` : 'Anyone';
            const uses = code.uses ? `${code.usedCount}/${code.uses}` : `${code.usedCount}/∞`;
            list += `**${status}** \`${code.code}\` • ${uses} uses • ${user}${expiry}\n`;
        });

        const container = new ContainerBuilder()
            .setAccentColor(0x0099FF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 📋 Promo Codes (${count} total)`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(list || 'No codes on this page')
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Page ${page}/${totalPages} • ${pageSize} per page`)
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error listing promo codes:', error);
        await interaction.reply({
            content: `❌ Error listing promo codes: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== PROMO CODE - DELETE ====================
async function handlePromoDelete(interaction) {
    const PromoCode = models.PromoCode;
    const code = interaction.options.getString('code').toUpperCase();

    try {
        const promoCode = await PromoCode.findOne({ where: { code } });

        if (!promoCode) {
            return await interaction.reply({
                components: [buildSimpleContainer('❌ Code Not Found', `Promo code \`${code}\` not found!`, 0xFF0000)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        await promoCode.destroy();

        await interaction.reply({
            components: [buildSimpleContainer('✅ Promo Code Deleted', `Promo code \`${code}\` has been deleted!`, 0x00FF00)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error deleting promo code:', error);
        await interaction.reply({
            content: `❌ Error deleting promo code: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== PROMO CODE - TOGGLE ====================
async function handlePromoToggle(interaction) {
    const PromoCode = models.PromoCode;
    const code = interaction.options.getString('code').toUpperCase();

    try {
        const promoCode = await PromoCode.findOne({ where: { code } });

        if (!promoCode) {
            return await interaction.reply({
                components: [buildSimpleContainer('❌ Code Not Found', `Promo code \`${code}\` not found!`, 0xFF0000)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        promoCode.isActive = !promoCode.isActive;
        await promoCode.save();

        await interaction.reply({
            components: [buildSimpleContainer(
                '✅ Promo Code Toggled',
                `Promo code \`${code}\` is now **${promoCode.isActive ? 'enabled' : 'disabled'}**!`,
                0x00FF00
            )],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error toggling promo code:', error);
        await interaction.reply({
            content: `❌ Error toggling promo code: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== PROMO CODE - INFO ====================
async function handlePromoInfo(interaction) {
    const PromoCode = models.PromoCode;
    const code = interaction.options.getString('code').toUpperCase();

    try {
        const promoCode = await PromoCode.findOne({ where: { code } });

        if (!promoCode) {
            return await interaction.reply({
                components: [buildSimpleContainer('❌ Code Not Found', `Promo code \`${code}\` not found!`, 0xFF0000)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const status = promoCode.isActive ? '🟢 Active' : '🔴 Disabled';
        const uses = promoCode.uses ? `${promoCode.usedCount}/${promoCode.uses}` : `${promoCode.usedCount}/∞`;
        const expiry = promoCode.expiresAt ? `<t:${Math.floor(promoCode.expiresAt.getTime() / 1000)}:F>` : 'Never';
        const user = promoCode.userId ? `<@${promoCode.userId}>` : 'Anyone';
        const created = `<t:${Math.floor(promoCode.createdAt.getTime() / 1000)}:F>`;

        const container = new ContainerBuilder()
            .setAccentColor(0x0099FF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 📋 Promo Code Info: \`${promoCode.code}\``)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Status:** ${status}\n` +
                    `**Uses:** ${uses}\n` +
                    `**Restricted To:** ${user}\n` +
                    `**Currency:** ${promoCode.currency}\n` +
                    `**Amount:** ${promoCode.amount}\n` +
                    `**Expires:** ${expiry}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Created By:** <@${promoCode.createdBy}>\n` +
                    `**Created At:** ${created}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Description**\n${promoCode.description || 'None'}`)
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error getting promo code info:', error);
        await interaction.reply({
            content: `❌ Error getting promo code info: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== COIN - ADD ====================
async function handleCoinAdd(interaction) {
    const Economy = models.Economy;
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
        const economy = await Economy.getOrCreate(user.id);
        await economy.addBalance(amount, 'admin_add');

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Coins Added!')
            .setDescription(`Added **${amount}** coins to ${user.username}`)
            .addFields(
                { name: 'New Balance', value: `${economy.balance.toLocaleString()} 🪙`, inline: true },
                { name: 'User', value: `<@${user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleCoinAdd:', error);
        await interaction.reply({
            content: '❌ Error adding coins. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== COIN - SET ====================
async function handleCoinSet(interaction) {
    const Economy = models.Economy;
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
        const economy = await Economy.getOrCreate(user.id);
        const oldBalance = economy.balance;
        const oldTotalEarned = economy.totalEarned;
        await economy.setBalance(amount, { source: 'admin_set', resetTotals: true });

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Coins Set!')
            .setDescription(`Set ${user.username}'s coins to **${amount}** 🪙`)
            .addFields(
                { name: 'Previous Balance', value: `${oldBalance.toLocaleString()} 🪙`, inline: true },
                { name: 'Previous Total Earned', value: `${oldTotalEarned.toLocaleString()} 🪙`, inline: true },
                { name: 'New Balance', value: `${economy.balance.toLocaleString()} 🪙`, inline: true },
                { name: 'New Total Earned', value: `${economy.totalEarned.toLocaleString()} 🪙`, inline: true },
                { name: 'Total Spent (Reset)', value: `${economy.totalSpent.toLocaleString()} 🪙`, inline: true },
                { name: 'User', value: `<@${user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleCoinSet:', error);
        await interaction.reply({
            content: '❌ Error setting coins. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== COIN - REMOVE ====================
async function handleCoinRemove(interaction) {
    const Economy = models.Economy;
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    try {
        const economy = await Economy.getOrCreate(user.id);

        if (economy.balance < amount) {
            return await interaction.reply({
                content: `❌ ${user.username} only has ${economy.balance.toLocaleString()} 🪙. Cannot remove ${amount} 🪙.`,
                flags: MessageFlags.Ephemeral
            });
        }

        await economy.removeBalance(amount, 'admin_remove');

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('✅ Coins Removed!')
            .setDescription(`Removed **${amount}** coins from ${user.username}`)
            .addFields(
                { name: 'New Balance', value: `${economy.balance.toLocaleString()} 🪙`, inline: true },
                { name: 'User', value: `<@${user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleCoinRemove:', error);
        await interaction.reply({
            content: '❌ Error removing coins. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== COIN - RESET ====================
async function handleCoinReset(interaction) {
    const Economy = models.Economy;
    const user = interaction.options.getUser('user');

    try {
        const economy = await Economy.getOrCreate(user.id);
        const oldBalance = economy.balance;
        await economy.setBalance(0, { source: 'admin_reset' });

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🔄 Coins Reset!')
            .setDescription(`Reset ${user.username}'s coins to **0** 🪙`)
            .addFields(
                { name: 'Previous Balance', value: `${oldBalance.toLocaleString()} 🪙`, inline: true },
                { name: 'User', value: `<@${user.id}>`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleCoinReset:', error);
        await interaction.reply({
            content: '❌ Error resetting coins. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ==================== COIN - DELETE ====================
async function handleCoinDelete(interaction) {
    const { Economy, Level, Player, PromoRedemption } = models;
    const user = interaction.options.getUser('user');

    // Check if user has any data
    const economy = await Economy.findOne({ where: { playerId: user.id } });
    const level = await Level.findOne({ where: { playerId: user.id } });
    const player = await Player.findOne({ where: { playerId: user.id } });

    if (!economy && !level && !player) {
        return await interaction.reply({
            content: `❌ ${user.username} has no data to delete.`,
            flags: MessageFlags.Ephemeral
        });
    }

    // Build confirmation embed
    const confirmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ WARNING: Delete All Data')
        .setDescription(`Are you sure you want to delete **ALL** economy data for ${user.username}?`)
        .addFields(
            { name: 'This will delete:', value: '• All coins\n• All XP\n• Level progress\n• Cooldowns\n• Daily streak\n• Promo code redemptions', inline: false },
            { name: '⚠️ This action cannot be undone!', value: 'Click the confirm button to proceed.' }
        )
        .setTimestamp();

    // Create confirmation buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_delete_${user.id}`)
                .setLabel('⚠️ Confirm Delete All Data')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        )
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`cancel_delete_${user.id}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

    const reply = await interaction.reply({
        embeds: [confirmEmbed],
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    // Create collector for confirmation
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000 // 1 minute
    });

    collector.on('collect', async (i) => {
        if (interactionBan(i)) return;
        if (i.customId === `cancel_delete_${user.id}`) {
            await i.update({
                content: '❌ Deletion cancelled.',
                embeds: [],
                components: []
            });
            return;
        }

        if (i.customId === `confirm_delete_${user.id}`) {
            await i.deferUpdate();

            try {
                // Delete all data
                let deleted = [];

                // Delete economy data
                if (economy) {
                    await economy.destroy();
                    deleted.push('Economy data (coins, cooldowns, streak)');
                }

                // Delete level data
                if (level) {
                    await level.destroy();
                    deleted.push('Level data (XP, level)');
                }

                // Delete promo code redemptions
                const redemptions = await PromoRedemption.findAll({ where: { playerId: user.id } });
                if (redemptions.length > 0) {
                    await PromoRedemption.destroy({ where: { playerId: user.id } });
                    deleted.push(`${redemptions.length} promo code redemption(s)`);
                }

                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🗑️ Data Deleted Successfully')
                    .setDescription(`All data has been deleted for ${user.username}`)
                    .addFields(
                        { name: 'Deleted:', value: deleted.map(d => `• ${d}`).join('\n'), inline: false },
                        { name: 'User', value: `<@${user.id}>`, inline: true }
                    )
                    .setTimestamp();

                await i.editReply({
                    embeds: [successEmbed],
                    components: []
                });

            } catch (error) {
                console.error('Error deleting user data:', error);
                await i.editReply({
                    content: '❌ Error deleting data. Please try again.',
                    embeds: [],
                    components: []
                });
            }
        }
    });

    collector.on('end', async () => {
        // Disable buttons after timeout
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_delete_${user.id}`)
                    .setLabel('⚠️ Confirm Delete All Data')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`cancel_delete_${user.id}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
                    .setDisabled(true)
            );

        await interaction.editReply({
            components: [disabledRow]
        }).catch(() => { });
    });
}
