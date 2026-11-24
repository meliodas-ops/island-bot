const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WalletTransaction', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    walletId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.BIGINT, allowNull: false },
    balanceAfter: { type: DataTypes.BIGINT, allowNull: false },
    reason: { type: DataTypes.STRING(64), allowNull: false },
    referenceType: { type: DataTypes.STRING(32), allowNull: true },
    referenceId: { type: DataTypes.STRING(64), allowNull: true },
    createdBy: { type: DataTypes.STRING(20), allowNull: true }
}, {
    tableName: 'wallet_transactions', timestamps: true, updatedAt: false,
    indexes: [{ fields: ['walletId', 'createdAt'] }]
});
