/*
 * Titles and names are matched by trimmed, case-insensitive keys so that
 * "Fotografie ", "fotografie" and "Fotografie" are the same workshop.
 */
export function normalizeKey(value) {
    return String(value ?? "")
        .normalize("NFC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}
