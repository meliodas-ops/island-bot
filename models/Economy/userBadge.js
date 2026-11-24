// models/Economy/userBadge.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserBadge = sequelize.define('UserBadge', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        playerId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            comment: 'Discord User ID'
        },
        badgeId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Reference to badge definition'
        },
        earnedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        grantedBy: {
            type: DataTypes.STRING(20),
            allowNull: true,
            comment: 'Discord User ID of who granted the badge'
        }
    }, {
        tableName: 'user_badges',
        timestamps: true,
        indexes: [{ unique: true, fields: ['playerId', 'badgeId'] }]
    });

    const { badges } = require('../../utils/botData');
    UserBadge.getBadgeData = badgeId => badges()[badgeId] || null;
    UserBadge.getAllBadges = badges;

    // Instance method to get formatted badge info
    UserBadge.prototype.getBadgeInfo = function () {
        return UserBadge.getBadgeData(this.badgeId);
    };

    // Static method to get all badges for a user
    UserBadge.getUserBadges = async function (playerId) {
        const badges = await this.findAll({
            where: { playerId },
            order: [['earnedAt', 'ASC']]
        });

        return badges.map(badge => ({
            ...badge.toJSON(),
            info: badge.getBadgeInfo()
        }));
    };

    // Static method to check if a user has a specific badge
    UserBadge.hasBadge = async function (playerId, badgeId) {
        const badge = await this.findOne({
            where: { playerId, badgeId }
        });
        return !!badge;
    };

    // Static method to add a badge to a user
    UserBadge.addBadge = async function (playerId, badgeId, grantedBy = null) {
        // Check if badge exists in JSON
        const badgeData = this.getBadgeData(badgeId);
        if (!badgeData) {
            throw new Error(`Badge with ID ${badgeId} does not exist`);
        }

        // Check if user already has this badge
        const hasBadge = await this.hasBadge(playerId, badgeId);
        if (hasBadge) {
            throw new Error(`User already has badge: ${badgeData.name}`);
        }

        // Create the badge
        const badge = await this.create({
            playerId,
            badgeId,
            grantedBy
        });

        return badge;
    };

    // Static method to remove a badge from a user
    UserBadge.removeBadge = async function (playerId, badgeId) {
        const badge = await this.findOne({
            where: { playerId, badgeId }
        });

        if (!badge) {
            throw new Error(`User does not have badge with ID ${badgeId}`);
        }

        await badge.destroy();
        return true;
    };

    return UserBadge;
};
