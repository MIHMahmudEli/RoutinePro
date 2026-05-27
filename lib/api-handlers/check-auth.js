export default async function handler(request, response) {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

    const { password } = request.body || {};
    
    // Compare provided password with the secret environment variable
    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
        return response.status(401).json({ authenticated: false, error: 'Invalid security key' });
    }

    return response.status(200).json({ authenticated: true });
}
