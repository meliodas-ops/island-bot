const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PlayerActionState', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    playerId: { type: DataTypes.STRING(20), allowNull: false },
    actionCode: { type: DataTypes.STRING(32), allowNull: false },
    cooldownUntil: { type: DataTypes.DATE, allowNull: true },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
    streak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'player_action_states', timestamps: true,
    indexes: [{ unique: true, fields: ['playerId', 'actionCode'] }]
});
