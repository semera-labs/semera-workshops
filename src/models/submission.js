import { DataTypes } from "sequelize";
import sequelize from '../lib/db.js';

export const Submission = sequelize.define('Submission', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: DataTypes.STRING,
    preferences: DataTypes.JSON,
});