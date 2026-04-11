import { put } from '@vercel/blob';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = request.headers.authorization;
    if (authHeader !== '01716099707') {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const data = request.body; // Expecting { ramadanFeatureEnabled: boolean }
        
        const blob = await put('config.json', JSON.stringify(data), {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
        });

        return response.status(200).json({ 
            success: true, 
            message: `Ramadan Mode is now ${data.ramadanFeatureEnabled ? 'ENABLED' : 'DISABLED'} globally!`
        });
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
