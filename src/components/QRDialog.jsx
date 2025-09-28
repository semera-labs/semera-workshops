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
} from "@mui/material";

export default function QRDialog({ open, onClose }) {
  const [url, setUrl] = useState("http://localhost:3001");
  const qrRefs = {
    android: useRef(),
    ios: useRef(),
  };

  useEffect(() => {
    const getIP = async () => {
      try {
        if (window.electron?.ipcRenderer) {
          const ip = await window.electron.ipcRenderer.invoke("get-local-ip");
          // Android/other → IP, iOS → .local (mDNS)
          setUrl({
            android: `http://${ip}:3001`,
            ios: `http://semera.local:3001`,
          });
        } else {
          console.warn("Electron API not available - running in browser dev mode");
          setUrl({
            android: "http://localhost:3001",
            ios: "http://localhost:3001",
          });
        }
      } catch (err) {
        console.error("Fehler beim Abrufen der IP:", err);
      }
    };

    getIP();
  }, []);

  const handleDownload = async () => {
    // Collect canvases from refs
    const androidCanvas = qrRefs.android.current.querySelector("canvas");
    const iosCanvas = qrRefs.ios.current.querySelector("canvas");

    // Create a combined canvas
    const width = 600;
    const height = 350;
    const combined = document.createElement("canvas");
    combined.width = width;
    combined.height = height;
    const ctx = combined.getContext("2d");

    // White background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // Draw labels
    ctx.fillStyle = "#000";
    ctx.font = "20px Arial";
    ctx.fillText("Android / Other", 50, 30);
    ctx.fillText("iOS", 350, 30);

    // Draw QR codes
    ctx.drawImage(androidCanvas, 20, 50, 256, 256);
    ctx.drawImage(iosCanvas, 320, 50, 256, 256);

    // Save combined PNG
    const pngUrl = combined.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "workshop-qr.png";
    link.click();
  };

  const handlePrint = () => {
    const androidCanvas = qrRefs.android.current.querySelector("canvas");
    const iosCanvas = qrRefs.ios.current.querySelector("canvas");

    const win = window.open();
    win.document.write(`
      <h2>Android / Other</h2>
      <img src="${androidCanvas.toDataURL()}"/>
      <h2>iOS</h2>
      <img src="${iosCanvas.toDataURL()}"/>
    `);
    win.print();
    win.close();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>QR Codes für Teilnehmer</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "row", justifyContent: "space-around" }}
      >
        <Box ref={qrRefs.android} sx={{ textAlign: "center" }}>
          <Typography variant="h6">Android / Andere</Typography>
          <QRCodeCanvas value={url.android || ""} size={256} />
          <p style={{ marginTop: "10px", wordBreak: "break-word" }}>
            {url.android}
          </p>
        </Box>
        <Box ref={qrRefs.ios} sx={{ textAlign: "center" }}>
          <Typography variant="h6">iOS</Typography>
          <QRCodeCanvas value={url.ios || ""} size={256} />
          <p style={{ marginTop: "10px", wordBreak: "break-word" }}>{url.ios}</p>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDownload}>Download</Button>
        <Button onClick={handlePrint}>Drucken</Button>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}
