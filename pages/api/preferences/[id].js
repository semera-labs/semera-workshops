import { updateSubmissionById, deleteSubmissionById  } from '../../../lib/data';

export default async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'PUT') {
        try {
            const updatedSubmission = req.body;

            // Aktualisieren des Eintrags mit der angegebenen ID
            await updateSubmissionById(id, updatedSubmission);

            res.status(200).json({ message: 'Eintrag erfolgreich aktualisiert.' });
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Eintrags auf dem Server:', error);
            res.status(500).json({ message: 'Fehler beim Aktualisieren des Eintrags.' });
        }
    } else if (req.method === 'DELETE') {
        try {
            // Delete the entry with the specified ID
            await deleteSubmissionById(id);

            res.status(200).json({ message: 'Eintrag erfolgreich gelöscht.' });
        } catch (error) {
            console.error('Fehler beim Löschen des Eintrags auf dem Server:', error);
            res.status(500).json({ message: 'Fehler beim Löschen des Eintrags.' });
        }
    } else {
        res.status(405).json({ message: 'Methode nicht erlaubt.' });
    }
}
