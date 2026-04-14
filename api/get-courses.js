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

        // Fetch the content directly and return with no-cache headers
        const courseRes = await fetch(coursesBlob.url);
        const data = await courseRes.json();

        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
