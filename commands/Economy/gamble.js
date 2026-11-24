// commands/Economy/gamble.js
const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ActionRowBuilder
} = require('discord.js');
const { models } = require('../../utils/database');
const { getEmoji } = require('../../utils/emojis');

// Developer ID
const DEV_ID = '663231875707568139';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('💎 Gamble your coins by mining for diamonds!')
        .addSubcommand(sub => sub
            .setName('mines')
            .setDescription('💎 Mine for diamonds in a grid!')
            .addIntegerOption(option =>
                option.setName('bet')
                    .setDescription('Amount of coins to bet (min 100)')
                    .setRequired(true)
                    .setMinValue(100)
                    .setMaxValue(500000)
            )
            .addStringOption(option =>
                option.setName('size')
                    .setDescription('Grid size (4x4, 5x5)')
                    .setRequired(true)
                    .addChoices(
                        { name: '4x4', value: '4' },
                        { name: '5x5', value: '5' }
                    )
            )
        ),
    supportServer: false,

    // Store active mine games
    activeMineGames: new Map(),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'mines') {
            await handleMineStart(interaction);
        } else {
            await interaction.reply({
                content: '❌ Unknown subcommand!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

// ------------------ SAFE INTERACTION HELPERS ------------------
// Prevent "Interaction has already been acknowledged" (40060) and
// "Unknown interaction" (10062) crashes if an interaction was already
// handled or its token expired before we got to it.
async function safeUpdate(buttonInteraction, payload) {
    try {
        if (buttonInteraction.replied || buttonInteraction.deferred) {
            return await buttonInteraction.editReply(payload);
        }
        return await buttonInteraction.update(payload);
    } catch (error) {
        if (error.code === 40060 || error.code === 10062) {
            console.warn('Interaction already handled/expired, skipping update:', error.code);
            return;
        }
        throw error;
    }
}

async function safeReply(buttonInteraction, payload) {
    try {
        if (buttonInteraction.replied || buttonInteraction.deferred) {
            return await buttonInteraction.followUp(payload);
        }
        return await buttonInteraction.reply(payload);
    } catch (error) {
        if (error.code === 40060 || error.code === 10062) {
            console.warn('Interaction already handled/expired, skipping reply:', error.code);
            return;
        }
        throw error;
    }
}

// Get emojis
function getCoinEmoji() {
    return getEmoji('common-coin');
}

function getPlusEmoji() {
    return getEmoji('plus');
}

function getDiamondEmoji() {
    return getEmoji('diamond');
}

function getXEmoji() {
    return getEmoji('no');
}

function getDashEmoji() {
    return getEmoji('dash');
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

// Reused insufficient balance container
function buildInsufficientBalanceContainer(balance, amount) {
    const coin = getCoinEmoji();
    return new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## ❌ Insufficient Balance')
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `You don't have enough coins to gamble!\n\n` +
                `**Your Balance**\n${balance.toLocaleString()} ${coin}\n\n` +
                `**Amount Tried**\n${amount.toLocaleString()} ${coin}`
            )
        );
}

// Reused "level up" text block
function buildLevelUpText(xpResult) {
    const coin = getCoinEmoji();
    const plus = getPlusEmoji();
    if (!xpResult || !xpResult.leveledUp) return null;

    return (
        `**🎉 Level Up!**\n` +
        `You reached Level ${xpResult.currentLevel}!\n` +
        `📈 Level ${xpResult.currentLevel} Rewards: ${plus}${xpResult.totalCoinsEarned} ${coin}\n` +
        `💎 Total Level Up Rewards: ${plus}${xpResult.totalCoinsEarned} ${coin}!`
    );
}

// ------------------ MINE SUBCOMMAND ------------------
// Fixed mine (X) counts per grid size — everything else is a diamond
const MINE_COUNTS = {
    4: 3,
    5: 6
};

// Build grid with random diamonds and X's
function generateGrid(size) {
    const totalCells = size * size;
    const grid = [];
    const mineCount = MINE_COUNTS[size] ?? Math.floor(totalCells * 0.33);
    const diamondCount = totalCells - mineCount;

    // Create positions and shuffle
    const positions = Array.from({ length: totalCells }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Mark first diamondCount positions as diamonds
    const diamondPositions = new Set(positions.slice(0, diamondCount));

    // Build grid
    for (let i = 0; i < totalCells; i++) {
        grid.push({
            index: i,
            isDiamond: diamondPositions.has(i),
            isRevealed: false
        });
    }

    return grid;
}

// Calculate payout multiplier based on grid size and diamonds found
// multiplier = 1 + (rate * diamondsFound)
// so 0 diamonds found = 1x (you keep exactly your bet back on cashout/timeout)
function calculateMultiplier(size, diamondsFound) {
    const rates = {
        4: 0.2,
        5: 0.2
    };

    const rate = rates[size];
    if (!rate) return 1;

    return 1 + (rate * diamondsFound);
}

// XP awarded per diamond found, varies by grid size
function getXpPerDiamond(size) {
    const rates = {
        4: 10,
        5: 30
    };

    return rates[size] ?? 10;
}

// Create the cashout button reflecting current game state.
// Lives as a Section accessory inside the container (see createMineGameEmbed)
// instead of its own action row, since a message can only have 5 action rows
// total and a 5x5 grid already needs all 5 for the cells themselves.
function createCashoutButton(game) {
    return new ButtonBuilder()
        .setLabel('💰 Cashout')
        .setCustomId('mine_cashout')
        .setStyle(ButtonStyle.Success)
        .setDisabled(game.cashedOut || game.gameOver);
}

// Create a single dev toggle button (reveal <-> unreveal) as a Section
// accessory. A Section can only hold ONE button accessory (not an
// ActionRow with multiple buttons), so this replaces the old two-button
// reveal/unreveal pair with one toggle. This also avoids spending one of
// the message's 5 action-row slots, which a 5x5 grid already fully uses.
function createDevToggleButton(game, userId) {
    const isDev = userId === DEV_ID;
    const disabled = game.cashedOut || game.gameOver || !isDev;

    if (game.revealAll) {
        return new ButtonBuilder()
            .setLabel('🔒 Unreveal')
            .setCustomId('mine_dev_unreveal')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled);
    }

    return new ButtonBuilder()
        .setLabel('🔍 Reveal')
        .setCustomId('mine_dev_reveal')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);
}

// Create mine game embed (container)
function createMineGameEmbed(game, userId) {
    const coin = getCoinEmoji();
    const size = game.size;

    const container = new ContainerBuilder()
        .setAccentColor(game.gameOver ? (game.won ? 0xFFD700 : 0xFF0000) : 0x00D4FF)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 💎 Diamond Mine`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Grid Size**: ${size}x${size}\n` +
                `**Bet Amount**: ${game.bet.toLocaleString()} ${coin}\n` +
                `**Diamonds Found**: ${game.diamondsFound || 0}\n` +
                `**Revealed**: ${game.revealedCount}/${size * size}\n` +
                `**Multiplier**: ${game.totalMultiplier ? game.totalMultiplier.toFixed(2) : '1.00'}x\n` +
                `**Potential Win**: ${Math.floor(game.bet * (game.totalMultiplier || 1)).toLocaleString()} ${coin}`
            )
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# 💎 = Diamond • ❌ = Lose All • Click cells to reveal!`
                    )
                )
                .setButtonAccessory(createCashoutButton(game))
        );

    // Add a dev toggle button as its own Section if user is dev.
    // Using a Section (with a single button accessory) instead of an
    // ActionRow means this doesn't consume one of the message's 5
    // action-row slots, which the grid itself needs (up to 5 rows for
    // a 5x5 board).
    if (userId === DEV_ID) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# 🔧 Developer Tools`)
                )
                .setButtonAccessory(createDevToggleButton(game, userId))
        );
    }

    return container;
}

// Create mine game grid buttons (cells only — cashout and dev toggle live
// in the container now, as Section accessories)
function createMineGameButtons(game, revealAll = false) {
    const rows = [];
    const size = game.size;
    const dash = getDashEmoji();
    const diamond = getDiamondEmoji();
    const x = getXEmoji();

    for (let row = 0; row < size; row++) {
        const rowButtons = [];
        for (let col = 0; col < size; col++) {
            const index = row * size + col;
            const cell = game.grid[index];

            let button;
            // If revealAll is true, show everything as revealed
            if (revealAll || cell.isRevealed || game.gameOver) {
                if (cell.isDiamond) {
                    button = new ButtonBuilder()
                        .setEmoji(diamond)
                        .setCustomId(`mine_cell_${index}`)
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true);
                } else {
                    button = new ButtonBuilder()
                        .setEmoji(x)
                        .setCustomId(`mine_cell_${index}`)
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true);
                }
            } else {
                button = new ButtonBuilder()
                    .setEmoji(dash)
                    .setCustomId(`mine_cell_${index}`)
                    .setStyle(ButtonStyle.Primary);
            }
            rowButtons.push(button);
        }
        rows.push(new ActionRowBuilder().addComponents(rowButtons));
    }

    return rows;
}

async function handleMineStart(interaction) {
    const Player = models.Player;
    const Economy = models.Economy;
    const Level = models.Level;

    const bet = interaction.options.getInteger('bet');
    const size = parseInt(interaction.options.getString('size'));
    const coin = getCoinEmoji();

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

        if (economy.balance < bet) {
            return await interaction.reply({
                components: [buildInsufficientBalanceContainer(economy.balance, bet)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const existingGame = module.exports.activeMineGames.get(interaction.user.id);
        if (existingGame && !existingGame.gameOver) {
            return await interaction.reply({
                content: '❌ You already have an active mining game! Finish it first.',
                flags: MessageFlags.Ephemeral
            });
        }

        await economy.removeBalance(bet, 'mine_bet');

        const grid = generateGrid(size);

        const game = {
            userId: interaction.user.id,
            bet: bet,
            size: size,
            grid: grid,
            diamondsFound: 0,
            revealedCount: 0,
            gameOver: false,
            cashedOut: false,
            totalMultiplier: 1,
            winnings: 0,
            totalDiamonds: grid.filter(c => c.isDiamond).length,
            xpGained: 0,
            won: false,
            messageId: null,
            processing: false, // lock to prevent overlapping clicks racing each other
            revealAll: false // track if dev revealed all
        };

        module.exports.activeMineGames.set(interaction.user.id, game);

        const embed = createMineGameEmbed(game, interaction.user.id);
        const buttons = createMineGameButtons(game);

        const reply = await interaction.reply({
            components: [embed, ...buttons],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

        // Store the message ID
        game.messageId = reply.id;

        // Create a simple collector
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000
        });

        collector.on('collect', async (buttonInteraction) => {
            // Acknowledge immediately so the 3-second interaction token
            // doesn't expire while we do async DB work further down.
            try {
                await buttonInteraction.deferUpdate();
            } catch (error) {
                console.error('Failed to defer button interaction:', error.message);
                return;
            }

            // Check if it's the right user
            if (buttonInteraction.user.id !== interaction.user.id) {
                return await safeReply(buttonInteraction, {
                    content: '❌ This is not your game!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Check if game is over
            if (game.gameOver) {
                return await safeReply(buttonInteraction, {
                    content: '❌ This game is already over!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Handle dev toggle button
            if (buttonInteraction.customId === 'mine_dev_reveal' || buttonInteraction.customId === 'mine_dev_unreveal') {
                // Only the dev can use this
                if (buttonInteraction.user.id !== DEV_ID) {
                    return await safeReply(buttonInteraction, {
                        content: '❌ You are not authorized to use this!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Toggle reveal state
                game.revealAll = buttonInteraction.customId === 'mine_dev_reveal';

                const embed = createMineGameEmbed(game, buttonInteraction.user.id);
                const buttons = createMineGameButtons(game, game.revealAll);

                // If revealing, disable the cell buttons too (they're just
                // for viewing); if unrevealing, restore normal clickable state.
                if (game.revealAll) {
                    for (const row of buttons) {
                        for (const component of row.components) {
                            component.setDisabled(true);
                        }
                    }
                }

                await safeUpdate(buttonInteraction, {
                    components: [embed, ...buttons],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                });

                return;
            }

            // Prevent a racing/duplicate click from being processed while the
            // previous click's DB calls and message update are still in flight.
            if (game.processing) {
                return await safeReply(buttonInteraction, {
                    content: '⏳ Still processing your last move, hang on!',
                    flags: MessageFlags.Ephemeral
                });
            }
            game.processing = true;

            try {
                // Handle the interaction
                await handleMineInteraction(buttonInteraction, game);
            } finally {
                game.processing = false;
            }
        });

        collector.on('end', async () => {
            const currentGame = module.exports.activeMineGames.get(interaction.user.id);
            if (currentGame && !currentGame.gameOver) {
                await autoMineCashout(interaction, currentGame);
            }
            module.exports.activeMineGames.delete(interaction.user.id);
        });

        // Store collector reference
        game.collector = collector;

    } catch (error) {
        console.error('Error in handleMineStart:', error);
        await interaction.reply({
            content: '❌ There was an error starting the mining game.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// Handle mine interaction
async function handleMineInteraction(buttonInteraction, game) {
    const customId = buttonInteraction.customId;

    if (customId === 'mine_cashout') {
        await handleMineCashout(buttonInteraction, game);
        return;
    }

    // Handle cell click
    const cellIndex = parseInt(customId.split('_')[2]);
    const cell = game.grid[cellIndex];

    if (cell.isRevealed) {
        await safeReply(buttonInteraction, {
            content: '❌ This cell is already revealed!',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Reveal the cell
    cell.isRevealed = true;
    game.revealedCount++;

    if (cell.isDiamond) {
        game.diamondsFound++;
        game.totalMultiplier = calculateMultiplier(game.size, game.diamondsFound);

        if (game.diamondsFound === game.totalDiamonds) {
            game.gameOver = true;
            game.won = true;
            await finishMineGame(buttonInteraction, game, true);
            return;
        }
    } else {
        game.gameOver = true;
        game.won = false;
        await finishMineGame(buttonInteraction, game, false);
        return;
    }

    // Update the game display
    const embed = createMineGameEmbed(game, buttonInteraction.user.id);
    const buttons = createMineGameButtons(game, game.revealAll);

    await safeUpdate(buttonInteraction, {
        components: [embed, ...buttons],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
}

async function handleMineCashout(buttonInteraction, game) {
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();

    if (game.cashedOut || game.gameOver) {
        await safeReply(buttonInteraction, {
            content: '❌ You cannot cashout now!',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const multiplier = game.totalMultiplier || calculateMultiplier(game.size, game.diamondsFound);
    const finalWinnings = Math.floor(game.bet * multiplier);

    game.cashedOut = true;
    game.gameOver = true;
    game.won = true;
    game.winnings = finalWinnings;

    const economy = await Economy.getOrCreate(game.userId);
    await economy.addBalance(finalWinnings, 'mine_cashout');

    // XP: 200 base + (per-diamond rate, size-dependent) per diamond found
    // If no diamonds found, 0 XP
    const baseXP = 200;
    const xpPerDiamond = getXpPerDiamond(game.size);
    let xpGained = 0;

    if (game.diamondsFound > 0) {
        xpGained = baseXP + (game.diamondsFound * xpPerDiamond);
    }
    game.xpGained = xpGained;

    let xpResult = null;
    if (xpGained > 0) {
        const level = await Level.getOrCreate(game.userId);
        xpResult = await level.addXP(xpGained, economy);
    }

    const diamond = getDiamondEmoji();
    const plus = getPlusEmoji();

    const resultContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 💰 Cashout Successful!`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `You cashed out with ${game.diamondsFound} ${diamond} diamonds found!\n\n` +
                `**💰 Winnings**\n` +
                `${finalWinnings.toLocaleString()} ${coin}\n\n` +
                `**📊 Multiplier**\n` +
                `${multiplier.toFixed(2)}x\n\n` +
                `**📈 XP Gained**\n` +
                `${xpGained > 0 ? `${plus}${xpGained.toLocaleString()} XP (${baseXP} base + ${game.diamondsFound * xpPerDiamond} diamond bonus)` : '0 XP (no diamonds found)'}`
            )
        );

    const levelUpText = buildLevelUpText(xpResult);
    if (levelUpText) {
        resultContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(levelUpText)
        );
    }

    resultContainer
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# Cashed out by ${buttonInteraction.user.username}`
            )
        );

    const disabledButtons = createMineGameButtons(game, game.revealAll);
    for (const row of disabledButtons) {
        for (const component of row.components) {
            component.setDisabled(true);
        }
    }

    await safeUpdate(buttonInteraction, {
        components: [resultContainer, ...disabledButtons],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });

    if (game.collector) {
        game.collector.stop();
    }
    module.exports.activeMineGames.delete(game.userId);
}

async function finishMineGame(buttonInteraction, game, won) {
    const Economy = models.Economy;
    const Level = models.Level;

    const coin = getCoinEmoji();
    const diamond = getDiamondEmoji();
    const x = getXEmoji();
    const plus = getPlusEmoji();

    try {
        let resultContainer;
        let xpGained = 0;
        let xpResult = null;

        if (won) {
            const multiplier = game.totalMultiplier || calculateMultiplier(game.size, game.diamondsFound);
            const winnings = Math.floor(game.bet * multiplier);
            game.winnings = winnings;

            const economy = await Economy.getOrCreate(game.userId);
            await economy.addBalance(winnings, 'mine_all_diamonds');

            // XP: 200 base + (per-diamond rate, size-dependent) per diamond found
            const baseXP = 200;
            const xpPerDiamond = getXpPerDiamond(game.size);
            xpGained = baseXP + (game.diamondsFound * xpPerDiamond);
            game.xpGained = xpGained;

            const level = await Level.getOrCreate(game.userId);
            xpResult = await level.addXP(xpGained, economy);

            resultContainer = new ContainerBuilder()
                .setAccentColor(0xFFD700)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## 🎉 ALL DIAMONDS FOUND!`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `You found all ${game.diamondsFound} ${diamond} diamonds!\n\n` +
                        `**💰 Winnings**\n` +
                        `${winnings.toLocaleString()} ${coin}\n\n` +
                        `**📊 Multiplier**\n` +
                        `${multiplier.toFixed(2)}x\n\n` +
                        `**📈 XP Gained**\n` +
                        `${plus}${xpGained.toLocaleString()} XP (${baseXP} base + ${game.diamondsFound * xpPerDiamond} diamond bonus)`
                    )
                );

            const levelUpText = buildLevelUpText(xpResult);
            if (levelUpText) {
                resultContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(levelUpText)
                );
            }

            resultContainer
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Won by ${buttonInteraction.user.username}`
                    )
                );

        } else {
            // Hit an X - lose all, but get 200 XP consolation
            const economy = await Economy.getOrCreate(game.userId);

            // XP: 200 base (consolation)
            const baseXP = 200;
            xpGained = baseXP;
            game.xpGained = xpGained;

            const level = await Level.getOrCreate(game.userId);
            xpResult = await level.addXP(xpGained, economy);

            resultContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## 💀 BOOM! You Hit an X!`)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `You hit an ${x} and lost everything!\n\n` +
                        `**💰 Lost**\n` +
                        `${game.bet.toLocaleString()} ${coin}\n\n` +
                        `**💎 Diamonds Found**\n` +
                        `${game.diamondsFound}\n\n` +
                        `**📈 XP Gained**\n` +
                        `${plus}${xpGained.toLocaleString()} XP (consolation)`
                    )
                );

            const levelUpText = buildLevelUpText(xpResult);
            if (levelUpText) {
                resultContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(levelUpText)
                );
            }

            resultContainer
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# Lost by ${buttonInteraction.user.username}`
                    )
                );
        }

        const disabledButtons = createMineGameButtons(game, game.revealAll);
        for (const row of disabledButtons) {
            for (const component of row.components) {
                component.setDisabled(true);
            }
        }

        await safeUpdate(buttonInteraction, {
            components: [resultContainer, ...disabledButtons],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error in finishMineGame:', error);
        try {
            await safeReply(buttonInteraction, {
                content: '❌ There was an error finishing your game. Please check your balance.',
                flags: MessageFlags.Ephemeral
            });
        } catch (replyError) {
            console.error('Could not reply:', replyError);
        }
    }

    if (game.collector) {
        game.collector.stop();
    }
    module.exports.activeMineGames.delete(game.userId);
}

async function autoMineCashout(interaction, game) {
    const Economy = models.Economy;
    const Level = models.Level;
    const coin = getCoinEmoji();

    if (game.gameOver || game.cashedOut) return;

    const multiplier = game.totalMultiplier || calculateMultiplier(game.size, game.diamondsFound);
    const winnings = Math.floor(game.bet * multiplier);

    game.winnings = winnings;
    game.cashedOut = true;
    game.gameOver = true;
    game.won = true;

    const economy = await Economy.getOrCreate(game.userId);
    await economy.addBalance(winnings, 'mine_auto_cashout');

    // XP: 200 base + (per-diamond rate, size-dependent) per diamond found
    // If no diamonds found, 0 XP
    const baseXP = 200;
    const xpPerDiamond = getXpPerDiamond(game.size);
    let xpGained = 0;

    if (game.diamondsFound > 0) {
        xpGained = baseXP + (game.diamondsFound * xpPerDiamond);
    }
    game.xpGained = xpGained;

    if (xpGained > 0) {
        const level = await Level.getOrCreate(game.userId);
        await level.addXP(xpGained, economy);
    }

    try {
        await interaction.followUp({
            content: `⏰ **Time's up!** You auto-cashed out with ${game.diamondsFound} diamonds and won ${winnings.toLocaleString()} ${coin}! (${xpGained > 0 ? `${xpGained} XP gained` : '0 XP - no diamonds found'})`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in auto cashout followup:', error);
    }

    if (game.collector) {
        game.collector.stop();
    }
    module.exports.activeMineGames.delete(game.userId);
}