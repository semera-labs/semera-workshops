import { getAllWorkshops } from '../../../lib/workshops';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const workshops = await getAllWorkshops();
            res.status(200).json(workshops);
        } catch (error) {
            console.error('Error fetching workshops:', error);
            res.status(500).json({ message: 'Error fetching workshops.' });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed.' });
    }
}