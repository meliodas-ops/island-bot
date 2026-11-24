const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Level = sequelize.define('Level', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        playerId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            comment: 'Discord User ID'
        },
        level: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false
        },
        currentXP: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'XP for current level only'
        },
        totalXP: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Total XP earned across all levels'
        }
    }, {
        tableName: 'levels',
        timestamps: true
    });

    // Amari Leveling Formula: 5 * level^2 + 50 * level + 100
    // This returns the XP needed to go from level to level+1
    Level.getXPForLevel = function (level) {
        if (!level || level < 1) level = 1;
        return 5 * Math.pow(level, 2) + 50 * level + 100;
    };

    // Get level rewards - 100 coins per level
    Level.getLevelRewards = function (level) {
        const coins = level * 100;
        let bonusMessage = '';

        if (level === 5) {
            bonusMessage = '🎁 **Bonus:** +500 bonus coins!';
        } else if (level === 10) {
            bonusMessage = '🎁 **Bonus:** +1000 bonus coins + 🏅 Special Role!';
        } else if (level === 25) {
            bonusMessage = '🎁 **Bonus:** +2500 bonus coins + 👑 Legendary Role!';
        } else if (level === 50) {
            bonusMessage = '🎁 **Bonus:** +5000 bonus coins + ⚡ Mythic Role!';
        } else if (level === 100) {
            bonusMessage = '🎁 **Bonus:** +10000 bonus coins + 🌟 Ultimate Role!';
        } else if (level % 10 === 0 && level > 0) {
            bonusMessage = `🎁 **Bonus:** +${level * 50} bonus coins for reaching level ${level}!`;
        }

        return {
            coins,
            bonusMessage
        };
    };

    // Get or create level record
    Level.getOrCreate = async function (playerId) {
        const [level, created] = await this.findOrCreate({
            where: { playerId },
            defaults: {
                playerId,
                level: 1,
                currentXP: 0,
                totalXP: 0
            }
        });
        return level;
    };

    // Add XP and handle level ups
    Level.prototype.addXP = async function (amount, economy = null, options = {}) {
        this.currentXP += amount;
        this.totalXP += amount;

        let leveledUp = false;
        let newLevels = 0;
        let levelUpDetails = [];
        let totalCoinsEarned = 0;

        // Get XP needed for next level
        let xpNeeded = this.constructor.getXPNeededForLevel(this.level);

        while (this.currentXP >= xpNeeded) {
            this.currentXP -= xpNeeded;
            this.level += 1;
            leveledUp = true;
            newLevels++;

            const rewards = this.constructor.getLevelRewards(this.level);
            totalCoinsEarned += rewards.coins;

            if (economy) {
                await economy.addBalance(rewards.coins, 'level_reward', options);
            }

            levelUpDetails.push({
                level: this.level,
                coins: rewards.coins,
                bonusMessage: rewards.bonusMessage
            });

            // Calculate XP needed for next level
            xpNeeded = this.constructor.getXPNeededForLevel(this.level);
        }

        await this.save(options.transaction ? { transaction: options.transaction } : undefined);

        return {
            leveledUp,
            newLevels,
            currentLevel: this.level,
            currentXP: this.currentXP,
            totalXP: this.totalXP,
            levelUpDetails,
            totalCoinsEarned
        };
    };

    // Fix XP to ensure it's within bounds for current level
    Level.prototype.fixXP = async function () {
        let fixed = false;

        // Get XP needed for next level
        let xpNeeded = this.constructor.getXPNeededForLevel(this.level);

        while (this.currentXP >= xpNeeded) {
            this.currentXP -= xpNeeded;
            this.level += 1;
            fixed = true;
            xpNeeded = this.constructor.getXPNeededForLevel(this.level);
        }

        if (this.currentXP < 0) {
            this.currentXP = 0;
            fixed = true;
        }

        if (fixed) {
            await this.save();
        }

        return fixed;
    };

    // Get XP progress percentage for current level
    Level.prototype.getProgress = function () {
        const xpNeeded = this.constructor.getXPNeededForLevel(this.level);
        if (xpNeeded <= 0) return 0;

        let progress = Math.floor((this.currentXP / xpNeeded) * 100);
        if (progress < 0) progress = 0;
        if (progress > 100) progress = 100;

        return progress;
    };

    // Get XP needed to go from current level to next level
    Level.prototype.getXPNeeded = function () {
        return this.constructor.getXPNeededForLevel(this.level);
    };

    // Static method to get XP needed for a specific level
    Level.getXPNeededForLevel = function (level) {
        if (!level || level < 1) level = 1;
        return 5 * Math.pow(level, 2) + 50 * level + 100;
    };

    // Static method to get leaderboard
    Level.getLeaderboard = async function (limit = 10) {
        return await this.findAll({
            order: [['level', 'DESC'], ['totalXP', 'DESC']],
            limit: limit
        });
    };

    return Level;
};
