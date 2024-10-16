import { getAllSubmissions } from '../../../lib/data';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const submissions = await getAllSubmissions();
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(JSON.stringify(submissions, null, 2));
    } else {
        res.status(405).json({ message: 'Methode nicht erlaubt' });
    }
}
