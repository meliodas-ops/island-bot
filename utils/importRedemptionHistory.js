// Legacy receipts contain Discord emoji IDs as well as amounts. Only import numbers followed by reward units.
module.exports = async function importRedemptionHistory(models, transaction) {
    for (const receipt of await models.PromoRedemption.findAll({transaction})) {
        const matches = String(receipt.reward || '').matchAll(/([\d][\d,]*)\s+(coins?|XP|fragments?)\b/gi);
        for (const [,number,unit] of matches) {
            const xp = unit.toLowerCase() === 'xp';
            await models.RedemptionReward.findOrCreate({
                where: {redemptionId:receipt.id,rewardType:xp ? 'xp':'currency',currencyCode:xp ? null : unit.toLowerCase().startsWith('coin') ? 'coin':'island_fragment'},
                defaults:{amount:Number(number.replaceAll(',',''))},transaction
            });
        }
    }
};
