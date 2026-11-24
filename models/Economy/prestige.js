// models/Bot/Prestige.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Prestige = sequelize.define('Prestige', {
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
        prestigeLevel: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Current prestige level'
        },
        goldEarned: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total gold earned across all prestiges'
        },
        islandFragmentsEarned: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total Island Fragments earned across all prestiges'
        },
        level: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total levels gained across all prestiges'
        },
        multiplier: {
            type: DataTypes.VIRTUAL,
            get() { return 0.5 * (this.prestigeLevel || 0); }
        },
        nextGoldRequirement: { type: DataTypes.VIRTUAL, get() { return this.calculateRequirements().gold; } },
        nextFragmentsRequirement: { type: DataTypes.VIRTUAL, get() { return this.calculateRequirements().fragments; } },
        nextLevelRequirement: { type: DataTypes.VIRTUAL, get() { return this.calculateRequirements().level; } },
        lastPrestigeAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the player last prestiged'
        }
    }, {
        tableName: 'prestige',
        timestamps: true
    });

    // Static method to get or create prestige record
    Prestige.getOrCreate = async function (playerId) {
        const [prestige, created] = await this.findOrCreate({
            where: { playerId },
            defaults: {
                playerId,
                prestigeLevel: 0,
                goldEarned: 0,
                islandFragmentsEarned: 0,
                level: 0,
                lastPrestigeAt: null
            }
        });
        return prestige;
    };

    // Calculate requirements based on prestige level
    Prestige.prototype.calculateRequirements = function () {
        const level = this.prestigeLevel || 0;
        return {
            gold: 200000 + (100000 * level),      // Gold: 200,000 + (100,000 × prestigeLevel)
            fragments: 1500 + (500 * level),       // Fragments: 1,500 + (500 × prestigeLevel)
            level: 100 + (50 * level),             // Level: 100 + (50 × prestigeLevel)
            multiplier: 0.5 * level                // Multiplier: 0.5 × prestigeLevel
        };
    };

    // Update requirements for next prestige
    Prestige.prototype.updateRequirements = function () {
        return this.calculateRequirements();
    };

    // Check if player can prestige
    Prestige.prototype.canPrestige = function (economyData, levelData) {
        const req = this.calculateRequirements();

        // Check all requirements
        const hasEnoughGold = economyData.balance >= req.gold;
        const hasEnoughFragments = economyData.islandFragments >= req.fragments;
        const hasEnoughLevel = levelData.level >= req.level;

        return {
            canPrestige: hasEnoughGold && hasEnoughFragments && hasEnoughLevel,
            requirements: req,
            details: {
                gold: { current: economyData.balance, required: req.gold, met: hasEnoughGold },
                fragments: { current: economyData.islandFragments, required: req.fragments, met: hasEnoughFragments },
                level: { current: levelData.level, required: req.level, met: hasEnoughLevel }
            }
        };
    };

    // Perform prestige
    Prestige.prototype.doPrestige = async function (economyData, levelData) {
        return sequelize.transaction({type:'IMMEDIATE'}, async transaction => {
            await this.reload({transaction});
            await economyData.reload({transaction});
            await levelData.reload({transaction});
            if (!this.canPrestige(economyData,levelData).canPrestige) throw new Error('Prestige requirements are no longer met');

            // Store total earned before reset
            this.goldEarned += economyData.balance;
            this.islandFragmentsEarned += economyData.islandFragments;
            this.level += levelData.level;

            // Increment prestige level
            this.prestigeLevel += 1;
            this.lastPrestigeAt = new Date();

            // Update requirements for next prestige
            this.updateRequirements();
            await this.save({transaction});

            // Record the currency reset in the wallet ledger. Fragments stay untouched.
            await economyData.setBalance(0, { source: 'prestige_reset', transaction });

            // Reset level to 1
            levelData.level = 1;
            levelData.currentXP = 0;
            await levelData.save({transaction});

            return {
                newPrestigeLevel: this.prestigeLevel,
                nextRequirements: this.calculateRequirements()
            };
        });
    };

    return Prestige;
};
