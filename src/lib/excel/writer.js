import ExcelJS from "exceljs";

import {
    IMPORT_KINDS,
    normalizeText,
    templateHeaders,
} from "./importSchema.js";

import { computeAllocationStats } from "../allocation/stats.js";
import { MAX_PREFERENCES, PREFERENCE_KEYS } from "../preferenceKeys.js";

/*
 * --------------------------------------------------------------------------
 * Excel workbook building (no browser APIs, so it can be tested in Node).
 * --------------------------------------------------------------------------
 */

const HEADER_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF7" },
};

const WARN_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDECEA" },
};

export function createWorkbook() {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Semera Workshops";
    workbook.created = new Date();

    return workbook;
}

function safeSheetName(workbook, wanted) {
    const base =
        String(wanted)
            .replace(/[\\/?*[\]:]/g, " ")
            .trim()
            .slice(0, 31) || "Tabelle";

    let name = base;
    let counter = 2;

    while (workbook.getWorksheet(name)) {
        const suffix = ` ${counter++}`;
        name = base.slice(0, 31 - suffix.length) + suffix;
    }

    return name;
}

/*
 * columns: [{ header, width? }]
 * rows:    arrays of cell values (strings or numbers)
 * options: { highlight?: (row, index) => boolean }
 */
export function addTableSheet(
    workbook,
    sheetName,
    columns,
    rows,
    options = {}
) {
    const sheet = workbook.addWorksheet(safeSheetName(workbook, sheetName), {
        views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.addRow(columns.map((column) => column.header));

    const headerRow = sheet.getRow(1);

    headerRow.font = { bold: true };
    headerRow.fill = HEADER_FILL;
    headerRow.alignment = { vertical: "middle" };

    rows.forEach((cells, index) => {
        const row = sheet.addRow(cells);

        if (options.highlight?.(cells, index)) {
            row.fill = WARN_FILL;
        }
    });

    columns.forEach((column, index) => {
        let width = String(column.header).length;

        for (const cells of rows) {
            width = Math.max(width, String(cells[index] ?? "").length);
        }

        sheet.getColumn(index + 1).width =
            column.width ?? Math.min(50, Math.max(10, width + 2));
    });

    if (columns.length > 0) {
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length },
        };
    }

    return sheet;
}

export async function workbookToBuffer(workbook) {
    return workbook.xlsx.writeBuffer();
}

/*
 * --------------------------------------------------------------------------
 * Data sheets (same layout the importer reads again)
 * --------------------------------------------------------------------------
 */

export function addParticipantsSheet(workbook, people) {
    return addTableSheet(
        workbook,
        IMPORT_KINDS.participants.sheetName,
        [{ header: "Vorname" }, { header: "Nachname" }, { header: "Kurs" }],
        people.map((person) => [
            person.Vorname ?? "",
            person.Name ?? "",
            person.Kurs ?? "",
        ])
    );
}

export function addWorkshopsSheet(workbook, workshops) {
    return addTableSheet(
        workbook,
        IMPORT_KINDS.workshops.sheetName,
        [
            { header: "Titel" },
            { header: "Min. Teilnehmer" },
            { header: "Max. Teilnehmer" },
            { header: "Betreuung" },
            { header: "Ort" },
        ],
        workshops.map((workshop) => [
            workshop.title ?? "",
            workshop.minParticipants ?? 0,
            workshop.maxParticipants ?? "",
            workshop.staff ?? "",
            workshop.location ?? workshop.room ?? "",
        ])
    );
}

export function addPreferencesSheet(workbook, submissions, numPreferences = 3) {
    let columns = Math.min(MAX_PREFERENCES, Math.max(1, Number(numPreferences) || 3));

    for (const submission of submissions) {
        PREFERENCE_KEYS.forEach((key, index) => {
            if (submission.preferences?.[key]) {
                columns = Math.max(columns, index + 1);
            }
        });
    }

    return addTableSheet(
        workbook,
        IMPORT_KINDS.preferences.sheetName,
        [
            { header: "Name" },
            ...PREFERENCE_KEYS.slice(0, columns).map((_, index) => ({
                header: `${index + 1}. Wahl`,
            })),
        ],
        submissions.map((submission) => [
            submission.name ?? "",
            ...PREFERENCE_KEYS.slice(0, columns).map(
                (key) => submission.preferences?.[key] ?? ""
            ),
        ])
    );
}

/*
 * Empty workbook with the right headers, two example rows and an
 * explanation sheet. Importing it again works, so it doubles as a test.
 */
export function buildTemplateWorkbook(kind) {
    const definition = IMPORT_KINDS[kind];
    const workbook = createWorkbook();

    const headers = templateHeaders(kind);

    addTableSheet(
        workbook,
        definition.sheetName,
        headers.map((header) => ({ header })),
        definition.example
    );

    addTableSheet(
        workbook,
        "Hinweise",
        [{ header: "Spalte", width: 28 }, { header: "Pflicht", width: 10 }, { header: "Bedeutung", width: 80 }],
        [
            ...definition.fields.map((field) => [
                field.label,
                field.required ? "ja" : "nein",
                "",
            ]),
            [],
            [definition.hint],
            [
                "Die Spaltenüberschriften dürfen auch anders lauten – beim Import kann jede Spalte im Dialog zugeordnet werden.",
            ],
        ]
    );

    return workbook;
}

/*
 * --------------------------------------------------------------------------
 * Allocation sheets
 * --------------------------------------------------------------------------
 */

function compareGerman(a, b) {
    return String(a).localeCompare(String(b), "de");
}

function workshopInfo(workshop, workshopLookup) {
    const fromDatabase = workshopLookup.get(normalizeText(workshop?.title));

    return {
        title: workshop?.title ?? "(Unbenannter Workshop)",
        staff: workshop?.staff ?? fromDatabase?.staff ?? "",
        location:
            workshop?.location ??
            workshop?.room ??
            fromDatabase?.location ??
            "",
        minParticipants:
            workshop?.minParticipants ?? fromDatabase?.minParticipants ?? 0,
        maxParticipants:
            workshop?.maxParticipants ?? fromDatabase?.maxParticipants ?? "",
    };
}

/*
 * Returns { entries: [{ workshop, day, participants }], days: number[] }
 * regardless of single-day, random or multi-day.
 */
function collectEntries(allocations) {
    if (allocations.mode === "multi-day") {
        const entries = [];
        const days = new Set();

        for (const workshop of Object.values(allocations.schedule ?? {})) {
            for (const [day, participants] of Object.entries(
                workshop.days ?? {}
            )) {
                days.add(Number(day));
                entries.push({
                    workshop,
                    day: Number(day),
                    participants: participants ?? [],
                });
            }
        }

        return { entries, days: [...days].sort((a, b) => a - b) };
    }

    return {
        entries: (allocations.workshops ?? []).map((workshop) => ({
            workshop,
            day: null,
            participants: workshop.participants ?? [],
        })),
        days: [],
    };
}

/*
 * ctx: {
 *   settings     { reportShowStaff, reportShowRoom, reportShowParticipantCount }
 *   workshops    workshops from the database (fallback for room / staff)
 *   submissions  to compute how well wishes were met and to find people
 *                without an assignment
 *   people       participant list (course column, people without wishes)
 * }
 */
export function addAllocationSheets(workbook, allocations, ctx = {}) {
    const settings = {
        reportShowStaff: true,
        reportShowRoom: true,
        reportShowParticipantCount: true,
        ...(ctx.settings ?? {}),
    };

    const workshopLookup = new Map(
        (ctx.workshops ?? []).map((workshop) => [
            normalizeText(workshop.title),
            workshop,
        ])
    );

    const peopleByName = new Map(
        (ctx.people ?? []).map((person) => [
            `${person.Vorname} ${person.Name}`.trim().toLowerCase(),
            person,
        ])
    );

    const submissionsByName = new Map(
        (ctx.submissions ?? []).map((submission) => [
            String(submission.name ?? "").trim().toLowerCase(),
            submission,
        ])
    );

    const hasCourse = [...peopleByName.values()].some((person) => person.Kurs);

    const courseOf = (name) =>
        peopleByName.get(String(name).trim().toLowerCase())?.Kurs ?? "";

    const { entries, days } = collectEntries(allocations);
    const multiDay = allocations.mode === "multi-day";

    entries.sort(
        (a, b) =>
            compareGerman(a.workshop.title, b.workshop.title) ||
            (a.day ?? 0) - (b.day ?? 0)
    );

    /*
     * Sheet 1: overview
     */
    {
        const columns = [{ header: "Workshop" }];

        if (multiDay) columns.push({ header: "Tag" });
        if (settings.reportShowStaff) columns.push({ header: "Betreuung" });
        if (settings.reportShowRoom) columns.push({ header: "Ort" });
        if (settings.reportShowParticipantCount) {
            columns.push({ header: "Teilnehmer" }, { header: "Max." });
        }
        columns.push({ header: "Min." }, { header: "Hinweis" });

        const rows = entries.map(({ workshop, day, participants }) => {
            const info = workshopInfo(workshop, workshopLookup);
            const count = participants.length;
            const max = Number(info.maxParticipants);
            const min = Number(info.minParticipants) || 0;

            let hint = "";

            if (Number.isFinite(max) && max > 0 && count > max) {
                hint = "über dem Maximum";
            } else if (count > 0 && count < min) {
                hint = "unter dem Minimum";
            } else if (count === 0) {
                hint = "keine Teilnehmer";
            }

            const row = [info.title];

            if (multiDay) row.push(day);
            if (settings.reportShowStaff) row.push(info.staff);
            if (settings.reportShowRoom) row.push(info.location);
            if (settings.reportShowParticipantCount) {
                row.push(count, info.maxParticipants);
            }
            row.push(min, hint);

            return row;
        });

        addTableSheet(workbook, "Übersicht", columns, rows, {
            highlight: (row) => row[row.length - 1] !== "",
        });
    }

    /*
     * Sheet 2: by workshop
     */
    {
        const columns = [{ header: "Workshop" }];

        if (multiDay) columns.push({ header: "Tag" });
        columns.push({ header: "Nr." }, { header: "Name" });
        if (hasCourse) columns.push({ header: "Kurs" });

        const rows = [];

        for (const { workshop, day, participants } of entries) {
            [...participants]
                .sort(compareGerman)
                .forEach((name, index) => {
                    const row = [workshop.title];

                    if (multiDay) row.push(day);
                    row.push(index + 1, name);
                    if (hasCourse) row.push(courseOf(name));

                    rows.push(row);
                });
        }

        addTableSheet(workbook, "Nach Workshop", columns, rows);
    }

    /*
     * Sheet 3: by participant
     */
    {
        const maxPreferences = Math.min(
            MAX_PREFERENCES,
            Math.max(1, Number(allocations.maxPreferences) || MAX_PREFERENCES)
        );

        const rankOf = (name, workshopTitle) => {
            const submission = submissionsByName.get(
                String(name).trim().toLowerCase()
            );

            if (!submission) {
                return null;
            }

            const wishes = PREFERENCE_KEYS.slice(0, maxPreferences)
                .map((key) => submission.preferences?.[key])
                .filter(Boolean);

            const index = wishes.findIndex(
                (wish) =>
                    normalizeText(wish) === normalizeText(workshopTitle)
            );

            return index === -1 ? 0 : index + 1;
        };

        const rankText = (rank) =>
            rank == null ? "" : rank === 0 ? "kein Wunsch" : `${rank}. Wahl`;

        const columns = [{ header: "Name" }];

        if (hasCourse) columns.push({ header: "Kurs" });

        if (multiDay) {
            days.forEach((day) => columns.push({ header: `Tag ${day}` }));
            columns.push({ header: "Erfüllte Wünsche" });
        } else {
            columns.push({ header: "Workshop" }, { header: "Wunsch" });
        }

        columns.push({ header: "Hinweis" });

        const rows = [];
        const listed = new Set();

        const allocationNames = Object.keys(
            allocations.participantAllocations ?? {}
        );

        const knownNames = new Set(allocationNames);

        /*
         * Participants that exist (submissions or list) but have no
         * allocation entry at all.
         */
        for (const submission of ctx.submissions ?? []) {
            if (
                submission.name &&
                ![...knownNames].some(
                    (name) =>
                        name.trim().toLowerCase() ===
                        String(submission.name).trim().toLowerCase()
                )
            ) {
                knownNames.add(submission.name);
            }
        }

        for (const name of [...knownNames].sort(compareGerman)) {
            const placements =
                allocations.participantAllocations?.[name] ?? [];

            listed.add(name.trim().toLowerCase());

            const row = [name];

            if (hasCourse) row.push(courseOf(name));

            if (multiDay) {
                let fulfilled = 0;

                days.forEach((day) => {
                    const placement = placements.find(
                        (item) => Number(item.day) === day
                    );

                    row.push(placement?.workshop ?? "");

                    if (
                        placement &&
                        rankOf(name, placement.workshop) > 0
                    ) {
                        fulfilled++;
                    }
                });

                row.push(
                    submissionsByName.size > 0
                        ? `${fulfilled}/${days.length}`
                        : ""
                );

                const filledDays = placements
                    .filter((item) => item.fallback)
                    .map((item) => item.day);

                const notes = [];

                if (placements.length === 0) {
                    notes.push("Nicht zugeteilt");
                } else if (placements.length < days.length) {
                    notes.push("Nicht an allen Tagen zugeteilt");
                }

                if (filledDays.length > 0) {
                    notes.push(
                        `Aufgefüllt (kein Wunsch möglich): Tag ${filledDays.join(", ")}`
                    );
                }

                row.push(notes.join("; "));
            } else {
                const placement = placements[0];

                row.push(
                    placement?.workshop ?? "",
                    placement
                        ? rankText(rankOf(name, placement.workshop))
                        : ""
                );
                row.push(
                    !placement
                        ? "Nicht zugeteilt"
                        : placement.fallback
                            ? "Aufgefüllt (kein Wunsch möglich)"
                            : ""
                );
            }

            rows.push(row);
        }

        for (const person of ctx.people ?? []) {
            const key = `${person.Vorname} ${person.Name}`
                .trim()
                .toLowerCase();

            if (listed.has(key)) {
                continue;
            }

            listed.add(key);

            const row = [`${person.Vorname} ${person.Name}`.trim()];

            if (hasCourse) row.push(person.Kurs ?? "");

            const emptyCells = multiDay ? days.length + 1 : 2;

            for (let i = 0; i < emptyCells; i++) row.push("");

            row.push("Keine Präferenzen eingereicht");
            rows.push(row);
        }

        addTableSheet(workbook, "Nach Teilnehmer", columns, rows, {
            highlight: (row) => row[row.length - 1] !== "",
        });
    }

    /*
     * Sheet 4: statistics (how good is this allocation)
     */
    {
        const stats = computeAllocationStats(allocations, ctx.submissions ?? []);

        const percent = (value) => `${Math.round(value * 100)} %`;

        const rows = [
            [multiDay ? "Tageszuteilungen" : "Zuteilungen", stats.assignments],
            ...stats.byRank.map((count, index) => [
                `${index + 1}. Wahl`,
                `${count} (${stats.assignments ? percent(count / stats.assignments) : "0 %"})`,
            ]),
            ["Ohne Wunsch", stats.noWish],
            ["davon aufgefüllt", stats.fallback],
            [
                "Nicht zugeteilt (Personen)",
                stats.unassigned.length,
            ],
            ["Freie Plätze", `${stats.seatsFree} von ${stats.seatsTotal}`],
            ["Unter Minimum / nicht durchgeführt", stats.belowMinimum.length],
        ];

        if (allocations.seed != null) {
            rows.push(["Seed (zum Wiederholen)", allocations.seed]);
        }

        addTableSheet(
            workbook,
            "Statistik",
            [{ header: "Kennzahl", width: 36 }, { header: "Wert", width: 24 }],
            rows
        );
    }

    if ((allocations.warnings ?? []).length > 0) {
        addTableSheet(
            workbook,
            "Warnungen",
            [{ header: "Warnung", width: 100 }],
            allocations.warnings.map((warning) => [warning])
        );
    }

    return workbook;
}
