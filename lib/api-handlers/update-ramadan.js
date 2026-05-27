export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = request.headers.authorization;
    if (!process.env.ADMIN_PASSWORD || authHeader !== process.env.ADMIN_PASSWORD) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { mappings, featureEnabled } = request.body;

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;
        if (!GITHUB_TOKEN) {
            return response.status(500).json({ error: 'Server configuration error: missing GITHUB_TOKEN' });
        }

        const url = `https://api.github.com/repos/MIHMahmudEli/RoutinePro/contents/data/ramadan-mappings.json`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
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

        const payload = { 
            mappings, 
            featureEnabled: featureEnabled === undefined ? true : featureEnabled 
        };

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Admin: Sync Ramadan Mappings (${Object.keys(mappings || {}).length} sections)`,
                content: Buffer.from(JSON.stringify(payload, null, 2), 'utf-8').toString('base64'),
                sha: sha,
                branch: 'main'
            })
        });

        if (!putRes.ok) {
            const err = await putRes.json();
            throw new Error(err.message);
        }

        // 2. Update metadata.json to include slot info
        try {
            const metaUrl = `https://api.github.com/repos/MIHMahmudEli/RoutinePro/contents/data/metadata.json`;
            let metaSha;
            let metaData = { lastUpdate: new Date().toISOString(), courseCount: 0, semester: "Unknown" };

            const metaGet = await fetch(`${metaUrl}?ref=main`, { headers });
            if (metaGet.ok) {
                const metaBody = await metaGet.json();
                metaSha = metaBody.sha;
                const existingContent = JSON.parse(Buffer.from(metaBody.content, 'base64').toString('utf-8'));
                metaData = { ...metaData, ...existingContent };
            }

            metaData.ramadanSlots = Object.keys(mappings || {}).length;
            metaData.lastUpdate = new Date().toISOString();

            await fetch(metaUrl, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Admin: Update metadata with ${metaData.ramadanSlots} ramadan slots`,
                    content: Buffer.from(JSON.stringify(metaData, null, 2), 'utf-8').toString('base64'),
                    sha: metaSha,
                    branch: 'main'
                })
            });
        } catch (mErr) {
            console.warn("Failed to update metadata.json with slot info:", mErr);
        }

        return response.status(200).json({ success: true, message: `Successfully synced global Ramadan mappings and updated metadata` });
    } catch (error) {
        console.error('Update ramadan error:', error);
        return response.status(500).json({ error: error.message });
    }
}
