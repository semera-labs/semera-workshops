import { saveAs } from 'file-saver';
import axios from 'axios';

const generateAllocationFile = async () => {
    try {
        const response = await axios.get('/api/workshops/allocate');
        console.log('API Response:', response);
        const allocations = response.data;

        if (!allocations || allocations.length === 0) {
            alert('No allocations available to generate the file.');
            return;
        }

        // Generate HTML content
        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Workshop Zuteilung</title>
            <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #ffffff; }
            </style>
        </head>
        <body>
        `;

        allocations.forEach((workshop) => {
            htmlContent += `
            <h2>${workshop.title} (Maximale Teilnehmer: ${workshop.maxParticipants}) (Minimale Teilnehmer: ${workshop.minParticipants})</h2>
            <table style="break-after:page;">
                <tr>
                    <th>Name</th>
                </tr>
            `;
            workshop.participants.forEach((participant) => {
                htmlContent += `<tr>
                    <td>${participant}</td>
                </tr>
                `;
            });
            htmlContent += `</table>`;
        });

        htmlContent += `</body>
        </html>
        `;

        // Create a Blob from the HTML content
        const blob = new Blob([htmlContent], { type: 'text/html' });
        saveAs(blob, 'workshop_allocations.html');
    } catch (error) {
        console.error('Error generating allocation file:', error);
        alert(`Error generating allocation file: ${error.message || 'Unknown error occurred.'}`);
    }
};

export default generateAllocationFile;