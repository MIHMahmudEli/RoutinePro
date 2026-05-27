export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = request.headers.authorization;
    if (!process.env.ADMIN_PASSWORD || authHeader !== process.env.ADMIN_PASSWORD) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { data, semester } = request.body;
        
        if (!Array.isArray(data)) {
            return response.status(400).json({ error: 'Data must be a course array' });
        }

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;
        if (!GITHUB_TOKEN) {
            return response.status(500).json({ error: 'Server configuration error: missing GITHUB_TOKEN' });
        }

        const REPO = 'MIHMahmudEli/RoutinePro';
        const BRANCH = 'main';

        // Helper to update github file
        const updateGithubFile = async (path, contentStr, message) => {
            const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
            const headers = {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'RoutinePro-App'
            };

            // Get existing file SHA
            let sha;
            const getRes = await fetch(`${url}?ref=${BRANCH}`, { headers });
            if (getRes.ok) {
                const getBody = await getRes.json();
                sha = getBody.sha;
            }

            // Write new file
            const putRes = await fetch(url, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    content: Buffer.from(contentStr, 'utf-8').toString('base64'),
                    sha: sha,
                    branch: BRANCH
                })
            });

            if (!putRes.ok) {
                const err = await putRes.json();
                throw new Error(err.message);
            }
        };

        // 1. Update courses.json
        await updateGithubFile('data/courses.json', JSON.stringify(data, null, 2), `Update global courses (${data.length} items)`);
        
        // 2. Update metadata.json (preserve ramadanSlots if exists)
        let ramadanSlots = undefined;
        try {
            const metaUrl = `https://api.github.com/repos/${REPO}/contents/data/metadata.json`;
            const headers = { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'RoutinePro-App' };
            const metaRes = await fetch(`${metaUrl}?ref=${BRANCH}`, { headers });
            if (metaRes.ok) {
                const metaBody = await metaRes.json();
                const existing = JSON.parse(Buffer.from(metaBody.content, 'base64').toString('utf-8'));
                if (existing.ramadanSlots) ramadanSlots = existing.ramadanSlots;
            }
        } catch (e) {}

        await updateGithubFile('data/metadata.json', JSON.stringify({
            lastUpdate: new Date().toISOString(),
            courseCount: data.length,
            semester: semester || "Updated Semester",
            ramadanSlots: ramadanSlots
        }, null, 2), `Update courses metadata`);

        return response.status(200).json({ 
            success: true, 
            message: `Successfully synced ${data.length} courses globally to GitHub. Changes will be live in 30 seconds.`
        });
    } catch (error) {
        console.error('Upload error:', error);
        return response.status(500).json({ error: error.message });
    }
}
