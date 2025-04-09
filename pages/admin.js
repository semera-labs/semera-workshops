import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DataGrid } from '@mui/x-data-grid';
import { saveAs } from 'file-saver';
import { deDE } from '@mui/x-data-grid/locales';
import generateAllocationFile from '../lib/generateAllocationReport';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import QrCodeIcon from '@mui/icons-material/QrCode';
import Head from 'next/head';
import QRCode from 'qrcode';

export default function AdminView() {
    const [submissions, setSubmissions] = useState([]);

    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const [localIp, setLocalIp] = useState('');

    const [qrCode, setQrCode] = useState('');

    const [displayQrCode, setDisplayQrCode] = useState(false);

    const generateQrCode = async () => {
        setQrCode(await QRCode.toDataURL(`http://${localIp}:3000`, {
            errorCorrectionLevel: 'H', type: 'image/jpeg',
            quality: 1,
        }));
    };

    // Hardcoded password
    const correctPassword = "secret123";

    // Handle password submission
    const handleLogin = () => {
        if (password === correctPassword) {
            setIsAuthenticated(true);
        } else {
            alert("Incorrect password!");
        }
    };

    // Fetch submissions from the server
    const fetchSubmissions = async () => {
        try {
            const response = await axios.get('/api/preferences');
            setSubmissions(response.data);
        } catch (error) {
            console.error('Fehler beim Abrufen der Einreichungen:', error);
        }
    };

    useEffect(() => {
        fetchSubmissions(); // Fetch data on component mount
    }, []);


    const exportData = async () => {
        try {
            const response = await axios.get('/api/preferences/export');
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            saveAs(blob, 'submissions.json');
        } catch (error) {
            console.error('Fehler beim Exportieren der Workshops:', error);
            alert('Fehler beim Exportieren der Workshops.');
        }
    };

    const exportWorkshops = async () => {
        try {
            const response = await axios.get('/api/workshops/export');
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            saveAs(blob, 'workshops.json');
        } catch (error) {
            console.error('Fehler beim Exportieren der Workshops:', error);
            alert('Fehler beim Exportieren der Workshops.');
        }
    };

    const displayQRCode = () => {
        setDisplayQrCode((prev) => !prev);
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
                        const response = await axios.post('/api/preferences/import', importedData);
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

    const importWorkshops = (event) => {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Workshops an den Server senden
                    try {
                        const response = await axios.post('/api/workshops/import', importedData);
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

    const handleCellEditCommit = async (newRow, oldRow) => {
        console.log('Edit Commit:', newRow);
        var updatedSubmission = {};

        // Lokalen State aktualisieren und die neuen Daten direkt verwenden
        const updatedSubmissions = submissions.map((submission) => {
            console.log('Checking submission:', submission);
            if (submission.id === newRow.id) {
                updatedSubmission.id = newRow.id;
                updatedSubmission.name = newRow.name;
                updatedSubmission.preferences = { first: newRow.first, second: newRow.second, third: newRow.third };
                console.log('Updated Submission:', updatedSubmission);
                return updatedSubmission;
            }
            return submission;
        });

        setSubmissions(updatedSubmissions); // Update the state with the modified submission

        // Änderung an den Server senden
        try {
            await axios.put(`/api/preferences/${updatedSubmission.id}`, updatedSubmission);
            console.log('Änderung erfolgreich auf dem Server gespeichert.');
        } catch (error) {
            console.error('Fehler beim Speichern der Änderung auf dem Server:', error);
            alert('Fehler beim Speichern der Änderung auf dem Server.');
        }

        return newRow;
    };

    const columns = [
        { field: 'name', headerName: 'Name', width: 300, editable: true },
        { field: 'first', headerName: 'Erste Wahl', width: 200, editable: true },
        { field: 'second', headerName: 'Zweite Wahl', width: 200, editable: true },
        { field: 'third', headerName: 'Dritte Wahl', width: 200, editable: true },
    ];

    if (!isAuthenticated) {
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                backgroundColor: "#f4f4f4",
                fontFamily: "Arial, sans-serif"
            }}>
                <div style={{
                    backgroundColor: "#ffffff",
                    padding: "30px",
                    borderRadius: "10px",
                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                    textAlign: "center",
                    width: "300px"
                }}>
                    <h2 style={{ marginBottom: "20px", color: "#333" }}>Enter Admin Password</h2>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        style={{
                            width: "100%",
                            padding: "10px",
                            marginBottom: "15px",
                            border: "1px solid #ccc",
                            borderRadius: "5px",
                            fontSize: "16px"
                        }}
                    />
                    <button
                        onClick={handleLogin}
                        style={{
                            width: "100%",
                            padding: "10px",
                            backgroundColor: "#007BFF",
                            color: "white",
                            fontSize: "16px",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                            transition: "background 0.3s"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0056b3"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#007BFF"}
                    >
                        Submit
                    </button>
                </div>
            </div>
        );
    }


    return (
        <>
            <Head>
                <title>WS-Allocate Admin Panel</title>
                <link rel="icon" href="/favicon.png" />
            </Head>
            <div className="min-h-screen flex items-center justify-center bg-gray-100 w-full">
                <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-6xl">
                    <h2 className="text-2xl font-bold mb-6 text-center">Admin Panel</h2>
                    <div className="flex mb-4">
                        <button
                            className="p-2 hover:bg-gray-200"
                            onClick={exportData}
                        >
                            <div className="flex items-center flex-col">
                                <FileDownloadIcon fontSize='large' />
                                <span>Preference</span>
                                <span>Export</span>
                            </div>
                        </button>
                        <label className="p-2 hover:bg-gray-200 cursor-pointer">
                            <div className="flex items-center flex-col">
                                <FileUploadIcon fontSize='large' />
                                <span>Preference</span>
                                <span>Import</span>
                            </div>
                            <input
                                type="file"
                                accept=".json"
                                onChange={importData}
                                style={{ display: 'none' }}
                            />
                        </label>
                        <div className="border-l border-gray-300 h-fill mx-2"></div>
                        <button
                            className="p-2 hover:bg-gray-200 "
                            onClick={exportWorkshops}
                        >
                            <div className="flex items-center flex-col">
                                <FileDownloadIcon fontSize='large' />
                                <span>Workshop</span>
                                <span>Export</span>
                            </div>
                        </button>
                        <label className="p-2 hover:bg-gray-200 cursor-pointer">
                            <div className="flex items-center flex-col">
                                <FileUploadIcon fontSize='large' />
                                <span>Workshop</span>
                                <span>Import</span>
                            </div>
                            <input
                                type="file"
                                accept=".json"
                                onChange={importWorkshops}
                                style={{ display: 'none' }}
                            />
                        </label>
                        <div className="border-l border-gray-300 h-fill mx-2"></div>
                        <button
                            className="p-2 hover:bg-gray-200"
                            onClick={generateAllocationFile}
                        >
                            <div className="flex items-center flex-col">
                                <AutoModeIcon fontSize='large' />
                                <span>Allocate</span>
                            </div>
                        </button>
                        <button
                            className="p-2 hover:bg-gray-200"
                            onClick={fetchSubmissions} // Trigger the refresh when clicked
                        >
                            <div className="flex items-center flex-col">
                                <RefreshIcon fontSize='large' />
                                <span>Refresh</span>
                            </div>
                        </button>
                        <div className="border-l border-gray-300 h-fill mx-2"></div>
                        <button
                            className="p-2 hover:bg-gray-200"
                            onClick={displayQRCode}
                        >
                            <div className="flex items-center flex-col">
                                <QrCodeIcon fontSize='large' />
                                <span>QRCode</span>
                            </div>
                        </button>
                    </div>
                    <div style={{ height: 600, width: '100%' }}>
                        {displayQrCode ?
                            <div>
                                <input
                                    value={localIp}
                                    onChange={(e) => setLocalIp(e.target.value)}
                                    placeholder="Enter IP"
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        marginBottom: "15px",
                                        border: "1px solid #ccc",
                                        borderRadius: "5px",
                                        fontSize: "16px"
                                    }}
                                />
                                <button
                                    onClick={generateQrCode}
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        backgroundColor: "#007BFF",
                                        color: "white",
                                        fontSize: "16px",
                                        border: "none",
                                        borderRadius: "5px",
                                        cursor: "pointer",
                                        transition: "background 0.3s"
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#0056b3"}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#007BFF"}
                                >Generate QR Code</button>
                                {qrCode && <img src={qrCode} alt="QR Code" style={{ width: '400px' }} />}
                            </div>
                            :
                            <DataGrid rows={submissions.map((submission) => ({
                                id: submission.id,
                                name: submission.name,
                                first: submission.preferences.first,
                                second: submission.preferences.second,
                                third: submission.preferences.third,
                            }))}
                                columns={columns} pageSize={5}
                                localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                                processRowUpdate={(updatedRow, originalRow) => handleCellEditCommit(updatedRow, originalRow)} />}

                    </div>
                </div>
            </div>
        </>
    );
}
