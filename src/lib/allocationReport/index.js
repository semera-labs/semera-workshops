import axios from "axios";
import API_BASE from "../api.js";
import {
    MAX_ALLOCATION_RUNS,
    MAX_DAYS,
    clampPreferenceCount,
} from "../preferenceKeys.js";

import {
    generateAllocationFile,
} from "./html.js";

import {
    generateAllocationCSV,
} from "./csv.js";

import {
    generateAllocationDocx,
} from "./docx.js";

import {
    generateAllocationExcel,
} from "./excel.js";


/*
 * --------------------------------------------------------------------------
 * Generate allocation
 * --------------------------------------------------------------------------
 */

const MAX_LISTED_WARNINGS = 12;

/*
 * options: { seed }     reproduces an earlier run
 *          { attempts } how many greedy runs to try (best one is kept)
 */
export const generateAllocation = async (
    numOfDays = null,
    maxPreferences = null,
    options = {}
) => {
    try {
        let days =
            numOfDays;

        let preferences =
            maxPreferences;

        let runs =
            options.attempts;

        /*
         * Use application settings when values
         * were not supplied explicitly.
         */
        if (
            window.electron?.ipcRenderer &&
            (
                days == null ||
                preferences == null ||
                runs == null
            )
        ) {
            const settings =
                await window.electron.ipcRenderer.invoke(
                    "settings:load"
                );

            runs = options.attempts ?? settings?.allocationRuns;

            if (days == null) {
                days =
                    Number.parseInt(
                        settings?.numDays,
                        10
                    ) || 1;
            }

            if (
                preferences == null
            ) {
                preferences =
                    Number.parseInt(
                        settings?.numPreferences,
                        10
                    ) || 5;
            }
        }

        /*
         * Safe fallbacks.
         */
        days = Math.min(
            MAX_DAYS,
            Math.max(1, Number.parseInt(days, 10) || 1)
        );

        preferences = clampPreferenceCount(preferences, 5);

        console.log(
            "Starting allocation:",
            {
                numDays:
                    days,

                maxPreferences:
                    preferences,
            }
        );

        const response =
            await axios.post(
                `http://${API_BASE}/api/workshops/allocate`,
                {
                    numDays:
                        days,

                    maxPreferences:
                        preferences,

                    forceRandom:
                        false,

                    ...(options.seed != null
                        ? { seed: options.seed }
                        : {}),

                    attempts:
                        Math.min(
                            MAX_ALLOCATION_RUNS,
                            Math.max(
                                1,
                                Number.parseInt(runs, 10) || 1
                            )
                        ),
                }
            );

        const allocations =
            response.data;

        if (
            !allocations ||
            !Array.isArray(
                allocations.workshops
            )
        ) {
            throw new Error(
                "Ungültige Antwort vom Zuteilungsserver."
            );
        }

        if (allocations.warnings?.length > 0) {
            const shown = allocations.warnings.slice(0, MAX_LISTED_WARNINGS);
            const more = allocations.warnings.length - shown.length;

            alert(
                "Zuteilung Warnungen:\n\n" +
                shown.join("\n") +
                (more > 0 ? `\n… und ${more} weitere` : "")
            );
        }

        return allocations;
    } catch (error) {
        console.error(
            "Error generating allocation:",
            error
        );

        alert(
            `Fehler beim Generieren der Zuteilung: ${error.response?.data?.message ||
            error.message ||
            "Unbekannter Fehler aufgetreten."
            }`
        );

        return null;
    }
};


export {
    generateAllocationFile,
    generateAllocationCSV,
    generateAllocationDocx,
    generateAllocationExcel,
};