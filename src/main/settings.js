import { app } from "electron";
import fs from "fs";
import path from "path";

const settingsPath =
    path.join(
        app.getPath("userData"),
        "settings.json"
    );

const defaultSettings = {
    warnBeforeDelete: true,
    enableBonjour: true,
    numDays: 1,
    numPreferences: 3,
};

export function loadSettings() {
    try {
        if (
            fs.existsSync(
                settingsPath
            )
        ) {
            const data =
                fs.readFileSync(
                    settingsPath,
                    "utf-8"
                );

            const parsed =
                JSON.parse(data);

            return {
                ...defaultSettings,
                ...parsed,
            };
        }
    } catch (err) {
        console.error(
            "Error loading settings:",
            err
        );
    }

    return {
        ...defaultSettings,
    };
}

export function saveSettings(
    newSettings
) {
    try {
        /*
         * The port is server configuration
         * and must not be duplicated in
         * settings.json.
         */
        const {
            port,
            ...settingsWithoutPort
        } = newSettings;

        const normalizedSettings = {
            ...defaultSettings,
            ...settingsWithoutPort,
        };

        fs.writeFileSync(
            settingsPath,
            JSON.stringify(
                normalizedSettings,
                null,
                2
            ),
            "utf-8"
        );

        return true;
    } catch (err) {
        console.error(
            "Error saving settings:",
            err
        );

        return false;
    }
}