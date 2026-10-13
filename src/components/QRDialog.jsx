import { useState, useEffect, useRef } from "react";

import { QRCodeCanvas } from "qrcode.react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

export default function QRDialog({ open, onClose }) {
  const [url, setUrl] = useState({
    android: "",
    ios: "",
  });

  const [error, setError] = useState(null);

  // Network adapters of this PC (see src/lib/network.js) and the chosen one.
  const [network, setNetwork] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const qrRefs = {
    android: useRef(null),
    ios: useRef(null),
  };

  useEffect(() => {
    const getConnectionData = async () => {
      try {
        if (window.electron?.ipcRenderer) {
          // The address phones should use (organiser's choice or best guess)
          const info =
            await window.electron.ipcRenderer.invoke(
              "network:get"
            );

          setNetwork(info);

          const ip = info?.selected ?? null;

          // Get active server configuration
          const serverConfig =
            await window.electron.ipcRenderer.invoke(
              "server:get-config"
            );

          const port =
            Number.parseInt(
              serverConfig?.port,
              10
            ) || 80;

          // Get Bonjour status
          let bonjour = false;

          try {
            const res = await fetch(
              `http://127.0.0.1:${port}/api/status`
            );

            if (res.ok) {
              const data = await res.json();

              bonjour =
                !!data.bonjourRunning;
            }
          } catch (err) {
            console.warn(
              "Bonjour status endpoint not reachable:",
              err
            );
          }

          // Error collection
          const errors = [];

          if (
            !ip ||
            ip === "localhost" ||
            ip.startsWith("127.") ||
            ip === "0.0.0.0"
          ) {
            errors.push(
              "Keine nutzbare Netzwerkadresse gefunden. Ist der Rechner mit dem WLAN oder Hotspot verbunden?"
            );
          }

          if (!bonjour) {
            errors.push(
              "Bonjour-Dienst ist nicht gestartet."
            );
          }

          // Build port suffix
          const portSuffix =
            port === 80
              ? ""
              : `:${port}`;

          // Decide which URLs to show
          if (
            (!ip || ip.includes("localhost")) &&
            !bonjour
          ) {
            // Neither IP nor Bonjour works
            setUrl({
              android: "",
              ios: "",
            });
          } else if (
            !ip ||
            ip.includes("localhost")
          ) {
            // IP failed but Bonjour works → show only iOS
            setUrl({
              android: "",
              ios: `http://semera.local${portSuffix}`,
            });
          } else if (!bonjour) {
            // Bonjour failed → show same IP for all devices
            setUrl({
              android: `http://${ip}${portSuffix}`,
              ios: `http://${ip}${portSuffix}`,
            });
          } else {
            // All good
            setUrl({
              android: `http://${ip}${portSuffix}`,
              ios: `http://semera.local${portSuffix}`,
            });
          }

          if (errors.length > 0) {
            setError(
              errors.join(" ")
            );
          } else {
            setError(null);
          }
        } else {
          console.warn(
            "Electron API not available - running in browser dev mode"
          );

          setUrl({
            android: "",
            ios: "",
          });

          setError(
            "Electron-API nicht verfügbar (Browser-Modus)."
          );
        }
      } catch (err) {
        console.error(
          "Fehler beim Abrufen der IP oder Bonjour-Status:",
          err
        );

        setUrl({
          android: "",
          ios: "",
        });

        setError(
          "Fehler beim Abrufen der Netzwerkdaten."
        );
      }
    };

    if (open) {
      getConnectionData();
    }
  }, [open, refreshKey]);

  const chooseNetwork = async (address) => {
    await window.electron?.ipcRenderer?.invoke(
      "network:select",
      address
    );

    setRefreshKey((key) => key + 1);
  };

  const selectedCandidate =
    network?.candidates?.find(
      (candidate) =>
        candidate.address === network.selected
    ) ?? null;

  const kindLabel = {
    lan: "",
    other: " – kein privates Netz",
    vpn: " – VPN",
    virtual: " – virtuell",
    linklocal: " – keine Adresse vom Router",
  };

  const handleDownload = async () => {
    const androidCanvas =
      qrRefs.android.current?.querySelector(
        "canvas"
      );

    const iosCanvas =
      qrRefs.ios.current?.querySelector(
        "canvas"
      );

    const width = 600;
    const height = 350;

    const combined =
      document.createElement(
        "canvas"
      );

    combined.width = width;
    combined.height = height;

    const ctx =
      combined.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#fff";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    ctx.fillStyle = "#000";
    ctx.font = "20px Arial";

    let x = 50;

    if (
      androidCanvas &&
      url.android
    ) {
      ctx.fillText(
        "Android / Other",
        x,
        30
      );

      ctx.drawImage(
        androidCanvas,
        20,
        50,
        256,
        256
      );

      x += 300;
    }

    if (
      iosCanvas &&
      url.ios
    ) {
      ctx.fillText(
        "iOS",
        x + 30,
        30
      );

      ctx.drawImage(
        iosCanvas,
        x,
        50,
        256,
        256
      );
    }

    const pngUrl =
      combined.toDataURL(
        "image/png"
      );

    const link =
      document.createElement("a");

    link.href = pngUrl;
    link.download =
      "workshop-qr.png";

    link.click();
  };

  const handlePrint = () => {
    const androidCanvas =
      qrRefs.android.current?.querySelector(
        "canvas"
      );

    const iosCanvas =
      qrRefs.ios.current?.querySelector(
        "canvas"
      );

    const printWindow =
      window.open();

    if (printWindow) {
      printWindow.document.write(
        "<html><head><title>QR Codes</title></head><body>"
      );

      if (
        url.android &&
        androidCanvas
      ) {
        printWindow.document.write(
          "<h2>Android / Other</h2>"
        );

        printWindow.document.write(
          `<img src="${androidCanvas.toDataURL()}"/>`
        );
      }

      if (
        url.ios &&
        iosCanvas
      ) {
        printWindow.document.write(
          "<h2>iOS</h2>"
        );

        printWindow.document.write(
          `<img src="${iosCanvas.toDataURL()}"/>`
        );
      }

      printWindow.document.write(
        "</body></html>"
      );

      printWindow.document.close();

      printWindow.print();
      printWindow.close();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        QR Codes für Teilnehmer
      </DialogTitle>

      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {error && (
          <Box
            sx={{
              width: "100%",
              mb: 2,
            }}
          >
            <Alert severity="warning">
              {error}
            </Alert>
          </Box>
        )}

        {network?.candidates?.length > 0 && (
          <Box sx={{ width: "100%", padding: 1 }}>
            <FormControl
              size="small"
              fullWidth
            >
              <InputLabel id="network-label" shrink>
                Verfügbare Netzwerkadapter
              </InputLabel>

              <Select
                labelId="network-label"
                label="Netzwerk, in dem die Handys sind"
                displayEmpty
                notched
                value={network.saved ?? ""}
                onChange={(event) =>
                  chooseNetwork(event.target.value)
                }
              >
                <MenuItem value="">
                  Automatisch
                  {network.automatic
                    ? ` (${network.automatic})`
                    : ""}
                </MenuItem>

                {network.candidates.map(
                  (candidate) => (
                    <MenuItem
                      key={`${candidate.name}-${candidate.address}`}
                      value={candidate.address}
                    >
                      {candidate.name} –{" "}
                      {candidate.address}
                      {kindLabel[candidate.kind]}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>

            {selectedCandidate?.reason && (
              <Alert
                severity="warning"
                sx={{ mt: 1 }}
              >
                {selectedCandidate.reason}
              </Alert>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              Handy und Rechner müssen im selben WLAN sein.
              Die Handys brauchen kein Internet.
            </Typography>
          </Box>
        )}

        {url.android && (
          <Box
            ref={qrRefs.android}
            sx={{
              textAlign: "center",
            }}
          >
            <Typography variant="h6">
              Android / Andere
            </Typography>

            <QRCodeCanvas
              value={url.android}
              size={256}
            />

            <p
              style={{
                marginTop: "10px",
                wordBreak: "break-word",
              }}
            >
              {url.android}
            </p>
          </Box>
        )}

        {url.ios && (
          <Box
            ref={qrRefs.ios}
            sx={{
              textAlign: "center",
            }}
          >
            <Typography variant="h6">
              iOS
            </Typography>

            <QRCodeCanvas
              value={url.ios}
              size={256}
            />

            <p
              style={{
                marginTop: "10px",
                wordBreak: "break-word",
              }}
            >
              {url.ios}
            </p>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleDownload}
          disabled={!url.android && !url.ios}
        >
          Download
        </Button>

        <Button
          onClick={handlePrint}
          disabled={!url.android && !url.ios}
        >
          Drucken
        </Button>

        <Button onClick={onClose}>
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
}