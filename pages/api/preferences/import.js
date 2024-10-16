import { saveImportedData } from '../../../lib/data';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const importedData = req.body;

            // Speichern der importierten Daten
            await saveImportedData(importedData);

            res.status(200).json({ message: 'Daten erfolgreich importiert.' });
        } catch (error) {
            console.error('Fehler beim Importieren der Daten auf dem Server:', error);
            res.status(500).json({ message: 'Fehler beim Importieren der Daten.' });
        }
    } else {
        res.status(405).json({ message: 'Methode nicht erlaubt.' });
    }
}