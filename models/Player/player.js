const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Player = sequelize.define('Player', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        playerId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'Discord User ID'
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        discriminator: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isRegistered: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        registeredAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        playerNumber: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            comment: 'Ascending registration number'
        }
    }, {
        tableName: 'players',
        timestamps: true
    });

    // Static method to get next player number
    Player.getNextPlayerNumber = async function () {
        const lastPlayer = await this.findOne({
            order: [['playerNumber', 'DESC']]
        });
        return lastPlayer ? lastPlayer.playerNumber + 1 : 1;
    };

    // Static method to register a player
    Player.registerPlayer = async function (userId, username, discriminator = null) {
        const [player, created] = await this.findOrCreate({
            where: { playerId: userId },
            defaults: {
                playerId: userId,
                username,
                discriminator,
                isRegistered: false
            }
        });

        // Update username if changed
        if (!created && player.username !== username) {
            player.username = username;
            await player.save();
        }

        return player;
    };

    // Instance method to complete registration
    Player.prototype.completeRegistration = async function () {
        if (this.isRegistered) {
            return this;
        }

        const nextNumber = await this.constructor.getNextPlayerNumber();
        this.isRegistered = true;
        this.registeredAt = new Date();
        this.playerNumber = nextNumber;
        await this.save();
        return this;
    };

    return Player;
};