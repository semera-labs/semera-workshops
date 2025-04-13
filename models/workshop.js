const { DataTypes } = require('sequelize');
const sequelize = require('../lib/db');

const Workshop = sequelize.define('Workshop', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    title: DataTypes.STRING,
    maxParticipants: DataTypes.INTEGER,
    minParticipants: DataTypes.INTEGER,
    staff: DataTypes.STRING,
});

module.exports = Workshop;