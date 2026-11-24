// commands/Community/changelogs.js
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
    SeparatorSpacingSize
} = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changelogs')
        .setDescription('View the bot changelogs'),

    async execute(interaction) {
        const changelogsPath = path.join(process.cwd(), 'data', 'changelogs.json');

        // Check if changelogs file exists
        if (!fs.existsSync(changelogsPath)) {
            return await interaction.reply({
                content: '❌ Changelogs file not found!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Load changelogs data
        let changelogsData = {};
        try {
            changelogsData = JSON.parse(fs.readFileSync(changelogsPath, 'utf8'));
        } catch (error) {
            console.error('❌ Error loading changelogs.json:', error.message);
            return await interaction.reply({
                content: '❌ Error loading changelogs!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Get all dates and sort them (newest first)
        const dates = Object.keys(changelogsData).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('-').map(Number);
            const [dayB, monthB, yearB] = b.split('-').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateB - dateA;
        });

        if (dates.length === 0) {
            return await interaction.reply({
                content: '📝 No changelogs available yet!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Start with the most recent changelog (index 0)
        let currentIndex = 0;
        await sendChangelog(interaction, changelogsData, dates, currentIndex);
    }
};

// Builds the Components V2 container for a given changelog entry
function buildChangelogContainer(date, data, index, totalEntries, client) {
    const changesText = (data.changes && data.changes.length)
        ? data.changes.map(change => `${change}`).join('\n')
        : 'No changes listed';

    const container = new ContainerBuilder()
        .setAccentColor(0x5865F2)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 📝 Changelogs - ${formatDate(date)}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(data.title || 'Updates')
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**📋 Changes**\n${changesText}`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(false)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${index + 1}/${totalEntries} changelog entries`)
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('changelog_first')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index === 0),
                new ButtonBuilder()
                    .setCustomId('changelog_prev')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === 0),
                new ButtonBuilder()
                    .setCustomId('changelog_page')
                    .setLabel(`${index + 1}/${totalEntries}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('changelog_next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === totalEntries - 1),
                new ButtonBuilder()
                    .setCustomId('changelog_last')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index === totalEntries - 1)
            )
        );

    return container;
}

// Helper function to send/update changelog
async function sendChangelog(interaction, changelogsData, dates, index) {
    const date = dates[index];
    const data = changelogsData[date];
    const totalEntries = dates.length;

    const container = buildChangelogContainer(date, data, index, totalEntries, interaction.client);

    // Send or update the message
    let message;
    if (interaction.isButton()) {
        // Update the existing message
        await interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
        message = await interaction.fetchReply();
    } else {
        // Initial command - send new message
        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
        message = await interaction.fetchReply();
    }

    // Create a new collector for this specific message
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 120000
    });

    collector.on('collect', async (buttonInteraction) => {
        // Determine which button was pressed
        let newIndex = index;
        let shouldUpdate = false;

        switch (buttonInteraction.customId) {
            case 'changelog_first':
                if (index !== 0) {
                    newIndex = 0;
                    shouldUpdate = true;
                }
                break;
            case 'changelog_prev':
                if (index > 0) {
                    newIndex = index - 1;
                    shouldUpdate = true;
                }
                break;
            case 'changelog_next':
                if (index < totalEntries - 1) {
                    newIndex = index + 1;
                    shouldUpdate = true;
                }
                break;
            case 'changelog_last':
                if (index !== totalEntries - 1) {
                    newIndex = totalEntries - 1;
                    shouldUpdate = true;
                }
                break;
            default:
                await buttonInteraction.deferUpdate();
                return;
        }

        if (shouldUpdate) {
            // Stop the current collector
            collector.stop();

            // Send the new changelog with the updated index
            await sendChangelog(buttonInteraction, changelogsData, dates, newIndex);
        } else {
            // No change needed, just acknowledge
            await buttonInteraction.deferUpdate();
        }
    });

    collector.on('end', async () => {
        // Rebuild the container with all navigation buttons disabled
        const disabledContainer = buildChangelogContainer(date, data, index, totalEntries, interaction.client);

        const components = disabledContainer.components;
        const actionRow = components[components.length - 1];
        if (actionRow && actionRow.components) {
            for (const btn of actionRow.components) {
                btn.data.disabled = true;
            }
        }

        try {
            await message.edit({
                components: [disabledContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            // Ignore if message was deleted
        }
    });
}

// Helper function to format date
function formatDate(dateStr) {
    const [day, month, year] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}