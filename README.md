<p align="center">
  <img src="./public/semera_workshops.png" alt="Semera Workshops Logo" width="80"/>
</p>

<h1 align="center">Semera Workshops</h1>
<p align="center">
  <!-- Latest release -->
  <a href="https://github.com/TieHaxJan/semera-workshops/releases">
    <img src="https://img.shields.io/github/v/release/TieHaxJan/semera-workshops?style=for-the-badge&color=blue" alt="Latest Release"/>
  </a>
  <!-- Build status -->
  <a href="https://github.com/TieHaxJan/semera-workshops/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/TieHaxJan/semera-workshops/build.yml?branch=main&style=for-the-badge" alt="Build Status"/>
  </a>
  <!-- Downloads -->
  <a href="https://github.com/TieHaxJan/semera-workshops/releases">
    <img src="https://img.shields.io/github/downloads/TieHaxjan/semera-workshops/total?style=for-the-badge&color=success" alt="Downloads"/>
  </a>
</p>


[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./package.json)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](./README.md)
[![Made with Electron](https://img.shields.io/badge/made%20with-Electron-2c3e50.svg?logo=electron)](https://electronjs.org)
[![Made with React](https://img.shields.io/badge/frontend-React-61dafb.svg?logo=react)](https://react.dev)
[![Made with SQLite](https://img.shields.io/badge/database-SQLite-003B57.svg?logo=sqlite)](https://sqlite.org)
[![Made with Express](https://img.shields.io/badge/backend-Express-000000.svg?logo=express)](https://expressjs.com)
[![Made with MUI](https://img.shields.io/badge/made%20with-MUI-007FFF.svg?logo=mui)](https://mui.com)
[![Styled with tailwindcss](https://img.shields.io/badge/styled%20with-Tailwind-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com)

**Semera Workshops** is a cross-platform desktop application (built with **Electron + React + Express + SQLite**) for collecting participant submissions and allocating workshops at seminars, camps, and events.
It is designed for **offline, LAN-based use** (no internet required). Participants can submit their preferences via a local web form, while organizers can manage, allocate, and export workshop assignments through the admin interface.

## ✨ Features

* **Participant Submission Form**

  * Accessible via LAN/IP or `.local` address (Bonjour/mDNS).
  * Number of preferences configurable.

* **Admin Dashboard**

  * Manage workshop definitions.
  * Import/export participants and submissions (JSON/CSV).
  * Run allocations (single-day or multi-day).
  * Export results as **HTML, CSV, or DOCX**.
  * View unmatched names.
  * QR code generator for quick participant access.

* **Offline-first**

  * No internet or DNS setup required.
  * Works via LAN IP and Bonjour `.local` discovery.

* **Cross-platform**

  * Windows Portable `.exe`

## 🚧 Roadmap / TODOs

* [ ] Submit form should dynamically respect the configured number of preferences.
* [ ] Allocation should be **stored once**; exports should only read, not reallocate.
* [ ] Warn admin when allocation leaves participants unassigned.
* [ ] Add all options to the application menu bar.
* [ ] Implement internationalization (i18n).
* [ ] (Add preference via Admin menu.)
* [ ] Add menu entry for opening the submission form in a browser.
* [ ] Show confirmation before deleting submissions. (Disable in settings)
* [ ] Delete all Buttons
* [ ] Secure `/admin` endpoint against LAN access (restrict to Electron app).
* [ ] Apply custom icons and consistent headers across all windows.
* [ ] Add Bonjour/mDNS service broadcast for `.local` access.
* [ ] Finalize build pipeline and product shipping process.
* [ ] Future Buddy-Feature

## 📦 Project Structure

```
semera-workshops/
├── src/
│   ├── assets/          # Static assets (icons, images)
│   ├── components/      # React components (Admin, QRDialog, etc.)
│   ├── lib/             # Shared utilities (DB init, allocation, exports)
│   ├── main/            # Electron main process (windows, menu, preload)
│   ├── models/          # Sequelize models (Submissions, Workshops, Participants)
│   ├── renderer/        # React frontend (AdminView, IndexView)
│   └── server/          # Express API (preferences, workshops, participants)
├── dist/                # Build output
├── assets/              # Build resources (icons, manual, etc.)
├── manual.md            # Project manual (compiled into PDF for Help menu)
├── package.json         # Dependencies and electron-builder config
└── README.md            # This file
```

## ⚙️ Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start development

Runs both the React frontend and Electron app:

```bash
npm run dev
```

* React: [http://localhost:5173](http://localhost:5173)
* Express API: [http://localhost:3001](http://localhost:3001)
* Electron will open the **Admin window** (http://localhost:5173/admin).

### 3. Database

* Uses **SQLite**.
* Database file is persisted alongside the app (portable mode).

## 🛠️ Build

### Windows

```bash
npm run build
```

* Produces a **portable `.exe`** under `dist/win-unpacked`.

## 📖 Manual

* Written in `manual.md`.
* Compiled into **manual.pdf** with `npm run build:manual`.
* Shipped with the app and accessible via **Help → Manual**.

## 🔒 Notes on Networking

* Participants connect via LAN IP (e.g. `http://192.168.178.67:3001`).
* Bonjour/mDNS broadcasts `http://semera.local:3001` for Apple devices.
* The **QR dialog** shows both IP and `.local` URLs so users can pick whichever works.

## 👤 Author

* **Jan Schulz-Nigmann / Semera**
* Email: [you@example.com](mailto:you@example.com)
* License: MIT