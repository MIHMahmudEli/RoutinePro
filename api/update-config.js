export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = request.headers.authorization;
    if (!process.env.ADMIN_PASSWORD || authHeader !== process.env.ADMIN_PASSWORD) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { ramadanFeatureEnabled } = request.body;

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        if (!GITHUB_TOKEN) {
            return response.status(500).json({ error: 'Server configuration error: missing GITHUB_TOKEN' });
        }

        const url = `https://api.github.com/repos/MIHMahmudEli/RoutinePro/contents/data/config.json`;
        const headers = {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RoutinePro-App'
        };

        // Get existing file SHA
        let sha;
        const getRes = await fetch(`${url}?ref=main`, { headers });
        if (getRes.ok) {
            const getBody = await getRes.json();
            sha = getBody.sha;
        }

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Admin: Toggle Ramadan Feature -> ${ramadanFeatureEnabled}`,
                content: Buffer.from(JSON.stringify({ ramadanFeatureEnabled }, null, 2), 'utf-8').toString('base64'),
                sha: sha,
                branch: 'main'
            })
        });

        if (!putRes.ok) {
            const err = await putRes.json();
            throw new Error(err.message);
        }

        return response.status(200).json({ success: true, message: `Config updated dynamically. Ramadan Mode forced ${ramadanFeatureEnabled ? 'ON' : 'OFF'} for all users.` });
    } catch (error) {
        console.error('Update config error:', error);
        return response.status(500).json({ error: error.message });
    }
}
