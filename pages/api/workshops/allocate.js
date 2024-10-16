import { allocateWorkshops } from '../../../lib/allocation';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const allocations = await allocateWorkshops();
            res.status(200).json(allocations);
        } catch (error) {
            console.error('Error during allocation:', error);
            res.status(500).json({ message: 'Error during allocation.' });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed.' });
    }
}
