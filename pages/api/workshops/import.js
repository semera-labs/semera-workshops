import { setWorkshops } from '../../../lib/workshops';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const newWorkshops = req.body;

            if (!Array.isArray(newWorkshops)) {
                return res.status(400).json({ message: 'Expected an array of workshops.' });
            }

            await setWorkshops(newWorkshops);
            res.status(200).json({ message: 'Workshops imported successfully.' });
        } catch (error) {
            console.error('Error importing workshops:', error);
            res.status(500).json({ message: 'Error importing workshops.' });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed.' });
    }
}
