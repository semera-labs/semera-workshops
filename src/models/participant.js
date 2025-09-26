import { DataTypes } from "sequelize";
import sequelize from "../lib/db.js";

export const Participant = sequelize.define("Participant", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    Vorname: DataTypes.STRING,
    Name: DataTypes.STRING,
    Kurs: DataTypes.STRING,
});
