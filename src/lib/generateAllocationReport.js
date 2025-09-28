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
            </style>
        </head>
        <body>
        `;

        if (Array.isArray(allocations)) {
            // Single-day allocation
            allocations.forEach((workshop) => {
                htmlContent += `
                <h2>${workshop.title} (${workshop.staff})</h2>
                <table>
                    <tr><th>Name</th></tr>
                `;
                workshop.participants.forEach((participant) => {
                    htmlContent += `<tr><td>${participant}</td></tr>`;
                });
                htmlContent += `</table>`;
            });
        } else if (allocations.schedule) {
            // Multi-day allocation
            const { schedule } = allocations;

            for (const [projectTitle, workshop] of Object.entries(schedule)) {
                htmlContent += `
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
            alert('Keine Zuteilung vorhanden.');
            return;
        }

        const sections = [];

        if (Array.isArray(allocations)) {
            // Single-day allocation
            allocations.forEach((workshop) => {
                const rows = [
                    ...workshop.participants.map(
                        (p) =>
                            new TableRow({
                                children: [new TableCell({ children: [new Paragraph({ text: p, style: "ArialNormal", })] })],
                            })
                    ),
                ];

                sections.push({
                    properties: {},
                    children: [
                        new Paragraph({
                            text: workshop.title,
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER,
                            style: "ArialHeading"
                        }),
                        new Table({ rows }),
                        new Paragraph(""), // spacing
                    ],
                });
            });
        } else if (allocations.schedule) {
            // Multi-day allocation
            const { schedule } = allocations;

            for (const [projectTitle, workshop] of Object.entries(schedule)) {
                const days = Object.keys(workshop.days);
                const headerRow = new TableRow({
                    children: days.map(
                        (day) => new TableCell({ children: [new Paragraph({ text: `Tag ${day}`, style: "ArialNormal", })] })
                    ),
                });

                const maxRows = Math.max(
                    ...days.map((day) => workshop.days[day]?.length || 0)
                );

                const rows = [headerRow];
                for (let i = 0; i < maxRows; i++) {
                    rows.push(
                        new TableRow({
                            children: days.map((day) => {
                                const name = workshop.days[day]?.[i] || "";
                                return new TableCell({ children: [new Paragraph({ text: name, style: "ArialNormal", })] });
                            }),
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
                            style: "ArialHeading"
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
                            size: 24, // halbe Points, 24 = 12pt
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
            sections
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, "workshop_allocations.docx");
    } catch (error) {
        console.error("Error generating DOCX allocation file:", error);
        alert(`Fehler beim Generieren der Zuteilungs-Datei: ${error.message || 'Unbekannter Fehler aufgetreten.'}`);
    }
};