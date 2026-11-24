// models/Economy/economy.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Economy = sequelize.define('Economy', {
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
        balance: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        totalEarned: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        totalSpent: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        // New currency: Island Fragments
        islandFragments: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Island Fragments - special currency'
        },
        totalFragmentsEarned: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Total Island Fragments earned'
        },
        totalFragmentsSpent: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Total Island Fragments spent'
        },
        workCooldown: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        lastWork: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        begCooldown: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        lastBeg: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        robCooldown: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        lastRob: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        gambleCooldown: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        lastGamble: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        dailyStreak: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        lastDaily: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'economy',
        timestamps: true
    });

    // Static method to get or create economy record
    Economy.getOrCreate = async function (playerId) {
        const existing = await this.findOne({where:{playerId}});
        if (existing) return existing;
        await sequelize.transaction({type:'IMMEDIATE'}, async transaction => {
            await sequelize.models.Player.findOrCreate({where:{playerId},defaults:{username:String(playerId)},transaction});
            await sequelize.query('INSERT OR IGNORE INTO economy_accounts(playerId,createdAt,updatedAt) VALUES (?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', {replacements:[playerId],transaction});
        });
        return this.findOne({where:{playerId}});
    };

    async function change(economy, currencyCode, value, reason, mode, options = {}) {
        if (!Number.isSafeInteger(value)) throw new TypeError('Invalid wallet amount');
        const apply = async transaction => {
            const [wallet] = await sequelize.models.Wallet.findOrCreate({where:{playerId:economy.playerId,currencyCode},transaction});
            const before = Number(wallet.balance);
            const after = mode === 'delta' ? before + value : value;
            if (!Number.isSafeInteger(after) || after < 0) throw new Error('Insufficient funds or invalid balance');
            const amount = after - before;
            wallet.balance = after;
            if (mode === 'resetTotals') {
                wallet.totalEarned = after;
                wallet.totalSpent = 0;
            } else if (mode === 'delta') {
                wallet.totalEarned += Math.max(amount,0);
                wallet.totalSpent += Math.max(-amount,0);
            }
            await wallet.save({transaction});
            await sequelize.models.WalletTransaction.create({walletId:wallet.id,amount,balanceAfter:after,reason},{transaction});
            await economy.reload({transaction});
            return economy;
        };
        return options.transaction ? apply(options.transaction) : sequelize.transaction({type:'IMMEDIATE'},apply);
    }
    Economy.prototype.setBalance = function(amount, options = {}) {
        return change(this,'coin',amount,options.source || 'admin_set',options.resetTotals ? 'resetTotals' : 'reset',options);
    };
    for (const [currency,add,remove] of [['coin','addBalance','removeBalance'],['island_fragment','addFragments','removeFragments']]) {
        Economy.prototype[add] = function(amount,reason='unknown',options={}) { return change(this,currency,amount,reason,'delta',options); };
        Economy.prototype[remove] = async function(amount,reason='unknown',options={}) {
            if (amount < 0) throw new Error('Invalid withdrawal');
            await change(this,currency,-amount,reason,'delta',options);
            return true;
        };
    }

    const findActionState = (economy,actionCode) => sequelize.models.PlayerActionState.findOne({where:{playerId:economy.playerId,actionCode}});
    async function saveActionState(economy,actionCode,duration,streak=0) {
        const now = Date.now();
        await sequelize.models.PlayerActionState.upsert({playerId:economy.playerId,actionCode,lastUsedAt:new Date(now),cooldownUntil:duration ? new Date(now+duration) : null,streak});
        return findActionState(economy,actionCode);
    }
    Economy.prototype.recordDailyClaim = async function() {
        await saveActionState(this,'daily',null,this.dailyStreak+1);
        await this.reload();
    };

    // ---------- WORK COOLDOWN (15 seconds) ----------
    Economy.prototype.canWork = async function () {
        const state = await findActionState(this, 'work');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.workCooldown;
        if (!cooldown) return true;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return true;
        return Date.now() >= timestamp;
    };

    Economy.prototype.getWorkCooldown = async function () {
        const state = await findActionState(this, 'work');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.workCooldown;
        if (!cooldown) return 0;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return 0;
        const remaining = timestamp - Date.now();
        if (remaining <= 0) return 0;
        return Math.ceil(remaining / 1000);
    };

    Economy.prototype.setWorkCooldown = async function () {
        const state = await saveActionState(this, 'work', 15 * 1000);
        this.workCooldown = String(state?.cooldownUntil?.getTime() || Date.now() + 15 * 1000);
        await this.reload();
        return this.workCooldown;
    };

    // ---------- BEG COOLDOWN (30 seconds) ----------
    Economy.prototype.canBeg = async function () {
        const state = await findActionState(this, 'beg');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.begCooldown;
        if (!cooldown) return true;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return true;
        return Date.now() >= timestamp;
    };

    Economy.prototype.getBegCooldown = async function () {
        const state = await findActionState(this, 'beg');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.begCooldown;
        if (!cooldown) return 0;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return 0;
        const remaining = timestamp - Date.now();
        if (remaining <= 0) return 0;
        return Math.ceil(remaining / 1000);
    };

    Economy.prototype.setBegCooldown = async function () {
        const state = await saveActionState(this, 'beg', 30 * 1000);
        this.begCooldown = String(state?.cooldownUntil?.getTime() || Date.now() + 30 * 1000);
        await this.reload();
        return this.begCooldown;
    };

    // ---------- ROB COOLDOWN (1 minute) ----------
    Economy.prototype.canRob = async function () {
        const state = await findActionState(this, 'rob');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.robCooldown;
        if (!cooldown) return true;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return true;
        return Date.now() >= timestamp;
    };

    Economy.prototype.getRobCooldown = async function () {
        const state = await findActionState(this, 'rob');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.robCooldown;
        if (!cooldown) return 0;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return 0;
        const remaining = timestamp - Date.now();
        if (remaining <= 0) return 0;
        return Math.ceil(remaining / 1000);
    };

    Economy.prototype.setRobCooldown = async function () {
        const state = await saveActionState(this, 'rob', 60 * 1000);
        this.robCooldown = String(state?.cooldownUntil?.getTime() || Date.now() + 60 * 1000);
        await this.reload();
        return this.robCooldown;
    };

    // ---------- GAMBLE COOLDOWN (5 minutes) ----------
    Economy.prototype.canGamble = async function () {
        const state = await findActionState(this, 'gamble');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.gambleCooldown;
        if (!cooldown) return true;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return true;
        return Date.now() >= timestamp;
    };

    Economy.prototype.getGambleCooldown = async function () {
        const state = await findActionState(this, 'gamble');
        const cooldown = state?.cooldownUntil ? String(state.cooldownUntil.getTime()) : this.gambleCooldown;
        if (!cooldown) return 0;
        const timestamp = parseInt(cooldown);
        if (isNaN(timestamp)) return 0;
        const remaining = timestamp - Date.now();
        if (remaining <= 0) return 0;
        return Math.ceil(remaining / 1000);
    };

    Economy.prototype.setGambleCooldown = async function () {
        const state = await saveActionState(this, 'gamble', 5 * 60 * 1000);
        this.gambleCooldown = String(state?.cooldownUntil?.getTime() || Date.now() + 5 * 60 * 1000);
        this.lastGamble = String(state?.lastUsedAt?.getTime() || Date.now());
        await this.reload();
        return this.gambleCooldown;
    };

    // ---------- DAILY COOLDOWN (24 hours) ----------
    Economy.prototype.canClaimDaily = async function () {
        const state = await findActionState(this, 'daily');
        const lastDaily = state?.lastUsedAt?.getTime() || parseInt(this.lastDaily);
        if (!lastDaily) return true;
        if (isNaN(lastDaily)) return true;
        const diff = Date.now() - lastDaily;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return hours >= 24;
    };

    Economy.prototype.getDailyCooldown = async function () {
        const state = await findActionState(this, 'daily');
        const lastDaily = state?.lastUsedAt?.getTime() || parseInt(this.lastDaily);
        if (!lastDaily) return { hours: 0, minutes: 0 };
        if (isNaN(lastDaily)) return { hours: 0, minutes: 0 };

        const diff = Date.now() - lastDaily;
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours >= 24) return { hours: 0, minutes: 0 };

        const remainingMs = 24 * 60 * 60 * 1000 - diff;
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return { hours: remainingHours, minutes: remainingMinutes };
    };

    return Economy;
};
