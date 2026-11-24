const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Badge', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    image: { type: DataTypes.STRING(255), allowNull: true },
    icon: { type: DataTypes.STRING(255), allowNull: true },
    color: { type: DataTypes.STRING(32), allowNull: true }
}, { tableName: 'badges', timestamps: true });
