export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, mode = 'sync' } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    const isFullMode = mode === 'full';

    const systemPrompt = isFullMode 
      ? `EXTRACT REGISTERED COURSES WITH FULL DETAILS FROM IMAGE.
      
      CRITICAL INSTRUCTIONS:
      1. ONLY extract information that is visually present.
      2. ONLY extract courses that are actively registered.
      3. For EACH course, extract EVERY schedule entry (a course might have multiple rows or times).
      4. COMPLETELY IGNORE any course that has "Dropped" or "Dropped(100%)" written anywhere near it. Do not extract dropped courses at all.
      5. ONLY extract information that is visually present. DO NOT use general knowledge.
      
      Structure per schedule entry:
      - title: Full course name in UPPERCASE.
        Example: If the text is '00733-MOBILE APPLICATION DEVELOPMENT [A]', the title should be 'MOBILE APPLICATION DEVELOPMENT'.
      - section: The single or double character inside the square brackets (e.g., A, B, CC, K, etc.).
      - days: Array of days (e.g. ["Sunday", "Tuesday"]).
      - start: Start time in "HH:MM AM/PM" format.
      - end: End time in "HH:MM AM/PM" format.
      - room: Room number/name (e.g. 1102, DS0102).
      - type: Either "Theory" or "Lab". 
      
      Return ONLY a clean JSON array of objects in this exact format:
      [{"title": "...", "section": "...", "days": ["..."], "start": "...", "end": "...", "room": "...", "type": "..."}]
      Do not include any dropped courses, preamble, explanation, or extra text.`
      : `EXTRACT REGISTERED COURSES FROM IMAGE.

      CRITICAL INSTRUCTIONS:
      1. ONLY extract courses that are actively registered.
      2. COMPLETELY IGNORE any course that has "Dropped" or "Dropped(100%)" written anywhere near it. Do not extract dropped courses at all.
      3. ONLY extract information that is visually present. DO NOT use general knowledge.
      
      Structure per course:
      - title: The full course name in UPPERCASE. 
        Example: If the text is '00733-MOBILE APPLICATION DEVELOPMENT [A]', the title should be 'MOBILE APPLICATION DEVELOPMENT'.
      - section: The single or double character inside the square brackets (e.g., A, B, CC, K, etc.).

      Return ONLY a clean JSON array of objects in this exact format:
      [{"title": "...", "section": "..."}]

      Do not include any dropped courses, preamble, explanation, or extra text.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
              type: "text",
              text: systemPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Groq API error' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\[.*\]/s);
    
    if (jsonMatch) {
      return res.status(200).json(JSON.parse(jsonMatch[0]));
    } else {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
