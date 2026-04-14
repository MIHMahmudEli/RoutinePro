import { list } from '@vercel/blob';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { blobs } = await list({ prefix: 'config.json' });
        const targetBlob = blobs.find(b => b.pathname === 'config.json');

        if (!targetBlob) {
            return response.status(404).json({ error: 'Global config not found.' });
        }

        // Fetch the content directly and return with no-cache headers
        const configRes = await fetch(targetBlob.url);
        const data = await configRes.json();

        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
