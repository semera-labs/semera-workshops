import {
    saveAs,
} from "file-saver";

import {
    getReportSettings,
} from "./settings.js";

import {
    validateAllocationResult,
    getWorkshopInfo,
    escapeCsv,
    getScheduleWorkshops,
} from "./helpers.js";


/*
 * --------------------------------------------------------------------------
 * CSV report
 * --------------------------------------------------------------------------
 */

export async function generateAllocationCSV(
    allocations
) {
    try {
        validateAllocationResult(
            allocations
        );

        const settings =
            await getReportSettings();

        let csvContent =
            "";


        /*
         * ------------------------------------------------------------------
         * Single-day / random allocation
         * ------------------------------------------------------------------
         */

        if (
            allocations.mode ===
            "single-day" ||
            allocations.mode ===
            "random"
        ) {
            for (
                const workshop of allocations.workshops
            ) {
                const info =
                    getWorkshopInfo(
                        workshop
                    );

                const participants =
                    workshop.participants ??
                    [];

                csvContent +=
                    `${escapeCsv(
                        info.title
                    )}\n`;

                if (
                    settings.reportShowStaff
                ) {
                    csvContent +=
                        `Personal;${escapeCsv(
                            info.staff
                        )}\n`;
                }

                if (
                    settings.reportShowRoom
                ) {
                    csvContent +=
                        `Raum;${escapeCsv(
                            info.room
                        )}\n`;
                }

                if (
                    settings.reportShowParticipantCount
                ) {
                    csvContent +=
                        `Teilnehmer;${participants.length}/${info.maxParticipants}\n`;
                }

                csvContent +=
                    "Name\n";

                for (
                    const participant of participants
                ) {
                    csvContent +=
                        `${escapeCsv(
                            participant
                        )}\n`;
                }

                csvContent +=
                    "\n";
            }
        }


        /*
         * ------------------------------------------------------------------
         * Multi-day allocation
         * ------------------------------------------------------------------
         */

        else if (
            allocations.mode ===
            "multi-day"
        ) {
            const workshops =
                getScheduleWorkshops(
                    allocations
                );

            for (
                const workshop of workshops
            ) {
                const info =
                    getWorkshopInfo(
                        workshop
                    );

                const days =
                    Object.keys(
                        workshop.days ??
                        {}
                    );

                csvContent +=
                    `${escapeCsv(
                        info.title
                    )}\n`;

                if (
                    settings.reportShowStaff
                ) {
                    csvContent +=
                        `Personal;${escapeCsv(
                            info.staff
                        )}\n`;
                }

                if (
                    settings.reportShowRoom
                ) {
                    csvContent +=
                        `Raum;${escapeCsv(
                            info.room
                        )}\n`;
                }

                csvContent +=
                    `Tag;${days
                        .map(
                            escapeCsv
                        )
                        .join(
                            ";"
                        )}\n`;

                if (
                    settings.reportShowParticipantCount
                ) {
                    csvContent +=
                        `Teilnehmer;${days
                            .map(
                                day => {
                                    const count =
                                        workshop.days[
                                            day
                                        ]?.length ??
                                        0;

                                    return `${count}/${info.maxParticipants}`;
                                }
                            )
                            .join(
                                ";"
                            )}\n`;
                }

                const maxRows =
                    Math.max(
                        0,
                        ...days.map(
                            day =>
                                workshop.days[
                                    day
                                ]?.length ??
                                0
                        )
                    );

                for (
                    let index = 0;
                    index <
                    maxRows;
                    index++
                ) {
                    const row =
                        days.map(
                            day =>
                                escapeCsv(
                                    workshop.days[
                                    day
                                    ]?.[
                                    index
                                    ] ??
                                    ""
                                )
                        );

                    csvContent +=
                        row.join(
                            ";"
                        ) +
                        "\n";
                }

                csvContent +=
                    "\n";
            }
        }


        const blob =
            new Blob(
                [
                    csvContent,
                ],
                {
                    type:
                        "text/csv;charset=utf-8;",
                }
            );

        saveAs(
            blob,
            "workshop_allocations.csv"
        );
    } catch (error) {
        console.error(
            "Error generating CSV allocation file:",
            error
        );

        alert(
            `Fehler beim Generieren der Zuteilungs-Datei: ${error.message ||
            "Unbekannter Fehler aufgetreten."
            }`
        );
    }
}