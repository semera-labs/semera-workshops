import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  Box,
  Divider,
} from "@mui/material";

export default function SettingsDialog({ open, onClose }) {
  const [settings, setSettings] = useState({
    warnBeforeDelete: true,
    numDays: 1,
    numPreferences: 3,
  });

  useEffect(() => {
    if (open && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke("settings:load").then((loaded) => {
        setSettings(loaded);
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke("settings:save", settings);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: "bold" }} component="span">
          Application Settings
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Warning before delete */}
        <Box mb={3}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            General
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.warnBeforeDelete}
                onChange={(e) =>
                  setSettings({ ...settings, warnBeforeDelete: e.target.checked })
                }
              />
            }
            label="Warn before deleting entries"
          />
        </Box>

        <Divider />

        {/* Number of days */}
        <Box mt={3} mb={3}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            Workshop Settings
          </Typography>
          <Box sx={{ display: "flex", gap: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Number of days
              </Typography>
              <Select
                value={settings.numDays}
                onChange={(e) =>
                  setSettings({ ...settings, numDays: e.target.value })
                }
                size="small"
              >
                {[1, 2, 3].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Number of preferences
              </Typography>
              <Select
                value={settings.numPreferences}
                onChange={(e) =>
                  setSettings({ ...settings, numPreferences: e.target.value })
                }
                size="small"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ fontWeight: "bold" }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
