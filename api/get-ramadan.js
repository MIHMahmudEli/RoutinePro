export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const url = `https://raw.githubusercontent.com/MIHMahmudEli/RoutinePro/main/data/ramadan-mappings.json?t=${Date.now()}`;
        const ramRes = await fetch(url);
        
        if (!ramRes.ok) {
            response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response.status(200).json({ featureEnabled: false, mappings: {} });
        }

        const data = await ramRes.json();

        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
