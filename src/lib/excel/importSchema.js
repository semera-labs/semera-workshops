/*
 * --------------------------------------------------------------------------
 * What can be imported, which columns it needs, how columns are detected and
 * how rows are validated. No UI and no network access in here.
 * --------------------------------------------------------------------------
 */

import { PREFERENCE_KEYS, PREFERENCE_LABELS } from "../preferenceKeys.js";

export function normalizeText(value) {
    return String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]/g, "");
}

function normalizeName(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

/*
 * --------------------------------------------------------------------------
 * Field definitions
 * --------------------------------------------------------------------------
 */

const ORDINALS = [
    ["erste", "erster", "erstes", "erst", "1", "first"],
    ["zweite", "zweiter", "zweites", "zweit", "2", "second"],
    ["dritte", "dritter", "drittes", "dritt", "3", "third"],
    ["vierte", "vierter", "viertes", "viert", "4", "fourth"],
    ["funfte", "fuenfte", "funfter", "fuenfter", "funftes", "funft", "fuenft", "5", "fifth"],
    ["sechste", "sechster", "sechstes", "sechst", "6", "sixth"],
    ["siebte", "siebter", "siebtes", "siebt", "7", "seventh"],
];

const PREFERENCE_NOUNS = [
    "wahl",
    "wunsch",
    "praferenz",
    "praeferenz",
    "prioritat",
    "prioritaet",
    "prio",
    "workshop",
    "projekt",
    "pref",
    "preference",
    "choice",
];

function preferenceSynonyms(index) {
    const synonyms = new Set();

    for (const ordinal of ORDINALS[index]) {
        synonyms.add(ordinal);

        for (const noun of PREFERENCE_NOUNS) {
            synonyms.add(`${ordinal}${noun}`);
            synonyms.add(`${noun}${ordinal}`);
        }
    }

    return [...synonyms];
}

export const IMPORT_KINDS = {
    participants: {
        label: "Teilnehmer",
        endpoint: "participants",
        sheetName: "Teilnehmer",
        fields: [
            {
                key: "Vorname",
                label: "Vorname",
                required: true,
                synonyms: ["vorname", "firstname", "rufname", "givenname"],
            },
            {
                key: "Name",
                label: "Nachname",
                required: true,
                synonyms: [
                    "nachname",
                    "familienname",
                    "lastname",
                    "surname",
                    "name",
                ],
            },
            {
                key: "Kurs",
                label: "Kurs / Klasse",
                required: false,
                synonyms: ["kurs", "klasse", "gruppe", "stufe", "class", "course"],
            },
        ],
        example: [
            ["Max", "Mustermann", "Kurs A"],
            ["Erika", "Musterfrau", "Kurs B"],
        ],
        hint: "Eine Zeile pro Person. Vor- und Nachname stehen in getrennten Spalten.",
    },

    workshops: {
        label: "Workshops",
        endpoint: "workshops",
        sheetName: "Workshops",
        fields: [
            {
                key: "title",
                label: "Titel",
                required: true,
                synonyms: [
                    "titel",
                    "title",
                    "workshop",
                    "workshopname",
                    "bezeichnung",
                    "projekt",
                    "thema",
                    "angebot",
                    "name",
                ],
            },
            {
                key: "minParticipants",
                label: "Min. Teilnehmer",
                required: false,
                synonyms: [
                    "min",
                    "minimum",
                    "minteilnehmer",
                    "teilnehmermin",
                    "mindestteilnehmer",
                    "mindestanzahl",
                    "mindestens",
                    "minimal",
                    "minparticipants",
                ],
            },
            {
                key: "maxParticipants",
                label: "Max. Teilnehmer",
                required: true,
                synonyms: [
                    "max",
                    "maximum",
                    "maxteilnehmer",
                    "teilnehmermax",
                    "hochstteilnehmer",
                    "hoechstteilnehmer",
                    "maximalteilnehmer",
                    "plaetze",
                    "platze",
                    "kapazitat",
                    "kapazitaet",
                    "maxparticipants",
                    "maxanzahl",
                    "teilnehmerzahl",
                ],
            },
            {
                key: "staff",
                label: "Betreuung",
                required: false,
                synonyms: [
                    "betreuung",
                    "betreuer",
                    "betreuungsperson",
                    "leitung",
                    "leiter",
                    "personal",
                    "staff",
                    "teamer",
                    "dozent",
                    "referent",
                ],
            },
            {
                key: "location",
                label: "Ort / Raum",
                required: false,
                synonyms: [
                    "ort",
                    "raum",
                    "location",
                    "room",
                    "veranstaltungsort",
                    "standort",
                ],
            },
        ],
        example: [
            ["Fotografie", 4, 12, "Frau Beispiel", "Raum 101"],
            ["Theater", 6, 15, "Herr Muster", "Aula"],
        ],
        hint: "Eine Zeile pro Workshop. Titel und maximale Teilnehmerzahl sind Pflicht.",
    },

    preferences: {
        label: "Präferenzen",
        endpoint: "preferences",
        sheetName: "Präferenzen",
        fields: [
            {
                key: "name",
                label: "Name (Vor- und Nachname)",
                required: true,
                synonyms: [
                    "name",
                    "teilnehmer",
                    "schuler",
                    "schueler",
                    "vollername",
                    "person",
                    "vorundnachname",
                    "vornamenachname",
                ],
            },
            ...PREFERENCE_KEYS.map((key, index) => ({
                key,
                label: PREFERENCE_LABELS[index],
                required: index === 0,
                synonyms: preferenceSynonyms(index),
            })),
        ],
        example: [
            ["Max Mustermann", "Fotografie", "Theater", "Kochen"],
            ["Erika Musterfrau", "Theater", "Kochen", "Fotografie"],
        ],
        hint: "Eine Zeile pro Person. Der Name steht in einer Spalte (Vorname Nachname), danach die Wünsche. Die Workshop-Titel müssen mit den angelegten Workshops übereinstimmen.",
    },
};

export function templateHeaders(kind) {
    return IMPORT_KINDS[kind].fields.map((field) => field.label);
}

/*
 * --------------------------------------------------------------------------
 * Column detection
 * --------------------------------------------------------------------------
 */

const EXACT_SCORE = 100;
const PARTIAL_SCORE = 60;
const POSITION_SCORE = 20;

function scoreHeader(header, field) {
    const normalized = normalizeText(header);

    if (!normalized) {
        return 0;
    }

    let best = 0;

    for (const synonym of field.synonyms) {
        const candidate = normalizeText(synonym);

        if (normalized === candidate) {
            /*
             * Generic words ("name", "max") are weaker than specific ones
             * ("nachname", "maxteilnehmer") so that the specific column wins.
             */
            best = Math.max(best, candidate.length <= 4 ? 80 : EXACT_SCORE);
        } else if (
            candidate.length >= 5 &&
            normalized.includes(candidate)
        ) {
            best = Math.max(best, PARTIAL_SCORE);
        }
    }

    return best;
}

export function looksLikeHeader(kind, row) {
    const fields = IMPORT_KINDS[kind].fields;

    return row.some((cell) =>
        fields.some((field) => scoreHeader(cell, field) > 0)
    );
}

/*
 * Returns { mapping: { fieldKey: columnIndex }, guessed: Set<fieldKey>,
 *           score: number }
 *
 * "guessed" lists mappings that were derived from the column position only
 * and should be double-checked by the user.
 */
export function autoMapColumns(kind, headerRow, columnCount, hasHeader) {
    const fields = IMPORT_KINDS[kind].fields;
    const mapping = {};
    const guessed = new Set();
    const usedColumns = new Set();
    let total = 0;

    if (hasHeader) {
        const candidates = [];

        fields.forEach((field) => {
            headerRow.forEach((header, column) => {
                const score = scoreHeader(header, field);

                if (score > 0) {
                    candidates.push({ field: field.key, column, score });
                }
            });
        });

        candidates.sort(
            (a, b) => b.score - a.score || a.column - b.column
        );

        for (const candidate of candidates) {
            if (
                candidate.field in mapping ||
                usedColumns.has(candidate.column)
            ) {
                continue;
            }

            mapping[candidate.field] = candidate.column;
            usedColumns.add(candidate.column);
            total += candidate.score;
        }
    }

    /*
     * Fill remaining required/known fields by position, but only into
     * columns that nothing else claimed. Marked as "guessed".
     */
    const positionOrder = {
        participants: ["Name", "Vorname", "Kurs"],
        workshops: [
            "title",
            "minParticipants",
            "maxParticipants",
            "staff",
            "location",
        ],
        preferences: ["name", ...PREFERENCE_KEYS],
    }[kind];

    if (!hasHeader || Object.keys(mapping).length === 0) {
        positionOrder.forEach((key, index) => {
            if (
                index < columnCount &&
                !(key in mapping) &&
                !usedColumns.has(index)
            ) {
                mapping[key] = index;
                usedColumns.add(index);
                guessed.add(key);
                total += POSITION_SCORE;
            }
        });
    }

    return { mapping, guessed, score: total };
}

/*
 * Picks the sheet that matches best: own sheet name first, otherwise the
 * sheet whose headers are recognised best.
 */
export function pickBestSheet(kind, sheets) {
    const wanted = normalizeText(IMPORT_KINDS[kind].sheetName);

    let bestIndex = 0;
    let bestScore = -1;

    sheets.forEach((sheet, index) => {
        const hasHeader = looksLikeHeader(kind, sheet.rows[0] ?? []);
        const { score } = autoMapColumns(
            kind,
            sheet.rows[0] ?? [],
            sheet.rows[0]?.length ?? 0,
            hasHeader
        );

        const nameBonus = normalizeText(sheet.name) === wanted ? 1000 : 0;

        if (score + nameBonus > bestScore) {
            bestScore = score + nameBonus;
            bestIndex = index;
        }
    });

    return bestIndex;
}

/*
 * --------------------------------------------------------------------------
 * Row validation and record building
 * --------------------------------------------------------------------------
 */

function parseWholeNumber(text) {
    const match = /^\s*(\d+)(?:[.,]0+)?(?:\s*\D.*)?$/.exec(String(text ?? ""));

    return match ? Number.parseInt(match[1], 10) : null;
}

function cellAt(row, mapping, key) {
    const column = mapping[key];

    if (column == null || column < 0) {
        return "";
    }

    return String(row[column] ?? "").trim();
}

/*
 * context:
 *   mode            "replace" | "append"
 *   workshops       existing workshops  [{ title }]
 *   participants    existing participants [{ Vorname, Name }]
 *   submissions     existing submissions [{ name }]
 *
 * Returns:
 *   records   cleaned objects ready for the import endpoint
 *   issues    [{ rowNumber, level: "error" | "warn", message }]
 *   notes     [{ level: "info" | "warn", message }]   (not tied to a row)
 *   skipped   number of rows that are not imported
 */
export function buildRecords(
    kind,
    rows,
    rowNumbers,
    mapping,
    context = {}
) {
    const records = [];
    const issues = [];
    const notes = [];
    const append = context.mode === "append";

    const issue = (index, level, message) =>
        issues.push({
            rowNumber: rowNumbers[index] ?? index + 1,
            level,
            message,
        });

    const seen = new Set();
    let skipped = 0;

    const skip = (index, message) => {
        issue(index, "error", message);
        skipped++;
    };

    if (kind === "participants") {
        const existing = new Set(
            append
                ? (context.participants ?? []).map((person) =>
                    normalizeName(`${person.Vorname} ${person.Name}`)
                )
                : []
        );

        rows.forEach((row, index) => {
            const Vorname = cellAt(row, mapping, "Vorname");
            const Name = cellAt(row, mapping, "Name");
            const Kurs = cellAt(row, mapping, "Kurs");

            if (!Vorname && !Name) {
                return skip(index, "Leere Zeile – übersprungen.");
            }

            if (!Vorname || !Name) {
                return skip(
                    index,
                    `${!Vorname ? "Vorname" : "Nachname"} fehlt – übersprungen.`
                );
            }

            const key = normalizeName(`${Vorname} ${Name}`);

            if (seen.has(key)) {
                return skip(
                    index,
                    `„${Vorname} ${Name}“ kommt doppelt vor – übersprungen.`
                );
            }

            if (existing.has(key)) {
                return skip(
                    index,
                    `„${Vorname} ${Name}“ ist bereits vorhanden – übersprungen.`
                );
            }

            seen.add(key);
            records.push({ Vorname, Name, Kurs });
        });

        /*
         * Cross-check against received preferences: a very low match rate
         * with a high match rate for swapped names means the columns for
         * first and last name are probably swapped.
         */
        const submissionNames = new Set(
            (context.submissions ?? []).map((submission) =>
                normalizeName(submission.name)
            )
        );

        if (submissionNames.size > 0 && records.length > 0) {
            const direct = records.filter((record) =>
                submissionNames.has(
                    normalizeName(`${record.Vorname} ${record.Name}`)
                )
            ).length;

            const swapped = records.filter((record) =>
                submissionNames.has(
                    normalizeName(`${record.Name} ${record.Vorname}`)
                )
            ).length;

            if (swapped > direct && swapped >= 2) {
                notes.push({
                    level: "warn",
                    code: "swap-names",
                    message: `Nur ${direct} von ${records.length} Namen passen zu den eingegangenen Präferenzen, aber ${swapped} passen, wenn Vor- und Nachname vertauscht werden. Sind die Spalten vertauscht?`,
                });
            } else {
                notes.push({
                    level: "info",
                    message: `${direct} von ${records.length} Namen passen zu eingegangenen Präferenzen.`,
                });
            }
        }
    }

    if (kind === "workshops") {
        const existing = new Set(
            append
                ? (context.workshops ?? []).map((workshop) =>
                    normalizeText(workshop.title)
                )
                : []
        );

        rows.forEach((row, index) => {
            const title = cellAt(row, mapping, "title");
            const maxText = cellAt(row, mapping, "maxParticipants");
            const minText = cellAt(row, mapping, "minParticipants");
            const staff = cellAt(row, mapping, "staff");
            const location = cellAt(row, mapping, "location");

            if (!title && !maxText && !minText && !staff && !location) {
                return skip(index, "Leere Zeile – übersprungen.");
            }

            if (!title) {
                return skip(index, "Titel fehlt – übersprungen.");
            }

            const maxParticipants = parseWholeNumber(maxText);

            if (maxParticipants == null || maxParticipants < 1) {
                return skip(
                    index,
                    maxText
                        ? `„${title}“: max. Teilnehmer „${maxText}“ ist keine Zahl ≥ 1 – übersprungen.`
                        : `„${title}“: max. Teilnehmer fehlt – übersprungen.`
                );
            }

            let minParticipants = 0;

            if (minText) {
                const parsed = parseWholeNumber(minText);

                if (parsed == null) {
                    return skip(
                        index,
                        `„${title}“: min. Teilnehmer „${minText}“ ist keine Zahl – übersprungen.`
                    );
                }

                minParticipants = parsed;
            }

            if (minParticipants > maxParticipants) {
                return skip(
                    index,
                    `„${title}“: Minimum (${minParticipants}) ist größer als Maximum (${maxParticipants}) – übersprungen. Sind die Spalten vertauscht?`
                );
            }

            const key = normalizeText(title);

            if (seen.has(key)) {
                return skip(
                    index,
                    `„${title}“ kommt doppelt vor – übersprungen.`
                );
            }

            if (existing.has(key)) {
                return skip(
                    index,
                    `„${title}“ ist bereits vorhanden – übersprungen.`
                );
            }

            seen.add(key);
            records.push({
                title,
                minParticipants,
                maxParticipants,
                staff,
                location,
            });
        });
    }

    if (kind === "preferences") {
        const workshopLookup = new Map(
            (context.workshops ?? []).map((workshop) => [
                normalizeText(workshop.title),
                workshop.title,
            ])
        );

        const canCheckWorkshops = workshopLookup.size > 0;

        if (!canCheckWorkshops) {
            notes.push({
                level: "warn",
                message:
                    "Es sind noch keine Workshops angelegt. Die Wünsche können deshalb nicht geprüft werden – bitte zuerst die Workshops importieren.",
            });
        }

        const existing = new Set(
            append
                ? (context.submissions ?? []).map((submission) =>
                    normalizeName(submission.name)
                )
                : []
        );

        const unknownTitles = new Map();
        let checkedValues = 0;
        let unknownValues = 0;

        rows.forEach((row, index) => {
            const name = cellAt(row, mapping, "name").replace(/\s+/g, " ");

            const wishes = PREFERENCE_KEYS.map((key) => ({
                key,
                value: cellAt(row, mapping, key),
            })).filter((wish) => wish.value !== "");

            if (!name && wishes.length === 0) {
                return skip(index, "Leere Zeile – übersprungen.");
            }

            if (!name) {
                return skip(index, "Name fehlt – übersprungen.");
            }

            if (wishes.length === 0) {
                return skip(
                    index,
                    `„${name}“: keine Wünsche angegeben – übersprungen.`
                );
            }

            const key = normalizeName(name);

            if (seen.has(key)) {
                return skip(
                    index,
                    `„${name}“ kommt doppelt vor – übersprungen.`
                );
            }

            if (existing.has(key)) {
                return skip(
                    index,
                    `„${name}“ ist bereits vorhanden – übersprungen.`
                );
            }

            const preferences = {};
            const usedTitles = new Set();
            let rowHasUnknown = false;

            for (const wish of wishes) {
                let value = wish.value;

                if (canCheckWorkshops) {
                    checkedValues++;

                    const canonical = workshopLookup.get(
                        normalizeText(value)
                    );

                    if (canonical) {
                        value = canonical;
                    } else {
                        unknownValues++;
                        rowHasUnknown = true;
                        unknownTitles.set(
                            value,
                            (unknownTitles.get(value) ?? 0) + 1
                        );
                    }
                }

                if (usedTitles.has(value)) {
                    issue(
                        index,
                        "warn",
                        `„${name}“: „${value}“ wurde mehrfach gewählt.`
                    );
                }

                usedTitles.add(value);
                preferences[wish.key] = value;
            }

            if (rowHasUnknown) {
                issue(
                    index,
                    "warn",
                    `„${name}“: unbekannter Workshop (${wishes
                        .filter(
                            (wish) =>
                                !workshopLookup.has(
                                    normalizeText(wish.value)
                                )
                        )
                        .map((wish) => `„${wish.value}“`)
                        .join(", ")}) – wird so übernommen und bei der Zuteilung ignoriert.`
                );
            }

            seen.add(key);
            records.push({ name, preferences });
        });

        if (
            canCheckWorkshops &&
            checkedValues > 0 &&
            unknownValues / checkedValues > 0.5
        ) {
            notes.push({
                level: "warn",
                message:
                    "Mehr als die Hälfte der Wünsche passt zu keinem Workshop. Wurden die richtigen Spalten zugeordnet?",
            });
        }

        if (unknownTitles.size > 0) {
            notes.push({
                level: "warn",
                message: `Unbekannte Workshop-Titel: ${[...unknownTitles.entries()]
                    .slice(0, 8)
                    .map(([title, count]) => `„${title}“ (${count}×)`)
                    .join(", ")}${unknownTitles.size > 8 ? " …" : ""}`,
            });
        }

        const participantNames = new Set(
            (context.participants ?? []).map((person) =>
                normalizeName(`${person.Vorname} ${person.Name}`)
            )
        );

        if (participantNames.size > 0 && records.length > 0) {
            const matched = records.filter((record) =>
                participantNames.has(normalizeName(record.name))
            ).length;

            notes.push({
                level: matched === 0 ? "warn" : "info",
                message: `${matched} von ${records.length} Namen passen zur Teilnehmerliste.`,
            });
        }
    }

    return { records, issues, notes, skipped };
}

export function missingRequiredFields(kind, mapping) {
    return IMPORT_KINDS[kind].fields.filter(
        (field) => field.required && mapping[field.key] == null
    );
}
