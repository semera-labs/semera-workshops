import { sequelize } from "../models/index.js";

export async function initDatabase() {
    try {
        await sequelize.sync({ alter: true });
        console.log("✅ Database initialized");
    } catch (error) {
        console.error("❌ Error initializing database:", error);
        process.exit(1);
    }
}
