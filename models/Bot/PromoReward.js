const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PromoReward', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    promoCodeId: { type: DataTypes.INTEGER, allowNull: false },
    rewardType: { type: DataTypes.STRING(32), allowNull: false },
    currencyCode: { type: DataTypes.STRING(32), allowNull: true },
    minAmount: { type: DataTypes.BIGINT, allowNull: false },
    maxAmount: { type: DataTypes.BIGINT, allowNull: false }
}, {
    tableName: 'promo_rewards', timestamps: true,
    indexes: [{ unique: true, fields: ['promoCodeId', 'rewardType', 'currencyCode'] }]
});
