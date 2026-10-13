import {
    saveAs,
} from "file-saver";

import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    AlignmentType,
} from "docx";

import {
    getReportSettings,
} from "./settings.js";

import {
    validateAllocationResult,
    getWorkshopInfo,
    getScheduleWorkshops,
} from "./helpers.js";


/*
 * --------------------------------------------------------------------------
 * DOCX helpers
 * --------------------------------------------------------------------------
 */

function createParticipantTable(
    participants = []
) {
    const safeParticipants =
        participants.length >
            0
            ? participants
            : [
                "(keine Teilnehmer)",
            ];

    const rows =
        safeParticipants.map(
            participant =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    text:
                                        participant,

                                    style:
                                        "ArialNormal",
                                }),
                            ],
                        }),
                    ],
                })
        );

    return new Table({
        rows,
    });
}


function createInfoParagraphs({
    workshop,
    participantCount = null,
    settings,
}) {
    const info =
        getWorkshopInfo(
            workshop
        );

    const paragraphs = [];

    if (
        settings.reportShowStaff &&
        info.staff
    ) {
        paragraphs.push(
            new Paragraph({
                text:
                    `Personal: ${info.staff}`,

                style:
                    "ArialNormal",

                alignment:
                    AlignmentType.CENTER,
            })
        );
    }

    if (
        settings.reportShowRoom &&
        info.room
    ) {
        paragraphs.push(
            new Paragraph({
                text:
                    `Raum: ${info.room}`,

                style:
                    "ArialNormal",

                alignment:
                    AlignmentType.CENTER,
            })
        );
    }

    if (
        settings.reportShowParticipantCount &&
        participantCount != null
    ) {
        paragraphs.push(
            new Paragraph({
                text:
                    `Teilnehmer: ${participantCount}/${info.maxParticipants}`,

                style:
                    "ArialNormal",

                alignment:
                    AlignmentType.CENTER,
            })
        );
    }

    return paragraphs;
}


/*
 * --------------------------------------------------------------------------
 * DOCX report
 * --------------------------------------------------------------------------
 */

export async function generateAllocationDocx(
    allocations
) {
    try {
        validateAllocationResult(
            allocations
        );

        const settings =
            await getReportSettings();

        const sections = [];


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

                sections.push({
                    properties: {},

                    children: [
                        new Paragraph({
                            text:
                                info.title,

                            heading:
                                HeadingLevel.HEADING_1,

                            alignment:
                                AlignmentType.CENTER,

                            style:
                                "ArialHeading",
                        }),

                        ...createInfoParagraphs({
                            workshop,

                            participantCount:
                                participants.length,

                            settings,
                        }),

                        new Paragraph(
                            ""
                        ),

                        createParticipantTable(
                            participants
                        ),

                        new Paragraph(
                            ""
                        ),
                    ],
                });
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

                if (
                    days.length ===
                    0
                ) {
                    continue;
                }

                const headerRow =
                    new TableRow({
                        children:
                            days.map(
                                day => {
                                    const participants =
                                        workshop.days[
                                        day
                                        ] ??
                                        [];

                                    let text =
                                        `Tag ${day}`;

                                    if (
                                        settings.reportShowParticipantCount
                                    ) {
                                        text +=
                                            ` (${participants.length}/${info.maxParticipants})`;
                                    }

                                    return new TableCell({
                                        children: [
                                            new Paragraph({
                                                text,

                                                style:
                                                    "ArialNormal",
                                            }),
                                        ],
                                    });
                                }
                            ),
                    });

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

                const rows = [
                    headerRow,
                ];

                if (
                    maxRows === 0
                ) {
                    rows.push(
                        new TableRow({
                            children:
                                days.map(
                                    () =>
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    text:
                                                        "(keine Teilnehmer)",

                                                    style:
                                                        "ArialNormal",
                                                }),
                                            ],
                                        })
                                ),
                        })
                    );
                } else {
                    for (
                        let rowIndex = 0;
                        rowIndex <
                        maxRows;
                        rowIndex++
                    ) {
                        rows.push(
                            new TableRow({
                                children:
                                    days.map(
                                        day =>
                                            new TableCell({
                                                children: [
                                                    new Paragraph({
                                                        text:
                                                            workshop.days[
                                                            day
                                                            ]?.[
                                                            rowIndex
                                                            ] ??
                                                            "",

                                                        style:
                                                            "ArialNormal",
                                                    }),
                                                ],
                                            })
                                    ),
                            })
                        );
                    }
                }

                /*
                 * Participant counts already appear
                 * in the individual day headers.
                 */
                const infoParagraphs =
                    createInfoParagraphs({
                        workshop,

                        participantCount:
                            null,

                        settings,
                    });

                sections.push({
                    properties: {},

                    children: [
                        new Paragraph({
                            text:
                                info.title,

                            heading:
                                HeadingLevel.HEADING_1,

                            alignment:
                                AlignmentType.CENTER,

                            style:
                                "ArialHeading",
                        }),

                        ...infoParagraphs,

                        new Paragraph(
                            ""
                        ),

                        new Table({
                            rows,
                        }),

                        new Paragraph(
                            ""
                        ),
                    ],
                });
            }
        }


        /*
         * ------------------------------------------------------------------
         * Build document
         * ------------------------------------------------------------------
         */

        const doc =
            new Document({
                styles: {
                    paragraphStyles: [
                        {
                            id:
                                "ArialNormal",

                            name:
                                "Arial Normal",

                            basedOn:
                                "Normal",

                            run: {
                                font:
                                    "Arial",

                                size:
                                    24,
                                // 12pt
                            },
                        },

                        {
                            id:
                                "ArialHeading",

                            name:
                                "Arial Heading",

                            basedOn:
                                "Heading1",

                            run: {
                                font:
                                    "Arial",

                                bold:
                                    true,

                                size:
                                    32,
                                // 16pt
                            },
                        },
                    ],
                },

                sections,
            });

        const blob =
            await Packer.toBlob(
                doc
            );

        saveAs(
            blob,
            "workshop_allocations.docx"
        );
    } catch (error) {
        console.error(
            "Error generating DOCX allocation file:",
            error
        );

        alert(
            `Fehler beim Generieren der Zuteilungs-Datei: ${error.message ||
            "Unbekannter Fehler aufgetreten."
            }`
        );
    }
}