import React, { useEffect, useState } from "react";
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
    const handleDeleteClick = (id) => async () => {
        try {
            await axios.delete(`http://${API_BASE}/api/workshops/${id}`);
            setWorkshops(workshops.filter((w) => w.id !== id));
        } catch (err) {
            console.error("Error deleting workshop:", err);
        }
    };

    // Handle add
    const handleAddWorkshop = async () => {
        const newWorkshop = {
            title: "New Workshop",
            maxParticipants: 20,
            minParticipants: 5,
            staff: "",
        };

        try {
            const res = await axios.post(`http://${API_BASE}/api/workshops`, newWorkshop);
            setWorkshops([...workshops, res.data]); // DB should return full object with ID
        } catch (err) {
            console.error("Error adding workshop:", err);
        }
    };

    const columns = [
        { field: "id", headerName: "ID", width: 120, editable: false },
        { field: "title", headerName: "Title", width: 200, editable: true },
        {
            field: "maxParticipants",
            headerName: "Max Participants",
            width: 200,
            editable: true,
            type: "number",
        },
        {
            field: "minParticipants",
            headerName: "Min Participants",
            width: 200,
            editable: true,
            type: "number",
        },
        { field: "staff", headerName: "Staff", width: 250, editable: true },
        {
            field: "actions",
            type: "actions",
            headerName: "Actions",
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
            <DialogTitle>Edit Workshops</DialogTitle>
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
                    Add Workshop
                </Button>
                <Button onClick={onClose} color="primary" variant="contained">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
