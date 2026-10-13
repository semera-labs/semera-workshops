import ExcelJS from "exceljs";

/*
 * --------------------------------------------------------------------------
 * Reads tabular files (xlsx / csv / json) into plain string tables.
 *
 * Everything here is UI independent so it can be tested in Node.
 * --------------------------------------------------------------------------
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;

/*
 * A sheet looks like:
 *   { name, rows: string[][], rowNumbers: number[] }
 * rowNumbers[i] is the 1-based row number in the original file, so that
 * messages can point to the same row the user sees in Excel.
 */

export function cellToString(value) {
    if (value == null) {
        return "";
    }

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    if (typeof value === "object") {
        if (Array.isArray(value.richText)) {
            return value.richText.map((part) => part.text).join("").trim();
        }

        if ("result" in value) {
            return cellToString(value.result);
        }

        if ("text" in value) {
            return cellToString(value.text);
        }

        if ("error" in value) {
            return "";
        }

        return "";
    }

    return String(value).trim();
}

function finishSheet(name, rawRows, rowNumbers) {
    const rows = [];
    const numbers = [];

    rawRows.forEach((cells, index) => {
        if (cells.every((cell) => cell === "")) {
            return;
        }

        rows.push(cells);
        numbers.push(rowNumbers[index]);
    });

    /*
     * Remove trailing empty columns and make all rows equally long.
     */
    let width = 0;

    for (const cells of rows) {
        let last = cells.length;

        while (last > 0 && cells[last - 1] === "") {
            last--;
        }

        width = Math.max(width, last);
    }

    return {
        name,
        rows: rows.map((cells) =>
            Array.from({ length: width }, (_, index) => cells[index] ?? "")
        ),
        rowNumbers: numbers,
    };
}

/*
 * --------------------------------------------------------------------------
 * CSV
 * --------------------------------------------------------------------------
 */

function detectDelimiter(text) {
    const firstLine =
        text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";

    let best = ";";
    let bestCount = -1;

    for (const candidate of [";", ",", "\t"]) {
        let inQuotes = false;
        let count = 0;

        for (const char of firstLine) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === candidate && !inQuotes) {
                count++;
            }
        }

        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    }

    return best;
}

function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(text) {
    const source = stripBom(text);
    const delimiter = detectDelimiter(source);

    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < source.length; i++) {
        const char = source[i];

        if (inQuotes) {
            if (char === '"') {
                if (source[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += char;
            }

            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === delimiter) {
            row.push(cell.trim());
            cell = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && source[i + 1] === "\n") {
                i++;
            }

            row.push(cell.trim());
            rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    row.push(cell.trim());
    rows.push(row);

    return rows;
}

/*
 * --------------------------------------------------------------------------
 * JSON (the app's own export format)
 * --------------------------------------------------------------------------
 */

const IGNORED_JSON_KEYS = new Set(["id", "createdAt", "updatedAt"]);

function isPlainObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

export function jsonToRows(text) {
    const data = JSON.parse(stripBom(text));

    if (!Array.isArray(data)) {
        throw new Error(
            "Die JSON-Datei muss eine Liste von Einträgen enthalten."
        );
    }

    if (data.every(Array.isArray)) {
        return data.map((cells) => cells.map(cellToString));
    }

    const flattened = data.map((entry) => {
        const flat = {};

        if (!isPlainObject(entry)) {
            return flat;
        }

        for (const [key, value] of Object.entries(entry)) {
            if (IGNORED_JSON_KEYS.has(key)) {
                continue;
            }

            if (isPlainObject(value)) {
                for (const [subKey, subValue] of Object.entries(value)) {
                    flat[subKey in entry ? `${key}.${subKey}` : subKey] =
                        subValue;
                }
            } else {
                flat[key] = value;
            }
        }

        return flat;
    });

    const headers = [];

    for (const entry of flattened) {
        for (const key of Object.keys(entry)) {
            if (!headers.includes(key)) {
                headers.push(key);
            }
        }
    }

    return [
        headers,
        ...flattened.map((entry) =>
            headers.map((header) => cellToString(entry[header]))
        ),
    ];
}

/*
 * --------------------------------------------------------------------------
 * Entry point
 * --------------------------------------------------------------------------
 */

function extensionOf(fileName) {
    const match = /\.([^.]+)$/.exec(fileName ?? "");

    return match ? match[1].toLowerCase() : "";
}

export async function readTableFile(fileName, arrayBuffer) {
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
        throw new Error(
            "Die Datei ist zu groß (maximal 10 MB)."
        );
    }

    const extension = extensionOf(fileName);
    const decoder = new TextDecoder("utf-8");

    let sheets = [];

    if (extension === "xlsx" || extension === "xlsm") {
        const bytes = new Uint8Array(arrayBuffer);

        if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
            throw new Error(
                "Die Datei ist keine gültige Excel-Datei (.xlsx)."
            );
        }

        const workbook = new ExcelJS.Workbook();

        try {
            await workbook.xlsx.load(arrayBuffer);
        } catch {
            throw new Error(
                "Die Excel-Datei konnte nicht gelesen werden. Ist sie beschädigt oder passwortgeschützt?"
            );
        }

        workbook.eachSheet((worksheet) => {
            if (worksheet.state && worksheet.state !== "visible") {
                return;
            }

            const columnCount = worksheet.columnCount;
            const rawRows = [];
            const numbers = [];

            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rawRows.length > MAX_ROWS) {
                    return;
                }

                rawRows.push(
                    Array.from({ length: columnCount }, (_, index) =>
                        cellToString(row.getCell(index + 1).value)
                    )
                );
                numbers.push(rowNumber);
            });

            sheets.push(finishSheet(worksheet.name, rawRows, numbers));
        });
    } else if (extension === "xls") {
        throw new Error(
            "Das alte Excel-Format (.xls) wird nicht unterstützt. Bitte in Excel über „Speichern unter“ als .xlsx speichern."
        );
    } else if (
        extension === "csv" ||
        extension === "tsv" ||
        extension === "txt"
    ) {
        const rawRows = parseCsv(decoder.decode(arrayBuffer));

        sheets.push(
            finishSheet(
                "Tabelle",
                rawRows,
                rawRows.map((_, index) => index + 1)
            )
        );
    } else if (extension === "json") {
        const rawRows = jsonToRows(decoder.decode(arrayBuffer));

        sheets.push(
            finishSheet(
                "JSON",
                rawRows,
                rawRows.map((_, index) => index + 1)
            )
        );
    } else {
        throw new Error(
            "Dieses Dateiformat wird nicht unterstützt. Bitte .xlsx, .csv oder .json verwenden."
        );
    }

    sheets = sheets.filter((sheet) => sheet.rows.length > 0);

    if (sheets.length === 0) {
        throw new Error("Die Datei enthält keine Daten.");
    }

    const truncated = sheets.some((sheet) => sheet.rows.length > MAX_ROWS);

    if (truncated) {
        sheets = sheets.map((sheet) => ({
            ...sheet,
            rows: sheet.rows.slice(0, MAX_ROWS),
            rowNumbers: sheet.rowNumbers.slice(0, MAX_ROWS),
        }));
    }

    return { sheets, truncated };
}
