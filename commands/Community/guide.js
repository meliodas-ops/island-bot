const { interactionBan } = require('../../utils/bans');
// commands/Community/guide.js
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');
const { getEmoji } = require('../../utils/emojis');

// Get emojis
function getCoinEmoji() {
    return getEmoji('common-coin');
}

function getPromoTicketEmoji() {
    return getEmoji('promoTicket');
}

const pages = [
    {
        title: '📖 Welcome to the Bot Guide!',
        description: 'Learn how to navigate and use all the features of the bot!',
        fields: [
            {
                name: '📋 What is this bot?',
                value: 'This bot is a complete economy, leveling, and prestige system with features like:\n' +
                    '• 💰 **Economy System** - Earn, beg, and rob your way to riches!\n' +
                    '• 📊 **Leveling System** - Gain XP and level up!\n' +
                    '• ⭐ **Prestige System** - Reset your progress for powerful multipliers!\n' +
                    '• 💎 **Island Fragments** - A special currency earned through leveling!\n' +
                    '• 🎯 **Daily Rewards** - Claim rewards every day!\n' +
                    '• 👤 **Player Profiles** - Track your progress!\n' +
                    '• 🏆 **Leaderboards** - Compete with others!\n' +
                    '• 🎫 **Promo Codes** - Redeem special codes for rewards!'
            },
            {
                name: '📌 Quick Start',
                value: '1. `/player register` - Register as a player\n' +
                    '2. `/economy work` - Start earning coins\n' +
                    '3. `/player level` - Check your progress\n' +
                    '4. `/economy daily` - Claim daily rewards\n' +
                    '5. `/cooldowns` - Check your cooldowns'
            }
        ],
        color: 0x0099FF
    },
    {
        title: '💰 Economy Commands',
        description: 'Learn how to earn and manage your coins!',
        fields: [
            {
                name: '💼 `/economy work`',
                value: '• **Cooldown:** 15 seconds\n' +
                    '• **Reward:** 50-200 coins (scales with prestige multiplier)\n' +
                    '• **XP:** 400-500 XP\n' +
                    '• **Description:** Work at various jobs to earn coins.'
            },
            {
                name: '🤲 `/economy beg`',
                value: '• **Cooldown:** 30 seconds\n' +
                    '• **Reward:** 450-500 coins (scales with prestige multiplier)\n' +
                    '• **XP:** 450-500 XP\n' +
                    '• **Description:** Beg for coins from kind strangers.'
            },
            {
                name: '🔫 `/economy rob`',
                value: '• **Cooldown:** 1 minute\n' +
                    '• **Success Rate:** 2%\n' +
                    '• **Success Reward:** 5,000 - 10,000 coins (scales with prestige multiplier)\n' +
                    '• **Fail Reward:** 0 coins\n' +
                    '• **XP:** Success = coins earned XP, Fail = 500 XP\n' +
                    '• **Description:** Attempt a high-risk robbery for big rewards!'
            },
            {
                name: '📅 `/economy daily`',
                value: '• **Cooldown:** 24 hours\n' +
                    '• **Reward:** 100-200 coins (scales with prestige multiplier)\n' +
                    '• **XP:** 50-100 XP\n' +
                    '• **Bonus:** Streak bonus for claiming daily!'
            },
            {
                name: '💰 `/economy balance`',
                value: '• **Cooldown:** None\n' +
                    '• **Description:** Check your coin balance, total earned, total spent, and Island Fragments!'
            },
            {
                name: '💎 `/economy exchange gold:<amount>`',
                value: '• **Description:** Exchange gold for Island Fragments\n' +
                    '• **Exchange Rate:** 100 gold = 1 Island Fragment\n' +
                    '• **Min Exchange:** 1,000 gold\n' +
                    '• **Max Exchange:** 100,000 gold'
            }
        ],
        color: 0x00FF00
    },
    {
        title: '📊 Leveling & Prestige System',
        description: 'Learn how the leveling and prestige systems work!',
        fields: [
            {
                name: '📈 How to Earn XP',
                value: '• **Work:** 400-500 XP per work\n' +
                    '• **Beg:** 450-500 XP per beg\n' +
                    '• **Rob:** Success = coins earned XP, Fail = 500 XP\n' +
                    '• **Daily:** 50-100 XP per daily claim\n' +
                    '• **Gamble:** Win = 500 XP, Lose = 300 XP'
            },
            {
                name: '🎁 Level Rewards',
                value: '• **Every Level:** `Level × 100` coins\n' +
                    '• **Level 5:** +500 bonus coins\n' +
                    '• **Level 10:** +1000 coins\n' +
                    '• **Level 25:** +2500 coins\n' +
                    '• **Level 50:** +5000 coins\n' +
                    '• **Level 100:** +10000 coins\n' +
                    '• **Every 10 Levels:** Bonus coins!'
            },
            {
                name: '💎 Island Fragments',
                value: '• Earn **5 fragments** per level!\n' +
                    '• Check your fragments with `/economy balance`\n' +
                    '• Exchange gold for fragments with `/economy exchange`\n' +
                    '• Fragments are used for prestige requirements\n' +
                    '• **Fragments are never lost** when prestiging!'
            },
            {
                name: '⭐ Prestige System',
                value: '• **Requirements:** Gold and Island Fragments\n' +
                    '• **Gold:** 200,000 + (100,000 × prestige level)\n' +
                    '• **Fragments:** 1,500 + (500 × prestige level)\n' +
                    '• **Level:** 100 + (50 × prestige level)\n' +
                    '• **Multiplier:** 0.5 × prestige level\n' +
                    '• **Multiplier applies to:** All gold rewards!\n' +
                    '• **Resets:** Gold to 0, Level to 1\n' +
                    '• **Keeps:** Island Fragments stay untouched!'
            }
        ],
        color: 0xFFD700
    },
    {
        title: '🎲 Gamble & Promo Codes',
        description: 'Take risks and earn rewards!',
        fields: [
            {
                name: '🎲 `/gamble coins amount:<number>`',
                value: '• **Cooldown:** 5 minutes\n' +
                    '• **Chance:** 50% win, 50% lose\n' +
                    '• **Win:** Get your bet back + profit (amount × 2 total)\n' +
                    '• **Lose:** Lose your entire bet\n' +
                    '• **XP:** Win = 500 XP, Lose = 300 XP\n' +
                    '• **Max Bet:** 150,000 coins'
            },
            {
                name: getPromoTicketEmoji() + ' `/redeem redeem code:<code>`',
                value: '• **Description:** Redeem a promo code\n' +
                    '• **Rewards:** Coins, XP, or both!\n' +
                    '• **Check your redeemed codes:** `/redeem list`\n\n' +
                    '**<:PromoTicket:1528049808168976434> Active Promo Codes:**\n' +
                    '• <:PromoTicket:1528049808168976434> `COINREDEMPT` - 3,000 coins\n' +
                    '• <:PromoTicket:1528049808168976434> `XPREDEMPT` - 5,000 XP'
            }
        ],
        color: 0xFF6B9D
    },
    {
        title: '👤 Player & Badge Commands',
        description: 'Manage your player profile and achievements!',
        fields: [
            {
                name: '📝 `/player register`',
                value: '• **Description:** Register as a player\n' +
                    '• **Bonus:** 1000 coins on registration!\n' +
                    '• **Requirement:** Must accept rules'
            },
            {
                name: '✔ `/player profile`',
                value: '• **Description:** View your player profile\n' +
                    '• **Shows:** Player number, level, XP progress, prestige level, multiplier, registration date\n' +
                    '• **Option:** Check other players with `user:@user`'
            },
            {
                name: '📊 `/player level`',
                value: '• **Description:** View your level progress\n' +
                    '• **Shows:** Level, XP progress bar, total XP, prestige level, multiplier\n' +
                    '• **Option:** Check other players with `user:@user`'
            },
            {
                name: '🏆 `/player leaderboard`',
                value: '• **Description:** View the level leaderboard\n' +
                    '• **Shows:** Top players by level and XP\n' +
                    '• **Option:** Navigate pages with buttons'
            },
            {
                name: '⭐ `/prestige info`',
                value: '• **Description:** View your prestige progress\n' +
                    '• **Shows:** Requirements progress (Gold & Fragments)\n' +
                    '• **Action:** Click the button to prestige when ready!'
            },
            {
                name: '🎖️ Available Badges',
                value: `<:botcreator:1527258126838009966> **Bot Creator** - Given to the creator of the bot\n` +
                    `<:dev:1527255683458793622> **Bot Developer** - The developer of the bot\n` +
                    `<:admin:1527255983070646292> **Bot Admin** - Bot administrator\n` +
                    `<:staff:1527256238591836160> **Bot Staff** - Bot Staff\n` +
                    `<:artist:1527260806809387179> **Bot Artist** - Bot artist\n` +
                    `<:serverstaff:1527592812399427655> **Server Staff** - Given to staff team of the support server\n` +
                    `<:tester:1527256446197174272> **Bot Tester** - Bot testers\n` +
                    `<:earlysupp:1527256646617665643> **Early Supporter** - First 20 to register\n` +
                    `<:contribu:1527256957948526612> **Contributor** - Contributed to the bot's development\n` +
                    `<:premium:1527264595062947971> **Premium** - Premium User of Bot`
            }
        ],
        color: 0xFF69B4
    },
    {
        title: '⏰ Cooldowns',
        description: 'Track your cooldowns and maximize your earnings!',
        fields: [
            {
                name: '⏰ `/cooldowns`',
                value: '• **Description:** Check all your cooldowns\n' +
                    '• **Shows:** Work, Beg, Rob, Gamble, and Daily cooldowns\n' +
                    '• **Also shows:** Balance, daily streak, and player info\n' +
                    '• **Option:** Check other players with `user:@user`'
            }
        ],
        color: 0x9B59B6
    }
];

// Build the container for a given guide page
function createContainer(pageIndex) {
    const page = pages[pageIndex];
    const coin = getCoinEmoji();
    const promoTicket = getPromoTicketEmoji();

    const container = new ContainerBuilder()
        .setAccentColor(page.color)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${page.title}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(page.description)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        );

    // Add each field as its own text block, separated by small spacer separators
    page.fields.forEach((field, i) => {
        let fieldValue = field.value;
        // Replace common emojis with custom ones if needed
        if (fieldValue.includes('🪙')) {
            fieldValue = fieldValue.replace(/🪙/g, coin);
        }
        if (fieldValue.includes('🎫')) {
            fieldValue = fieldValue.replace(/🎫/g, promoTicket);
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${field.name}**\n${fieldValue}`)
        );

        if (i < page.fields.length - 1) {
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(false)
                    .setSpacing(SeparatorSpacingSize.Small)
            );
        }
    });

    container
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# Page ${pageIndex + 1}/${pages.length} • Use buttons to navigate`
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('guide_prev')
                    .setEmoji('◀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('guide_page')
                    .setLabel(`${pageIndex + 1}/${pages.length}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('guide_home')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('guide_next')
                    .setEmoji('▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === pages.length - 1)
            )
        );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription('Learn how to use the bot and its features'),
    supportServer: false,

    async execute(interaction) {
        let currentPage = 0;

        // Send initial message
        const container = createContainer(currentPage);

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

        // Get the actual message for the collector
        const message = await interaction.fetchReply();

        // Create collector for button interactions
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 120000 // 2 minutes
        });

        collector.on('collect', async (i) => {
            if (interactionBan(i)) return;
            if (i.customId === 'guide_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'guide_next') {
                currentPage = Math.min(pages.length - 1, currentPage + 1);
            } else if (i.customId === 'guide_home') {
                currentPage = 0;
            }

            const newContainer = createContainer(currentPage);

            await i.update({
                components: [newContainer],
                flags: MessageFlags.IsComponentsV2
            });
        });

        collector.on('end', async () => {
            // Rebuild the current page's container with all nav buttons disabled
            const finalContainer = createContainer(currentPage);

            const components = finalContainer.components;
            const actionRow = components[components.length - 1];
            if (actionRow && actionRow.components) {
                for (const btn of actionRow.components) {
                    btn.data.disabled = true;
                }
                // Reflect the expiry on the page indicator button
                actionRow.components[1].data.label = 'Expired';
            }

            await interaction.editReply({
                components: [finalContainer],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => { });
        });
    }
};