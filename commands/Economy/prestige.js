// commands/Economy/prestige.js
const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { models } = require('../../utils/database');
const { buildProgressBar } = require('../../utils/progressBar');
const { getEmoji } = require('../../utils/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestige')
        .setDescription('View your prestige status and requirements')
        .addSubcommand(sub => sub
            .setName('info')
            .setDescription('View your prestige status and requirements')
        ),

    supportServer: true,

    async execute(interaction) {
        // Defer reply immediately to prevent interaction timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'info':
                    await handlePrestigeInfo(interaction);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Unknown subcommand!',
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            console.error('Error in prestige execute:', error);
            await interaction.editReply({
                content: '❌ There was an error executing this command. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

// Get emojis
function getCoinEmoji() {
    return getEmoji('common-coin');
}
function getIslandEmoji() {
    return getEmoji('islandFragment');
}

// Helper to build "not registered" container
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

// Format number
function formatNumber(num) {
    return num.toLocaleString();
}

// ==================== PRESTIGE INFO ====================
async function handlePrestigeInfo(interaction) {
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;
    const Prestige = models.Prestige;
    const coin = getCoinEmoji();
    const island = getIslandEmoji();

    try {
        const player = await Player.findOne({
            where: { playerId: interaction.user.id }
        });

        if (!player || !player.isRegistered) {
            const container = buildNotRegisteredContainer(interaction.user);
            return await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(interaction.user.id);
        const level = await Level.getOrCreate(interaction.user.id);
        const prestige = await Prestige.getOrCreate(interaction.user.id);

        // Check if can prestige
        const canPrestigeResult = prestige.canPrestige(economy, level);
        const req = prestige.calculateRequirements();

        // Build progress bars for each requirement
        const goldProgress = Math.min(100, Math.floor((economy.balance / req.gold) * 100));
        const fragmentsProgress = Math.min(100, Math.floor((economy.islandFragments / req.fragments) * 100));
        const levelProgress = Math.min(100, Math.floor((level.level / req.level) * 100));

        const goldBar = buildProgressBar(goldProgress, 100, 10);
        const fragmentsBar = buildProgressBar(fragmentsProgress, 100, 10);
        const levelBar = buildProgressBar(levelProgress, 100, 10);

        const container = new ContainerBuilder()
            .setAccentColor(canPrestigeResult.canPrestige ? 0x00FF00 : 0xFFA500)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ⭐ ${interaction.user.username}'s Prestige`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Prestige Level:** ${prestige.prestigeLevel}\n` +
                            `**Multiplier:** ${prestige.multiplier}x`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder({
                            media: { url: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) }
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
                    `**📊 Requirements for Next Prestige**\n` +
                    `Status: ${canPrestigeResult.canPrestige ? '🟢 Ready to Upgrade Prestige!' : '🔴 Requirements Not Met'}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `💰 **Gold**\n` +
                    `${goldBar}\n` +
                    `${formatNumber(economy.balance)} / ${formatNumber(req.gold)} ${coin} (${goldProgress}%)`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `🏝️ **Island Fragments**\n` +
                    `${fragmentsBar}\n` +
                    `${formatNumber(economy.islandFragments)} / ${formatNumber(req.fragments)} ${island} (${fragmentsProgress}%)`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `📊 **Level**\n` +
                    `${levelBar}\n` +
                    `${formatNumber(level.level)} / ${formatNumber(req.level)} (${levelProgress}%)`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 Stats**\n` +
                    `Total Gold Earned: ${formatNumber(prestige.goldEarned)} ${coin}\n` +
                    `Total Fragments Earned: ${formatNumber(prestige.islandFragmentsEarned)} ${island}\n` +
                    `Total Levels Gained: ${formatNumber(prestige.level)}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${interaction.user.username}`)
            )
            // Prestige button now lives inside the container itself
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prestige_${interaction.user.id}`)
                        .setLabel('Upgrade Prestige')
                        .setStyle(canPrestigeResult.canPrestige ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setEmoji('⭐')
                        .setDisabled(!canPrestigeResult.canPrestige)
                )
            );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

        // Get the actual message for the collector
        const message = await interaction.fetchReply();

        // Create collector for prestige button
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.customId === `prestige_${interaction.user.id}` && i.user.id === interaction.user.id,
            time: 120000 // 2 minutes
        });

        collector.on('collect', async (i) => {
            // Show confirmation
            const confirmContainer = new ContainerBuilder()
                .setAccentColor(0xFFA500)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## ⚠️ Confirm Prestige')
                )
                .addSeparatorComponents(
                    new SeparatorBuilder()
                        .setDivider(true)
                        .setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `Are you sure you want to prestige?\n\n` +
                        `**You will lose:**\n` +
                        `• All your gold (reset to 0)\n` +
                        `• All your XP and levels (reset to 1)\n\n` +
                        `**You will keep:**\n` +
                        `• 💎 Island Fragments (they stay untouched!)\n\n` +
                        `**You will gain:**\n` +
                        `• Prestige Level ${prestige.prestigeLevel + 1}\n` +
                        `• Multiplier: ${(0.5 * (prestige.prestigeLevel + 1)).toFixed(1)}x`
                    )
                )
                .addSeparatorComponents(
                    new SeparatorBuilder()
                        .setDivider(false)
                        .setSpacing(SeparatorSpacingSize.Small)
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_prestige_${interaction.user.id}`)
                            .setLabel('Confirm Prestige')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId(`cancel_prestige_${interaction.user.id}`)
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌')
                    )
                );

            await i.update({
                components: [confirmContainer],
                flags: MessageFlags.IsComponentsV2
            });

            // Create collector for confirmation buttons
            const confirmCollector = message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 60000 // 1 minute
            });

            confirmCollector.on('collect', async (btn) => {
                if (btn.customId === `cancel_prestige_${interaction.user.id}`) {
                    const cancelledContainer = new ContainerBuilder()
                        .setAccentColor(0xFFA500)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('## ❌ Prestige Cancelled')
                        )
                        .addSeparatorComponents(
                            new SeparatorBuilder()
                                .setDivider(true)
                                .setSpacing(SeparatorSpacingSize.Small)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('You cancelled the prestige process.')
                        );

                    await btn.update({
                        components: [cancelledContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    confirmCollector.stop();
                    return;
                }

                if (btn.customId === `confirm_prestige_${interaction.user.id}`) {
                    await btn.deferUpdate();

                    try {
                        // Perform prestige
                        const result = await prestige.doPrestige(economy, level);

                        const successContainer = new ContainerBuilder()
                            .setAccentColor(0x00FF00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('## ⭐ Prestige Complete!')
                            )
                            .addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(true)
                                    .setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `🎉 Congratulations! You have reached Prestige Level **${result.newPrestigeLevel}**!\n\n` +
                                    `**📊 New Multiplier:** ${(0.5 * result.newPrestigeLevel).toFixed(1)}x\n\n` +
                                    `**Next Prestige Requirements:**\n` +
                                    `• Gold: ${formatNumber(result.nextRequirements.gold)} ${coin}\n` +
                                    `• Fragments: ${formatNumber(result.nextRequirements.fragments)} 💎\n` +
                                    `• Level: ${formatNumber(result.nextRequirements.level)}`
                                )
                            )
                            .addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(false)
                                    .setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`-# Prestige by ${interaction.user.username}`)
                            );

                        await btn.editReply({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                    } catch (error) {
                        console.error('Error performing prestige:', error);
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent('## ❌ Error')
                            )
                            .addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(true)
                                    .setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    'There was an error processing your prestige. Please try again.'
                                )
                            );

                        await btn.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                    confirmCollector.stop();
                }
            });

            confirmCollector.on('end', async () => {
                // Disable buttons after timeout
                const disabledConfirmContainer = new ContainerBuilder()
                    .setAccentColor(0xFFA500)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('## ⚠️ Confirm Prestige')
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setDivider(true)
                            .setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('This confirmation has expired.')
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setDivider(false)
                            .setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`confirm_prestige_${interaction.user.id}`)
                                .setLabel('Confirm Prestige')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('✅')
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`cancel_prestige_${interaction.user.id}`)
                                .setLabel('Cancel')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('❌')
                                .setDisabled(true)
                        )
                    );

                await interaction.editReply({
                    components: [disabledConfirmContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
            });
        });

        collector.on('end', async () => {
            // Rebuild the container with the prestige button disabled
            container.components[container.components.length - 1].components[0].data.disabled = true;
            container.components[container.components.length - 1].components[0].data.label = 'Upgrade Prestige';

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => { });
        });

    } catch (error) {
        console.error('Error in handlePrestigeInfo:', error);
        await interaction.editReply({
            content: '❌ There was an error fetching your prestige info. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}