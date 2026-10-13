import { useEffect, useState } from "react";
import { MAX_ALLOCATION_RUNS, MAX_DAYS, MAX_PREFERENCES } from "../lib/preferenceKeys.js";

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

// make allocation algorithm better

export default function SettingsDialog({ open, onClose }) {
  const [settings, setSettings] = useState({
    warnBeforeDelete: true,
    enableBonjour: true,
    numDays: 1,
    numPreferences: 3,
    allocationRuns: 1,

    // Report generation settings
    reportShowParticipantCount: true,
    reportShowStaff: true,
    reportShowRoom: true,

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

        const port =
          Number.parseInt(serverConfig?.port, 10) || 80;

        setOriginalPort(port);

        setSettings({
          warnBeforeDelete:
            loadedSettings?.warnBeforeDelete ?? true,

          enableBonjour:
            loadedSettings?.enableBonjour ?? true,

          numDays:
            loadedSettings?.numDays ?? 1,

          numPreferences:
            loadedSettings?.numPreferences ?? 3,

          allocationRuns:
            loadedSettings?.allocationRuns ?? 1,

          // Report generation settings
          reportShowParticipantCount:
            loadedSettings?.reportShowParticipantCount ?? true,

          reportShowStaff:
            loadedSettings?.reportShowStaff ?? true,

          reportShowRoom:
            loadedSettings?.reportShowRoom ?? true,

          port,
        });
      } catch (err) {
        console.error(
          "Fehler beim Laden der Einstellungen:",
          err
        );

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

    const newPort =
      Number.parseInt(settings.port, 10);

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

    // Empty or out-of-range input becomes a valid number of runs.
    const allocationRuns = Math.min(
      MAX_ALLOCATION_RUNS,
      Math.max(1, Number.parseInt(settings.allocationRuns, 10) || 1)
    );

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
          { ...settings, allocationRuns }
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
      console.error(
        "Fehler beim Speichern der Einstellungen:",
        err
      );

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
            sx={{
              mb: 1,
              fontWeight: 600,
            }}
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
                    warnBeforeDelete:
                      e.target.checked,
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
            sx={{
              mb: 1,
              fontWeight: 600,
            }}
          >
            Workshop Einstellungen
          </Typography>

          <Box
            sx={{
              display: "flex",
              gap: 3,
            }}
          >
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
                    numDays:
                      e.target.value,
                  })
                }
                size="small"
              >
                {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((n) => (
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
                value={
                  settings.numPreferences
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    numPreferences:
                      e.target.value,
                  })
                }
                size="small"
              >
                {Array.from({ length: MAX_PREFERENCES }, (_, i) => i + 1).map(
                  (n) => (
                    <MenuItem
                      key={n}
                      value={n}
                    >
                      {n}
                    </MenuItem>
                  )
                )}
              </Select>
            </Box>

            <Box>
              <Typography
                variant="body2"
                sx={{ mb: 0.5 }}
              >
                Durchläufe
              </Typography>

              <TextField
                type="number"
                size="small"
                value={settings.allocationRuns}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allocationRuns: e.target.value,
                  })
                }
                slotProps={{
                  htmlInput: {
                    min: 1,
                    max: MAX_ALLOCATION_RUNS,
                  },
                }}
                sx={{ width: 100 }}
              />
            </Box>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            Durchläufe: Die Zuteilung wird so oft mit anderen
            Zufallswerten wiederholt (1 bis {MAX_ALLOCATION_RUNS}).
            Übernommen wird der Durchlauf mit den meisten
            1. Wahlen. Bei gleich vielen gewinnt der mit weniger
            Nicht-Zugeteilten.
          </Typography>
        </Box>

        <Divider />

        {/* Report generation settings */}
        <Box mt={3} mb={3}>
          <Typography
            variant="subtitle1"
            sx={{
              mb: 1,
              fontWeight: 600,
            }}
          >
            Berichtserstellung
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1 }}
          >
            Zusätzliche Workshop-Informationen
            im Zuteilungsbericht anzeigen.
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={
                    settings.reportShowParticipantCount
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reportShowParticipantCount:
                        e.target.checked,
                    })
                  }
                />
              }
              label="Teilnehmeranzahl / maximale Teilnehmer anzeigen"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={
                    settings.reportShowStaff
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reportShowStaff:
                        e.target.checked,
                    })
                  }
                />
              }
              label="Personal anzeigen"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={
                    settings.reportShowRoom
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reportShowRoom:
                        e.target.checked,
                    })
                  }
                />
              }
              label="Raum anzeigen"
            />
          </Box>
        </Box>

        <Divider />

        {/* Network settings */}
        <Box mt={3}>
          <Typography
            variant="subtitle1"
            sx={{
              mb: 1,
              fontWeight: 600,
            }}
          >
            Netzwerk
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={
                  settings.enableBonjour
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    enableBonjour:
                      e.target.checked,
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
                  port:
                    e.target.value,
                })
              }
              slotProps={{
                htmlInput: {
                  min: 1,
                  max: 65535,
                },
              }}
              disabled={saving}
              sx={{
                width: 160,
              }}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 1,
              }}
            >
              Der Server wird beim Ändern des
              Ports automatisch neu gestartet.
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
          sx={{
            fontWeight: "bold",
          }}
        >
          {saving
            ? "Speichern…"
            : "Speichern"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}