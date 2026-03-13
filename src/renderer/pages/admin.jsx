import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { saveAs } from 'file-saver';
import { deDE } from '@mui/x-data-grid/locales';
import { generateAllocationCSV, generateAllocationFile, generateAllocationDocx, generateAllocation } from '../../lib/generateAllocationReport';
import WorkshopEditor from "../../components/WorkshopEditor";
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import QRDialog from "../../components/QRDialog";
import API_BASE from "../../lib/api.js";
import SettingsDialog from "../../components/SettingsDialog";
import { Button } from "@mui/material";

export default function AdminView() {
    const [submissions, setSubmissions] = useState([]);

    const [openWorkshopEditor, setOpenWorkshopEditor] = useState(false);
    const [people, setPeople] = useState([]);

    const [qrOpen, setQrOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({ warnBeforeDelete: true, numDays: 1, numPreferences: 3 });
    const [allocations, setAllocations] = useState(null);

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
        fetchSubmissions(); // Fetch data on component mount
        fetchParticipants();
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
            window.electron.ipcRenderer.on("menu-export-preferences", exportData);
            window.electron.ipcRenderer.on("menu-export-workshops", exportWorkshops);
            window.electron.ipcRenderer.on("menu-import-workshops", importWorkshops);
            window.electron.ipcRenderer.on("menu-import-participants", importParticipants);
            window.electron.ipcRenderer.on("menu-import-preferences", importData);

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
                window.electron.ipcRenderer.removeAllListeners("menu-import-workshops");
                window.electron.ipcRenderer.removeAllListeners("menu-import-preferences");
                window.electron.ipcRenderer.removeAllListeners("menu-import-participants");
            };
        }
    }, []);

    useEffect(() => {
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on("menu-allocate", handleAllocate);
            window.electron.ipcRenderer.on("menu-reallocate", handleAllocate);

            return () => {
                window.electron.ipcRenderer.removeAllListeners("menu-allocate");
                window.electron.ipcRenderer.removeAllListeners("menu-reallocate");
            };
        }
    }, [settings]);

    const handleAllocate = async () => {
        const data = await generateAllocation(settings.numDays, settings.numPreferences);
        if (data.workshops) setAllocations(data.workshops);
        console.log(data.workshops)
        if (data.schedule) setAllocations(data.schedule);
        console.log(data.schedule)
    };

    useEffect(() => {
        const handler = () => {
            const missing = getUnmatchedNames();
            if (missing.length === 0) {
                alert('Alle Namen abgeglichen!');
            } else {
                alert(`Fehlende Namen:\n\n${missing.join('\n')}`);
            }
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
            return () => {
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-html");
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-csv");
                window.electron.ipcRenderer.removeAllListeners("menu-save-allocation-docx");
            };
        }
    }, [allocations]);


    const handleSettingsClose = () => {
        setSettingsOpen(false);
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.invoke("settings:load").then((loaded) => {
                setSettings(loaded);
            });
        }
    };


    const exportData = async () => {
        try {
            const response = await axios.get(`http://${API_BASE}/api/preferences`);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            saveAs(blob, 'submissions.json');
        } catch (error) {
            console.error('Fehler beim Exportieren der Workshops:', error);
            alert('Fehler beim Exportieren der Workshops.');
        }
    };

    const exportWorkshops = async () => {
        try {
            const response = await axios.get(`http://${API_BASE}/api/workshops`);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            saveAs(blob, 'workshops.json');
        } catch (error) {
            console.error('Fehler beim Exportieren der Workshops:', error);
            alert('Fehler beim Exportieren der Workshops.');
        }
    };

    const importData = async () => {
        try {
            const result = await window.electron.ipcRenderer.invoke("import-preferences-dialog");
            if (!result) return;

            const importedData = JSON.parse(result.content);

            // Update local state
            setSubmissions(importedData);

            // Send to server
            const response = await axios.post(`http://${API_BASE}/api/preferences/import`, importedData);
            if (response.status === 200) {
            } else {
                alert("Fehler beim Server-Update.");
            }
        } catch (error) {
            console.error("Fehler beim Import:", error);
            alert("Fehler beim Importieren. Bitte gültige JSON-Datei auswählen.");
        }
    };


    const importParticipants = async () => {
        try {
            const result = await window.electron.ipcRenderer.invoke("import-participants-dialog");
            if (!result) return;

            let imported = [];
            const { content, path } = result;

            if (path.endsWith(".json")) {
                const json = JSON.parse(content);
                imported = json.map((p) => ({
                    Vorname: p.Vorname || p.firstname || "",
                    Name: p.Name || p.lastname || "",
                    Kurs: p.Kurs || "",
                }));
            } else if (path.endsWith(".csv")) {
                // --- CSV import ---
                const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) return alert("Leere CSV-Datei.");

                // detect delimiter: use ; if it occurs more often than ,
                const delimiter = (lines[0].split(";").length > lines[0].split(",").length) ? ";" : ",";

                // split first line (possible header)
                const headerCells = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

                // header keywords we accept
                const headerPatterns = [
                    ["nachname", "vorname"],
                    ["lastname", "firstname"],
                    ["name", "firstname"],
                ];

                // check if first line looks like a header
                const isHeader = headerPatterns.some(pattern =>
                    pattern.every(keyword => headerCells.some(h => h.includes(keyword)))
                );

                // choose starting index for data
                const startIndex = isHeader ? 1 : 0;

                imported = lines.slice(startIndex).map(line => {
                    const cells = line.split(delimiter).map(s => s.trim());
                    // If more than two cells, just take first two meaningful ones
                    const [col1, col2] = cells;

                    // Determine which one is first name and last name if we had a header
                    let firstname = col2;
                    let lastname = col1;

                    // If the file used "Firstname, Lastname" header order
                    if (isHeader && headerCells[0].includes("vorname") || headerCells[0].includes("firstname")) {
                        firstname = col1;
                        lastname = col2;
                    }

                    return {
                        Vorname: firstname || "",
                        Name: lastname || "",
                        Kurs: "",
                    };
                });
            } else {
                alert("Ungültiges Dateiformat. Bitte JSON oder CSV verwenden.");
                return;
            }

            if (imported.length === 0) {
                alert("Keine Teilnehmer gefunden.");
                return;
            }

            await axios.post(`http://${API_BASE}/api/participants/import`, imported);
            setPeople(imported);
        } catch (err) {
            console.error("Fehler beim Importieren der Teilnehmer:", err);
            alert("Fehler beim Importieren der Teilnehmer. Bitte prüfen Sie die Datei.");
        }
    };

    const importWorkshops = async () => {
        try {
            const result = await window.electron.ipcRenderer.invoke("import-workshops-dialog");
            if (!result) return;

            const importedData = JSON.parse(result.content);

            // Send to server
            const response = await axios.post(`http://${API_BASE}/api/workshops/import`, importedData);
            if (response.status === 200) {
            } else {
                alert("Fehler beim Server-Update.");
            }
        } catch (error) {
            console.error("Fehler beim Import:", error);
            alert("Fehler beim Importieren. Bitte gültige JSON-Datei auswählen.");
        }
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

    const handleCellEditCommit = async (newRow, oldRow) => {
        console.log('Edit Commit:', newRow);
        var updatedSubmission = {};

        // Lokalen State aktualisieren und die neuen Daten direkt verwenden
        const updatedSubmissions = submissions.map((submission) => {
            console.log('Checking submission:', submission);
            if (submission.id === newRow.id) {
                updatedSubmission.id = newRow.id;
                updatedSubmission.name = newRow.name;
                updatedSubmission.preferences = { first: newRow.first, second: newRow.second, third: newRow.third, fourth: newRow.fourth };
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
            alert('Fehler beim Speichern der Änderung auf dem Server.');
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

    // Build the preference columns dynamically
    const preferenceColumns = Array.from({ length: preferenceCount }, (_, index) => {
        const field = ['first', 'second', 'third', 'fourth', 'fifth'][index] || `preference${index + 1}`;
        const labelMap = ['Erste Wahl', 'Zweite Wahl', 'Dritte Wahl', 'Vierte Wahl', 'Fünfte Wahl'];

        return {
            field,
            headerName: labelMap[index] || `Wahl ${index + 1}`,
            width: 160,
            editable: true,
        };
    });

    const isPreferenceMatched = (submissionName, preferenceName, allocations) => {
        if (!allocations || !Array.isArray(allocations)) return false;
        const workshop = allocations.find(w => w.title === preferenceName);
        if (!workshop || !Array.isArray(workshop.participants)) return false;
        return workshop.participants.some(n => n.toLowerCase() === submissionName.toLowerCase());
    };

    const columns = [
        { field: 'name', headerName: 'Name', width: 200, editable: true },
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
            <div className="min-h-screen flex flex-col p-4 bg-white w-full">
                <div style={{ height: '87vh', width: '100%' }}>
                    <DataGrid rows={submissions.map((submission) => {
                        const matched = isNameMatched(submission.name);
                        return {
                            id: submission.id,
                            name: submission.name,
                            first: submission.preferences.first,
                            second: submission.preferences.second,
                            third: submission.preferences.third,
                            fourth: submission.preferences.fourth,
                            matched,
                        }
                    })}
                        columns={columns} pageSize={5}
                        localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                        processRowUpdate={(updatedRow, originalRow) => handleCellEditCommit(updatedRow, originalRow)}
                        getRowClassName={(params) =>
                            params.row.matched ? '' : 'unmatched-row'
                        }
                        getCellClassName={(params) => {
                            const { field, row } = params;
                            if (['first', 'second', 'third', 'fourth'].includes(field)) {
                                const matched = isPreferenceMatched(row.name, row[field], allocations);
                                return matched ? 'highlight-cell' : '';
                            }
                            return '';
                        }}
                    />

                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
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
            </div>
        </>
    );
}
