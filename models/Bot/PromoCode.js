// models/Bot/PromoCode.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PromoCode = sequelize.define('PromoCode', {
        code: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        uses: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },
        usedCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        },
        currency: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'coin'
        },
        amount: {
            type: DataTypes.STRING,
            allowNull: false
        },
        createdBy: {
            type: DataTypes.STRING,
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        }
    }, {
        // Disable foreign key constraints for this model
        timestamps: true,
        hooks: {
            afterCreate: async (promoCode, options) => {
                const PromoReward = sequelize.models.PromoReward;
                if (!PromoReward) return;
                const amount = String(promoCode.amount || '').trim().toLowerCase();
                const range = amount.match(/^random\s+(\d+)\s*-\s*(\d+)$/);
                const fixed = amount.match(/^(\d+)$/);
                if (!range && !fixed) throw new Error(`Invalid promo amount: ${promoCode.amount}`);
                const minAmount = Number(range ? range[1] : fixed[1]);
                const maxAmount = Number(range ? range[2] : fixed[1]);
                if (minAmount > maxAmount) throw new Error('Promo amount range is invalid');
                const currencies = String(promoCode.currency || 'coin').split(',').map(x => x.trim().toLowerCase());
                for (const currency of currencies) {
                    const rewardType = currency === 'xp' ? 'xp' : 'currency';
                    const currencyCode = rewardType === 'xp' ? null : (currency === 'fragments' ? 'island_fragment' : currency);
                    await PromoReward.create({ promoCodeId: promoCode.id, rewardType, currencyCode, minAmount, maxAmount }, { transaction: options.transaction });
                }
            }
        }
    });

    // Instance methods
    PromoCode.prototype.isUsable = function () {
        if (!this.isActive) return false;
        if (this.expiresAt && new Date() > this.expiresAt) return false;
        if (this.uses !== null && this.usedCount >= this.uses) return false;
        return true;
    };

    PromoCode.prototype.useCode = async function (transaction) {
        this.usedCount += 1;
        await this.save(transaction ? { transaction } : undefined);
    };

    // Static methods
    PromoCode.generateUniqueCode = async function (length = 8) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let exists;
        let attempts = 0;
        const maxAttempts = 20;

        do {
            code = '';
            for (let i = 0; i < length; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            exists = await this.findOne({ where: { code } });
            attempts++;
        } while (exists && attempts < maxAttempts);

        if (exists) {
            throw new Error('Failed to generate a unique code after ' + maxAttempts + ' attempts');
        }

        return code;
    };

    PromoCode.parseAmount = function (amountStr) {
        if (typeof amountStr === 'string' && amountStr.toLowerCase().startsWith('random ')) {
            const range = amountStr.substring(7).trim();
            const parts = range.split('-');
            if (parts.length === 2) {
                const min = parseInt(parts[0].trim());
                const max = parseInt(parts[1].trim());
                if (!isNaN(min) && !isNaN(max) && min <= max) {
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }
            }
            return parseInt(amountStr) || 0;
        }
        return parseInt(amountStr) || 0;
    };

    return PromoCode;
};
