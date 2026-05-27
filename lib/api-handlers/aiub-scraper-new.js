/**
 * AIUB Portal Scraper - v3
 * Fixed: redirect following, dynamic captcha MIME type, better auth detection
 */

import https from 'https';
import http from 'http';

function cleanCookies(cookieArray) {
    if (!cookieArray) return '';
    if (typeof cookieArray === 'string') return cookieArray;
    if (!Array.isArray(cookieArray)) return '';
    return cookieArray
        .map(cookie => cookie.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
}

// Raw single HTTP request — no redirect following
function fetchOnce(url, method = 'GET', body = null, headers = {}, cookies = '', isBinary = false) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const reqHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': cookies,
            ...headers
        };

        let bodyStr = null;
        if (body) {
            bodyStr = typeof body === 'string' ? body : new URLSearchParams(body).toString();
            reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
            reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
        }

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method,
            headers: reqHeaders
        };

        const req = protocol.request(options, (res) => {
            const chunks = [];
            const newCookies = res.headers['set-cookie'] || [];
            const location = res.headers['location'] || null;
            const contentType = res.headers['content-type'] || '';

            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    body: isBinary ? buffer : buffer.toString('utf-8'),
                    cookies: newCookies,
                    status: res.statusCode,
                    location,
                    contentType
                });
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// Fetch with automatic redirect following + cookie accumulation across hops
async function fetchWithCookies(url, method = 'GET', body = null, headers = {}, cookies = '', isBinary = false, _depth = 0) {
    const result = await fetchOnce(url, method, body, headers, cookies, isBinary);

    const thisNewCookieStr = cleanCookies(result.cookies || []);

    // Follow 3xx redirects (always GET after first hop)
    if ([301, 302, 303, 307, 308].includes(result.status) && result.location && _depth < 6) {
        const nextUrl = result.location.startsWith('http')
            ? result.location
            : `https://portal.aiub.edu${result.location}`;

        const mergedCookies = [cookies, thisNewCookieStr].filter(Boolean).join('; ');

        const followResult = await fetchWithCookies(nextUrl, 'GET', null, {
            ...headers,
            'Referer': url
        }, mergedCookies, isBinary, _depth + 1);

        // Merge cookies from all hops
        const allCookies = [...(result.cookies || []), ...(followResult.cookies || [])];
        return { ...followResult, cookies: allCookies };
    }

    return result;
}

// ─── CAPTCHA FETCH ────────────────────────────────────────────────────────────

async function fetchCaptchaFromAIUB() {
    try {
        console.log('[AIUB] Fetching login page...');
        const loginPageRes = await fetchWithCookies('https://portal.aiub.edu/Login', 'GET', null, {
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        if (loginPageRes.status !== 200) {
            throw new Error(`Could not reach AIUB login page (HTTP ${loginPageRes.status})`);
        }

        // Extract CSRF token
        const csrfMatch =
            loginPageRes.body.match(/name="__RequestVerificationToken"[\s\S]*?value="([^"]+)"/i) ||
            loginPageRes.body.match(/value="([^"]+)"[\s\S]*?name="__RequestVerificationToken"/i);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        // Extract CaptchaDeText token
        const captchaDeTextMatch =
            loginPageRes.body.match(/id="CaptchaDeText"[\s\S]*?value="([^"]+)"/i) ||
            loginPageRes.body.match(/name="CaptchaDeText"[\s\S]*?value="([^"]+)"/i) ||
            loginPageRes.body.match(/value="([^"]+)"[\s\S]*?id="CaptchaDeText"/i);
        const captchaDeText = captchaDeTextMatch ? captchaDeTextMatch[1] : '';

        console.log('[AIUB] CSRF Token:', csrfToken ? 'Found' : 'Missing');
        console.log('[AIUB] CaptchaDeText:', captchaDeText ? 'Found' : 'Missing');

        const cleanedCookies = cleanCookies(loginPageRes.cookies);
        const captchaUrl = captchaDeText
            ? `https://portal.aiub.edu/DefaultCaptcha/Generate?t=${captchaDeText}`
            : 'https://portal.aiub.edu/DefaultCaptcha/Generate';

        console.log('[AIUB] Fetching CAPTCHA from:', captchaUrl);

        // Fetch captcha as binary (use fetchOnce — captcha URL doesn't redirect)
        const imgRes = await fetchOnce(captchaUrl, 'GET', null, {
            'Referer': 'https://portal.aiub.edu/Login',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin'
        }, cleanedCookies, true);

        if (imgRes.status === 200) {
            const base64 = imgRes.body.toString('base64');
            // Use actual content-type from response (may be gif, png, jpeg…)
            const rawMime = (imgRes.contentType || 'image/gif').split(';')[0].trim();
            const mimeType = rawMime || 'image/gif';

            console.log(`[AIUB] CAPTCHA fetched (${imgRes.body.length} bytes, ${mimeType})`);

            return {
                success: true,
                captchaImage: base64,
                captchaMimeType: mimeType,
                csrfToken,
                captchaDeText,
                cookies: loginPageRes.cookies
            };
        } else {
            throw new Error(`Failed to fetch CAPTCHA image (HTTP ${imgRes.status})`);
        }
    } catch (error) {
        console.error('[AIUB] Captcha fetch error:', error);
        return { success: false, error: error.message };
    }
}

// ─── LOGIN & SCRAPE ───────────────────────────────────────────────────────────

async function scrapeAIUBCourses(username, password, captchaText, csrfToken, captchaDeText, initialCookies) {
    try {
        console.log('[AIUB] Starting login...');

        let cookiesStr = cleanCookies(initialCookies);
        if (!cookiesStr) {
            console.log('[AIUB] No initial cookies — fetching fresh login page...');
            const fresh = await fetchOnce('https://portal.aiub.edu/Login', 'GET');
            cookiesStr = cleanCookies(fresh.cookies);
        }

        const loginData = {
            UserName: username,
            Password: password,
            CaptchaInputText: captchaText,
            CaptchaDeText: captchaDeText || '',
            fingerPrint: '-',
            __RequestVerificationToken: csrfToken || '',
        };

        console.log('[AIUB] Submitting login form...');
        // Use fetchOnce here — we handle the redirect manually so we can capture the session cookie
        const loginRes = await fetchOnce(
            'https://portal.aiub.edu/Login',
            'POST',
            loginData,
            {
                'Referer': 'https://portal.aiub.edu/Login',
                'Origin': 'https://portal.aiub.edu',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            cookiesStr
        );

        console.log(`[AIUB] Login response: HTTP ${loginRes.status}, Location: ${loginRes.location || 'none'}`);

        // 200 on login page = still showing login form = wrong captcha/credentials
        if (loginRes.status === 200) {
            const lBody = loginRes.body || '';
            if (lBody.includes('CaptchaInputText') || lBody.includes('CaptchaDeText')) {
                // Try to find validation-summary-errors or text-danger classes
                const errorMatch = lBody.match(/class="text-danger"[^>]*>([\s\S]*?)<\/span>/i) ||
                                   lBody.match(/class="field-validation-error"[^>]*>([\s\S]*?)<\/span>/i) ||
                                   lBody.match(/validation-summary-errors[\s\S]*?<li>([\s\S]*?)<\/li>/i) ||
                                   lBody.match(/class="[^"]*validation-summary-errors[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

                if (errorMatch) {
                    const cleanErr = errorMatch[1]
                        .replace(/<[^>]*>/g, '') // strip HTML tags
                        .replace(/\s+/g, ' ')     // collapse spaces
                        .trim();
                    if (cleanErr) {
                        throw new Error(cleanErr);
                    }
                }
                
                throw new Error('Invalid credentials or CAPTCHA — please reload CAPTCHA and try again');
            }
        }

        if (loginRes.status >= 400) {
            throw new Error(`Login request failed (HTTP ${loginRes.status})`);
        }

        // Capture session cookies from the login response (the 302 sets auth cookies)
        const loginNewCookies = cleanCookies(loginRes.cookies);
        let sessionCookies = [cookiesStr, loginNewCookies].filter(Boolean).join('; ');

        // Follow the login redirect to fully establish the session on AIUB's side
        if ([301, 302, 303].includes(loginRes.status) && loginRes.location) {
            const redirectUrl = loginRes.location.startsWith('http')
                ? loginRes.location
                : `https://portal.aiub.edu${loginRes.location}`;

            console.log(`[AIUB] Following login redirect → ${redirectUrl}`);
            const redirectRes = await fetchWithCookies(redirectUrl, 'GET', null, {
                'Referer': 'https://portal.aiub.edu/Login',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin'
            }, sessionCookies);

            const moreCookies = cleanCookies(redirectRes.cookies);
            sessionCookies = [sessionCookies, moreCookies].filter(Boolean).join('; ');
            console.log(`[AIUB] Redirect landed on: HTTP ${redirectRes.status}`);
        }

        // Fetch offered courses page
        console.log('[AIUB] Fetching courses page...');
        const coursesPageRes = await fetchWithCookies(
            'https://portal.aiub.edu/Student/Section/Offered',
            'GET',
            null,
            {
                'Referer': 'https://portal.aiub.edu/Student',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin'
            },
            sessionCookies
        );

        console.log(`[AIUB] Courses page: HTTP ${coursesPageRes.status}`);

        // If redirected back to login page = session not established
        const cBody = coursesPageRes.body || '';
        if (cBody.includes('id="UserId"') || cBody.includes('name="UserId"') ||
            (cBody.includes('CaptchaInputText') && cBody.includes('/Login'))) {
            throw new Error('Authentication failed — session was not established. Reload CAPTCHA and try again.');
        }

        if (coursesPageRes.status !== 200) {
            throw new Error(`Failed to load courses page (HTTP ${coursesPageRes.status})`);
        }

        // Parse courses
        console.log('[AIUB] Parsing courses...');
        const coursesData = parseCoursesFromHTML(cBody);

        if (coursesData.length === 0) {
            console.log('[AIUB] Page snippet (500 chars):', cBody.substring(0, 500));
            throw new Error('No courses found — the portal page structure may have changed, or no courses are offered yet.');
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
        console.error('[AIUB] Scrape error:', error);
        return { success: false, error: error.message };
    }
}

// ─── PARSERS ──────────────────────────────────────────────────────────────────

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
                const cellText = cellMatch[1]
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
            if (!sectionName || sectionName === 'N/A') sectionName = match[1];
        }

        const key = baseTitle.toUpperCase();

        if (!coursesMap[key]) {
            coursesMap[key] = { code: raw.code, baseTitle, dept: raw.dept, sections: {} };
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
    const days = {
        Saturday: 'SAT', Sunday: 'SUN', Monday: 'MON', Tuesday: 'TUE',
        Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI',
        Sat: 'SAT', Sun: 'SUN', Mon: 'MON', Tue: 'TUE',
        Wed: 'WED', Thu: 'THU', Fri: 'FRI'
    };
    return days[day] || day.substring(0, 3).toUpperCase();
}

// ─── GLOBAL SYNC ──────────────────────────────────────────────────────────────

async function syncToGlobalDatabase(courses) {
    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : null;
        const REPO = process.env.GITHUB_REPO || 'MIHMahmudEli/RoutinePro';
        const BRANCH = process.env.GITHUB_BRANCH || 'main';

        if (!GITHUB_TOKEN) {
            console.warn('[AIUB] Missing GITHUB_TOKEN — skipping global sync');
            return { success: false, message: 'Missing GITHUB_TOKEN' };
        }

        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RoutinePro-AIUB-Sync'
        };

        const getSha = async (path) => {
            const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers });
            if (!res.ok) return null;
            return (await res.json()).sha;
        };

        const updateFile = async (path, contentStr, message) => {
            const sha = await getSha(path);
            const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
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

        await updateFile('data/courses.json', JSON.stringify(courses, null, 2), `AIUB Sync: update courses (${courses.length})`);

        // Preserve ramadanSlots if present
        let ramadanSlots;
        try {
            const metaRes = await fetch(`https://api.github.com/repos/${REPO}/contents/data/metadata.json?ref=${BRANCH}`, { headers });
            if (metaRes.ok) {
                const metaBody = await metaRes.json();
                const existing = JSON.parse(Buffer.from(metaBody.content, 'base64').toString('utf-8'));
                if (existing.ramadanSlots) ramadanSlots = existing.ramadanSlots;
            }
        } catch (_) { /* ignore */ }

        const newMeta = {
            lastUpdate: new Date().toISOString(),
            courseCount: Array.isArray(courses) ? courses.length : 0,
            semester: `AIUB Portal Sync - ${new Date().toLocaleDateString()}`
        };
        if (ramadanSlots !== undefined) newMeta.ramadanSlots = ramadanSlots;

        await updateFile('data/metadata.json', JSON.stringify(newMeta, null, 2), `AIUB Sync: update metadata (${newMeta.courseCount} courses)`);

        console.log('[AIUB] Global sync complete');
        return { success: true, message: 'Global files updated' };
    } catch (error) {
        console.error('[AIUB] Global sync error:', error);
        return { success: false, message: error.message };
    }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

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
        return response.status(400).json({ success: false, error: 'Missing required fields: username, password, or captcha' });
    }

    try {
        const result = await scrapeAIUBCourses(username, password, captcha, csrfToken, captchaDeText, cookies);

        if (result.success && result.courses) {
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
