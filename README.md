<p align="center">
  <img src="./public/semera_workshops.png" alt="Semera Workshops Logo" width="80"/>
</p>

<h1 align="center">Semera Workshops</h1>


[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](./package.json)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](./README.md)
[![Made with Electron](https://img.shields.io/badge/made%20with-Electron-2c3e50.svg?logo=electron)](https://electronjs.org)
[![Made with React](https://img.shields.io/badge/frontend-React-61dafb.svg?logo=react)](https://react.dev)
[![Made with SQLite](https://img.shields.io/badge/database-SQLite-003B57.svg?logo=sqlite)](https://sqlite.org)
[![Made with Express](https://img.shields.io/badge/backend-Express-000000.svg?logo=express)](https://expressjs.com)
[![Made with MUI](https://img.shields.io/badge/made%20with-MUI-007FFF.svg?logo=mui)](https://mui.com)
[![Styled with tailwindcss](https://img.shields.io/badge/styled%20with-Tailwind-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com)

**Semera Workshops** is a cross-platform desktop application (built with **Electron + React + Express + SQLite**) for collecting participant submissions and allocating workshops at seminars, camps, and events.
It is designed for **offline, LAN-based use** (no internet required). Participants can submit their preferences via a local web form on their phones, while organizers can manage, allocate, and export workshop assignments through the admin interface.

## ✨ Features

* **Participant Submission Form**

  * Accessible via LAN IP or the `semera.local` name (Bonjour/mDNS), usually through a QR code.
  * 1 to **7 preferences**, configurable in the settings.
  * Light page (~90 KB over the wire) that copes with weak Wi-Fi: request time-outs, automatic retries, the filled-in form survives a lost connection, double taps send only once, and sending the same submission twice counts as success.

* **Admin Dashboard**

  * Manage workshops, participants and submissions (inline editing, right-click assignment).
  * **Import** participants, workshops and submissions from **Excel (.xlsx), CSV or JSON** with an interactive column-mapping dialog and an Excel template.
  * **Export** each data set as Excel or JSON, or everything in one Excel file.
  * Run allocations for **1 to 7 days**, optionally as the best of up to 200 runs (see [Allocation](#-allocation)).
  * Assign people **by hand** for single days or workshops via right-click, also without an existing allocation.
  * **Evaluation panel**: first/second/… choice distribution, unassigned people, free seats, workshops below their minimum.
  * Export results as **HTML, CSV, Excel or DOCX**.
  * View unmatched names (people on the participant list without a submission).
  * QR code generator with a **network picker** (ignores VirtualBox/WSL/VPN adapters by default).

* **Offline-first**

  * No internet or DNS setup required.
  * Works via LAN IP and Bonjour `.local` discovery.
  * See [Notes on Networking](#-notes-on-networking) for router settings.

* **Safe by default**

  * Everything except submitting a form and reading the workshop list is only allowed from the machine the app runs on.
  * Imports are all-or-nothing (database transaction): a failing import leaves existing data untouched.

* **Cross-platform**

  * Windows Portable `.exe`, macOS app.

## 🧮 Allocation

The allocator lives in `src/lib/allocation/` and is a deliberate **greedy** algorithm (optimised for as many first choices as possible).

1. Input is validated and cleaned first (`prepare.js`): titles and names are compared case- and whitespace-insensitively, duplicate names keep the first submission, unknown wishes are reported, invalid workshops (missing maximum, duplicate title, more days than workshops) stop the run with a clear message.
2. People are processed in random order; everybody gets the first wish that still has a free seat.
3. Workshops below their minimum are cancelled and their participants are re-placed on their remaining wishes.
4. Whoever has no free wish stays **unassigned**. Nobody is placed in a random workshop (an opt-in `fallback` exists on the server API but is off by default). Unassigned people are listed in the evaluation panel and can be assigned by hand.
5. Multi-day (2–7 days): every person gets a *different* workshop per day. If there are fewer wishes than days, the remaining days stay open.

**Runs and seed:** `attempts` (1–200, setting *Durchläufe*) repeats the greedy run with different seeds and keeps the run with the most first choices (ties: fewest unassigned). Results are reproducible with the returned `seed`.

`POST /api/workshops/allocate` (local only):

| Field | Meaning |
|---|---|
| `numDays` | 1–7 |
| `maxPreferences` | 1–7 |
| `attempts` | 1–200, best run wins (default 1) |
| `seed` | reproduce a run (optional) |
| `fallback` | fill people without a possible wish with a free workshop (default `false`) |
| `forceRandom` | ignore wishes, distribute evenly |
| `predefinedAllocations` | `[{ name, workshopTitle }]` placed before everybody else |

The result contains `mode`, `workshops` / `schedule`, `participantAllocations`, `warnings` (strings), `issues` (structured: `code`, `severity`, `message`), `unassigned`, `stats`, `seed` and `attempts`.

Manual changes (`src/lib/allocation/manual.js`) and the statistics (`stats.js`) are pure functions shared by the server and the admin UI.

The limits (7 wishes, 7 days, 200 runs) are defined once in `src/lib/preferenceKeys.js`.

## 📥 Import / Export formats

The import dialog reads `.xlsx`, `.csv` (`;`, `,` or tab) and `.json` (max. 10 MB / 5000 rows; old `.xls` must be saved as `.xlsx`). Column headers are detected automatically (e.g. *Plätze* → maximum participants, *Erstwahl* → first wish); every column can be reassigned in the dialog. The Excel template contains the expected headers.

| Kind | Columns (`*` = required) |
|---|---|
| Participants | Vorname\*, Nachname\*, Kurs |
| Workshops | Titel\*, Min. Teilnehmer, Max. Teilnehmer\*, Betreuung, Ort |
| Preferences | Name\* (first and last name in one column), 1. Wahl\* … 7. Wahl |

Exports use the same headers, so every export can be imported again (also useful as a backup before an update).

## 🚧 Roadmap / TODOs

- [x] Submit form dynamically respects the configured number of preferences (now up to 7).
- [ ] Implement internationalization (i18n).
- [x] (Add preference via Admin menu.) → Can be done by opening the submit form and adding an entry.
- [ ] Apply custom icons and consistent headers across all windows.
- [ ] Notify User on network Change and restart Program (Bonjour now re-announces itself within ~15 s after an address change; the QR dialog has to be reopened for a new Android code)
- [x] Create new Missing People Window Dialog.
- [ ] Finalize build pipeline and product shipping process.
- [ ] Theming
- [ ] Fix Single/Multi-Day File generation (returned warnings messes with the data parsing)
- [ ] Auto Refresh on new Submission
- [ ] Extend Manual to explain things more in depth (`manual.tex` is up to date, `manual.docx` / `manual.pdf` still have to be regenerated; screenshots of menus, QR dialog and settings need to be retaken)
- [x] Display Staff Member and How many slots are full and location in the allocation report/ toggle this via the settings
- [x] Display how many first, second, third choices were selected (evaluation panel)
- [ ] Allow for multiple allocation algorithms via settings (the number of runs is configurable; the algorithm itself is greedy by design)
- [ ] Grade on how good the allocation is (statistics exist, there is no single score)
- [ ] Make allocation more robust (validation, seeded runs and per-day manual assignment are done)
- [ ] Display all errors to user
- [ ] Remote Update/ Patch
- [ ] Future Buddy-Feature
- [ ] Verify older phones: the build targets Safari 16 / Chrome 107 (Vite default), older iOS versions may not show the form
- [ ] Add the `LICENSE` file the badge links to

## 📦 Project Structure

```
semera-workshops/
├── src/
│   ├── assets/          # Static assets (icons, images)
│   ├── components/      # React components (dialogs: import, export, QR, settings, evaluation, …)
│   ├── lib/
│   │   ├── allocation/        # Greedy allocator, validation, statistics, manual assignment
│   │   ├── allocationReport/  # HTML / CSV / DOCX / Excel allocation reports
│   │   ├── excel/             # Table reader (xlsx/csv/json), column detection, Excel writer
│   │   ├── network.js         # Which network adapter can phones reach?
│   │   └── preferenceKeys.js  # Limits and labels (wishes, days, runs)
│   ├── main/            # Electron main process (windows, menu, preload, settings)
│   ├── models/          # Sequelize models (Submissions, Workshops, Participants)
│   ├── renderer/        # React frontend (AdminView, IndexView = phone form)
│   └── server/          # Express API (preferences, workshops, participants), Bonjour, transport
├── dist/                # Build output
├── public/              # Icon
├── manual.docx / .pdf   # Project manual (Word / shipped PDF)
├── manual.tex           # Same manual as LaTeX source, images in manual_images/
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
* Express API: `http://localhost:<port>` – the port comes from `config.json` (default **80**, change it in the app settings).
* Electron will open the **Admin window** (http://localhost:5173/admin).

Lint with `npm run lint`.

### 3. Database and settings

* Uses **SQLite**. In development the file is `./workshop.sqlite` (git-ignored); in a release build it lies next to the executable (portable mode).
* `settings.json` (application settings) and `config.json` (server port/host) live in Electron's *userData* folder, e.g. `%APPDATA%\Semera Workshops` on Windows.

## 🛠️ Build

### Windows

```bash
npm run build
```

* Produces a **portable `.exe`** under `dist/win-unpacked`.
* The renderer is split: the phone form (~270 KB, ~90 KB gzipped) is the main chunk, the admin UI (several MB) is loaded only on `/admin`.

## 📖 Manual

* Written in `manual.docx` (and mirrored in `manual.tex`, compile with `pdflatex manual.tex` twice).
* Compiled into **manual.pdf**.
* Shipped with the app and accessible via **Hilfe → Handbuch (PDF)**.

## 🔒 Notes on Networking

* Participants connect via LAN IP (e.g. `http://192.168.178.67`; the port is appended when it is not 80).
* Bonjour/mDNS announces `http://semera.local` for Apple devices. Only the address of the chosen network is announced (no IPv6, no virtual adapters) and it is re-announced when the address changes.
* The **QR dialog** shows both the IP and the `.local` URL and lets you pick the network adapter the phones are in. Adapters are classified in `src/lib/network.js` (name, MAC vendor, subnet); the Windows hotspot network (`192.168.137.x`) is allowed.
* Router checklist (details in the manual): same network (no guest network), client/AP isolation **off**, DHCP on, no internet needed, mDNS not blocked. For printed QR codes give the computer a fixed address (DHCP reservation recommended).
* Phones need no internet; mobile data should be switched off on them.

### Who may call what

| Access | Routes |
|---|---|
| **Anybody on the network** | `GET /api/workshops`, `GET /api/workshops/:id`, `GET /api/public-settings`, `POST /api/preferences`, `GET /api/status`, `GET /api/config`, the phone form (`/`) |
| **Only from the machine itself** (loopback) | the admin page `/admin`; list/edit/delete/import for preferences; create/edit/delete/import/allocate for workshops; everything under `/api/participants`; `/api/bonjour/*`; `/api/config/check-port` |

Static files are served gzip-compressed; files in `/assets` are cached for a year (they are hashed), `index.html` and all `/api` answers are never cached.

## 👤 Author

* **Jan Schulz-Nigmann / Semera**
* Email: [you@example.com](mailto:you@example.com)
* License: MIT
