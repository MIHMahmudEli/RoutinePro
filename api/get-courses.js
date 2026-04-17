export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;
        const REPO = 'MIHMahmudEli/RoutinePro';
        const url = `https://api.github.com/repos/${REPO}/contents/data/courses.json?t=${Date.now()}`;
        
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RoutinePro-App'
        };
        if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

        const courseRes = await fetch(url, { headers });
        
        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

        if (!courseRes.ok) {
            return response.status(200).json([]);
        }

        const body = await courseRes.json();
        const content = Buffer.from(body.content, 'base64').toString('utf-8');
        const data = JSON.parse(content);

        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
