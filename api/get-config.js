export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const url = `https://raw.githubusercontent.com/MIHMahmudEli/RoutinePro/main/data/config.json?t=${Date.now()}`;
        const configRes = await fetch(url);
        
        if (!configRes.ok) {
            response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response.status(200).json({ ramadanFeatureEnabled: false });
        }

        const data = await configRes.json();

        response.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response.status(200).json(data);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
