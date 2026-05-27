export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = request.query;
    if (!id) {
        return response.status(400).json({ error: 'ID is required' });
    }

    try {
        const REPO = 'MIHMahmudEli/RoutinePro';
        const BRANCH = 'main';
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;

        // Try raw first for performance/cache
        const rawUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/data/shares/${id}.json?t=${Date.now()}`;
        
        try {
            const rawRes = await fetch(rawUrl);
            if (rawRes.ok) {
                const data = await rawRes.json();
                return response.status(200).json(data);
            }
        } catch (e) {
            console.warn("Raw fetch failed, falling back to API");
        }

        // Fallback to GitHub API (handles recent changes better)
        const apiUrl = `https://api.github.com/repos/${REPO}/contents/data/shares/${id}.json?ref=${BRANCH}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RoutinePro-App'
        };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

        const apiRes = await fetch(apiUrl, { headers });
        if (!apiRes.ok) {
            return response.status(404).json({ error: 'Shared routine not found' });
        }

        const body = await apiRes.json();
        const content = Buffer.from(body.content, 'base64').toString('utf-8');
        return response.status(200).json(JSON.parse(content));

    } catch (error) {
        console.error('Fetch share error:', error);
        return response.status(500).json({ error: error.message });
    }
}
