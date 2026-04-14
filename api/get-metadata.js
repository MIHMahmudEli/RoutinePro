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

        // Fetch the content directly and proxy it to avoid 302 caching
        const res = await fetch(targetBlob.url);
        const data = await res.json();

        return response.status(200)
            .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            .setHeader('Pragma', 'no-cache')
            .setHeader('Expires', '0')
            .json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
