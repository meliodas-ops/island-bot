// commands/Economy/economy.js
const {
    SlashCommandBuilder,
    MessageFlags,
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Economy management commands')
        .addSubcommand(sub => sub
            .setName('balance')
            .setDescription('Check your balance')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('User to check balance for')
                    .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('work')
            .setDescription('Work to earn coins (15s cooldown)')
        )
        .addSubcommand(sub => sub
            .setName('beg')
            .setDescription('Beg for coins (30s cooldown)')
        )
        .addSubcommand(sub => sub
            .setName('rob')
            .setDescription('Attempt a robbery (1min cooldown)')
        )
        .addSubcommand(sub => sub
            .setName('daily')
            .setDescription('Claim your daily reward (24h cooldown)')
        )
        .addSubcommand(sub => sub
            .setName('exchange')
            .setDescription('Exchange gold for Island Fragments (100 gold = 1 fragment)')
            .addIntegerOption(option =>
                option.setName('gold')
                    .setDescription('Amount of gold to exchange (min: 1,000, max: 100,000)')
                    .setRequired(true)
                    .setMinValue(1000)
                    .setMaxValue(100000)
            )
        ),
    supportServer: false,

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'balance':
                await handleBalance(interaction);
                break;
            case 'work':
                await handleWork(interaction);
                break;
            case 'beg':
                await handleBeg(interaction);
                break;
            case 'rob':
                await handleRob(interaction);
                break;
            case 'daily':
                await handleDaily(interaction);
                break;
            case 'exchange':
                await handleExchange(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown subcommand!',
                    flags: MessageFlags.Ephemeral
                });
        }
    }
};

// Get emojis
function getCoinEmoji() {
    return getEmoji('common-coin');
}

function getPlusEmoji() {
    return getEmoji('plus');
}

function getMinusEmoji() {
    return getEmoji('minus');
}

function getIslandEmoji() {
    return getEmoji('islandFragment');
}

// Get prestige multiplier for a user (gold only)
async function getPrestigeMultiplier(playerId) {
    try {
        const Prestige = models.Prestige;
        const prestige = await Prestige.findOne({ where: { playerId } });
        if (prestige && prestige.multiplier) {
            return prestige.multiplier;
        }
        return 0;
    } catch (error) {
        console.error('Error getting prestige multiplier:', error);
        return 0;
    }
}

// Reused "not registered" container
function buildNotRegisteredContainer(username) {
    return new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## ❌ Player Not Registered')
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${username} is not registered as a player.\n\n` +
                `**How to Register**\nUse \`/player register\` to become a player!`
            )
        );
}

// Reused cooldown container
function buildCooldownContainer(title, description, timeRemaining, cooldownLength) {
    return new ContainerBuilder()
        .setAccentColor(0xFFA500)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ⏰ ${title}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Time Remaining**\n${timeRemaining}\n\n**Cooldown**\n${cooldownLength}`
            )
        );
}

// Reused "level up" text block (no multiplier for XP)
function buildLevelUpText(xpResult) {
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();
    if (!xpResult.leveledUp) return null;

    return (
        `**🎉 Level Up!**\n` +
        `You reached Level ${xpResult.currentLevel}!\n` +
        `📈 Level ${xpResult.currentLevel} Rewards: ${plus}${xpResult.totalCoinsEarned} ${coin}\n` +
        `💎 Total Level Up Rewards: ${plus}${xpResult.totalCoinsEarned} ${coin}!`
    );
}

// Format number with plus/minus emojis
function formatWithEmoji(amount, showPlus = true) {
    const plus = getPlusEmoji();
    const minus = getMinusEmoji();
    if (amount > 0 && showPlus) {
        return `${plus}${amount.toLocaleString()}`;
    } else if (amount < 0) {
        return `${minus}${Math.abs(amount).toLocaleString()}`;
    }
    return amount.toLocaleString();
}

// ------------------ EXCHANGE SUBCOMMAND ------------------
async function handleExchange(interaction) {
    const Economy = models.Economy;
    const goldAmount = interaction.options.getInteger('gold');
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();
    const minus = getMinusEmoji();
    const island = getIslandEmoji();

    try {
        // Check if player is registered
        const Player = models.Player;
        const player = await Player.findOne({
            where: { playerId: interaction.user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(interaction.user.username)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(interaction.user.id);

        // Check if player has enough gold
        if (economy.balance < goldAmount) {
            const insufficientContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## ❌ Insufficient Gold')
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `You don't have enough gold to exchange!\n\n` +
                        `**Your Balance**\n${economy.balance.toLocaleString()} ${coin}\n\n` +
                        `**Gold Needed**\n${goldAmount.toLocaleString()} ${coin}`
                    )
                );

            return await interaction.reply({
                components: [insufficientContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        // Calculate fragments (100 gold = 1 fragment)
        const fragmentsEarned = Math.floor(goldAmount / 100);
        const goldUsed = fragmentsEarned * 100; // Round down to nearest 100

        if (fragmentsEarned === 0) {
            const minContainer = new ContainerBuilder()
                .setAccentColor(0xFFA500)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## ⚠️ Minimum Exchange')
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `You need at least **100** gold to exchange for 1 fragment!\n\n` +
                        `**Exchange Rate:** 100 gold = 1 Island Fragment`
                    )
                );

            return await interaction.reply({
                components: [minContainer],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        // Remove gold and add fragments
        await Economy.sequelize.transaction({type:'IMMEDIATE'}, async transaction => {
            await economy.removeBalance(goldUsed, 'fragment_exchange', {transaction});
            await economy.addFragments(fragmentsEarned, 'gold_exchange', {transaction});
        });

        const exchangeContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## 💎 Exchange Complete!')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `Successfully exchanged **${goldUsed.toLocaleString()}** ${coin} for **${fragmentsEarned.toLocaleString()}** Island Fragments!`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💰 Gold Remaining**\n${economy.balance.toLocaleString()} ${coin}\n\n` +
                    `**💎 Island Fragments**\n${economy.islandFragments.toLocaleString()} ${island}\n\n` +
                    `**📊 Exchange Rate**\n100 gold = 1 Island Fragment`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Exchanged by ${interaction.user.username}`)
            );

        await interaction.reply({
            components: [exchangeContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in handleExchange:', error);
        await interaction.reply({
            content: '❌ There was an error processing your exchange. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ WORK SUBCOMMAND ------------------
async function handleWork(interaction) {
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();
    const island = getIslandEmoji();

    try {
        const player = await Player.findOne({
            where: { playerId: interaction.user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(interaction.user.username)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(interaction.user.id);
        const canWork = await economy.canWork();

        if (!canWork) {
            const remainingSeconds = await economy.getWorkCooldown();
            return await interaction.reply({
                components: [buildCooldownContainer(
                    'Work Cooldown',
                    'You need to rest before working again!',
                    `${remainingSeconds}s`,
                    '15 seconds'
                )],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const level = await Level.getOrCreate(interaction.user.id);
        const multiplier = await getPrestigeMultiplier(interaction.user.id);

        const jobs = [
            { name: '💻 Programmer', min: 50, max: 150 },
            { name: '🎨 Designer', min: 40, max: 120 },
            { name: '📝 Writer', min: 30, max: 100 },
            { name: '🔧 Mechanic', min: 45, max: 130 },
            { name: '👨‍🍳 Chef', min: 35, max: 110 },
            { name: '🧹 Cleaner', min: 20, max: 80 },
            { name: '📦 Delivery Driver', min: 25, max: 90 },
            { name: '🛠️ Builder', min: 40, max: 140 },
            { name: '🎵 Musician', min: 30, max: 120 },
            { name: '📊 Manager', min: 60, max: 180 },
            { name: '🔬 Scientist', min: 55, max: 160 },
            { name: '🏗️ Architect', min: 50, max: 170 },
            { name: '💊 Pharmacist', min: 45, max: 140 },
            { name: '⚖️ Lawyer', min: 70, max: 200 },
            { name: '👨‍🏫 Teacher', min: 35, max: 100 }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];
        let reward = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

        // Apply prestige multiplier to gold reward ONLY
        if (multiplier > 0) {
            reward = Math.floor(reward * (1 + multiplier));
        }

        let bonus = 0;
        if (economy.dailyStreak > 0) {
            bonus = Math.floor(reward * (economy.dailyStreak * 0.05));
            if (bonus > 100) bonus = 100;
        }

        const totalReward = reward + bonus;

        await economy.addBalance(totalReward, 'work');
        await economy.setWorkCooldown();

        // XP does NOT get prestige multiplier
        const xpGained = Math.floor(Math.random() * 100) + 400;
        const xpResult = await level.addXP(xpGained, economy);

        const nextWorkTime = Date.now() + 15 * 1000;

        const multiplierText = multiplier > 0 ? ` (${multiplier}x multiplier applied to gold!)` : '';

        const workContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## 💼 Work Complete!')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `You worked as a ${job.name} and earned **${plus}${totalReward}** ${coin}!${multiplierText}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

        const levelUpText = buildLevelUpText(xpResult);
        if (levelUpText) {
            workContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(levelUpText)
            );
        }

        workContainer
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💵 Economy**\n` +
                    `New Balance: ${economy.balance.toLocaleString()} ${coin}\n` +
                    `Bonus: ${bonus > 0 ? `${plus}${bonus} ${coin} (Streak bonus!)` : 'None'}\n` +
                    `Streak: ${economy.dailyStreak} days`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 Leveling**\nXP Gained: ${plus}${xpGained} XP`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ⏰ Next Work Available: <t:${Math.floor(nextWorkTime / 1000)}:R> • Worked by ${interaction.user.username}`
                )
            );

        await interaction.reply({
            components: [workContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleWork:', error);
        await interaction.reply({
            content: '❌ There was an error processing your work. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ BEG SUBCOMMAND ------------------
async function handleBeg(interaction) {
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();

    try {
        const player = await Player.findOne({
            where: { playerId: interaction.user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(interaction.user.username)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(interaction.user.id);
        const canBeg = await economy.canBeg();

        if (!canBeg) {
            const remainingSeconds = await economy.getBegCooldown();
            return await interaction.reply({
                components: [buildCooldownContainer(
                    'Beg Cooldown',
                    'You need to wait before begging again!',
                    `${remainingSeconds}s`,
                    '30 seconds'
                )],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const level = await Level.getOrCreate(interaction.user.id);
        const multiplier = await getPrestigeMultiplier(interaction.user.id);

        const begResponses = [
            'Someone felt sorry for you and gave you',
            'A kind stranger donated',
            'You found some coins on the ground',
            'Someone dropped their change and you picked it up',
            'A generous person gave you',
            'You asked nicely and received',
            'Someone had extra coins and shared',
            'A mysterious benefactor left you'
        ];

        let coinsEarned = Math.floor(Math.random() * 50) + 450;
        // Apply prestige multiplier to gold ONLY
        if (multiplier > 0) {
            coinsEarned = Math.floor(coinsEarned * (1 + multiplier));
        }

        const response = begResponses[Math.floor(Math.random() * begResponses.length)];

        await economy.setBegCooldown();
        await economy.addBalance(coinsEarned, 'beg');

        // XP does NOT get prestige multiplier
        const xpGained = Math.floor(Math.random() * 50) + 450;
        const xpResult = await level.addXP(xpGained, economy);

        const multiplierText = multiplier > 0 ? ` (${multiplier}x multiplier applied to gold!)` : '';

        const begContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## 🫴 Begged Successfully!')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${response} **${plus}${coinsEarned}** ${coin}!${multiplierText}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

        const levelUpText = buildLevelUpText(xpResult);
        if (levelUpText) {
            begContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(levelUpText)
            );
        }

        begContainer
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💵 Economy**\nNew Balance: ${economy.balance.toLocaleString()} ${coin}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 Leveling**\nXP Gained: ${plus}${xpGained} XP`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ⏰ Next Beg Available: <t:${Math.floor((Date.now() + 30 * 1000) / 1000)}:R> • Begged by ${interaction.user.username}`
                )
            );

        await interaction.reply({
            components: [begContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleBeg:', error);
        await interaction.reply({
            content: '❌ There was an error processing your beg. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ BALANCE SUBCOMMAND ------------------
async function handleBalance(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();
    const island = getIslandEmoji();

    try {
        const player = await Player.findOne({
            where: { playerId: targetUser.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(targetUser.username)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(targetUser.id);
        const level = await Level.getOrCreate(targetUser.id);
        const xpNeeded = level.getXPNeeded();
        const progress = Math.min(Math.max(level.getProgress ? level.getProgress() : 0, 0), 100);
        const progressBar = buildProgressBar(progress, 100, 10);

        const balanceContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## 💰 ${targetUser.username}'s Balance`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `🆔 Player **#${player.playerNumber}**  •  📈 Level **${level.level}**`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder({
                            media: { url: targetUser.displayAvatarURL({ extension: 'png', size: 128 }) }
                        })
                    )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💵 Economy**\n` +
                    `Balance: ${economy.balance.toLocaleString()} ${coin}\n` +
                    `Total Earned: ${economy.totalEarned.toLocaleString()} ${coin}\n` +
                    `Total Spent: ${economy.totalSpent.toLocaleString()} ${coin}\n` +
                    `Daily Streak: ${economy.dailyStreak} days`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💎 Island Fragments**\n` +
                    `${economy.islandFragments.toLocaleString()} ${island}\n` +
                    `Total Earned: ${economy.totalFragmentsEarned.toLocaleString()} ${island}\n` +
                    `Total Spent: ${economy.totalFragmentsSpent.toLocaleString()} ${island}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📊 XP Progress**\n${progressBar}\n${level.currentXP.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  •  ${progress}%`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# Requested by ${interaction.user.username}`)
            );

        await interaction.reply({
            components: [balanceContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleBalance:', error);
        await interaction.reply({
            content: '❌ There was an error fetching your balance. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ ROB SUBCOMMAND ------------------
async function handleRob(interaction) {
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();

    try {
        const player = await Player.findOne({
            where: { playerId: interaction.user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(interaction.user.username)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(interaction.user.id);
        const canRob = await economy.canRob();

        if (!canRob) {
            const remainingSeconds = await economy.getRobCooldown();
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            let timeString = '';
            if (minutes > 0) timeString += `${minutes}m `;
            timeString += `${seconds}s`;

            return await interaction.reply({
                components: [buildCooldownContainer(
                    'Rob Cooldown',
                    'You need to wait before attempting another robbery!',
                    timeString,
                    '1 minute'
                )],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const level = await Level.getOrCreate(interaction.user.id);
        const multiplier = await getPrestigeMultiplier(interaction.user.id);

        const success = Math.random() < 0.02;

        let coinsEarned = 0;
        let xpGained = 0;
        let resultMessage = '';
        let resultColor = 0x00FF00;
        let resultTitle = '';

        const successResponses = [
            'You successfully pulled off the heist! The vault was overflowing with treasure!',
            'The robbery was a massive success! You got away with a fortune!',
            'You cracked the main vault and hit the jackpot!',
            'The guards were distracted! You made off with a massive payout!',
            'You executed the perfect heist! The rewards are incredible!'
        ];

        const failResponses = [
            'The guards caught you red-handed! You barely escaped with your life!',
            'The alarms went off instantly! You had to flee with nothing!',
            'The police arrived before you could grab anything! Zero coins!',
            'You triggered every security system in the building! Total failure!',
            'The vault was empty and the guards were waiting for you! You got nothing!',
            'You were ambushed by the security team! You lost everything!',
            'The heist was a complete disaster! You barely made it out!',
            'Your getaway car broke down! You got caught!'
        ];

        if (success) {
            let minReward = 5000;
            let maxReward = 10000;

            // Apply prestige multiplier to gold ONLY
            if (multiplier > 0) {
                minReward = Math.floor(minReward * (1 + multiplier));
                maxReward = Math.floor(maxReward * (1 + multiplier));
            }

            coinsEarned = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
            // XP does NOT get prestige multiplier
            xpGained = coinsEarned;
            resultMessage = successResponses[Math.floor(Math.random() * successResponses.length)];
            resultColor = 0x00FF00;
            resultTitle = '✅ Heist Successful!';

            await economy.addBalance(coinsEarned, 'rob_success');
        } else {
            coinsEarned = 0;
            // XP does NOT get prestige multiplier on fail either
            xpGained = 500;
            resultMessage = failResponses[Math.floor(Math.random() * failResponses.length)];
            resultColor = 0xFF0000;
            resultTitle = '❌ Heist Failed!';
        }

        await economy.setRobCooldown();

        const xpResult = await level.addXP(xpGained, economy);

        const multiplierText = multiplier > 0 ? ` (${multiplier}x multiplier applied to gold!)` : '';

        const robContainer = new ContainerBuilder()
            .setAccentColor(resultColor)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 🔫 ${resultTitle}`)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(resultMessage + multiplierText)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

        const levelUpText = buildLevelUpText(xpResult);
        if (levelUpText) {
            robContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(levelUpText)
            );
        }

        robContainer
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💵 Economy**\n` +
                    `Coins Earned: ${coinsEarned > 0 ? `${plus}${coinsEarned.toLocaleString()}` : '0'} ${coin}\n` +
                    `New Balance: ${economy.balance.toLocaleString()} ${coin}`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 Leveling**\nXP Gained: ${plus}${xpGained.toLocaleString()} XP`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ⏰ Next Rob Available: <t:${Math.floor((Date.now() + 60 * 1000) / 1000)}:R> • Attempted by ${interaction.user.username}`
                )
            );

        await interaction.reply({
            components: [robContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleRob:', error);
        await interaction.reply({
            content: '❌ There was an error processing your robbery. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// ------------------ DAILY SUBCOMMAND ------------------
async function handleDaily(interaction) {
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();

    try {
        const player = await Player.findOne({
            where: { playerId: interaction.user.id }
        });

        if (!player || !player.isRegistered) {
            return await interaction.reply({
                components: [buildNotRegisteredContainer(interaction.user.username)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const economy = await Economy.getOrCreate(interaction.user.id);
        const canClaim = await economy.canClaimDaily();

        if (!canClaim) {
            const cooldown = await economy.getDailyCooldown();
            let timeString = '';
            if (cooldown.hours > 0) timeString += `${cooldown.hours}h `;
            timeString += `${cooldown.minutes}m`;

            return await interaction.reply({
                components: [buildCooldownContainer(
                    'Daily Reward Cooldown',
                    'You already claimed your daily reward!',
                    timeString,
                    '24 hours'
                )],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const level = await Level.getOrCreate(interaction.user.id);
        const multiplier = await getPrestigeMultiplier(interaction.user.id);

        let baseReward = Math.floor(Math.random() * 100) + 100;
        // Apply prestige multiplier to gold ONLY
        if (multiplier > 0) {
            baseReward = Math.floor(baseReward * (1 + multiplier));
        }

        const streakBonus = Math.min(economy.dailyStreak * 0.1, 0.5);
        const bonusAmount = Math.floor(baseReward * streakBonus);
        const totalReward = baseReward + bonusAmount;

        await economy.addBalance(totalReward, 'daily');
        await economy.recordDailyClaim();

        // XP does NOT get prestige multiplier
        const xpGained = Math.floor(Math.random() * 50) + 50;
        const xpResult = await level.addXP(xpGained, economy);

        const dailyMessages = [
            `🎉 Daily reward claimed! You received **${plus}${totalReward}** ${coin}!`,
            `💰 Another day, another reward! **${plus}${totalReward}** ${coin} added!`,
            `✨ Your daily reward of **${plus}${totalReward}** ${coin} is ready!`,
            `🌟 Daily bonus! You got **${plus}${totalReward}** ${coin}!`,
            `🎁 Here's your daily reward: **${plus}${totalReward}** ${coin}!`
        ];

        const message = dailyMessages[Math.floor(Math.random() * dailyMessages.length)];
        const multiplierText = multiplier > 0 ? ` (${multiplier}x multiplier applied to gold!)` : '';

        const dailyContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## 📅 Daily Reward Claimed!')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(message + multiplierText)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

        const levelUpText = buildLevelUpText(xpResult);
        if (levelUpText) {
            dailyContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(levelUpText)
            );
        }

        dailyContainer
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**💵 Economy**\n` +
                    `Reward: ${plus}${totalReward} ${coin}\n` +
                    `New Balance: ${economy.balance.toLocaleString()} ${coin}\n` +
                    `Bonus: ${plus}${bonusAmount} ${coin} (${Math.floor(streakBonus * 100)}% streak bonus!)\n` +
                    `Streak: ${economy.dailyStreak} days`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📈 Leveling**\nXP Gained: ${plus}${xpGained} XP`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# ⏰ Next Daily Available: <t:${Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)}:R> • Claimed by ${interaction.user.username}`
                )
            );

        await interaction.reply({
            components: [dailyContainer],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in handleDaily:', error);
        await interaction.reply({
            content: '❌ There was an error claiming your daily reward. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}
