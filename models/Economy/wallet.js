const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Wallet', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    playerId: { type: DataTypes.STRING(20), allowNull: false },
    currencyCode: { type: DataTypes.STRING(32), allowNull: false },
    balance: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    totalEarned: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    totalSpent: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'wallets', timestamps: true,
    validate: {
        nonNegativeBalance() {
            if (Number(this.balance) < 0) throw new Error('Wallet balance cannot be negative');
        }
    },
    indexes: [{ unique: true, fields: ['playerId', 'currencyCode'] }]
});
