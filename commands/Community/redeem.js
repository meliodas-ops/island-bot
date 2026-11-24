// commands/Community/redeem.js
const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');
const { models } = require('../../utils/database');
const { applyPromoCode, getUserRedemptions } = require('../../utils/promoCode');
const { getEmoji } = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem or view your redeemed promo codes')
        .addSubcommand(sub => sub
            .setName('redeem')
            .setDescription('Redeem a promo code')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('The promo code to redeem')
                    .setRequired(true)
                    .setMaxLength(16)
            )
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all promo codes you have claimed')
            .addIntegerOption(option =>
                option.setName('page')
                    .setDescription('Page number')
                    .setRequired(false)
                    .setMinValue(1)
            )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'redeem':
                await handleRedeem(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown subcommand!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
};

// Get the promoTicket emoji
function getPromoTicketEmoji() {
    return getEmoji('promoTicket');
}

// ------------------ REDEEM SUBCOMMAND ------------------
async function handleRedeem(interaction) {
    const code = interaction.options.getString('code');
    const userId = interaction.user.id;
    const promoTicket = getPromoTicketEmoji();

    // Check if user is registered
    const Player = models.Player;
    const player = await Player.findOne({
        where: { playerId: userId }
    });

    if (!player || !player.isRegistered) {
        const notRegisteredContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ❌ Player Not Registered')
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `You need to register first!\n\n**How to Register**\nUse \`/player register\` to become a player!`
                )
            );

        return await interaction.reply({
            components: [notRegisteredContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }

    // Apply the promo code
    const result = await applyPromoCode(code, userId);

    const resultContainer = new ContainerBuilder()
        .setAccentColor(result.success ? 0x00FF00 : 0xFF0000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${result.success ? `${promoTicket} Promo Code Redeemed!` : '❌ Redemption Failed'}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(result.message)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Code: \`${code}\` • Redeemed by ${interaction.user.username}`)
        );

    await interaction.reply({
        components: [resultContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
}

// ------------------ LIST SUBCOMMAND ------------------
async function handleList(interaction) {
    const userId = interaction.user.id;
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;
    const promoTicket = getPromoTicketEmoji();

    try {
        // Check if user is registered
        const Player = models.Player;
        const player = await Player.findOne({
            where: { playerId: userId }
        });

        if (!player || !player.isRegistered) {
            const notRegisteredContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## ❌ Player Not Registered')
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `You need to register first!\n\n**How to Register**\nUse \`/player register\` to become a player!`
                    )
                );

            return await interaction.reply({
                components: [notRegisteredContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        // Get user's redemptions
        const result = await getUserRedemptions(userId, page, pageSize);
        const { count, rows, totalPages } = result;

        if (!rows || rows.length === 0) {
            const noCodesContainer = new ContainerBuilder()
                .setAccentColor(0xFFA500)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${promoTicket} Your Redeemed Codes`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `You haven't redeemed any promo codes yet!\n\n` +
                        `**How to Redeem**\nUse \`/redeem redeem code:<code>\` to redeem a promo code!`
                    )
                );

            return await interaction.reply({
                components: [noCodesContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        let listContent = '';
        rows.forEach((redemption, index) => {
            const code = redemption.PromoCode;
            const date = `<t:${Math.floor(redemption.redeemedAt.getTime() / 1000)}:R>`;

            // Handle case where PromoCode might be null (if the code was deleted)
            if (code && code.code) {
                const reward = redemption.reward || `${code.currency}: ${code.amount}`;
                listContent += `${index + 1 + (page - 1) * pageSize}. ${promoTicket} \`${code.code}\` • ${reward} • ${date}\n`;
            } else {
                // Promo code was deleted but redemption record exists
                listContent += `${index + 1 + (page - 1) * pageSize}. ❌ \`DELETED\` • ${redemption.reward || 'Unknown reward'} • ${date}\n`;
            }
        });

        const listContainer = new ContainerBuilder()
            .setAccentColor(0x0099FF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${promoTicket} Your Redeemed Codes (${count} total)`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(listContent || 'No codes on this page')
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Page ${page}/${totalPages} • ${pageSize} per page`)
            );

        await interaction.reply({
            components: [listContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error listing redeemed codes:', error);

        // Send a user-friendly error message
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## ❌ Error')
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    'There was an error fetching your redeemed codes. Please try again later.'
                )
            );

        await interaction.reply({
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
}