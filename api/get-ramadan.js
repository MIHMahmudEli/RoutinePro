import { list } from '@vercel/blob';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { blobs } = await list({ prefix: 'ramadan-mappings.json' });
        const targetBlob = blobs.find(b => b.pathname === 'ramadan-mappings.json');

        if (!targetBlob) {
            // Return a safe default instead of 404 to avoid scary console errors
            response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response.status(200).json({ featureEnabled: false, mappings: {} });
        }

        // Fetch the content directly and return with no-cache headers
        const ramRes = await fetch(targetBlob.url);
        const data = await ramRes.json();

        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
