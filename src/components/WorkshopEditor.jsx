import React, { useEffect, useState, useCallback } from "react";
import {
    DataGrid,
    GridActionsCellItem,
} from "@mui/x-data-grid";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import axios from "axios";
import API_BASE from "../lib/api.js";

export default function WorkshopEditor({ open, onClose }) {
    const [workshops, setWorkshops] = useState([]);
    const [settings, setSettings] = useState({ warnBeforeDelete: true });

    // Fetch workshops
    const fetchWorkshops = async () => {
        try {
            const res = await axios.get(`http://${API_BASE}/api/workshops`);
            setWorkshops(res.data);
        } catch (err) {
            console.error("Error fetching workshops:", err);
        }
    };

    useEffect(() => {
        if (open && window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.invoke("settings:load").then((loaded) => {
                setSettings({
                    warnBeforeDelete: loaded.warnBeforeDelete ?? true,
                });
            });
        }
    }, [open]);

    useEffect(() => {
        if (open) fetchWorkshops();
    }, [open]);

    // Handle edit
    const handleRowUpdate = async (newRow, oldRow) => {
        try {
            await axios.put(`http://${API_BASE}/api/workshops/${newRow.id}`, newRow);
            setWorkshops((prev) =>
                prev.map((w) => (w.id === newRow.id ? newRow : w))
            );
            return newRow;
        } catch (err) {
            console.error("Error updating workshop:", err);
            return oldRow;
        }
    };

    // Handle delete
    const handleDeleteClick = useCallback(
        (id) => async () => {
            try {
                if (settings?.warnBeforeDelete) {
                    const confirmDelete = window.confirm(
                        "Are you sure you want to delete this workshop?"
                    );
                    if (!confirmDelete) return;
                }
                await axios.delete(`http://${API_BASE}/api/workshops/${id}`);
                setWorkshops((prev) => prev.filter((w) => w.id !== id));
            } catch (err) {
                console.error("Error deleting workshop:", err);
            }
        },
        [settings, setWorkshops] // dependencies — rebind when settings change
    );

    // Handle add
    const handleAddWorkshop = async () => {
        const newWorkshop = {
            title: "New Workshop",
            maxParticipants: 20,
            minParticipants: 5,
            staff: "",
            location: ""
        };

        try {
            const res = await axios.post(`http://${API_BASE}/api/workshops`, newWorkshop);
            setWorkshops([...workshops, res.data]); // DB should return full object with ID
        } catch (err) {
            console.error("Error adding workshop:", err);
        }
    };

    const columns = [
        { field: "id", headerName: "ID", width: 50, editable: false },
        { field: "title", headerName: "Titel", width: 200, editable: true },
        {
            field: "maxParticipants",
            headerName: "Maximale Teilnehmerzahl",
            width: 200,
            editable: true,
            type: "number",
        },
        {
            field: "minParticipants",
            headerName: "Minimale Teilnehmerzahl",
            width: 200,
            editable: true,
            type: "number",
        },
        { field: "staff", headerName: "Mitarbeiter", width: 180, editable: true },
        { field: "location", headerName: "Ort", width: 180, editable: true },
        {
            field: "actions",
            type: "actions",
            headerName: "Aktionen",
            width: 80,
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
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Workshops bearbeiten</DialogTitle>
            <DialogContent style={{ height: "70vh" }}>

                <DataGrid
                    rows={workshops}
                    columns={columns}
                    processRowUpdate={handleRowUpdate}
                    pageSize={5}
                />
            </DialogContent>
            <DialogActions>
                <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddWorkshop}
                >
                    Workshop hinzufügen
                </Button>
                <Button
                    onClick={async () => {
                        const confirmDelete = window.confirm(
                            "Sind Sie sicher, dass Sie alle Workshops löschen möchten?"
                        );
                        if (!confirmDelete) return;

                        try {
                            await axios.delete(`http://${API_BASE}/api/workshops`); // assuming you support bulk delete
                            setWorkshops([]);
                        } catch (err) {
                            console.error("Error deleting all workshops:", err);
                            alert("Fehler beim löschen aller Workshops!");
                        }
                    }}
                    className="text-white hover:bg-red-600" color="error" variant="contained"
                >
                    Alle löschen
                </Button>
                <Button onClick={onClose} color="primary" variant="contained">
                    Schließen
                </Button>
            </DialogActions>
        </Dialog>
    );
}
