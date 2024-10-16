const { DataTypes } = require('sequelize');
const sequelize = require('../lib/db');

const Submission = sequelize.define('Submission', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: DataTypes.STRING,
    preferences: DataTypes.JSON,
});

module.exports = Submission;