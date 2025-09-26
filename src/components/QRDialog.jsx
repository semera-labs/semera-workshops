import { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from "@mui/material";

export default function QRDialog({ open, onClose }) {
  const [url, setUrl] = useState("");
  const qrRef = useRef();

  useEffect(() => {
  const getIP = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        const ip = await window.electron.ipcRenderer.invoke("get-local-ip");
        setUrl(`http://${ip}:3001`);
      } else {
        console.warn("Electron API not available – running in browser dev mode");
        setUrl("http://localhost:3001"); // fallback für dev
      }
    } catch (err) {
      console.error("Fehler beim Abrufen der IP:", err);
    }
  };

  getIP();
}, []);

  const handleDownload = () => {
    const canvas = qrRef.current.querySelector("canvas");
    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "workshop-qr.png";
    link.click();
  };

  const handlePrint = () => {
    const canvas = qrRef.current.querySelector("canvas");
    const win = window.open();
    win.document.write(`<img src="${canvas.toDataURL()}"/>`);
    win.print();
    win.close();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>QR Code für Teilnehmer</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <div ref={qrRef} style={{ padding: 20, background: "#fff", borderRadius: 10 }}>
          <QRCodeCanvas value={url} size={256} />
        </div>
        <p style={{ marginTop: "10px", wordBreak: "break-word" }}>{url}</p>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDownload}>Download</Button>
        <Button onClick={handlePrint}>Print</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
