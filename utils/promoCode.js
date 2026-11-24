// utils/promoCode.js
const { models } = require('./database');
const { getEmoji } = require('./emojis');

/**
 * Parse a promo code amount string
 * @param {string} amountStr - The amount string (e.g., "100", "random 100-200")
 * @returns {number} The parsed amount
 */
function parseAmount(amountStr) {
    if (typeof amountStr === 'string' && amountStr.toLowerCase().startsWith('random ')) {
        const range = amountStr.substring(7).trim();
        const parts = range.split('-');
        if (parts.length === 2) {
            const min = parseInt(parts[0].trim());
            const max = parseInt(parts[1].trim());
            if (!isNaN(min) && !isNaN(max) && min <= max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }
        }
        return parseInt(amountStr) || 0;
    }
    return parseInt(amountStr) || 0;
}

/**
 * Apply a promo code to a user
 * @param {string} code - The promo code
 * @param {string} userId - The user ID redeeming the code
 * @returns {Object} Result of the redemption
 */
async function applyPromoCode(code, userId) {
    const { PromoCode, PromoReward, RedemptionReward, Economy, Level, PromoRedemption } = models;

    // Check if models exist
    if (!PromoCode || !Economy || !Level || !PromoRedemption) {
        console.error('Missing required models:', { PromoCode: !!PromoCode, Economy: !!Economy, Level: !!Level, PromoRedemption: !!PromoRedemption });
        return { success: false, message: '❌ System error: Missing models. Please contact an administrator.' };
    }

    return PromoCode.sequelize.transaction({type:"IMMEDIATE"}, async (transaction) => {
        const promoCode = await PromoCode.findOne({ where: { code: code.toUpperCase() }, transaction });
        if (!promoCode) return { success: false, message: '❌ Invalid promo code!' };
        if (!promoCode.isUsable()) {
            let reason = '❌ This promo code is no longer valid!';
            if (!promoCode.isActive) reason = '❌ This promo code has been deactivated!';
            if (promoCode.expiresAt && new Date() > promoCode.expiresAt) reason = '❌ This promo code has expired!';
            if (promoCode.uses !== null && promoCode.usedCount >= promoCode.uses) reason = '❌ This promo code has been used up!';
            return { success: false, message: reason };
        }
        if (promoCode.userId && promoCode.userId !== userId) return { success: false, message: '❌ This promo code is not for you!' };
        if (await PromoRedemption.findOne({ where: { promoCodeId: promoCode.id, playerId: userId }, transaction })) {
            return { success: false, message: '❌ You have already redeemed this code!' };
        }
        const economy = await Economy.findOne({ where: { playerId: userId }, transaction });
        const level = await Level.findOne({ where: { playerId: userId }, transaction });
        if (!economy || !level) return { success: false, message: '❌ You need to be registered to redeem codes!' };

        let definitions = PromoReward ? await PromoReward.findAll({ where: { promoCodeId: promoCode.id }, transaction }) : [];
        if (!definitions.length) {
            const rangeText = String(promoCode.amount || '').trim().toLowerCase();
            const range = rangeText.match(/^random\s+(\d+)\s*-\s*(\d+)$/);
            const fixed = rangeText.match(/^(\d+)$/);
            if (!range && !fixed) return { success: false, message: '❌ This promo code has an invalid reward configuration.' };
            const minAmount = Number(range ? range[1] : fixed[1]);
            const maxAmount = Number(range ? range[2] : fixed[1]);
            definitions = String(promoCode.currency || 'coin').split(',').map(raw => {
                const currency = raw.trim().toLowerCase();
                return { rewardType: currency === 'xp' ? 'xp' : 'currency', currencyCode: currency === 'xp' ? null : (currency === 'fragments' ? 'island_fragment' : currency), minAmount, maxAmount };
            });
        }

        const granted = [];
        const coin = getEmoji('common-coin');
        const xp = getEmoji('xp');
        const island = getEmoji('islandFragment');
        const redemption = await PromoRedemption.create({ promoCodeId: promoCode.id, playerId: userId, reward: '' }, { transaction });
        const sharedRoll = Math.random();
        for (const definition of definitions) {
            const amount = Number(definition.minAmount) === Number(definition.maxAmount)
                ? Number(definition.minAmount)
                : Math.floor(sharedRoll * (Number(definition.maxAmount) - Number(definition.minAmount) + 1)) + Number(definition.minAmount);
            if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Promo reward amount is invalid');
            if (definition.rewardType === 'xp') {
                await level.addXP(amount, economy, { transaction });
                granted.push({ rewardType: 'xp', currencyCode: null, amount, label: `${xp} ${amount.toLocaleString()} XP` });
            } else if (definition.currencyCode === 'coin') {
                await economy.addBalance(amount, 'promo_code', { transaction });
                granted.push({ rewardType: 'currency', currencyCode: 'coin', amount, label: `${coin} ${amount.toLocaleString()} coins` });
            } else if (definition.currencyCode === 'island_fragment') {
                await economy.addFragments(amount, 'promo_code', { transaction });
                granted.push({ rewardType: 'currency', currencyCode: 'island_fragment', amount, label: `${island} ${amount.toLocaleString()} fragments` });
            } else {
                throw new Error(`Unsupported promo currency: ${definition.currencyCode}`);
            }
            if (RedemptionReward) await RedemptionReward.create({
                redemptionId: redemption.id, rewardType: definition.rewardType,
                currencyCode: definition.currencyCode, amount
            }, { transaction });
        }
        if (!granted.length) throw new Error('Promo code has no rewards');
        redemption.reward = granted.map(reward => reward.label).join(', ');
        await redemption.save({ transaction });
        await promoCode.useCode(transaction);
        const rewards = granted.map(reward => reward.label);
        return { success: true, message: `✅ Promo code redeemed successfully!\n\n**Rewards:**\n• ${rewards.join('\n• ')}`, rewards };
    });
}

/**
 * Generate a unique promo code
 * @param {number} length - Length of the code
 * @returns {string} A unique code
 */
async function generateUniqueCode(length = 8) {
    const PromoCode = models.PromoCode;
    if (!PromoCode) {
        throw new Error('PromoCode model not found');
    }
    return await PromoCode.generateUniqueCode(length);
}

/**
 * Get all promo codes a user has redeemed
 * @param {string} userId - The user ID
 * @param {number} page - Page number
 * @param {number} pageSize - Items per page
 * @returns {Object} Redemptions with pagination
 */
async function getUserRedemptions(userId, page = 1, pageSize = 10) {
    const { PromoRedemption, PromoCode } = models;

    // Check if models exist
    if (!PromoRedemption || !PromoCode) {
        console.error('Missing models in getUserRedemptions:', { PromoRedemption: !!PromoRedemption, PromoCode: !!PromoCode });
        return { count: 0, rows: [], totalPages: 0 };
    }

    const offset = (page - 1) * pageSize;

    // Get redemptions
    const { count, rows } = await PromoRedemption.findAndCountAll({
        where: { playerId: userId },
        order: [['redeemedAt', 'DESC']],
        limit: pageSize,
        offset
    });

    // Fetch promo code details separately for each redemption
    const rowsWithDetails = await Promise.all(rows.map(async (redemption) => {
        try {
            const promoCode = await PromoCode.findOne({
                where: { id: redemption.promoCodeId },
                attributes: ['code', 'currency', 'amount']
            });

            // Convert to plain object and add PromoCode
            const plain = redemption.toJSON();
            plain.PromoCode = promoCode ? promoCode.toJSON() : null;
            return plain;
        } catch (error) {
            console.error('Error fetching promo code for redemption:', error);
            const plain = redemption.toJSON();
            plain.PromoCode = null;
            return plain;
        }
    }));

    return {
        count,
        rows: rowsWithDetails,
        totalPages: Math.ceil(count / pageSize) || 1
    };
}

// Export all functions
module.exports = {
    parseAmount,
    applyPromoCode,
    generateUniqueCode,
    getUserRedemptions
};
