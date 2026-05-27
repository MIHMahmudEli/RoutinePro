import crypto from 'crypto';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = request.body;
        if (!payload || !payload.items) {
            return response.status(400).json({ error: 'Invalid payload' });
        }

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;
        if (!GITHUB_TOKEN) {
            return response.status(500).json({ error: 'Server configuration error: missing GITHUB_TOKEN' });
        }

        const REPO = 'MIHMahmudEli/RoutinePro';
        const BRANCH = 'main';

        const jsonStr = JSON.stringify(payload);
        // Create a short 8-character ID based on hash of the routine content
        const id = crypto.createHash('md5').update(jsonStr).digest('hex').substring(0, 8);
        const path = `data/shares/${id}.json`;

        const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RoutinePro-App'
        };

        // 1. Check if the file already exists (to avoid duplicate commits)
        const checkRes = await fetch(`${url}?ref=${BRANCH}`, { headers });
        if (checkRes.ok) {
            return response.status(200).json({ id });
        }

        // 2. Write new share file to GitHub
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Create shared routine: ${id}`,
                content: Buffer.from(jsonStr).toString('base64'),
                branch: BRANCH
            })
        });

        if (!putRes.ok) {
            const err = await putRes.json();
            throw new Error(err.message || "Failed to write to GitHub");
        }

        return response.status(200).json({ id });
    } catch (error) {
        console.error('Share error:', error);
        return response.status(500).json({ error: error.message });
    }
}
