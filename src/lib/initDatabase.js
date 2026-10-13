import { sequelize } from "../models/index.js";

export async function initDatabase() {
    try {
        await sequelize.sync({ alter: true });

        // One submission per name, ignoring case. If old data already
        // contains duplicates the index cannot be created; the server then
        // only relies on its own check (and says so).
        try {
            await sequelize.query(
                "CREATE UNIQUE INDEX IF NOT EXISTS submissions_name_nocase ON `Submissions` (`name` COLLATE NOCASE)"
            );
        } catch (indexError) {
            console.warn(
                "Unique name index not created (duplicate names already exist?):",
                indexError.message
            );
        }

        console.log("Database initialized");
    } catch (error) {
        console.error("Error initializing database:", error);
        process.exit(1);
    }
}
