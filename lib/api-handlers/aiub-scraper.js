/**
 * AIUB Portal Scraper
 * Authenticates with AIUB portal and scrapes offered courses
 * 
 * IMPORTANT: This requires either Puppeteer or a headless browser service.
 * For Vercel deployment, consider using:
 * 1. Vercel's built-in Chromium (if available)
 * 2. Browserless.io service
 * 3. SerpAPI or similar third-party service
 */

import https from 'https';
import http from 'http';

// Helper to fetch URL and get cookies
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

// Extract CAPTCHA image from login page
async function fetchCaptchaImage(cookies) {
    try {
        const response = await fetchWithCookies('https://portal.aiub.edu/Login', 'GET', null, {}, cookies.join(';'));
        
        // Extract CAPTCHA image URL or ID from HTML
        const captchaMatch = response.body.match(/CaptchaImg["\s]*src=["']([^"']+)["']/i);
        const captchaIdMatch = response.body.match(/id=["']?([^"'\s>]+)["']?[^>]*CaptchaInputText/i);
        
        if (captchaMatch) {
            const captchaUrl = captchaMatch[1];
            // If it's a relative URL, make it absolute
            const fullUrl = captchaUrl.startsWith('http') ? captchaUrl : 'https://portal.aiub.edu' + captchaUrl;
            
            const imgResponse = await fetchWithCookies(fullUrl, 'GET', null, {}, cookies.join(';'), true);
            
            if (imgResponse.status === 200) {
                const base64 = imgResponse.body.toString('base64');
                return base64;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching CAPTCHA:', error);
        return null;
    }
}

// Main function to scrape AIUB courses
async function scrapeAIUBCourses(username, password, captchaText) {
    try {
        console.log('[AIUB Scraper] Starting login process...');
        
        // Step 1: Get login page and extract initial cookies + CAPTCHA
        let cookies = [];
        const loginPageRes = await fetchWithCookies('https://portal.aiub.edu/Login', 'GET');
        cookies.push(...loginPageRes.cookies);
        
        console.log('[AIUB Scraper] Login page fetched');

        // Step 2: Extract CSRF token and other form values from login page
        const csrfMatch = loginPageRes.body.match(/__RequestVerificationToken["\s]*value=["']([^"']+)["']/i);
        const csrfToken = csrfMatch ? csrfMatch[1] : '';

        if (!csrfToken) {
            console.warn('[AIUB Scraper] Warning: CSRF token not found, attempting login anyway...');
        }

        // Step 3: Submit login form
        const loginData = {
            UserId: username,
            Password: password,
            CaptchaInputText: captchaText,
            __RequestVerificationToken: csrfToken,
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
        console.log('[AIUB Scraper] Login attempt completed');

        // Check for login errors
        if (loginRes.body.includes('invalid') || loginRes.body.includes('failed') || loginRes.body.includes('error')) {
            if (loginRes.body.includes('captcha') || loginRes.body.includes('CAPTCHA')) {
                throw new Error('Invalid CAPTCHA text');
            }
            throw new Error('Login failed - Invalid credentials or CAPTCHA');
        }

        // Step 4: Navigate to offered courses page
        console.log('[AIUB Scraper] Fetching offered courses page...');
        const coursesPageRes = await fetchWithCookies(
            'https://portal.aiub.edu/Student/Section/Offered',
            'GET',
            null,
            { 'Referer': 'https://portal.aiub.edu/Login' },
            cookies.join(';')
        );

        if (coursesPageRes.status !== 200) {
            throw new Error('Failed to fetch courses page - you may not be authenticated');
        }

        // Step 5: Parse course table from HTML
        console.log('[AIUB Scraper] Parsing course data...');
        const coursesData = parseCoursesFromHTML(coursesPageRes.body);

        if (coursesData.length === 0) {
            throw new Error('No courses found - page structure may have changed');
        }

        console.log(`[AIUB Scraper] Scraped ${coursesData.length} courses`);

        // Convert to RoutinePro format
        const formattedCourses = formatCoursesForRoutinePro(coursesData);

        return {
            success: true,
            courses: formattedCourses,
            count: formattedCourses.length,
            message: `Successfully scraped ${formattedCourses.length} courses from AIUB portal`
        };

    } catch (error) {
        console.error('[AIUB Scraper] Error:', error);
        return {
            success: false,
            error: error.message,
            message: `Scraping failed: ${error.message}`
        };
    }
}

// Parse HTML table to extract course data
function parseCoursesFromHTML(html) {
    const courses = [];
    
    // Try to extract table data
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
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .trim();
                cells.push(cellText);
            }

            if (cells.length >= 6) {
                const courseData = {
                    classId: cells[0] || '',
                    code: cells[1] || '',
                    title: cells[2] || '',
                    section: cells[3] || '',
                    type: cells[4] || 'Theory',
                    day: cells[5] || '',
                    start: cells[6] || '',
                    end: cells[7] || '',
                    room: cells[8] || 'N/A',
                    status: cells[9] || 'Open',
                    capacity: cells[10] || '0',
                    count: cells[11] || '0',
                    dept: cells[12] || ''
                };

                if (courseData.classId && courseData.code && courseData.title) {
                    courses.push(courseData);
                }
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
                dept: raw.dept || 'N/A',
                sections: {}
            };
        }

        if (!coursesMap[key].sections[sectionName]) {
            coursesMap[key].sections[sectionName] = {
                id: raw.classId,
                section: sectionName,
                status: raw.status || 'Open',
                capacity: raw.capacity || '0',
                count: raw.count || '0',
                schedules: []
            };
        }

        if (raw.day && raw.start && raw.end) {
            coursesMap[key].sections[sectionName].schedules.push({
                day: normalizeDayName(raw.day),
                start: raw.start,
                end: raw.end,
                room: raw.room || 'N/A',
                type: raw.type || 'Theory'
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
    const normalized = {
        'Saturday': 'SAT',
        'Sunday': 'SUN',
        'Monday': 'MON',
        'Tuesday': 'TUE',
        'Wednesday': 'WED',
        'Thursday': 'THU',
        'Friday': 'FRI',
        'Sat': 'SAT',
        'Sun': 'SUN',
        'Mon': 'MON',
        'Tue': 'TUE',
        'Wed': 'WED',
        'Thu': 'THU',
        'Fri': 'FRI',
    };
    return normalized[day] || day.substring(0, 3).toUpperCase();
}

export default async function handler(request, response) {
    // Enable CORS if needed
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

    if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
        return response.status(200).end();
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password, captcha, action } = request.body;

    // For fetching CAPTCHA - future enhancement when we have a CAPTCHA service
    if (action === 'fetch-captcha') {
        // This would require integrating with AIUB's CAPTCHA service
        // For now, return a placeholder
        return response.status(200).json({
            success: true,
            captchaImage: '', // Empty placeholder - user needs to see actual CAPTCHA
            message: 'CAPTCHA service not yet available'
        });
    }

    if (!username || !password || !captcha) {
        return response.status(400).json({ 
            success: false, 
            error: 'Missing required fields: username, password, or captcha' 
        });
    }

    try {
        const result = await scrapeAIUBCourses(username, password, captcha);
        
        if (result.success) {
            return response.status(200).json(result);
        } else {
            return response.status(400).json(result);
        }
    } catch (error) {
        console.error('Handler error:', error);
        return response.status(500).json({
            success: false,
            error: 'Server error during scraping',
            message: error.message
        });
    }
}
