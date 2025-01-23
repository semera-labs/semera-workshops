"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function QRPage() {
    const router = useRouter();
    const [url, setUrl] = useState("http://gkunderground.workshop"); // Default URL

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const customUrl = params.get("url");
            if (customUrl) {
                setUrl(customUrl);
            }
        }
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            textAlign: "center"
        }}>
            <h1 style={{ fontSize: "40px" }}>QR Code scannen</h1>
            <div style={{ padding: "50px", background: "#fff", borderRadius: "10px" }}>
                <QRCodeCanvas value={url} size={512} />
            </div>
            <p style={{ marginTop: "10px", fontSize: "18px", fontWeight: "bold", wordBreak: "break-word" }}>
                {url}
            </p>
        </div>
    );
}
