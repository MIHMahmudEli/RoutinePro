/**
 * AIUB Portal Scraper - v2
 * Fetches CAPTCHA directly and scrapes courses with auto-global sync
 */

import https from 'https';
import http from 'http';

async function fetchWithCookies(url, method = 'GET', body = null, headers = {}, cookies = '', isBinary = false) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookies,
                ...headers
            }
        };

        if (body) {
            const bodyStr = typeof body === 'string' ? body : new URLSearchParams(body).toString();
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        const req = protocol.request(options, (res) => {
            const chunks = [];
            const newCookies = res.headers['set-cookie'];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const resolvedBody = isBinary ? buffer : buffer.toString('utf-8');
                resolve({ body: resolvedBody, cookies: newCookies || [], status: res.statusCode });
            });
        });

        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : new URLSearchParams(body).toString());
        req.end();
    });
}

async function fetchCaptchaFromAIUB() {
    try {
        console.log('[AIUB] Fetching login page for CAPTCHA...');
        const loginPageRes = await fetchWithCookies('https://portal.aiub.edu/Login', 'GET');
        
        if (loginPageRes.status !== 200) {
            throw new Error('Could not reach AIUB login page');
        }

        // Extract CSRF token using highly robust search
        const csrfMatch = loginPageRes.body.match(/name="__RequestVerificationToken"[\s\S]*?value="([^"]+)"/i) 
                       || loginPageRes.body.match(/value="([^"]+)"[\s\S]*?name="__RequestVerificationToken"/i)
                       || loginPageRes.body.match(/__RequestVerificationToken["\s]*value=["']([^"']+)["']/i);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        // Extract CaptchaDeText hidden input value
        const captchaDeTextMatch = loginPageRes.body.match(/id="CaptchaDeText"[\s\S]*?value="([^"]+)"/i)
                                || loginPageRes.body.match(/name="CaptchaDeText"[\s\S]*?value="([^"]+)"/i)
                                || loginPageRes.body.match(/value="([^"]+)"[\s\S]*?id="CaptchaDeText"/i);
        const captchaDeText = captchaDeTextMatch ? captchaDeTextMatch[1] : '';

        console.log('[AIUB] Extracted CSRF Token:', csrfToken ? 'Success' : 'Failed');
        console.log('[AIUB] Extracted CaptchaDeText:', captchaDeText ? 'Success' : 'Failed');

        // Build precise CAPTCHA URL
        let captchaUrl = captchaDeText 
            ? `https://portal.aiub.edu/DefaultCaptcha/Generate?t=${captchaDeText}`
            : 'https://portal.aiub.edu/DefaultCaptcha/Generate';

        console.log('[AIUB] Fetching CAPTCHA from:', captchaUrl);

        // Fetch CAPTCHA image using the SAME cookies from the loginPageRes
        const imgRes = await fetchWithCookies(captchaUrl, 'GET', null, {}, loginPageRes.cookies.join(';'), true);
        
        if (imgRes.status === 200) {
            const base64 = imgRes.body.toString('base64');
            console.log('[AIUB] CAPTCHA fetched successfully');
            
            return {
                success: true,
                captchaImage: base64,
                csrfToken: csrfToken,
                captchaDeText: captchaDeText,
                cookies: loginPageRes.cookies
            };
        } else {
            throw new Error('Failed to fetch CAPTCHA image');
        }
    } catch (error) {
        console.error('[AIUB] Error:', error);
        return { success: false, error: error.message };
    }
}

async function scrapeAIUBCourses(username, password, captchaText, csrfToken, captchaDeText, initialCookies) {
    try {
        console.log('[AIUB] Starting login...');
        
        let cookies = initialCookies || [];
        if (!cookies || cookies.length === 0) {
            const loginPageRes = await fetchWithCookies('https://portal.aiub.edu/Login', 'GET');
            cookies = loginPageRes.cookies;
        }

        // Submit login
        const loginData = {
            UserId: username,
            Password: password,
            CaptchaInputText: captchaText,
            CaptchaDeText: captchaDeText || '',
            __RequestVerificationToken: csrfToken || '',
            RememberMe: 'false'
        };

        const loginRes = await fetchWithCookies(
            'https://portal.aiub.edu/Login',
            'POST',
            loginData,
            { 'Referer': 'https://portal.aiub.edu/Login' },
            cookies.join(';')
        );

        cookies.push(...(loginRes.cookies || []));

        // Check for errors
        if (loginRes.body.includes('invalid') || loginRes.body.includes('failed')) {
            if (loginRes.body.includes('captcha') || loginRes.body.includes('CAPTCHA')) {
                throw new Error('Invalid CAPTCHA - please try again');
            }
            throw new Error('Invalid credentials - login failed');
        }

        // Fetch offered courses
        console.log('[AIUB] Fetching courses page...');
        const coursesPageRes = await fetchWithCookies(
            'https://portal.aiub.edu/Student/Section/Offered',
            'GET',
            null,
            { 'Referer': 'https://portal.aiub.edu/Login' },
            cookies.join(';')
        );

        if (coursesPageRes.status !== 200) {
            throw new Error('Failed to fetch courses - authentication error');
        }

        // Parse courses
        console.log('[AIUB] Parsing courses...');
        const coursesData = parseCoursesFromHTML(coursesPageRes.body);

        if (coursesData.length === 0) {
            throw new Error('No courses found - page may have changed');
        }

        const formattedCourses = formatCoursesForRoutinePro(coursesData);
        console.log(`[AIUB] Successfully scraped ${formattedCourses.length} courses`);

        return {
            success: true,
            courses: formattedCourses,
            count: formattedCourses.length,
            message: `Scraped ${formattedCourses.length} courses`
        };

    } catch (error) {
        console.error('[AIUB] Error:', error);
        return { success: false, error: error.message };
    }
}

function parseCoursesFromHTML(html) {
    const courses = [];
    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tables = html.match(tableRegex) || [];

    for (const table of tables) {
        const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
        const rows = table.match(rowRegex) || [];

        for (const row of rows) {
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
            let cellMatch;

            while ((cellMatch = cellRegex.exec(row)) !== null) {
                let cellText = cellMatch[1]
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .trim();
                cells.push(cellText);
            }

            if (cells.length >= 6 && cells[0] && cells[1] && cells[2]) {
                courses.push({
                    classId: cells[0],
                    code: cells[1],
                    title: cells[2],
                    section: cells[3] || 'N/A',
                    type: cells[4] || 'Theory',
                    day: cells[5] || '',
                    start: cells[6] || '',
                    end: cells[7] || '',
                    room: cells[8] || 'N/A',
                    status: cells[9] || 'Open',
                    capacity: cells[10] || '0',
                    count: cells[11] || '0',
                    dept: cells[12] || 'N/A'
                });
            }
        }
    }

    return courses;
}

function formatCoursesForRoutinePro(rawCourses) {
    const coursesMap = {};

    rawCourses.forEach(raw => {
        let baseTitle = raw.title.trim();
        const bracketRegex = /\s*\[([^\]]+)\]\s*$/;
        let sectionName = raw.section || 'N/A';
        
        const match = baseTitle.match(bracketRegex);
        if (match && match[1].length <= 3) {
            baseTitle = baseTitle.replace(bracketRegex, '').trim();
            if (!sectionName || sectionName === 'N/A') {
                sectionName = match[1];
            }
        }

        const key = baseTitle.toUpperCase();

        if (!coursesMap[key]) {
            coursesMap[key] = {
                code: raw.code,
                baseTitle: baseTitle,
                dept: raw.dept,
                sections: {}
            };
        }

        if (!coursesMap[key].sections[sectionName]) {
            coursesMap[key].sections[sectionName] = {
                id: raw.classId,
                section: sectionName,
                status: raw.status,
                capacity: raw.capacity,
                count: raw.count,
                schedules: []
            };
        }

        if (raw.day && raw.start && raw.end) {
            coursesMap[key].sections[sectionName].schedules.push({
                day: normalizeDayName(raw.day),
                start: raw.start,
                end: raw.end,
                room: raw.room,
                type: raw.type
            });
        }
    });

    return Object.values(coursesMap).map(course => {
        course.sections = Object.values(course.sections).sort((a, b) => 
            a.section.localeCompare(b.section, undefined, { numeric: true })
        );
        return course;
    });
}

function normalizeDayName(day) {
    const days = { 'Saturday': 'SAT', 'Sunday': 'SUN', 'Monday': 'MON', 'Tuesday': 'TUE', 'Wednesday': 'WED', 'Thursday': 'THU', 'Friday': 'FRI', 'Sat': 'SAT', 'Sun': 'SUN', 'Mon': 'MON', 'Tue': 'TUE', 'Wed': 'WED', 'Thu': 'THU', 'Fri': 'FRI' };
    return days[day] || day.substring(0, 3).toUpperCase();
}

async function syncToGlobalDatabase(courses) {
    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;
        const REPO = process.env.GITHUB_REPO || 'MIHMahmudEli/RoutinePro';
        const BRANCH = process.env.GITHUB_BRANCH || 'main';

        if (!GITHUB_TOKEN) {
            console.warn('[AIUB] Missing GITHUB_TOKEN - cannot perform global update');
            return { success: false, message: 'Missing GITHUB_TOKEN' };
        }

        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RoutinePro-AIUB-Sync'
        };

        // Helper to get file SHA (if exists)
        const getSha = async (path) => {
            const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`;
            const res = await fetch(url, { headers });
            if (!res.ok) return null;
            const body = await res.json();
            return body.sha;
        };

        // Helper to update file
        const updateFile = async (path, contentStr, message) => {
            const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
            const sha = await getSha(path);
            const putRes = await fetch(url, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    content: Buffer.from(contentStr, 'utf-8').toString('base64'),
                    sha: sha || undefined,
                    branch: BRANCH
                })
            });

            if (!putRes.ok) {
                const err = await putRes.json().catch(() => ({}));
                throw new Error(err.message || `GitHub update failed (${putRes.status})`);
            }
        };

        // 1) Update courses.json
        await updateFile('data/courses.json', JSON.stringify(courses, null, 2), `AIUB Sync: update courses (${courses.length})`);

        // 2) Update metadata.json (preserve ramadanSlots if present)
        let ramadanSlots = undefined;
        try {
            const metaShaUrl = `https://api.github.com/repos/${REPO}/contents/data/metadata.json?ref=${BRANCH}`;
            const metaRes = await fetch(metaShaUrl, { headers });
            if (metaRes.ok) {
                const metaBody = await metaRes.json();
                const existing = JSON.parse(Buffer.from(metaBody.content, 'base64').toString('utf-8'));
                if (existing.ramadanSlots) ramadanSlots = existing.ramadanSlots;
            }
        } catch (e) { /* ignore */ }

        const newMeta = {
            lastUpdate: new Date().toISOString(),
            courseCount: Array.isArray(courses) ? courses.length : 0,
            semester: `AIUB Portal Sync - ${new Date().toLocaleDateString()}`
        };
        if (ramadanSlots !== undefined) newMeta.ramadanSlots = ramadanSlots;

        await updateFile('data/metadata.json', JSON.stringify(newMeta, null, 2), `AIUB Sync: update metadata (${newMeta.courseCount} courses)`);

        console.log('[AIUB] Global update completed');
        return { success: true, message: 'Global files updated' };
    } catch (error) {
        console.error('[AIUB] Global sync error:', error);
        return { success: false, message: error.message };
    }
}

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

    const { username, password, captcha, csrfToken, captchaDeText, action, cookies } = request.body;

    // Fetch CAPTCHA
    if (action === 'fetch-captcha') {
        try {
            const result = await fetchCaptchaFromAIUB();
            return response.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            return response.status(500).json({ success: false, error: error.message });
        }
    }

    // Login and scrape
    if (!username || !password || !captcha) {
        return response.status(400).json({ success: false, error: 'Missing fields' });
    }

    try {
        const result = await scrapeAIUBCourses(username, password, captcha, csrfToken, captchaDeText, cookies);
        
        if (result.success && result.courses) {
            // Auto-sync to global
            const syncResult = await syncToGlobalDatabase(result.courses);
            result.globalSynced = syncResult.success;
            return response.status(200).json(result);
        } else {
            return response.status(400).json(result);
        }
    } catch (error) {
        return response.status(500).json({ success: false, error: error.message });
    }
}
