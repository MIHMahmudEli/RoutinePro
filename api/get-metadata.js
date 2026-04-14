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

        // Fetch the content directly and return with no-cache headers
        const metaRes = await fetch(targetBlob.url);
        const data = await metaRes.json();
        
        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
