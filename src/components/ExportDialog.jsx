import React, { useEffect, useState } from "react";
import {
    Alert,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup,
    Radio,
    RadioGroup,
    Typography,
} from "@mui/material";
import axios from "axios";
import { saveAs } from "file-saver";

import API_BASE from "../lib/api.js";
import { loadAllocationContext } from "../lib/allocationReport/excel.js";
import { saveWorkbook } from "../lib/excel/download.js";
import {
    addAllocationSheets,
    addParticipantsSheet,
    addPreferencesSheet,
    addWorkshopsSheet,
    createWorkbook,
} from "../lib/excel/writer.js";

/*
 * The three data sets that can be exported and re-imported.
 */
const DATASETS = {
    preferences: {
        label: "Präferenzen",
        path: "preferences",
        file: "Praeferenzen",
        jsonFile: "submissions.json",
    },
    workshops: {
        label: "Workshops",
        path: "workshops",
        file: "Workshops",
        jsonFile: "workshops.json",
    },
    participants: {
        label: "Teilnehmer",
        path: "participants",
        file: "Teilnehmer",
        jsonFile: "participants.json",
    },
};

const fetchList = (path) =>
    axios.get(`http://${API_BASE}/api/${path}`).then((response) => response.data);

/*
 * Without `only` the dialog exports several data sets (and the allocation)
 * into one Excel file. With `only` ("preferences" | "workshops" |
 * "participants") it exports just that one, as Excel or JSON.
 */
export default function ExportDialog({
    open,
    onClose,
    only = null,
    allocations = null,
    numPreferences = 3,
}) {
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [format, setFormat] = useState("xlsx");

    const [selection, setSelection] = useState({
        preferences: true,
        workshops: true,
        participants: true,
        allocation: true,
    });

    const wanted = only ? [only] : Object.keys(DATASETS);

    /*
     * Right after (re)opening, `data` can still hold the previous dialog's
     * data for a moment. Only treat it as usable if it has what this dialog
     * needs.
     */
    const ready = data && wanted.every((key) => Array.isArray(data[key]));

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;

        setData(null);
        setLoadError("");
        setError("");
        setFormat("xlsx");

        Promise.all(wanted.map((key) => fetchList(DATASETS[key].path)))
            .then((lists) => {
                if (!cancelled) {
                    setData(Object.fromEntries(wanted.map((key, i) => [key, lists[i]])));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadError("Die Daten konnten nicht vom Server geladen werden.");
                }
            });

        return () => {
            cancelled = true;
        };
        // `wanted` is derived from `only`
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, only]);

    const addDatasetSheet = (workbook, key) => {
        if (key === "preferences") {
            addPreferencesSheet(workbook, data.preferences, numPreferences);
        } else if (key === "workshops") {
            addWorkshopsSheet(workbook, data.workshops);
        } else {
            addParticipantsSheet(workbook, data.participants);
        }
    };

    const date = new Date().toISOString().slice(0, 10);

    const runExport = async () => {
        setBusy(true);
        setError("");

        try {
            if (only && format === "json") {
                saveAs(
                    new Blob([JSON.stringify(data[only], null, 2)], {
                        type: "application/json",
                    }),
                    DATASETS[only].jsonFile
                );
            } else if (only) {
                const workbook = createWorkbook();

                addDatasetSheet(workbook, only);
                await saveWorkbook(workbook, `${DATASETS[only].file}_${date}.xlsx`);
            } else {
                const workbook = createWorkbook();

                for (const key of Object.keys(DATASETS)) {
                    if (selection[key]) {
                        addDatasetSheet(workbook, key);
                    }
                }

                if (selection.allocation && allocations) {
                    addAllocationSheets(
                        workbook,
                        allocations,
                        await loadAllocationContext()
                    );
                }

                await saveWorkbook(workbook, `Semera-Workshops_${date}.xlsx`);
            }

            onClose();
        } catch (err) {
            console.error("Export failed:", err);
            setError(err.message || "Der Export ist fehlgeschlagen.");
        } finally {
            setBusy(false);
        }
    };

    const rows = [
        ...Object.entries(DATASETS).map(([key, item]) => ({
            key,
            label: item.label,
            count: data?.[key]?.length,
        })),
        {
            key: "allocation",
            label: "Zuteilung",
            disabled: !allocations,
            note: allocations
                ? "Übersicht, nach Workshop, nach Teilnehmer, Statistik"
                : "Noch keine Zuteilung vorhanden",
        },
    ];

    const isSelected = (row) => selection[row.key] && !row.disabled;
    const anySelected = rows.some(isSelected);

    const toggle = (key) => (event) =>
        setSelection((previous) => ({ ...previous, [key]: event.target.checked }));

    const title = only
        ? `${DATASETS[only].label} exportieren`
        : "Alles als Excel exportieren";

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>

            <DialogContent dividers>
                {loadError && <Alert severity="error">{loadError}</Alert>}

                {!ready && !loadError && <CircularProgress size={24} />}

                {ready && only && (
                    <>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            {data[only].length} {DATASETS[only].label} werden exportiert.
                        </Typography>

                        <RadioGroup
                            value={format}
                            onChange={(event) => setFormat(event.target.value)}
                        >
                            <FormControlLabel
                                value="xlsx"
                                control={<Radio size="small" />}
                                label="Excel (.xlsx)"
                            />

                            <FormControlLabel
                                value="json"
                                control={<Radio size="small" />}
                                label="JSON (.json)"
                            />
                        </RadioGroup>

                        <Typography variant="caption" color="text.secondary">
                            Beide Formate lassen sich später wieder importieren.
                        </Typography>
                    </>
                )}

                {ready && !only && (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Alles Ausgewählte landet in einer Excel-Datei, jeweils auf
                            einem eigenen Tabellenblatt. Präferenzen, Workshops und
                            Teilnehmer lassen sich später wieder importieren.
                        </Typography>

                        <FormGroup>
                            {rows.map((row) => (
                                <FormControlLabel
                                    key={row.key}
                                    disabled={row.disabled}
                                    control={
                                        <Checkbox
                                            checked={isSelected(row)}
                                            onChange={toggle(row.key)}
                                        />
                                    }
                                    label={
                                        <>
                                            {row.label}
                                            {row.count != null && ` (${row.count})`}

                                            {row.note && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ display: "block" }}
                                                >
                                                    {row.note}
                                                </Typography>
                                            )}
                                        </>
                                    }
                                />
                            ))}
                        </FormGroup>
                    </>
                )}

                {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Abbrechen
                </Button>

                <Button
                    variant="contained"
                    onClick={runExport}
                    disabled={busy || !ready || (!only && !anySelected)}
                >
                    {busy ? "Exportiere …" : "Exportieren"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
