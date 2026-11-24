const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('RedemptionReward', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    redemptionId: { type: DataTypes.INTEGER, allowNull: false },
    rewardType: { type: DataTypes.STRING(32), allowNull: false },
    currencyCode: { type: DataTypes.STRING(32), allowNull: true },
    amount: { type: DataTypes.BIGINT, allowNull: false }
}, {
    tableName: 'redemption_rewards', timestamps: true,
    indexes: [{ fields: ['redemptionId'] }]
});
