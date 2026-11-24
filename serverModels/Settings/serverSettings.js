// serverModels/Settings/ServerSettings.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ServerSettings = sequelize.define('ServerSettings', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        guildId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            comment: 'Discord Guild/Server ID'
        },
        guildName: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Server name'
        },
        prefix: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: '/',
            comment: 'Command prefix'
        },
        welcomeChannel: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: 'Welcome channel ID'
        },
        logChannel: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: 'Log channel ID'
        },
        // Economy Settings
        economyEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        levelingEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Server leveling system (disabled by default)'
        },
        prestigeEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        gambleEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        fragmentsEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        minBet: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        maxBet: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 150000
        },
        // Leveling Settings
        levelingMinXP: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
            comment: 'Minimum XP per message'
        },
        levelingMaxXP: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 15,
            comment: 'Maximum XP per message'
        },
        levelingInterval: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 60,
            comment: 'Cooldown in seconds between XP gains (min: 30s, max: 300s)'
        },
        levelingFormula: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'amari',
            comment: 'amari, atom-bot, or arcane-bot'
        },
        levelUpChannel: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: 'Channel ID for level up announcements'
        },
        // REMOVED: levelUpMessage
        joinedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    }, {
        tableName: 'server_settings',
        timestamps: true
    });

    // Static method to get or create server settings
    ServerSettings.getOrCreate = async function (guildId, guildName = null) {
        const [settings, created] = await this.findOrCreate({
            where: { guildId },
            defaults: {
                guildId,
                guildName: guildName || 'Unknown Server'
            }
        });
        return settings;
    };

    // Update server name
    ServerSettings.prototype.updateName = async function (guildName) {
        this.guildName = guildName;
        await this.save();
        return this;
    };

    // Toggle economy
    ServerSettings.prototype.toggleEconomy = async function () {
        this.economyEnabled = !this.economyEnabled;
        await this.save();
        return this;
    };

    // Toggle leveling
    ServerSettings.prototype.toggleLeveling = async function () {
        this.levelingEnabled = !this.levelingEnabled;
        await this.save();
        return this;
    };

    // Toggle prestige
    ServerSettings.prototype.togglePrestige = async function () {
        this.prestigeEnabled = !this.prestigeEnabled;
        await this.save();
        return this;
    };

    // Toggle gamble
    ServerSettings.prototype.toggleGamble = async function () {
        this.gambleEnabled = !this.gambleEnabled;
        await this.save();
        return this;
    };

    // Toggle fragments
    ServerSettings.prototype.toggleFragments = async function () {
        this.fragmentsEnabled = !this.fragmentsEnabled;
        await this.save();
        return this;
    };

    return ServerSettings;
};