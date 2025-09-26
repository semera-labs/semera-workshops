import { DataTypes } from "sequelize";
import sequelize from '../lib/db.js';

export const Workshop = sequelize.define('Workshop', {
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