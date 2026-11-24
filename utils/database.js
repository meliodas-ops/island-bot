// utils/database.js
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'bots.sqlite'),
    dialectOptions: { mode: require("sqlite3").OPEN_READWRITE },
    logging: false
});

/**
 * Recursively find all .js files in a directory
 */
function findModelFiles(dir) {
    const results = [];

    if (!fs.existsSync(dir)) {
        console.warn(`⚠️ Models directory not found: ${dir}`);
        return results;
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            results.push(...findModelFiles(fullPath));
        } else if (file.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * Load all models from the models directory
 */
function loadModels() {
    const modelsDir = path.join(__dirname, '..', 'models');
    const modelFiles = findModelFiles(modelsDir);
    const models = {};

    console.log(`📁 Found ${modelFiles.length} model files in models/`);

    for (const filePath of modelFiles) {
        try {
            const fileName = path.basename(filePath, '.js');
            const modelDefiner = require(filePath);

            if (typeof modelDefiner !== 'function') {
                console.warn(`⚠️ Skipping ${fileName}: Not a valid model (not a function)`);
                continue;
            }

            const model = modelDefiner(sequelize);
            const modelName = model.name || fileName;
            models[modelName] = model;
            console.log(`✅ Loaded model: ${modelName}`);
        } catch (error) {
            console.error(`❌ Error loading model from ${filePath}:`, error.message);
        }
    }

    console.log(`📊 Available models: ${Object.keys(models).join(', ')}`);
    return models;
}

// Load all models
const models = loadModels();

// Define relationships after all models are loaded
function setupRelationships() {
    const { Player, Economy, Level, PromoCode, PromoRedemption, PromoReward, RedemptionReward, UserBadge, Badge, Wallet, WalletTransaction, PlayerActionState, Example } = models;

    console.log('🔍 Setting up relationships...');

    if (Player && Economy) {
        Player.hasOne(Economy, { foreignKey: 'playerId', sourceKey: 'playerId', onDelete: 'CASCADE' });
        Economy.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId', onDelete: 'CASCADE' });
        console.log('✅ Relationship: Player <-> Economy');
    }

    if (Player && Level) {
        Player.hasOne(Level, { foreignKey: 'playerId', sourceKey: 'playerId', onDelete: 'CASCADE' });
        Level.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId', onDelete: 'CASCADE' });
        console.log('✅ Relationship: Player <-> Level');
    }

    if (PromoCode && PromoRedemption) {
        PromoCode.hasMany(PromoRedemption, { foreignKey: 'promoCodeId', onDelete: 'CASCADE' });
        PromoRedemption.belongsTo(PromoCode, { foreignKey: 'promoCodeId' });
    }
    if (PromoCode && PromoReward) {
        PromoCode.hasMany(PromoReward, { foreignKey: 'promoCodeId', onDelete: 'CASCADE' });
        PromoReward.belongsTo(PromoCode, { foreignKey: 'promoCodeId' });
    }
    if (PromoRedemption && RedemptionReward) {
        PromoRedemption.hasMany(RedemptionReward, { foreignKey: 'redemptionId', onDelete: 'CASCADE' });
        RedemptionReward.belongsTo(PromoRedemption, { foreignKey: 'redemptionId' });
    }

    if (Player && Wallet) {
        Player.hasMany(Wallet, { foreignKey: 'playerId', sourceKey: 'playerId', onDelete: 'CASCADE' });
        Wallet.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId', onDelete: 'CASCADE' });
    }
    if (Wallet && WalletTransaction) {
        Wallet.hasMany(WalletTransaction, { foreignKey: 'walletId', onDelete: 'CASCADE' });
        WalletTransaction.belongsTo(Wallet, { foreignKey: 'walletId' });
    }
    if (Player && PlayerActionState) {
        Player.hasMany(PlayerActionState, { foreignKey: 'playerId', sourceKey: 'playerId', onDelete: 'CASCADE' });
        PlayerActionState.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId', onDelete: 'CASCADE' });
    }

    if (Player && UserBadge) {
        Player.hasMany(UserBadge, { foreignKey: 'playerId', sourceKey: 'playerId', onDelete: 'CASCADE' });
        UserBadge.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId', onDelete: 'CASCADE' });
        console.log('✅ Relationship: Player <-> UserBadge');
    }

    if (Badge && UserBadge) {
        Badge.hasMany(UserBadge, { foreignKey: 'badgeId', onDelete: 'CASCADE' });
        UserBadge.belongsTo(Badge, { foreignKey: 'badgeId' });
    }

    if (Player && Example) {
        Player.hasMany(Example, { foreignKey: 'playerId' });
        Example.belongsTo(Player, { foreignKey: 'playerId' });
        console.log('✅ Relationship: Player <-> Example');
    }
}

// Setup relationships
setupRelationships();

module.exports = { sequelize, models, testConnection: () => sequelize.authenticate() };
