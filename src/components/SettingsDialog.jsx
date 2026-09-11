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
  TextField,
  Alert,
} from "@mui/material";

// Add enable/disable bonjour service (check if working?)

// Add Count/ Max participants, staff, room to report generation add settings

// make allocation algorithm better

// Set port? WILL NOT HAPPEN WITH THIS ARCHITECTURE LOL

export default function SettingsDialog({ open, onClose }) {
  const [settings, setSettings] = useState({
    warnBeforeDelete: true,
    enableBonjour: true,
    numDays: 1,
    numPreferences: 3,
    port: 80,
  });

  const [originalPort, setOriginalPort] = useState(80);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !window.electron?.ipcRenderer) {
      return;
    }

    const loadData = async () => {
      try {
        setError("");

        const [loadedSettings, serverConfig] = await Promise.all([
          window.electron.ipcRenderer.invoke("settings:load"),
          window.electron.ipcRenderer.invoke("server:get-config"),
        ]);

        const port = Number.parseInt(serverConfig?.port, 10) || 80;

        setOriginalPort(port);

        setSettings({
          warnBeforeDelete: loadedSettings?.warnBeforeDelete ?? true,
          enableBonjour: loadedSettings?.enableBonjour ?? true,
          numDays: loadedSettings?.numDays ?? 1,
          numPreferences: loadedSettings?.numPreferences ?? 3,
          port,
        });
      } catch (err) {
        console.error("Fehler beim Laden der Einstellungen:", err);

        setError(
          "Die Einstellungen konnten nicht geladen werden."
        );
      }
    };

    loadData();
  }, [open]);

  const handleSave = async () => {
    if (!window.electron?.ipcRenderer) {
      onClose();
      return;
    }

    const newPort = Number.parseInt(settings.port, 10);

    if (
      !Number.isInteger(newPort) ||
      newPort < 1 ||
      newPort > 65535
    ) {
      setError(
        "Bitte einen gültigen Port zwischen 1 und 65535 eingeben."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      /*
       * Save normal application settings first.
       *
       * settings.js ignores the port, because the port belongs
       * to the server configuration in config.json.
       */
      const settingsSaved =
        await window.electron.ipcRenderer.invoke(
          "settings:save",
          settings
        );

      if (!settingsSaved) {
        throw new Error(
          "Die Anwendungseinstellungen konnten nicht gespeichert werden."
        );
      }

      /*
       * Change the server port only when it actually changed.
       */
      if (newPort !== originalPort) {
        const result =
          await window.electron.ipcRenderer.invoke(
            "server:change-port",
            newPort
          );

        if (!result?.success) {
          setError(
            result?.message ||
            "Der Server-Port konnte nicht geändert werden."
          );

          return;
        }

        setOriginalPort(newPort);
      }

      onClose();
    } catch (err) {
      console.error("Fehler beim Speichern der Einstellungen:", err);

      setError(
        err?.message ||
        "Die Einstellungen konnten nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Typography
          variant="h6"
          sx={{ fontWeight: "bold" }}
          component="span"
        >
          Anwendungseinstellungen
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
          >
            {error}
          </Alert>
        )}

        {/* Warning before delete */}
        <Box mb={3}>
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            Allgemein
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.warnBeforeDelete}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    warnBeforeDelete: e.target.checked,
                  })
                }
              />
            }
            label="Vor dem Löschen warnen"
          />
        </Box>

        <Divider />

        {/* Number of days */}
        <Box mt={3} mb={3}>
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            Workshop Einstellungen
          </Typography>

          <Box sx={{ display: "flex", gap: 3 }}>
            <Box>
              <Typography
                variant="body2"
                sx={{ mb: 0.5 }}
              >
                Anzahl Tage
              </Typography>

              <Select
                value={settings.numDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    numDays: e.target.value,
                  })
                }
                size="small"
              >
                {[1, 2, 3].map((n) => (
                  <MenuItem
                    key={n}
                    value={n}
                  >
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box>
              <Typography
                variant="body2"
                sx={{ mb: 0.5 }}
              >
                Anzahl Präferenzen
              </Typography>

              <Select
                value={settings.numPreferences}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    numPreferences: e.target.value,
                  })
                }
                size="small"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <MenuItem
                    key={n}
                    value={n}
                  >
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        </Box>

        <Divider />

        <Box mt={3}>
          <Typography
            variant="subtitle1"
            sx={{ mb: 1, fontWeight: 600 }}
          >
            Netzwerk
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.enableBonjour}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    enableBonjour: e.target.checked,
                  })
                }
              />
            }
            label="Bonjour / mDNS aktivieren"
          />

          <Box mt={2}>
            <Typography
              variant="body2"
              sx={{ mb: 0.5 }}
            >
              Server-Port
            </Typography>

            <TextField
              type="number"
              size="small"
              value={settings.port}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  port: e.target.value,
                })
              }
              inputProps={{
                min: 1,
                max: 65535,
              }}
              disabled={saving}
              sx={{ width: 160 }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 1,
              }}
            >
              Der Server wird beim Ändern des Ports automatisch neu gestartet.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          justifyContent: "space-between",
          px: 3,
        }}
      >
        <Button
          onClick={onClose}
          disabled={saving}
        >
          Abbrechen
        </Button>

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ fontWeight: "bold" }}
        >
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}