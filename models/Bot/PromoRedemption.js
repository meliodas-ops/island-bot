// models/Bot/PromoRedemption.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PromoRedemption = sequelize.define('PromoRedemption', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        promoCodeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Reference to PromoCode table'
        },
        playerId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            comment: 'Discord User ID who redeemed'
        },
        redeemedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        reward: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'What was given (e.g., "100 coins", "50 XP")'
        }
    }, {
        tableName: 'promo_redemptions',
        timestamps: true,
        indexes: [{ unique: true, fields: ['promoCodeId', 'playerId'] }]
    });

    // Static method to check if a user has redeemed a specific code
    PromoRedemption.hasUserRedeemed = async function (promoCodeId, playerId) {
        const redemption = await this.findOne({
            where: {
                promoCodeId,
                playerId
            }
        });
        return !!redemption;
    };

    // Static method to get all redemptions for a user
    PromoRedemption.getUserRedemptions = async function (playerId, limit = 10, offset = 0) {
        const { count, rows } = await this.findAndCountAll({
            where: { playerId },
            order: [['redeemedAt', 'DESC']],
            limit,
            offset
        });
        return { count, rows };
    };

    // Static method to get all redemptions for a promo code
    PromoRedemption.getCodeRedemptions = async function (promoCodeId) {
        return await this.findAll({
            where: { promoCodeId },
            order: [['redeemedAt', 'DESC']]
        });
    };

    return PromoRedemption;
};
