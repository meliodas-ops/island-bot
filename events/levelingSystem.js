// events/levelingSystem.js
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    MessageFlags
} = require('discord.js');
const { serverModels } = require('../utils/serverDatabase');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots and DMs
        if (!message.guild || message.author.bot) return;

        try {
            const Leveling = serverModels.Leveling;
            const Settings = serverModels.ServerSettings;

            // Get server settings
            let settings = await Settings.findOne({
                where: { guildId: message.guild.id }
            });

            // If no settings, create them
            if (!settings) {
                settings = await Settings.create({
                    guildId: message.guild.id,
                    guildName: message.guild.name,
                    levelingEnabled: false // Disabled by default
                });
            }

            // Check if leveling is enabled
            if (!settings.levelingEnabled) return;

            // Get or create leveling record
            const leveling = await Leveling.getOrCreate(message.author.id, message.guild.id);

            // Check cooldown (prevent spam)
            const cooldownSeconds = settings.levelingInterval || 60;
            const cooldownMs = cooldownSeconds * 1000;

            if (leveling.lastMessageAt) {
                const timeSinceLast = Date.now() - new Date(leveling.lastMessageAt).getTime();
                if (timeSinceLast < cooldownMs) return;
            }

            // Generate random XP between min and max
            const minXP = settings.levelingMinXP || 5;
            const maxXP = settings.levelingMaxXP || 15;
            const xpGained = Math.floor(Math.random() * (maxXP - minXP + 1)) + minXP;

            // Add XP
            const result = await leveling.addXP(xpGained, message.guild.id);
            leveling.messageCount += 1;
            leveling.lastMessageAt = new Date();
            await leveling.save();

            // Handle level up
            if (result.leveledUp) {
                // Send level up message to configured channel using Components V2
                if (settings.levelUpChannel) {
                    const channel = message.guild.channels.cache.get(settings.levelUpChannel);
                    if (channel) {
                        // Build Components V2 container for level up
                        const levelUpContainer = new ContainerBuilder()
                            .setAccentColor(0xFFD700)
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent('## 🎉 Level Up!')
                                    )
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            `**${message.author}** just reached **Level ${result.currentLevel}**!`
                                        )
                                    )
                                    .setThumbnailAccessory(
                                        new ThumbnailBuilder({
                                            media: { url: message.author.displayAvatarURL({ extension: 'png', size: 128 }) }
                                        })
                                    )
                            )
                            .addSeparatorComponents(
                                new SeparatorBuilder()
                                    .setDivider(false)
                                    .setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`-# ${message.guild.name}`)
                            );

                        await channel.send({
                            components: [levelUpContainer],
                            flags: MessageFlags.IsComponentsV2
                        }).catch(() => { });
                    }
                }

                // ❌ NO DM NOTIFICATIONS - Removed
            }

        } catch (error) {
            console.error('Error in levelingSystem:', error);
        }
    }
};