import { put } from '@vercel/blob';
// v1.0.1 - Triggering redeploy for env vars

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // Use Environment Variable for security
    const authHeader = request.headers.authorization;
    if (!process.env.ADMIN_PASSWORD || authHeader !== process.env.ADMIN_PASSWORD) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { data, semester } = request.body;
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            return response.status(400).json({ error: 'Data must be a course array' });
        }

        // Upload to Vercel Blob
        const blob = await put('courses.json', JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });

        // Also update a "last sync" metadata blob
        await put('metadata.json', JSON.stringify({
            lastUpdate: new Date().toISOString(),
            courseCount: data.length,
            semester: semester || "Updated Semester"
        }), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });

        return response.status(200).json({ 
            success: true, 
            url: blob.url,
            message: `Successfully synced ${data.length} courses for ${semester || 'the semester'} globally.`
        });
    } catch (error) {
        console.error('Upload error:', error);
        return response.status(500).json({ error: error.message });
    }
}
