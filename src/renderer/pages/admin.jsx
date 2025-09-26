import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { saveAs } from 'file-saver';
import { deDE } from '@mui/x-data-grid/locales';
import { generateAllocationCSV, generateAllocationFile, generateAllocationDocx } from '../../lib/generateAllocationReport';
import WorkshopEditor from "../../components/WorkshopEditor";
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import RuleIcon from '@mui/icons-material/Rule';
import QrCodeIcon from '@mui/icons-material/QrCode';
import QRDialog from "../../components/QRDialog";
import API_BASE from "../../lib/api.js";

export default function AdminView() {
    const [submissions, setSubmissions] = useState([]);

    const [selectedDays, setSelectedDays] = useState(1);
    const [selectedPreferences, setSelectedPreferences] = useState(3);

    const [openWorkshopEditor, setOpenWorkshopEditor] = useState(false);
    const [people, setPeople] = useState([]);

    const [qrOpen, setQrOpen] = useState(false);

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
    }, []);


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

    const importData = (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Update des lokalen States
                    setSubmissions(importedData);

                    // Senden der importierten Daten an den Server
                    try {
                        const response = await axios.post(`http://${API_BASE}/api/preferences/import`, importedData);
                        if (response.status === 200) {
                            alert('Daten erfolgreich importiert und auf dem Server aktualisiert!');
                        } else {
                            alert('Fehler beim Aktualisieren der Daten auf dem Server.');
                        }
                    } catch (serverError) {
                        console.error('Serverfehler beim Importieren der Daten:', serverError);
                        alert('Fehler beim Aktualisieren der Daten auf dem Server.');
                    }
                } catch (error) {
                    console.error('Fehler beim Parsen des JSON:', error);
                    alert('Fehler beim Importieren der Daten. Bitte stellen Sie sicher, dass die Datei gültiges JSON enthält.');
                }
            };
            reader.readAsText(file);
        }
    };

    const importParticipants = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let imported = [];
                if (file.name.endsWith(".json")) {
                    const json = JSON.parse(e.target.result);
                    imported = json.map((p) => ({
                        Vorname: p.Vorname || p.firstname || "",
                        Name: p.Name || p.lastname || "",
                        Kurs: p.Kurs || "",
                    }));
                } else if (file.name.endsWith(".csv")) {
                    const lines = e.target.result.split("\n").map((l) => l.trim()).filter(Boolean);
                    imported = lines.map((line) => {
                        const [lastname, firstname] = line.split(",").map((s) => s.trim());
                        return { Vorname: firstname, Name: lastname, Kurs: "" };
                    });
                }
                await axios.post(`http://${API_BASE}/api/participants/import`, imported);
                setPeople(imported);
                alert(`✅ Imported ${imported.length} participants`);
            } catch (err) {
                console.error("Fehler beim Importieren der Teilnehmer:", err);
                alert("❌ Fehler beim Importieren der Teilnehmer. Bitte prüfen Sie die Datei.");
            }
        };
        reader.readAsText(file);
    };


    const importWorkshops = (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Workshops an den Server senden
                    try {
                        const response = await axios.post(`http://${API_BASE}/api/workshops/import`, importedData);
                        if (response.status === 200) {
                            alert('Workshops erfolgreich importiert!');
                        } else {
                            alert('Fehler beim Importieren der Workshops auf dem Server.');
                        }
                    } catch (serverError) {
                        console.error('Serverfehler beim Importieren der Workshops:', serverError);
                        alert('Fehler beim Importieren der Workshops auf dem Server.');
                    }
                } catch (error) {
                    console.error('Fehler beim Parsen des JSON:', error);
                    alert('Fehler beim Importieren der Workshops. Bitte stellen Sie sicher, dass die Datei gültiges JSON enthält.');
                }
            };
            reader.readAsText(file);
        }
    };

    const handleDeleteClick = (id) => async () => {
        try {
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

    const preferenceCount = selectedPreferences; // e.g. 4

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

    // Final column list with base + dynamic preference columns + actions
    const columns = [
        { field: 'name', headerName: 'Name', width: 200, editable: true },
        ...preferenceColumns,
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            width: 70,
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
                    <div className="flex mb-4 justify-between items-end w-full">
                        <div className='flex'>
                            <div className="flex flex-col items-center">
                                <p className="font-semibold text-sm">Preference</p>
                                <div className="flex space-x-2">
                                    <button
                                        className="p-2 hover:bg-gray-200"
                                        onClick={exportData}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <FileDownloadIcon fontSize="small" />
                                            <span>Export</span>
                                        </div>
                                    </button>
                                    <label className="p-2 hover:bg-gray-200 cursor-pointer">
                                        <div className="flex items-center flex-col text-sm">
                                            <FileUploadIcon fontSize="small" />
                                            <span>Import</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={importData}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="border-l border-gray-300 h-fill mx-2"></div>
                            <div className="flex flex-col items-center">
                                <p className="font-semibold text-sm">Workshop</p>
                                <div className="flex space-x-2">
                                    <button
                                        className="p-2 hover:bg-gray-200 "
                                        onClick={exportWorkshops}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <FileDownloadIcon fontSize='small' />
                                            <span>Export</span>
                                        </div>
                                    </button>
                                    <label className="p-2 hover:bg-gray-200 cursor-pointer">
                                        <div className="flex items-center flex-col text-sm">
                                            <FileUploadIcon fontSize='small' />
                                            <span>Import</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={importWorkshops}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <button
                                        className="p-2 hover:bg-gray-200 "
                                        onClick={() => setOpenWorkshopEditor(true)}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <SettingsIcon fontSize='small' />
                                            <span>Edit</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div className="border-l border-gray-300 h-fill mx-2"></div>
                            <div className="flex flex-col items-center">
                                <p className="font-semibold text-sm">Allocate</p>
                                <div className="flex space-x-2">
                                    <button
                                        className="p-2 hover:bg-gray-200"
                                        onClick={() => generateAllocationFile(selectedDays)}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <AutoModeIcon fontSize='small' />
                                            <span>HTML</span>
                                        </div>
                                    </button>
                                    <button
                                        className="p-2 hover:bg-gray-200"
                                        onClick={() => generateAllocationCSV(selectedDays)}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <AutoModeIcon fontSize='small' />
                                            <span>CSV</span>
                                        </div>
                                    </button>
                                    <button
                                        className="p-2 hover:bg-gray-200"
                                        onClick={() => generateAllocationDocx(selectedDays)}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <AutoModeIcon fontSize='small' />
                                            <span>DOCX</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div className="border-l border-gray-300 h-fill mx-2"></div>
                            <div className="flex flex-col items-center">
                                <p className="font-semibold text-sm">Teilnehmer</p>
                                <div className="flex space-x-2">
                                    <label className="p-2 hover:bg-gray-200 cursor-pointer">
                                        <div className="flex items-center flex-col text-sm text-center">
                                            <FileUploadIcon fontSize="small" />
                                            <span className='block'>Import</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept=".json,.csv"
                                            onChange={importParticipants}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <div className="border-l border-gray-300 h-fill mx-2"></div>
                            <div className="flex flex-col items-center">
                                <p className="font-semibold text-sm">Options</p>
                                <div className="flex space-x-2">
                                    <button
                                        className="p-2 hover:bg-gray-200"
                                        onClick={fetchSubmissions} // Trigger the refresh when clicked
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <RefreshIcon fontSize='small' />
                                            <span>Refresh</span>
                                        </div>
                                    </button>
                                    <button
                                        className="p-2 hover:bg-gray-200"
                                        onClick={() => {
                                            const missing = getUnmatchedNames();
                                            if (missing.length === 0) {
                                                alert('✅ All names are matched!');
                                            } else {
                                                alert(`❌ Missing names:\n\n${missing.join('\n')}`);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <RuleIcon fontSize='small' />
                                            <span>Missing</span>
                                        </div>
                                    </button>
                                     <button
                                        className="p-2 hover:bg-gray-200 "
                                        onClick={() => setQrOpen(true)}
                                    >
                                        <div className="flex items-center flex-col text-sm">
                                            <QrCodeIcon fontSize='small' />
                                            <span>QR Code</span>
                                        </div>
                                    </button>
                                    {/* Dropdowns */}
                                    <div className="flex flex-col items-center space-y-1 mt-2 text-sm">
                                        <select
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            value={selectedDays}
                                            onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                                        >
                                            {[1,2,3].map((n) => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                        <span>Days</span>
                                    </div>
                                    <div className="flex flex-col items-center space-y-1 mt-2 text-sm">
                                        <select
                                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                                            value={selectedPreferences}
                                            onChange={(e) => setSelectedPreferences(parseInt(e.target.value))}
                                        >
                                            {[1, 2, 3, 4, 5].map((n) => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                        <span>Preferences</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            <strong>Matched:</strong> {matchedCount} of {totalPeople} people
                        </div>
                    </div>
                    <div style={{ height: '82vh', width: '100%' }}>
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
                            } />

                    </div>
                <WorkshopEditor
                    open={openWorkshopEditor}
                    onClose={() => setOpenWorkshopEditor(false)}
                />
                <QRDialog open={qrOpen} onClose={() => setQrOpen(false)} />
            </div>
        </>
    );
}
