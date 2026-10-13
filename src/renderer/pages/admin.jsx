import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { deDE } from '@mui/x-data-grid/locales';
import { generateAllocationCSV, generateAllocationFile, generateAllocationDocx, generateAllocationExcel, generateAllocation } from '../../lib/generateAllocationReport';
import WorkshopEditor from "../../components/WorkshopEditor";
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import QRDialog from "../../components/QRDialog";
import API_BASE from "../../lib/api.js";
import SettingsDialog from "../../components/SettingsDialog";
import { Button } from "@mui/material";
import UnmatchedDialog from '../../components/UnmatchedDialog.jsx';
import ImportDialog from '../../components/ImportDialog.jsx';
import ExportDialog from '../../components/ExportDialog.jsx';
import AllocationSummary from '../../components/AllocationSummary.jsx';
import WorkshopOccupancy from '../../components/WorkshopOccupancy.jsx';
import { assignManually, unassignManually, assignmentsOf } from '../../lib/allocation/manual.js';
import { normalizeKey } from '../../lib/allocation/keys.js';
import { PREFERENCE_KEYS, PREFERENCE_HEADERS } from '../../lib/preferenceKeys.js';

export default function AdminView() {
    const [submissions, setSubmissions] = useState([]);

    const [openWorkshopEditor, setOpenWorkshopEditor] = useState(false);
    const [people, setPeople] = useState([]);

    const [unmatchedOpen, setUnmatchedOpen] = useState(false);
    const [unmatchedList, setUnmatchedList] = useState([]);

    const [qrOpen, setQrOpen] = useState(false);
    const [importDialog, setImportDialog] = useState({ open: false, kind: 'participants' });
    const [exportDialog, setExportDialog] = useState({ open: false, only: null });
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({ warnBeforeDelete: true, numDays: 1, numPreferences: 3 });
    const [allocations, setAllocations] = useState(null);
    const [workshops, setWorkshops] = useState([]);

    /*
     * The "context-assign" listener is registered once. It reads these refs
     * so it always sees the current workshops and settings instead of the
     * values from the first render.
     */
    const workshopsRef = useRef(workshops);
    const settingsRef = useRef(settings);

    useEffect(() => {
        workshopsRef.current = workshops;
    }, [workshops]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    /*
     * Manual assignment (context menu). Works for one day and for several
     * days; see lib/allocation/manual.js. Reads the refs because the
     * listener is registered only once.
     */
    const manualContext = () => ({
        workshops: workshopsRef.current,
        numDays: settingsRef.current.numDays,
        maxPreferences: settingsRef.current.numPreferences,
    });

    const assignManual = ({ name, workshop, day }) => {
        setAllocations((previous) =>
            assignManually(previous, { name, workshop, day }, manualContext())
        );
    };

    const unassignManual = ({ name, day }) => {
        setAllocations((previous) =>
            unassignManually(previous, { name, day }, manualContext())
        );
    };

    const fetchWorkshops = async () => {
        try {
            const response = await axios.get(`http://${API_BASE}/api/workshops`);
            setWorkshops(response.data); // data should include title and maxParticipants
        } catch (err) {
            console.error("Error fetching workshops:", err);
        }
    };

    const getWorkshopCounts = () => {
        const counts = {};

        workshops.forEach((workshop) => {
            const max =
                workshop.maxParticipants ?? 0;

            const min =
                workshop.minParticipants ?? 0;

            if (!allocations) {
                counts[workshop.title] = {
                    count: 0,
                    max,
                    overfilled: false,
                    days: null,
                };

                return;
            }

            /*
             * Multi-day allocation
             */
            if (
                allocations.mode ===
                "multi-day"
            ) {
                const scheduledWorkshop =
                    allocations.schedule?.[
                    workshop.title
                    ];

                const dayEntries =
                    Object.entries(
                        scheduledWorkshop?.days ||
                        {}
                    );

                const days =
                    dayEntries.map(
                        ([
                            day,
                            participants,
                        ]) => {
                            const count =
                                participants
                                    ?.length || 0;

                            return {
                                day,
                                count,
                                max,

                                overfilled:
                                    max > 0 &&
                                    count > max,

                                under:
                                    min > 0 &&
                                    count < min,
                            };
                        }
                    );

                counts[
                    workshop.title
                ] = {
                    /*
                     * Total assignment count.
                     * Only used internally / potentially
                     * for summaries.
                     */
                    count:
                        days.reduce(
                            (
                                total,
                                dayInfo
                            ) =>
                                total +
                                dayInfo.count,
                            0
                        ),

                    max,

                    overfilled:
                        days.some(
                            (dayInfo) =>
                                dayInfo.overfilled
                        ),

                    days,
                };

                return;
            }

            /*
             * Single-day / random allocation
             */
            const allocation =
                allocations.workshops?.find(
                    (item) =>
                        item.title ===
                        workshop.title
                );

            const count =
                allocation?.participants
                    ?.length || 0;

            counts[
                workshop.title
            ] = {
                count,
                max,

                overfilled:
                    max > 0 &&
                    count > max,

                days: null,
            };
        });

        return counts;
    };

    // Fetch submissions from the server
    const fetchSubmissions = async () => {
        try {
            const response = await axios.get(`http://${API_BASE}/api/preferences`);
            setSubmissions(response.data);
        } catch (error) {
            console.error('Fehler beim Abrufen der Einreichungen:', error);
        }
    };

    const fetchParticipants = async () => {
        try {
            const response = await axios.get(`http://${API_BASE}/api/participants`);
            setPeople(response.data);
        } catch (err) {
            console.error("Error fetching participants:", err);
        }
    };

    useEffect(() => {
        if (!window.electron?.ipcRenderer) {
            console.warn("ipcRenderer not available yet!");
            return;
        }

        window.electron.ipcRenderer.on("context-assign", assignManual);
        window.electron.ipcRenderer.on("context-unassign", unassignManual);

        return () => {
            window.electron.ipcRenderer.removeAllListeners("context-assign");
            window.electron.ipcRenderer.removeAllListeners("context-unassign");
        };
        // Registered once on purpose: the handlers only use setState and refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchSubmissions(); // Fetch data on component mount
        fetchParticipants();
        fetchWorkshops();
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on("menu-settings", () => {
                setSettingsOpen(true);
            });
            window.electron.ipcRenderer.on("menu-qr", () => {
                setQrOpen(true);
            });
            window.electron.ipcRenderer.on("menu-edit-workshops", () => {
                setOpenWorkshopEditor(true);
            });
            window.electron.ipcRenderer.on("menu-refresh", fetchSubmissions);
            window.electron.ipcRenderer.on("menu-export-preferences", () => openExport('preferences'));
            window.electron.ipcRenderer.on("menu-export-workshops", () => openExport('workshops'));
            window.electron.ipcRenderer.on("menu-export-participants", () => openExport('participants'));
            window.electron.ipcRenderer.on("menu-import-workshops", importWorkshops);
            window.electron.ipcRenderer.on("menu-import-participants", importParticipants);
            window.electron.ipcRenderer.on("menu-import-preferences", importData);
            window.electron.ipcRenderer.on("menu-export-excel", () => openExport(null));

            window.electron.ipcRenderer.invoke("settings:load").then((loaded) => {
                setSettings(loaded);
            });

            return () => {
                window.electron.ipcRenderer.removeAllListeners("menu-settings");
                window.electron.ipcRenderer.removeAllListeners("menu-qr");
                window.electron.ipcRenderer.removeAllListeners("menu-edit-workshops");
                window.electron.ipcRenderer.removeAllListeners("menu-refresh");
                window.electron.ipcRenderer.removeAllListeners("menu-export-preferences");
                window.electron.ipcRenderer.removeAllListeners("menu-export-workshops");
                window.electron.ipcRenderer.removeAllListeners("menu-export-participants");
                window.electron.ipcRenderer.removeAllListeners("menu-import-workshops");
                window.electron.ipcRenderer.removeAllListeners("menu-import-preferences");
                window.electron.ipcRenderer.removeAllListeners("menu-import-participants");
                window.electron.ipcRenderer.removeAllListeners("menu-export-excel");
            };
        }
    }, []);

    useEffect(() => {
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on("menu-allocate", handleAllocate);
            const handleReset = () => resetAllocations();
            window.electron.ipcRenderer.on("menu-reset-allocation", handleReset);


            return () => {
                window.electron.ipcRenderer.removeAllListeners("menu-allocate");
                window.electron.ipcRenderer.removeAllListeners("menu-reset-allocation");
            };
        }
    }, [settings]);

    const handleAllocate = async () => {
        const data = await generateAllocation(
            settings.numDays,
            settings.numPreferences,
            { attempts: settings.allocationRuns }
        );

        if (!data) {
            return;
        }
        setAllocations(data);

        console.log(
            "Allocation result:",
            data
        );
    };

    const resetAllocations = () => {
        setAllocations(null);

        window.electron?.ipcRenderer?.send(
            "allocation-state",
            false
        );
    };

    useEffect(() => {
        const handler = () => {
            const missing = getUnmatchedNames();
            setUnmatchedList(missing);
            setUnmatchedOpen(true);
        };

        window.electron?.ipcRenderer.on("menu-missing", handler);

        return () => {
            window.electron?.ipcRenderer.removeAllListeners("menu-missing");
        };
    }, [submissions, people]);

    useEffect(() => {
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.send("allocation-state", Boolean(allocations));

            window.electron.ipcRenderer.on("menu-save-allocation-html", () => { if (allocations) generateAllocationFile(allocations); });
            window.electron.ipcRenderer.on("menu-save-allocation-csv", () => { if (allocations) generateAllocationCSV(allocations); });
            window.electron.ipcRenderer.on("menu-save-allocation-docx", () => { if (allocations) generateAllocationDocx(allocations); });
            window.electron.ipcRenderer.on("menu-save-allocation-xlsx", () => { if (allocations) generateAllocationExcel(allocations); });
            return () => {
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-html");
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-csv");
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-docx");
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-xlsx");
            };
        }
    }, [allocations]);


    const handleSettingsClose = () => {
        setSettingsOpen(false);

        if (
            window.electron?.ipcRenderer
        ) {
            window.electron.ipcRenderer
                .invoke("settings:load")
                .then((loaded) => {
                    setSettings((previousSettings) => {
                        /*
                         * If allocation mode changed between
                         * single-day and multi-day, clear the
                         * old allocation.
                         */
                        const oldDays =
                            Number(
                                previousSettings.numDays
                            ) || 1;

                        const newDays =
                            Number(
                                loaded.numDays
                            ) || 1;

                        // A different number of days makes the old allocation unusable.
                        if (oldDays !== newDays) {
                            setAllocations(null);

                            window.electron?.ipcRenderer?.send(
                                "allocation-state",
                                false
                            );
                        }

                        return loaded;
                    });
                });
        }
    };


    // Export dialog: one data set (Excel or JSON) or everything as one Excel file.
    const openExport = (only) => setExportDialog({ open: true, only });

    // The import dialog reads Excel, CSV and JSON and lets the user check the column assignment.
    const openImport = (kind) => setImportDialog({ open: true, kind });

    const importData = () => openImport('preferences');
    const importParticipants = () => openImport('participants');
    const importWorkshops = () => openImport('workshops');

    const handleImported = () => {
        fetchSubmissions();
        fetchParticipants();
        fetchWorkshops();
    };

    const handleDeleteClick = (id) => async () => {
        try {
            if (settings.warnBeforeDelete) {
                const confirmDelete = window.confirm(
                    "Sind Sie sicher, dass Sie diesen Eintrag löschen möchten?"
                );
                if (!confirmDelete) return;
            }
            // Delete from server
            await axios.delete(`http://${API_BASE}/api/preferences/${id}`);
            console.log(`Submission with ID ${id} successfully deleted from server.`);

            setSubmissions(submissions.filter((submission) => submission.id !== id));
        } catch (error) {
            console.error(`Fehler beim Löschen der Submission mit ID ${id}:`, error);
            alert('Fehler beim Löschen des Eintrags auf dem Server.');
        }
    };

    const handleCellEditCommit = async (newRow) => {
        console.log('Edit Commit:', newRow);
        var updatedSubmission = {};

        // Lokalen State aktualisieren und die neuen Daten direkt verwenden
        const updatedSubmissions = submissions.map((submission) => {
            console.log('Checking submission:', submission);
            if (submission.id === newRow.id) {
                updatedSubmission.id = newRow.id;
                updatedSubmission.name = newRow.name;
                updatedSubmission.preferences = Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, newRow[key]]));
                console.log('Updated Submission:', updatedSubmission);
                return updatedSubmission;
            }
            return submission;
        });

        setSubmissions(updatedSubmissions); // Update the state with the modified submission

        // Änderung an den Server senden
        try {
            await axios.put(`http://${API_BASE}/api/preferences/${updatedSubmission.id}`, updatedSubmission);
            console.log('Änderung erfolgreich auf dem Server gespeichert.');
        } catch (error) {
            console.error('Fehler beim Speichern der Änderung auf dem Server:', error);
            alert(error.response?.data?.message || 'Fehler beim Speichern der Änderung auf dem Server.');
            fetchSubmissions();
        }

        return newRow;
    };

    const isNameMatched = (submissionName) => {
        return people.some((person) => {
            const fullName = `${person.Vorname} ${person.Name}`;
            return fullName.toLowerCase() === submissionName.toLowerCase();
        });
    };

    const matchedCount = submissions.filter((s) =>
        people.some((p) =>
            `${p.Vorname} ${p.Name}`.toLowerCase() === s.name.toLowerCase()
        )
    ).length;

    const totalPeople = people.length;

    const getUnmatchedNames = () => {
        return people
            .filter((p) =>
                !submissions.some(
                    (s) =>
                        `${p.Vorname} ${p.Name}`.toLowerCase() === s.name.toLowerCase()
                )
            )
            .map((p) => `${p.Vorname} ${p.Name}`);
    };

    const preferenceCount = settings.numPreferences; // e.g. 4

    /*
     * Right click on a name or a wish cell: manual assignment menu (built in
     * the main process). Single-day assigns directly, multi-day asks for the day.
     */
    const showContextMenu = (name, workshop) => {
        const multiDay = allocations
            ? allocations.mode === "multi-day"
            : Number(settings.numDays) > 1;

        const counts = getWorkshopCounts();

        window.electron?.ipcRenderer?.send("show-context-menu", {
            name,
            workshop,
            multiDay,
            numDays: allocations?.numDays ?? settings.numDays,

            workshops: workshops.map((item) => {
                const info = counts[item.title];

                return {
                    title: item.title,
                    info: multiDay
                        ? (info?.days ?? []).map((day) => `${day.count}/${day.max || "-"}`).join(" · ")
                        : `${info?.count ?? 0}/${info?.max || "-"}`,
                };
            }),

            assigned: assignmentsOf(allocations, name),
        });
    };

    // Build the preference columns dynamically
    const preferenceColumns = Array.from({ length: preferenceCount }, (_, index) => {
        const field = PREFERENCE_KEYS[index] || `preference${index + 1}`;

        return {
            field,
            headerName: PREFERENCE_HEADERS[index] || `Wahl ${index + 1}`,
            width: 160,
            editable: true,

            renderCell: (params) => {
                // Multi-day: show on which day this wish was granted.
                const days = getAssignedDays(params.row.name, params.value, allocations);

                return (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 4,
                        }}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            showContextMenu(params.row.name, params.value);
                        }}
                    >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {params.value}
                        </span>

                        {days.map((day) => (
                            <span
                                key={day}
                                title={`Tag ${day}`}
                                style={{
                                    flexShrink: 0,
                                    minWidth: 18,
                                    height: 18,
                                    lineHeight: "18px",
                                    borderRadius: 9999,
                                    textAlign: "center",
                                    fontSize: 11,
                                    fontWeight: "bold",
                                    color: "#fff",
                                    background: "#065f46",
                                }}
                            >
                                {day}
                            </span>
                        ))}
                    </div>
                );
            }
        };
    });

    /*
     * Days on which this person got the workshop (multi-day only).
     * Titles and names are compared like the allocator does, so a wish
     * typed as "fotografie " is still found.
     */
    const getAssignedDays = (submissionName, preferenceName, allocations) => {
        if (
            allocations?.mode !== "multi-day" ||
            !preferenceName ||
            !submissionName
        ) {
            return [];
        }

        const titleKey = normalizeKey(preferenceName);
        const nameKey = normalizeKey(submissionName);

        const workshop = Object.values(allocations.schedule ?? {}).find(
            (item) => normalizeKey(item.title) === titleKey
        );

        return Object.entries(workshop?.days ?? {})
            .filter(
                ([, participants]) =>
                    Array.isArray(participants) &&
                    participants.some((name) => normalizeKey(name) === nameKey)
            )
            .map(([day]) => Number(day))
            .sort((a, b) => a - b);
    };

    const isPreferenceMatched = (
        submissionName,
        preferenceName,
        allocations
    ) => {
        if (
            !allocations ||
            !preferenceName ||
            !submissionName
        ) {
            return false;
        }

        /*
         * Multi-day: highlight the wish when the person got that
         * workshop on at least one day.
         */
        if (allocations.mode === "multi-day") {
            return getAssignedDays(submissionName, preferenceName, allocations).length > 0;
        }

        /*
         * Single-day / random
         */
        const titleKey = normalizeKey(preferenceName);
        const nameKey = normalizeKey(submissionName);

        const workshop = allocations.workshops?.find(
            (item) => normalizeKey(item.title) === titleKey
        );

        return (
            Array.isArray(workshop?.participants) &&
            workshop.participants.some((name) => normalizeKey(name) === nameKey)
        );
    };

    const columns = [
        {
            field: 'name',
            headerName: 'Name',
            width: 200,
            editable: true,

            renderCell: (params) => (
                <div
                    style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        showContextMenu(params.row.name, "");
                    }}
                >
                    {params.value}
                </div>
            ),
        },
        ...preferenceColumns,
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Aktionen',
            width: 80,
            cellClassName: 'actions',
            getActions: ({ id }) => [
                <GridActionsCellItem
                    key="delete"
                    icon={<DeleteIcon />}
                    label="Delete"
                    onClick={handleDeleteClick(id)}
                    color="inherit"
                />,
            ],
        },
    ];


    return (
        <>
            {/*
              * The page fills the window: table + side panel take all height, the
              * bar below has its natural height. Very small windows scroll instead
              * of squeezing the side panel away.
              */}
            <div className="h-screen w-full overflow-auto bg-white">
                <div className="h-full min-h-[460px] min-w-[820px] flex flex-col gap-2 p-4">
                    <div className="flex flex-1 min-h-0 gap-4">
                        <div className="flex-1 min-w-[320px]" style={{ height: '100%' }}>
                            <DataGrid rows={submissions.map((submission) => {
                                const matched = isNameMatched(submission.name);
                                return {
                                    id: submission.id,
                                    name: submission.name,
                                    ...Object.fromEntries(
                                        PREFERENCE_KEYS.map((key) => [key, submission.preferences?.[key]])
                                    ),
                                    matched
                                }
                            })}
                                columns={columns} pageSize={5}
                                localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                                processRowUpdate={(updatedRow) => handleCellEditCommit(updatedRow)}
                                getRowClassName={(params) =>
                                    params.row.matched ? '' : 'unmatched-row'
                                }
                                getCellClassName={(params) => {
                                    const { field, row } = params;
                                    if (PREFERENCE_KEYS.includes(field)) {
                                        const matched = isPreferenceMatched(row.name, row[field], allocations);
                                        return matched ? 'highlight-cell' : '';
                                    }
                                    return '';
                                }}
                            />

                        </div>
                        {/* RIGHT PANEL */}
                        <aside className="w-80 shrink-0 p-4 border rounded bg-gray-50 overflow-y-auto">

                            <h3 className="font-bold mb-2">
                                Workshop-Belegung
                            </h3>

                            {allocations?.mode === "multi-day" && (
                                <div className="text-xs text-gray-500 mb-4 space-y-1">
                                    <div>
                                        Mehrtages-Zuteilung · {allocations.numDays} Tage ·
                                        max. {allocations.maxPreferences} Präferenzen
                                    </div>
                                    <div>Die Zahl in einer grünen Zelle ist der Tag.</div>
                                </div>
                            )}

                            {allocations && allocations.mode !== "multi-day" && (
                                <div className="text-xs text-gray-500 mb-4">
                                    Eintages-Zuteilung · max. {allocations.maxPreferences} Präferenzen
                                </div>
                            )}

                            {allocations && (
                                <AllocationSummary
                                    allocations={allocations}
                                    submissions={submissions}
                                />
                            )}

                            <WorkshopOccupancy
                                counts={getWorkshopCounts()}
                                multiDay={allocations?.mode === "multi-day"}
                            />

                        </aside>
                    </div>
                    <div className="shrink-0 flex justify-between items-center text-sm text-gray-600">
                        <div>
                            <strong>Abgleich:</strong> {matchedCount} von {totalPeople} Teilnehmern
                        </div>
                        <Button
                            onClick={async () => {
                                const confirmDelete = window.confirm(
                                    "Sind Sie sicher, dass Sie alle Präferenzen löschen möchten?"
                                );
                                if (!confirmDelete) return;

                                try {
                                    await axios.delete(`http://${API_BASE}/api/preferences`); // assuming you support bulk delete
                                    setSubmissions([]);
                                } catch (err) {
                                    console.error("Error deleting all submissions:", err);
                                    alert("Fehler beim löschen aller Präferenen.");
                                }
                            }}
                            className="text-white hover:bg-red-600" color="error" variant="contained"
                        >
                            Alle löschen
                        </Button>
                    </div>
                    <WorkshopEditor
                        open={openWorkshopEditor}
                        onClose={() => setOpenWorkshopEditor(false)}
                    />
                    <QRDialog open={qrOpen} onClose={() => setQrOpen(false)} />
                    <SettingsDialog open={settingsOpen} onClose={handleSettingsClose} />
                    <ImportDialog
                        open={importDialog.open}
                        initialKind={importDialog.kind}
                        onClose={() => setImportDialog((previous) => ({ ...previous, open: false }))}
                        onImported={handleImported}
                    />
                    <ExportDialog
                        open={exportDialog.open}
                        only={exportDialog.only}
                        onClose={() => setExportDialog((previous) => ({ ...previous, open: false }))}
                        allocations={allocations}
                        numPreferences={settings.numPreferences}
                    />
                    <UnmatchedDialog
                        open={unmatchedOpen}
                        onClose={() => setUnmatchedOpen(false)}
                        unmatchedNames={unmatchedList}
                    />
                </div>
            </div>
        </>
    );
}
