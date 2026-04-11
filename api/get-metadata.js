import { list } from '@vercel/blob';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { blobs } = await list({ prefix: 'metadata.json' });
        const targetBlob = blobs.find(b => b.pathname === 'metadata.json');

        if (!targetBlob) {
            return response.status(404).json({ error: 'Global metadata not found.' });
        }

        return response.status(302).setHeader('Location', targetBlob.url).send('');
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
