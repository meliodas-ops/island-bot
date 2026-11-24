// serverModels/Leveling/leveling.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Leveling = sequelize.define('Leveling', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        userId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            comment: 'Discord User ID'
        },
        guildId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            comment: 'Discord Guild/Server ID'
        },
        level: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        currentXP: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalXP: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        messageCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total messages sent in this server'
        },
        lastMessageAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Last time user sent a message'
        }
    }, {
        tableName: 'server_leveling',
        timestamps: true
    });

    // Unique constraint for userId + guildId
    Leveling.addHook('beforeCreate', (leveling, options) => {
        // Ensure uniqueness of userId + guildId combination
    });

    // Static method to get or create leveling record
    Leveling.getOrCreate = async function (userId, guildId) {
        const [record, created] = await this.findOrCreate({
            where: { userId, guildId },
            defaults: {
                userId,
                guildId,
                level: 1,
                currentXP: 0,
                totalXP: 0,
                messageCount: 0
            }
        });
        return record;
    };

    // Static method to get XP needed for a level (Amari formula: 5 * level^2 + 50 * level + 100)
    Leveling.getXPNeededForLevel = function (level) {
        if (!level || level < 1) level = 1;
        return 5 * Math.pow(level, 2) + 50 * level + 100;
    };

    // Static method to get XP needed using different formulas
    Leveling.getXPNeededForLevelWithFormula = function (level, formula = 'amari') {
        if (!level || level < 1) level = 1;

        switch (formula.toLowerCase()) {
            case 'atom-bot':
                return Math.floor(100 * Math.pow(1.5, level - 1));
            case 'arcane-bot':
                return Math.floor(50 * Math.pow(1.8, level - 1));
            case 'amari':
            default:
                return 5 * Math.pow(level, 2) + 50 * level + 100;
        }
    };

    // Instance method to add XP
    Leveling.prototype.addXP = async function (amount, guildId) {
        this.currentXP += amount;
        this.totalXP += amount;

        let leveledUp = false;
        let newLevels = 0;
        let levelUpDetails = [];

        // Get XP needed for next level
        const settings = await this.constructor.getSettings(guildId);
        const formula = settings ? settings.levelingFormula : 'amari';
        let xpNeeded = this.constructor.getXPNeededForLevelWithFormula(this.level, formula);

        while (this.currentXP >= xpNeeded) {
            this.currentXP -= xpNeeded;
            this.level += 1;
            leveledUp = true;
            newLevels++;
            levelUpDetails.push({ level: this.level });

            // Calculate XP needed for next level
            xpNeeded = this.constructor.getXPNeededForLevelWithFormula(this.level, formula);
        }

        await this.save();

        return {
            leveledUp,
            newLevels,
            currentLevel: this.level,
            currentXP: this.currentXP,
            totalXP: this.totalXP,
            levelUpDetails
        };
    };

    // Get progress percentage
    Leveling.prototype.getProgress = function (guildId) {
        const xpNeeded = this.constructor.getXPNeededForLevel(this.level);
        if (xpNeeded <= 0) return 0;

        let progress = Math.floor((this.currentXP / xpNeeded) * 100);
        if (progress < 0) progress = 0;
        if (progress > 100) progress = 100;

        return progress;
    };

    // Static method to get server leaderboard
    Leveling.getServerLeaderboard = async function (guildId, limit = 10) {
        return await this.findAll({
            where: { guildId },
            order: [
                ['level', 'DESC'],
                ['totalXP', 'DESC']
            ],
            limit: limit
        });
    };

    // Static method to get server settings
    Leveling.getSettings = async function (guildId) {
        const { serverModels } = require('../../utils/serverDatabase');
        const Settings = serverModels.ServerSettings;
        const settings = await Settings.findOne({ where: { guildId } });
        return settings;
    };

    return Leveling;
};