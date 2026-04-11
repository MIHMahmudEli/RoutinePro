import { put } from '@vercel/blob';
// v1.0.1 - Triggering redeploy for env vars

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // Security: Check for the admin secret key
    // In production, you should use an environment variable for this (e.g. process.env.ADMIN_SECRET)
    // but for now we follow the pattern in your Controller.js
    const authHeader = request.headers.authorization;
    if (authHeader !== '01716099707') {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const data = await request.json();
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            return response.status(400).json({ error: 'Data must be a course array' });
        }

        // Upload to Vercel Blob
        // Note: addRandomSuffix: false means it will overwrite if the name is same (useful for routine data)
        const blob = await put('courses.json', JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });

        // Also update a "last sync" metadata blob
        await put('metadata.json', JSON.stringify({
            lastUpdate: new Date().toISOString(),
            courseCount: data.length
        }), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });

        return response.status(200).json({ 
            success: true, 
            url: blob.url,
            message: `Successfully synced ${data.length} courses globally.`
        });
    } catch (error) {
        console.error('Upload error:', error);
        return response.status(500).json({ error: error.message });
    }
}
