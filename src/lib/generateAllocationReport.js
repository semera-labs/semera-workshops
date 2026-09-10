import { saveAs } from 'file-saver';
import axios from 'axios';
import {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    AlignmentType,
} from "docx";
import API_BASE from "./api.js";

export const generateAllocation = async (numOfDays = 1, maxPreferences = 5) => {
    try {
        const response = await axios.post(
            `http://${API_BASE}/api/workshops/allocate`,
            { numDays: numOfDays, maxPreferences: maxPreferences }
        );
        console.log('API Response:', response);
        const allocations = response.data;

        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert('Keine Zuteilungen vorhanden.');
            return;
        }

        if (allocations.warnings && allocations.warnings.length > 0) {
            alert("Zuteilung Warnungen:\n\n" + allocations.warnings.join("\n"));
        }

        return allocations;
    } catch (error) {
        console.error('Error generating allocation file:', error);
        alert(`Fehler beim Generieren der Zuteilung: ${error.message || 'Unbekannter Fehler aufgetreten.'}`);
    }
}

export const generateAllocationFile = async (allocations) => {
    try {
        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert('Keine Zuteilung vorhanden.');
            return;
        }

        // --- Fetch workshops to get correct maxParticipants ---
        const response = await fetch(`http://${API_BASE}/api/workshops`);
        const workshopsData = await response.json();

        const workshopMaxMap = {};
        workshopsData.forEach(ws => {
            workshopMaxMap[ws.title] = ws.maxParticipants;
        });

        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Workshop Zuteilung</title>
            <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { color: #333; }
            .project-container { margin-bottom: 60px; }
            .day-tables { display: flex; gap: 20px; }
            table { border-collapse: collapse; width: 100%; min-width: 200px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f9f9f9; }
            .day-label { font-weight: bold; margin-bottom: 5px; }

            /* pagebreak helper */
            @media print {
                .pagebreak {
                    page-break-before: always;
                }
            }
            </style>
        </head>
        <body>
        `;

        if (Array.isArray(allocations)) {
            // --- Single-day allocation ---
            allocations.forEach((workshop, index) => {
                if (workshop.participants.length > 0) {
                const maxParticipants = workshopMaxMap[workshop.title] ?? '-';

                htmlContent += `
                ${index !== 0 ? '<div class="pagebreak"></div>' : ''}
                <h2>
                    ${workshop.title} (${workshop.staff}) 
                    ${workshop.participants.length}/${maxParticipants}
                </h2>
                <table>
                    <tr><th>Name</th></tr>
                `;

                workshop.participants.forEach((participant) => {
                    htmlContent += `<tr><td>${participant}</td></tr>`;
                });

                htmlContent += `</table>`;
                }
            });

        } else if (allocations.schedule) {
            // --- Multi-day allocation ---
            const { schedule } = allocations;

            let first = true;

            for (const [projectTitle, workshop] of Object.entries(schedule)) {
                htmlContent += `
                ${!first ? '<div class="pagebreak"></div>' : ''}
                <div class="project-container">
                    <h2>${projectTitle} (${workshop.staff})</h2>
                    <div class="day-tables">
                `;

                const days = Object.keys(workshop.days);

                for (const day of days) {
                    const participants = workshop.days[day] || [];

                    htmlContent += `
                        <div>
                            <div class="day-label">Tag ${day}</div>
                            <table>
                                <tr><th>Name</th></tr>
                    `;

                    participants.forEach((participant) => {
                        htmlContent += `<tr><td>${participant}</td></tr>`;
                    });

                    htmlContent += `</table></div>`;
                }

                htmlContent += `</div></div>`;
                first = false;
            }
        }

        htmlContent += `</body></html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        saveAs(blob, 'workshop_allocations.html');

    } catch (error) {
        console.error('Error generating allocation file:', error);
        alert(`Fehler beim Generieren der Zuteilungs-Datei: ${error.message || 'Unbekannter Fehler aufgetreten.'}`);
    }
};

export const generateAllocationCSV = async (allocations) => {
    try {
        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert('Keine Zuteilung vorhanden.');
            return;
        }


        let csvContent = '';

        if (Array.isArray(allocations)) {
            // Single-day allocation
            allocations.forEach((workshop) => {
                csvContent += `"${workshop.title} (${workshop.staff})"\n`;
                csvContent += 'Name\n';
                workshop.participants.forEach((participant) => {
                    csvContent += `${participant}\n`;
                });
                csvContent += `\n`;
            });
        } else if (allocations.schedule) {
            // Multi-day allocation
            const { schedule } = allocations;

            for (const [projectTitle, workshop] of Object.entries(schedule)) {
                const days = Object.keys(workshop.days);
                csvContent += `"${projectTitle} (${workshop.staff})"\n`;
                csvContent += "Tag " + days.join(';') + '\n';

                const maxRows = Math.max(
                    ...days.map((day) => (workshop.days[day]?.length || 0))
                );

                for (let i = 0; i < maxRows; i++) {
                    const row = days.map(day => workshop.days[day]?.[i] || '');
                    csvContent += row.join(';') + '\n';
                }

                csvContent += '\n';
            }
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'workshop_allocations.csv');
    } catch (error) {
        console.error('Error generating CSV allocation file:', error);
        alert(`Fehler beim Generieren der Zuteilungs-Datei: ${error.message || 'Unbekannter Fehler aufgetreten.'}`);
    }
};

export const generateAllocationDocx = async (allocations) => {
    try {
        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert("Keine Zuteilung vorhanden.");
            return;
        }

        const sections = [];

        // Helper to safely build a table even if empty
        const createParticipantTable = (participants = []) => {
            const safeParticipants = participants.length > 0 ? participants : ["(keine Teilnehmer)"];
            const rows = safeParticipants.map(
                (p) =>
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ text: p, style: "ArialNormal" })],
                            }),
                        ],
                    })
            );
            return new Table({ rows });
        };

        if (Array.isArray(allocations)) {
            // Single-day allocation
            allocations.forEach((workshop) => {
                const { title, participants = [] } = workshop;

                sections.push({
                    properties: {},
                    children: [
                        new Paragraph({
                            text: title || "(Unbenannter Workshop)",
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER,
                            style: "ArialHeading",
                        }),
                        createParticipantTable(participants),
                        new Paragraph(""), // spacing
                    ],
                });
            });
        } else if (allocations.schedule) {
            // Multi-day allocation
            const { schedule } = allocations;

            for (const [projectTitle, workshop] of Object.entries(schedule)) {
                const days = Object.keys(workshop.days || {});
                if (days.length === 0) continue;

                const headerRow = new TableRow({
                    children: days.map(
                        (day) =>
                            new TableCell({
                                children: [new Paragraph({ text: `Tag ${day}`, style: "ArialNormal" })],
                            })
                    ),
                });

                const maxRows = Math.max(
                    ...days.map((day) => (workshop.days[day]?.length || 0))
                );

                const rows = [headerRow];
                const hasAnyParticipant = days.some((day) => (workshop.days[day]?.length || 0) > 0);

                if (hasAnyParticipant) {
                    for (let i = 0; i < maxRows; i++) {
                        rows.push(
                            new TableRow({
                                children: days.map((day) => {
                                    const name = workshop.days[day]?.[i] || "";
                                    return new TableCell({
                                        children: [new Paragraph({ text: name, style: "ArialNormal" })],
                                    });
                                }),
                            })
                        );
                    }
                } else {
                    // Empty placeholder row
                    rows.push(
                        new TableRow({
                            children: days.map(() =>
                                new TableCell({
                                    children: [new Paragraph({ text: "(keine Teilnehmer)", style: "ArialNormal" })],
                                })
                            ),
                        })
                    );
                }

                sections.push({
                    properties: {},
                    children: [
                        new Paragraph({
                            text: projectTitle,
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER,
                            style: "ArialHeading",
                        }),
                        new Table({ rows }),
                        new Paragraph(""), // spacing
                    ],
                });
            }
        }

        const doc = new Document({
            styles: {
                paragraphStyles: [
                    {
                        id: "ArialNormal",
                        name: "Arial Normal",
                        basedOn: "Normal",
                        run: {
                            font: "Arial",
                            size: 24, // 12pt
                        },
                    },
                    {
                        id: "ArialHeading",
                        name: "Arial Heading",
                        basedOn: "Heading1",
                        run: {
                            font: "Arial",
                            bold: true,
                            size: 32, // 16pt
                        },
                    },
                ],
            },
            sections,
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, "workshop_allocations.docx");
    } catch (error) {
        console.error("Error generating DOCX allocation file:", error);
        alert(
            `Fehler beim Generieren der Zuteilungs-Datei: ${error.message || "Unbekannter Fehler aufgetreten."
            }`
        );
    }
};
