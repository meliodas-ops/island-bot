const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Example = sequelize.define('Example', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'examples',
        timestamps: true
    });

    // Instance methods
    Example.prototype.incrementCount = async function () {
        this.count += 1;
        await this.save();
        return this.count;
    };

    // Static methods
    Example.findOrCreateExample = async function (name) {
        const [example, created] = await this.findOrCreate({
            where: { name },
            defaults: {
                name,
                count: 0,
                isActive: true
            }
        });
        return example;
    };

    return Example;
};