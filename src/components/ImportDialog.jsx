import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";

import API_BASE from "../lib/api.js";
import { readTableFile } from "../lib/excel/tableFile.js";
import {
    IMPORT_KINDS,
    autoMapColumns,
    buildRecords,
    looksLikeHeader,
    missingRequiredFields,
    pickBestSheet,
} from "../lib/excel/importSchema.js";
import { buildTemplateWorkbook } from "../lib/excel/writer.js";
import { saveWorkbook } from "../lib/excel/download.js";

const PREVIEW_ROWS = 5;
const MAX_COLUMNS = 20;
const MAX_LISTED_ISSUES = 12;

function columnLetter(index) {
    let letter = "";
    let n = index;

    do {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);

    return letter;
}

function existingAsRecords(kind, existing) {
    if (kind === "participants") {
        return existing.participants.map(({ Vorname, Name, Kurs }) => ({
            Vorname,
            Name,
            Kurs: Kurs ?? "",
        }));
    }

    if (kind === "workshops") {
        return existing.workshops.map(
            ({ title, minParticipants, maxParticipants, staff, location }) => ({
                title,
                minParticipants,
                maxParticipants,
                staff: staff ?? "",
                location: location ?? "",
            })
        );
    }

    return existing.submissions.map(({ name, preferences }) => ({
        name,
        preferences,
    }));
}

export default function ImportDialog({
    open,
    initialKind = "participants",
    onClose,
    onImported,
}) {
    const fileInput = useRef(null);

    // The menu entry decides what is imported; the dialog never switches.
    const kind = initialKind;
    const [existing, setExisting] = useState({
        workshops: [],
        participants: [],
        submissions: [],
    });

    const [fileName, setFileName] = useState("");
    const [workbook, setWorkbook] = useState(null);
    const [sheetIndex, setSheetIndex] = useState(0);
    const [hasHeader, setHasHeader] = useState(true);
    const [mapping, setMapping] = useState({});
    const [guessed, setGuessed] = useState(new Set());
    const [mode, setMode] = useState("replace");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [done, setDone] = useState(null);

    const definition = IMPORT_KINDS[kind];

    /*
     * Reset whenever the dialog opens and load what already exists, so that
     * names and workshop titles can be cross-checked.
     */
    useEffect(() => {
        if (!open) {
            return;
        }

        setFileName("");
        setWorkbook(null);
        setSheetIndex(0);
        setMapping({});
        setGuessed(new Set());
        setMode("replace");
        setError("");
        setDone(null);

        let cancelled = false;

        const load = (path) =>
            axios
                .get(`http://${API_BASE}/api/${path}`)
                .then((response) => response.data)
                .catch(() => []);

        Promise.all([
            load("workshops"),
            load("participants"),
            load("preferences"),
        ]).then(([workshops, participants, submissions]) => {
            if (!cancelled) {
                setExisting({ workshops, participants, submissions });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [open, initialKind]);

    /*
     * Chooses sheet, header row and column assignment for a (new) file or
     * a (new) import type.
     */
    const analyze = (nextKind, nextWorkbook) => {
        const index = pickBestSheet(nextKind, nextWorkbook.sheets);
        const sheet = nextWorkbook.sheets[index];
        const header = looksLikeHeader(nextKind, sheet.rows[0] ?? []);
        const auto = autoMapColumns(
            nextKind,
            sheet.rows[0] ?? [],
            sheet.rows[0]?.length ?? 0,
            header
        );

        setSheetIndex(index);
        setHasHeader(header);
        setMapping(auto.mapping);
        setGuessed(auto.guessed);
    };

    const remap = (sheet, header) => {
        const auto = autoMapColumns(
            kind,
            sheet.rows[0] ?? [],
            sheet.rows[0]?.length ?? 0,
            header
        );

        setMapping(auto.mapping);
        setGuessed(auto.guessed);
    };

    const loadFile = async (file) => {
        if (!file) {
            return;
        }

        setError("");
        setDone(null);
        setLoading(true);

        try {
            const loaded = await readTableFile(
                file.name,
                await file.arrayBuffer()
            );

            setWorkbook(loaded);
            setFileName(file.name);
            analyze(kind, loaded);
        } catch (err) {
            setWorkbook(null);
            setFileName("");
            setError(err.message || "Die Datei konnte nicht gelesen werden.");
        } finally {
            setLoading(false);
        }
    };

    const sheet = workbook?.sheets[sheetIndex] ?? null;

    const dataRows = useMemo(
        () => (sheet ? sheet.rows.slice(hasHeader ? 1 : 0) : []),
        [sheet, hasHeader]
    );

    const dataRowNumbers = useMemo(
        () => (sheet ? sheet.rowNumbers.slice(hasHeader ? 1 : 0) : []),
        [sheet, hasHeader]
    );

    const missing = useMemo(
        () => missingRequiredFields(kind, mapping),
        [kind, mapping]
    );

    const result = useMemo(() => {
        if (!sheet || missing.length > 0) {
            return null;
        }

        return buildRecords(kind, dataRows, dataRowNumbers, mapping, {
            mode,
            ...existing,
        });
    }, [sheet, missing, kind, dataRows, dataRowNumbers, mapping, mode, existing]);

    const columnCount = Math.min(
        MAX_COLUMNS,
        Math.max(0, ...(sheet?.rows ?? []).slice(0, 50).map((r) => r.length))
    );

    const fieldOfColumn = (column) =>
        Object.keys(mapping).find((key) => mapping[key] === column) ?? "";

    const assignColumn = (column, key) => {
        const next = { ...mapping };

        for (const [field, index] of Object.entries(next)) {
            if (index === column) {
                delete next[field];
            }
        }

        if (key) {
            next[key] = column;
        }

        setMapping(next);
        setGuessed((previous) => {
            const copy = new Set(previous);

            copy.delete(key);

            return copy;
        });
    };

    const swapNames = () => {
        setMapping((previous) => ({
            ...previous,
            Vorname: previous.Name,
            Name: previous.Vorname,
        }));
    };

    const existingCount = {
        participants: existing.participants.length,
        workshops: existing.workshops.length,
        preferences: existing.submissions.length,
    }[kind];

    const downloadTemplate = async () => {
        await saveWorkbook(
            buildTemplateWorkbook(kind),
            `Vorlage_${definition.label}.xlsx`
        );
    };

    const runImport = async () => {
        if (!result || result.records.length === 0) {
            return;
        }

        setBusy(true);
        setError("");

        try {
            const payload =
                mode === "append"
                    ? [...existingAsRecords(kind, existing), ...result.records]
                    : result.records;

            await axios.post(
                `http://${API_BASE}/api/${definition.endpoint}/import`,
                payload
            );

            setDone({ count: result.records.length, kind });
            onImported?.(kind, result.records.length);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.message ||
                "Der Import ist fehlgeschlagen. Die bisherigen Daten wurden nicht verändert."
            );
        } finally {
            setBusy(false);
        }
    };

    const shownIssues = result?.issues.slice(0, MAX_LISTED_ISSUES) ?? [];

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth scroll="paper">
            <DialogTitle>{definition.label} importieren</DialogTitle>

            <DialogContent dividers>
                {done ? (
                    <Alert severity="success">
                        {done.count} {IMPORT_KINDS[done.kind].label} wurden importiert.
                    </Alert>
                ) : (
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            {definition.hint} Erlaubt sind Excel (.xlsx), CSV und JSON.
                            Danach können Sie unten prüfen, welche Spalte welche Daten
                            enthält.
                        </Typography>

                        <Box
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragOver(false);
                                loadFile(event.dataTransfer.files?.[0]);
                            }}
                            sx={{
                                border: "2px dashed",
                                borderColor: dragOver ? "primary.main" : "divider",
                                borderRadius: 1,
                                p: 2,
                                textAlign: "center",
                                bgcolor: dragOver ? "action.hover" : "transparent",
                            }}
                        >
                            <input
                                ref={fileInput}
                                type="file"
                                hidden
                                accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json"
                                onChange={(event) => {
                                    loadFile(event.target.files?.[0]);
                                    event.target.value = "";
                                }}
                            />

                            {loading ? (
                                <CircularProgress size={24} />
                            ) : (
                                <Stack spacing={1} alignItems="center">
                                    <Typography variant="body2">
                                        {fileName
                                            ? `Geladen: ${fileName}`
                                            : "Datei hierher ziehen oder auswählen"}
                                    </Typography>

                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<UploadFileIcon />}
                                            onClick={() => fileInput.current?.click()}
                                        >
                                            {fileName ? "Andere Datei wählen" : "Datei auswählen"}
                                        </Button>

                                        <Button
                                            startIcon={<DownloadIcon />}
                                            onClick={downloadTemplate}
                                        >
                                            Excel-Vorlage herunterladen
                                        </Button>
                                    </Stack>
                                </Stack>
                            )}
                        </Box>

                        {error && <Alert severity="error">{error}</Alert>}

                        {workbook?.truncated && (
                            <Alert severity="warning">
                                Die Datei hat sehr viele Zeilen. Es werden nur die ersten
                                5000 berücksichtigt.
                            </Alert>
                        )}

                        {sheet && (
                            <>
                                <Stack
                                    direction="row"
                                    spacing={2}
                                    alignItems="center"
                                    flexWrap="wrap"
                                    useFlexGap
                                >
                                    {workbook.sheets.length > 1 && (
                                        <Select
                                            size="small"
                                            value={sheetIndex}
                                            onChange={(event) => {
                                                const index = event.target.value;
                                                const next = workbook.sheets[index];
                                                const header = looksLikeHeader(
                                                    kind,
                                                    next.rows[0] ?? []
                                                );

                                                setSheetIndex(index);
                                                setHasHeader(header);
                                                remap(next, header);
                                            }}
                                        >
                                            {workbook.sheets.map((item, index) => (
                                                <MenuItem key={item.name} value={index}>
                                                    Blatt: {item.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={hasHeader}
                                                onChange={(event) => {
                                                    setHasHeader(event.target.checked);
                                                    remap(sheet, event.target.checked);
                                                }}
                                            />
                                        }
                                        label="Erste Zeile enthält Spaltenüberschriften"
                                    />
                                </Stack>

                                <Typography variant="subtitle2">
                                    Welche Spalte enthält welche Daten?
                                </Typography>

                                <Box sx={{ overflowX: "auto" }}>
                                    <Table size="small" sx={{ minWidth: 400 }}>
                                        <TableHead>
                                            <TableRow>
                                                {Array.from({ length: columnCount }, (_, column) => {
                                                    const key = fieldOfColumn(column);

                                                    return (
                                                        <TableCell
                                                            key={column}
                                                            sx={{ minWidth: 150, verticalAlign: "top" }}
                                                        >
                                                            <Select
                                                                fullWidth
                                                                size="small"
                                                                displayEmpty
                                                                value={key}
                                                                onChange={(event) =>
                                                                    assignColumn(column, event.target.value)
                                                                }
                                                                color={
                                                                    key && guessed.has(key) ? "warning" : undefined
                                                                }
                                                            >
                                                                <MenuItem value="">
                                                                    <em>– nicht verwenden –</em>
                                                                </MenuItem>

                                                                {definition.fields.map((field) => (
                                                                    <MenuItem key={field.key} value={field.key}>
                                                                        {field.label}
                                                                        {field.required ? " *" : ""}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>

                                                            <Typography
                                                                variant="caption"
                                                                color={
                                                                    key && guessed.has(key)
                                                                        ? "warning.main"
                                                                        : "text.secondary"
                                                                }
                                                                sx={{ display: "block", mt: 0.5 }}
                                                            >
                                                                {key && guessed.has(key)
                                                                    ? "geraten – bitte prüfen"
                                                                    : hasHeader
                                                                        ? `Spalte ${columnLetter(column)}: ${sheet.rows[0][column] || "(leer)"}`
                                                                        : `Spalte ${columnLetter(column)}`}
                                                            </Typography>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        </TableHead>

                                        <TableBody>
                                            {dataRows.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                                                <TableRow key={rowIndex}>
                                                    {Array.from({ length: columnCount }, (_, column) => (
                                                        <TableCell
                                                            key={column}
                                                            sx={{
                                                                maxWidth: 220,
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                                color: fieldOfColumn(column)
                                                                    ? "text.primary"
                                                                    : "text.disabled",
                                                            }}
                                                        >
                                                            {row[column]}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>

                                {dataRows.length > PREVIEW_ROWS && (
                                    <Typography variant="caption" color="text.secondary">
                                        … und {dataRows.length - PREVIEW_ROWS} weitere Zeilen
                                    </Typography>
                                )}

                                {missing.length > 0 && (
                                    <Alert severity="error">
                                        Bitte ordnen Sie noch eine Spalte zu für:{" "}
                                        {missing.map((field) => field.label).join(", ")}.
                                    </Alert>
                                )}

                                {result && (
                                    <>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip
                                                color={result.records.length > 0 ? "success" : "error"}
                                                label={`${result.records.length} von ${dataRows.length} Zeilen werden importiert`}
                                            />

                                            {result.skipped > 0 && (
                                                <Chip
                                                    color="warning"
                                                    label={`${result.skipped} übersprungen`}
                                                />
                                            )}
                                        </Stack>

                                        {result.notes.map((note, index) => (
                                            <Alert
                                                key={index}
                                                severity={note.level === "warn" ? "warning" : "info"}
                                                action={
                                                    note.code === "swap-names" ? (
                                                        <Button color="inherit" size="small" onClick={swapNames}>
                                                            Tauschen
                                                        </Button>
                                                    ) : undefined
                                                }
                                            >
                                                {note.message}
                                            </Alert>
                                        ))}

                                        {shownIssues.length > 0 && (
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                                    Hinweise zu einzelnen Zeilen
                                                </Typography>

                                                <Box
                                                    component="ul"
                                                    sx={{ m: 0, pl: 2.5, maxHeight: 180, overflowY: "auto" }}
                                                >
                                                    {shownIssues.map((item, index) => (
                                                        <li key={index}>
                                                            <Typography
                                                                variant="body2"
                                                                color={
                                                                    item.level === "error"
                                                                        ? "error.main"
                                                                        : "warning.main"
                                                                }
                                                            >
                                                                Zeile {item.rowNumber}: {item.message}
                                                            </Typography>
                                                        </li>
                                                    ))}
                                                </Box>

                                                {result.issues.length > MAX_LISTED_ISSUES && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        … und {result.issues.length - MAX_LISTED_ISSUES} weitere
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}

                                        <Box>
                                            <RadioGroup
                                                value={mode}
                                                onChange={(event) => setMode(event.target.value)}
                                            >
                                                <FormControlLabel
                                                    value="replace"
                                                    control={<Radio size="small" />}
                                                    label={`Vorhandene Einträge ersetzen (${existingCount} vorhanden)`}
                                                />

                                                <FormControlLabel
                                                    value="append"
                                                    control={<Radio size="small" />}
                                                    label="An vorhandene Einträge anhängen (Doppelte werden übersprungen)"
                                                />
                                            </RadioGroup>

                                            {mode === "replace" && existingCount > 0 && (
                                                <Alert severity="warning" sx={{ mt: 1 }}>
                                                    Die {existingCount} vorhandenen Einträge werden gelöscht
                                                    und durch die importierten ersetzt.
                                                </Alert>
                                            )}
                                        </Box>
                                    </>
                                )}
                            </>
                        )}
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    {done ? "Schließen" : "Abbrechen"}
                </Button>

                {!done && (
                    <Button
                        variant="contained"
                        onClick={runImport}
                        disabled={busy || !result || result.records.length === 0}
                    >
                        {busy
                            ? "Importiere …"
                            : result
                                ? `${result.records.length} ${definition.label} importieren`
                                : "Importieren"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
