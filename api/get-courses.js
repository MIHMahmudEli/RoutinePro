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

        // Use 307 Temporary Redirect and force no-store to prevent CDN/Browser caching of the redirect
        return response.status(307)
            .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            .setHeader('Location', coursesBlob.url)
            .send('');
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
