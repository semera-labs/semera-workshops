import { getAllWorkshops } from '../../../lib/workshops';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const workshops = await getAllWorkshops();
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(JSON.stringify(workshops, null, 2));
    } else {
        res.status(405).json({ message: 'Methode nicht erlaubt' });
    }
}
