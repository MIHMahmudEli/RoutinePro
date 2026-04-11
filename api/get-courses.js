import { list } from '@vercel/blob';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Find the courses.json blob
        const { blobs } = await list({ prefix: 'courses.json' });
        const coursesBlob = blobs.find(b => b.pathname === 'courses.json');

        if (!coursesBlob) {
            return response.status(404).json({ error: 'Global courses not found. Using local fallback.' });
        }

        // Redirect to the blob URL
        return response.status(302).setHeader('Location', coursesBlob.url).send('');
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
