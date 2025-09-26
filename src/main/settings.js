import { app } from "electron";
import fs from "fs";
import path from "path";

const settingsPath = path.join(app.getPath("userData"), "settings.json");

// Default settings
const defaultSettings = {
    warnBeforeDelete: true,
    numDays: 1,
    numPreferences: 3,
};

export function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, "utf-8");
            return { ...defaultSettings, ...JSON.parse(data) };
        }
    } catch (err) {
        console.error("Error loading settings:", err);
    }
    return defaultSettings;
}

export function saveSettings(newSettings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), "utf-8");
        return true;
    } catch (err) {
        console.error("Error saving settings:", err);
        return false;
    }
}
