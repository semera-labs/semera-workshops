const { getAllSubmissions, saveSubmission } = require('../../../lib/data');

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const submissions = await getAllSubmissions();
            res.status(200).json(submissions);
        } catch (error) {
            console.error('Error fetching submissions:', error);
            res.status(500).json({ message: 'Error fetching submissions.' });
        }
    } else if (req.method === 'POST') {
        try {
            const newSubmission = req.body;

            if (!newSubmission.name || !newSubmission.preferences) {
                return res.status(400).json({ message: 'Name and preferences are required.' });
            }

            await saveSubmission(newSubmission);

            res.status(201).json({ message: 'Submission saved successfully.' });
        } catch (error) {
            console.error('Error saving submission:', error);
            res.status(500).json({ message: 'Error saving submission.' });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed.' });
    }
}
