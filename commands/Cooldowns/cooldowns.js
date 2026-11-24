const { interactionBan } = require('../../utils/bans');
// commands/Cooldowns/cooldowns.js
const {
    SlashCommandBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');
const { models } = require('../../utils/database');
const { buildProgressBar } = require('../../utils/progressBar');
const { getEmoji } = require('../../utils/emojis');

// Helper function to format cooldown time
function formatCooldown(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let timeString = '';
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}m `;
    if (secs > 0) timeString += `${secs}s`;
    if (!timeString) timeString = '0s';
    return timeString;
}

// Get emojis
function getCoinEmoji() {
    return getEmoji('common-coin');
}

// Builds the full Components V2 container for the cooldowns display
async function buildCooldownContainer(targetUser, player, economy, requestUser) {
    const coin = getCoinEmoji();

    // Check work cooldown
    const canWork = await economy.canWork();
    let workStatus = '✅ Available';
    if (!canWork) {
        const seconds = await economy.getWorkCooldown();
        workStatus = `⏳ ${formatCooldown(seconds)}`;
    }

    // Check beg cooldown
    const canBeg = await economy.canBeg();
    let begStatus = '✅ Available';
    if (!canBeg) {
        const seconds = await economy.getBegCooldown();
        begStatus = `⏳ ${formatCooldown(seconds)}`;
    }

    // Check rob cooldown
    const canRob = await economy.canRob();
    let robStatus = '✅ Available';
    if (!canRob) {
        const seconds = await economy.getRobCooldown();
        robStatus = `⏳ ${formatCooldown(seconds)}`;
    }

    // Check gamble cooldown
    const canGamble = await economy.canGamble();
    let gambleStatus = '✅ Available';
    if (!canGamble) {
        const seconds = await economy.getGambleCooldown();
        gambleStatus = `⏳ ${formatCooldown(seconds)}`;
    }

    // Check daily cooldown
    const canClaim = await economy.canClaimDaily();
    let dailyStatus = '✅ Available';
    if (!canClaim) {
        const cooldown = await economy.getDailyCooldown();
        let timeString = '';
        if (cooldown.hours > 0) timeString += `${cooldown.hours}h `;
        if (cooldown.minutes > 0) timeString += `${cooldown.minutes}m`;
        if (!timeString) timeString = '0m';
        dailyStatus = `⏳ ${timeString}`;
    }

    // Calculate progress (now 5 commands instead of 4)
    const totalCommands = 5;
    const statuses = [canWork, canBeg, canRob, canGamble, canClaim];
    const availableCount = statuses.filter(Boolean).length;
    // One emoji segment per command, so the bar fills exactly in step with availableCount
    const progressBar = buildProgressBar(availableCount, totalCommands, totalCommands);
    const allAvailable = availableCount === totalCommands;

    const container = new ContainerBuilder()
        .setAccentColor(allAvailable ? 0x00FF00 : 0xFFA500)
        // Header with avatar as a section accessory
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ⏰ ${targetUser.username}'s Cooldowns`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${allAvailable ? '🟢 All Available!' : '🟡 Some commands on cooldown'}\n` +
                        `${progressBar}  •  ${availableCount}/${totalCommands} available`
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
        // Single combined status block instead of 5 separated ones
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `💼 **Work**     ${workStatus}\n` +
                `🤲 **Beg**      ${begStatus}\n` +
                `🔫 **Rob**      ${robStatus}\n` +
                `🎲 **Gamble**   ${gambleStatus}\n` +
                `📅 **Daily**    ${dailyStatus}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        // Footer info
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `💰 Balance: ${coin} ${economy.balance.toLocaleString()}\n` +
                `🔥 Daily Streak: ${economy.dailyStreak} days\n` +
                `👤 Player: #${player.playerNumber}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(false)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Requested by ${requestUser.username}`)
        )
        // Refresh button lives inside the container via an action row
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`refresh_cooldowns_${targetUser.id}`)
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Primary)
            )
        );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldowns')
        .setDescription('Check your economy command cooldowns')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check cooldowns for')
                .setRequired(false)
        ),
    supportServer: false,

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const Player = models.Player;
        const Economy = models.Economy;
        const coin = getCoinEmoji();

        const player = await Player.findOne({
            where: { playerId: targetUser.id }
        });

        if (!player || !player.isRegistered) {
            const notRegisteredContainer = new ContainerBuilder()
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

            return await interaction.reply({
                components: [notRegisteredContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(targetUser.id);

        const container = await buildCooldownContainer(targetUser, player, economy, interaction.user);

        // Send the message with the container (Components V2 message)
        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

        // Get the actual message for the collector
        const message = await interaction.fetchReply();

        // Create collector for refresh button
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.customId === `refresh_cooldowns_${targetUser.id}` && i.user.id === interaction.user.id,
            time: 120000 // 2 minutes
        });

        collector.on('collect', async (i) => {
            if (interactionBan(i)) return;
            // Refresh the cooldowns
            const refreshedEconomy = await Economy.getOrCreate(targetUser.id);
            const refreshedContainer = await buildCooldownContainer(targetUser, player, refreshedEconomy, interaction.user);

            await i.update({
                components: [refreshedContainer],
                flags: MessageFlags.IsComponentsV2
            });
        });

        collector.on('end', async () => {
            // Rebuild the container but with the refresh button disabled
            const finalEconomy = await Economy.getOrCreate(targetUser.id);
            const finalContainer = await buildCooldownContainer(targetUser, player, finalEconomy, interaction.user);

            // Disable the button on the action row we just added
            const components = finalContainer.components;
            const actionRow = components[components.length - 1];
            if (actionRow && actionRow.components && actionRow.components[0]) {
                actionRow.components[0].data.disabled = true;
            }

            await interaction.editReply({
                components: [finalContainer],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => { });
        });
    }
};