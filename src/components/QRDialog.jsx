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
} from "@mui/material";

export default function QRDialog({ open, onClose }) {
  const [url, setUrl] = useState({ android: "", ios: "" });
  const [error, setError] = useState(null);

  const qrRefs = {
    android: useRef(),
    ios: useRef(),
  };

  useEffect(() => {
    const getConnectionData = async () => {
      try {
        if (window.electron?.ipcRenderer) {
          // Get IP
          const ip = await window.electron.ipcRenderer.invoke("get-local-ip");
          // Get Bonjour status
          let bonjour = false;
          try {
            const res = await fetch("http://localhost:3001/api/status");
            if (res.ok) {
              const data = await res.json();
              bonjour = !!data.bonjourRunning;
            }
          } catch (err) {
            console.warn("Bonjour status endpoint not reachable:", err);
          }

          // Error collection
          const errors = [];

          if (!ip || ip === "localhost" || ip.startsWith("127.") || ip === "0.0.0.0") {
            errors.push("Lokale IP-Adresse konnte nicht ermittelt werden.");
          }

          if (!bonjour) {
            errors.push("Bonjour-Dienst ist nicht gestartet.");
          }

          // Decide which URLs to show
          if ((!ip || ip.includes("localhost")) && !bonjour) {
            // Neither IP nor Bonjour works
            setUrl({ android: "http://localhost:3001", ios: "http://localhost:3001" });
          } else if (!ip || ip.includes("localhost")) {
            // IP failed but Bonjour works → show only iOS
            setUrl({ android: "", ios: "http://semera.local:3001" });
          } else if (!bonjour) {
            // Bonjour failed → show same IP for all devices
            setUrl({ android: `http://${ip}:3001`, ios: `http://${ip}:3001` });
          } else {
            // All good
            setUrl({
              android: `http://${ip}:3001`,
              ios: `http://semera.local:3001`,
            });
          }

          if (errors.length > 0) {
            setError(errors.join(" "));
          } else {
            setError(null);
          }
        } else {
          console.warn("Electron API not available - running in browser dev mode");
          setUrl({
            android: "http://localhost:3001",
            ios: "http://localhost:3001",
          });
          setError("Electron-API nicht verfügbar (Browser-Modus).");
        }
      } catch (err) {
        console.error("Fehler beim Abrufen der IP oder Bonjour-Status:", err);
        setError("Fehler beim Abrufen der Netzwerkdaten.");
      }
    };

    getConnectionData();
  }, []);

  const handleDownload = async () => {
    const androidCanvas = qrRefs.android.current?.querySelector("canvas");
    const iosCanvas = qrRefs.ios.current?.querySelector("canvas");

    const width = 600;
    const height = 350;
    const combined = document.createElement("canvas");
    combined.width = width;
    combined.height = height;
    const ctx = combined.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#000";
    ctx.font = "20px Arial";

    let x = 50;

    if (androidCanvas && url.android) {
      ctx.fillText("Android / Other", x, 30);
      ctx.drawImage(androidCanvas, 20, 50, 256, 256);
      x += 300;
    }
    if (iosCanvas && url.ios) {
      ctx.fillText("iOS", x + 30, 30);
      ctx.drawImage(iosCanvas, x, 50, 256, 256);
    }

    const pngUrl = combined.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "workshop-qr.png";
    link.click();
  };

  const handlePrint = () => {
    const androidCanvas = qrRefs.android.current?.querySelector("canvas");
    const iosCanvas = qrRefs.ios.current?.querySelector("canvas");

    const win = window.open();
    if (win) {
      win.document.write("<html><head><title>QR Codes</title></head><body>");
      if (url.android && androidCanvas) {
        win.document.write("<h2>Android / Other</h2>");
        win.document.write(`<img src="${androidCanvas.toDataURL()}"/>`);
      }
      if (url.ios && iosCanvas) {
        win.document.write("<h2>iOS</h2>");
        win.document.write(`<img src="${iosCanvas.toDataURL()}"/>`);
      }
      win.document.write("</body></html>");
      win.print();
      win.close();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>QR Codes für Teilnehmer</DialogTitle>
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
          <Box sx={{ width: "100%", mb: 2 }}>
            <Alert severity="warning">{error}</Alert>
          </Box>
        )}

        {url.android && (
          <Box ref={qrRefs.android} sx={{ textAlign: "center" }}>
            <Typography variant="h6">Android / Andere</Typography>
            <QRCodeCanvas value={url.android} size={256} />
            <p style={{ marginTop: "10px", wordBreak: "break-word" }}>{url.android}</p>
          </Box>
        )}

        {url.ios && (
          <Box ref={qrRefs.ios} sx={{ textAlign: "center" }}>
            <Typography variant="h6">iOS</Typography>
            <QRCodeCanvas value={url.ios} size={256} />
            <p style={{ marginTop: "10px", wordBreak: "break-word" }}>{url.ios}</p>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleDownload} disabled={!url.android && !url.ios}>
          Download
        </Button>
        <Button onClick={handlePrint} disabled={!url.android && !url.ios}>
          Drucken
        </Button>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}
