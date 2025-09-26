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
import API_BASE from "./api";

export const generateAllocationFile = async (numOfDays) => {
    try {
        const response = await axios.post(
            `http://${API_BASE}/api/workshops/allocate`,
            { numDays: numOfDays }
        );
        console.log('API Response:', response);
        const allocations = response.data;

        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert('No allocations available to generate the file.');
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
                <h2>${workshop.title}</h2>
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

            for (const [projectTitle, dayAllocations] of Object.entries(schedule)) {
                htmlContent += `
                <div class="project-container">
                    <h2>${projectTitle}</h2>
                    <div class="day-tables">
                `;

                const days = Object.keys(dayAllocations);

                for (const day of days) {
                    const participants = dayAllocations[day] || [];

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
        alert(`Error generating allocation file: ${error.message || 'Unknown error occurred.'}`);
    }
};

export const generateAllocationCSV = async (numOfDays) => {
    try {
        const response = await axios.post(
            `http://${API_BASE}/api/workshops/allocate`,
            { numDays: numOfDays }
        );
        console.log('API Response:', response);
        const allocations = response.data;

        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert('No allocations available to generate the file.');
            return;
        }

        let csvContent = '';

        if (Array.isArray(allocations)) {
            // Single-day allocation
            allocations.forEach((workshop) => {
                csvContent += `"${workshop.title}"\n`;
                csvContent += 'Name\n';
                workshop.participants.forEach((participant) => {
                    csvContent += `${participant}\n`;
                });
                csvContent += `\n`;
            });
        } else if (allocations.schedule) {
            // Multi-day allocation
            const { schedule } = allocations;

            for (const [projectTitle, dayAllocations] of Object.entries(schedule)) {
                const days = Object.keys(dayAllocations);
                csvContent += `"${projectTitle}"\n`;
                csvContent += "Tag " + days.join(';') + '\n';

                const maxRows = Math.max(
                    ...days.map((day) => (dayAllocations[day]?.length || 0))
                );

                for (let i = 0; i < maxRows; i++) {
                    const row = days.map(day => dayAllocations[day]?.[i] || '');
                    csvContent += row.join(';') + '\n';
                }

                csvContent += '\n';
            }
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'workshop_allocations.csv');
    } catch (error) {
        console.error('Error generating CSV allocation file:', error);
        alert(`Error generating CSV allocation file: ${error.message || 'Unknown error occurred.'}`);
    }
};

export const generateAllocationDocx = async (numOfDays) => {
    try {
        const response = await axios.post(
            `http://${API_BASE}/api/workshops/allocate`,
            { numDays: numOfDays }
        );
        const allocations = response.data;

        if (!allocations || (Array.isArray(allocations) && allocations.length === 0)) {
            alert("No allocations available to generate the file.");
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

            for (const [projectTitle, dayAllocations] of Object.entries(schedule)) {
                const days = Object.keys(dayAllocations);
                const headerRow = new TableRow({
                    children: days.map(
                        (day) => new TableCell({ children: [new Paragraph({ text: `Tag ${day}`, style: "ArialNormal", })] })
                    ),
                });

                const maxRows = Math.max(
                    ...days.map((day) => dayAllocations[day]?.length || 0)
                );

                const rows = [headerRow];
                for (let i = 0; i < maxRows; i++) {
                    rows.push(
                        new TableRow({
                            children: days.map((day) => {
                                const name = dayAllocations[day]?.[i] || "";
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
        alert(
            `Error generating DOCX allocation file: ${error.message || "Unknown error occurred."
            }`
        );
    }
};