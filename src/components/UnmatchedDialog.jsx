import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemText,
    Typography,
    Alert,
} from "@mui/material";

export default function UnmatchedDialog({ open, onClose, unmatchedNames = [] }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
            <DialogTitle>Fehlende Teilnehmer</DialogTitle>
            <DialogContent dividers>
                {unmatchedNames.length === 0 ? (
                    <Alert severity="success">Alle Namen wurden erfolgreich abgeglichen!</Alert>
                ) : (
                    <>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            Folgende <strong>{unmatchedNames.length}</strong> Teilnehmer haben noch keine Präferenzen eingereicht:
                        </Typography>
                        <List dense sx={{ maxHeight: 350, overflowY: "auto", bgcolor: "background.paper" }}>
                            {unmatchedNames.map((name, index) => (
                                <ListItem key={index} divider={index < unmatchedNames.length - 1}>
                                    <ListItemText primary={name} />
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">
                    Schließen
                </Button>
            </DialogActions>
        </Dialog>
    );
}