import { put } from '@vercel/blob';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = request.headers.authorization;
    if (!process.env.ADMIN_PASSWORD || authHeader !== process.env.ADMIN_PASSWORD) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const data = request.body;
        
        // Upload Ramadan Mappings to Blob
        const blob = await put('ramadan-mappings.json', JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });

        return response.status(200).json({ 
            success: true, 
            url: blob.url,
            message: "Global Ramadan Mappings updated successfully!"
        });
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
