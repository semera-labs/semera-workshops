import {
    saveAs,
} from "file-saver";

import {
    getReportSettings,
} from "./settings.js";

import {
    validateAllocationResult,
    getWorkshopInfo,
    buildInfoParts,
    escapeHtml,
    getScheduleWorkshops,
} from "./helpers.js";


/*
 * --------------------------------------------------------------------------
 * HTML report
 * --------------------------------------------------------------------------
 */

export async function generateAllocationFile(
    allocations
) {
    try {
        validateAllocationResult(
            allocations
        );

        const settings =
            await getReportSettings();

        let htmlContent = `
<!DOCTYPE html>

<html lang="de">

<head>
    <meta charset="UTF-8">

    <title>
        Workshop Zuteilung
    </title>

    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #222;
        }

        h2 {
            margin-bottom: 6px;
        }

        .workshop-info {
            margin-bottom: 15px;
            color: #555;
        }

        .project-container {
            margin-bottom: 60px;
        }

        .day-tables {
            display: flex;
            gap: 20px;
            align-items: flex-start;
            flex-wrap: wrap;
        }

        .day-container {
            flex: 1;
            min-width: 250px;
        }

        .day-label {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 5px;
        }

        .day-info {
            color: #555;
            font-size: 0.9em;
            margin-bottom: 6px;
        }

        table {
            width: 100%;
            min-width: 200px;
            border-collapse: collapse;
        }

        th,
        td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
        }

        th {
            background-color: #f9f9f9;
        }

        @media print {
            .pagebreak {
                page-break-before: always;
            }

            .project-container {
                page-break-inside: avoid;
            }
        }
    </style>
</head>

<body>
`;


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
            let first =
                true;

            for (
                const workshop of allocations.workshops
            ) {
                const participants =
                    workshop.participants ??
                    [];

                /*
                 * Preserve previous behavior:
                 * don't create pages for completely
                 * empty workshops.
                 */
                if (
                    participants.length ===
                    0
                ) {
                    continue;
                }

                const info =
                    getWorkshopInfo(
                        workshop
                    );

                const infoParts =
                    buildInfoParts(
                        workshop,
                        participants.length,
                        settings
                    );

                htmlContent += `
                    ${!first
                        ? '<div class="pagebreak"></div>'
                        : ""
                    }

                    <div class="project-container">

                        <h2>
                            ${escapeHtml(
                        info.title
                    )}
                        </h2>
                `;

                if (
                    infoParts.length >
                    0
                ) {
                    htmlContent += `
                        <div class="workshop-info">
                            ${infoParts
                            .map(
                                escapeHtml
                            )
                            .join(
                                " · "
                            )}
                        </div>
                    `;
                }

                htmlContent += `
                        <table>

                            <thead>
                                <tr>
                                    <th>
                                        Name
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                `;

                for (
                    const participant of participants
                ) {
                    htmlContent += `
                        <tr>
                            <td>
                                ${escapeHtml(
                        participant
                    )}
                            </td>
                        </tr>
                    `;
                }

                htmlContent += `
                            </tbody>

                        </table>

                    </div>
                `;

                first =
                    false;
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

            let first =
                true;

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

                if (
                    days.length ===
                    0
                ) {
                    continue;
                }

                const generalInfo = [];

                if (
                    settings.reportShowStaff &&
                    info.staff
                ) {
                    generalInfo.push(
                        `Personal: ${info.staff}`
                    );
                }

                if (
                    settings.reportShowRoom &&
                    info.room
                ) {
                    generalInfo.push(
                        `Raum: ${info.room}`
                    );
                }

                htmlContent += `
                    ${!first
                        ? '<div class="pagebreak"></div>'
                        : ""
                    }

                    <div class="project-container">

                        <h2>
                            ${escapeHtml(
                        info.title
                    )}
                        </h2>
                `;

                if (
                    generalInfo.length >
                    0
                ) {
                    htmlContent += `
                        <div class="workshop-info">
                            ${generalInfo
                            .map(
                                escapeHtml
                            )
                            .join(
                                " · "
                            )}
                        </div>
                    `;
                }

                htmlContent += `
                    <div class="day-tables">
                `;

                for (
                    const day of days
                ) {
                    const participants =
                        workshop.days[
                        day
                        ] ?? [];

                    htmlContent += `
                        <div class="day-container">

                            <div class="day-label">
                                Tag ${escapeHtml(
                        day
                    )}
                            </div>
                    `;

                    if (
                        settings.reportShowParticipantCount
                    ) {
                        htmlContent += `
                            <div class="day-info">
                                Teilnehmer:
                                ${participants.length}/${escapeHtml(
                            info.maxParticipants
                        )}
                            </div>
                        `;
                    }

                    htmlContent += `
                            <table>

                                <thead>
                                    <tr>
                                        <th>
                                            Name
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                    `;

                    if (
                        participants.length ===
                        0
                    ) {
                        htmlContent += `
                            <tr>
                                <td>
                                    (keine Teilnehmer)
                                </td>
                            </tr>
                        `;
                    } else {
                        for (
                            const participant of participants
                        ) {
                            htmlContent += `
                                <tr>
                                    <td>
                                        ${escapeHtml(
                                participant
                            )}
                                    </td>
                                </tr>
                            `;
                        }
                    }

                    htmlContent += `
                                </tbody>

                            </table>

                        </div>
                    `;
                }

                htmlContent += `
                        </div>

                    </div>
                `;

                first =
                    false;
            }
        }


        htmlContent += `
</body>

</html>
`;


        const blob =
            new Blob(
                [
                    htmlContent,
                ],
                {
                    type:
                        "text/html;charset=utf-8",
                }
            );

        saveAs(
            blob,
            "workshop_allocations.html"
        );
    } catch (error) {
        console.error(
            "Error generating HTML allocation file:",
            error
        );

        alert(
            `Fehler beim Generieren der Zuteilungs-Datei: ${error.message ||
            "Unbekannter Fehler aufgetreten."
            }`
        );
    }
}