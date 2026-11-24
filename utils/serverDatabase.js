const path = require('path');
const fs = require('fs');

const { sequelize: serverSequelize } = require('./database');

// Recursively find all .js files in a directory
function findModelFiles(dir) {
    const results = [];

    if (!fs.existsSync(dir)) {
        console.warn(`⚠️ Server models directory not found: ${dir}`);
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

// Load all server models
function loadServerModels() {
    const modelsDir = path.join(__dirname, '..', 'serverModels');
    const modelFiles = findModelFiles(modelsDir);
    const models = {};

    console.log(`📁 Found ${modelFiles.length} server model files in serverModels/`);

    for (const filePath of modelFiles) {
        try {
            const fileName = path.basename(filePath, '.js');
            const modelDefiner = require(filePath);

            if (typeof modelDefiner !== 'function') {
                console.warn(`⚠️ Skipping ${fileName}: Not a valid model`);
                continue;
            }

            const model = modelDefiner(serverSequelize);
            const modelName = model.name || fileName;
            models[modelName] = model;
            console.log(`✅ Loaded server model: ${modelName}`);
        } catch (error) {
            console.error(`❌ Error loading server model from ${filePath}:`, error.message);
        }
    }

    return models;
}

const serverModels = loadServerModels();

module.exports = { serverSequelize, serverModels };
