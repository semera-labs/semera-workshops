import axios from "axios";
import API_BASE from "../api.js";

import { getReportSettings } from "./settings.js";
import { validateAllocationResult } from "./helpers.js";

import {
    createWorkbook,
    addAllocationSheets,
} from "../excel/writer.js";

import { saveWorkbook } from "../excel/download.js";

/*
 * Loads everything the Excel report can use to be more helpful than the raw
 * allocation result (room/staff fallback, wish rank, courses, people who
 * have not been assigned). Missing data is not fatal.
 */
export async function loadAllocationContext() {
    const [settings, workshops, submissions, people] = await Promise.all([
        getReportSettings(),
        axios
            .get(`http://${API_BASE}/api/workshops`)
            .then((response) => response.data)
            .catch(() => []),
        axios
            .get(`http://${API_BASE}/api/preferences`)
            .then((response) => response.data)
            .catch(() => []),
        axios
            .get(`http://${API_BASE}/api/participants`)
            .then((response) => response.data)
            .catch(() => []),
    ]);

    return { settings, workshops, submissions, people };
}

export async function generateAllocationExcel(allocations) {
    try {
        validateAllocationResult(allocations);

        const context = await loadAllocationContext();
        const workbook = createWorkbook();

        addAllocationSheets(workbook, allocations, context);

        await saveWorkbook(workbook, "workshop_zuteilung.xlsx");
    } catch (error) {
        console.error("Error generating Excel allocation file:", error);

        alert(
            `Fehler beim Generieren der Excel-Datei: ${error.message ||
            "Unbekannter Fehler aufgetreten."
            }`
        );
    }
}
