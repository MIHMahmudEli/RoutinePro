/**
 * api/index.js — Single dispatcher for all API routes
 *
 * Vercel counts this as ONE serverless function instead of 13.
 * Routes /api/<action> to lib/api-handlers/<action>.js
 * Frontend URLs are unchanged — no frontend edits needed.
 */

export const config = {
  maxDuration: 60, // covers extract (30s) and scraper actions
};

// Map of action names to lazy-loaded handler modules
const HANDLERS = {
  'check-auth':      () => import('../lib/api-handlers/check-auth.js'),
  'extract':         () => import('../lib/api-handlers/extract.js'),
  'get-config':      () => import('../lib/api-handlers/get-config.js'),
  'get-courses':     () => import('../lib/api-handlers/get-courses.js'),
  'get-metadata':    () => import('../lib/api-handlers/get-metadata.js'),
  'get-ramadan':     () => import('../lib/api-handlers/get-ramadan.js'),
  'get-share':       () => import('../lib/api-handlers/get-share.js'),
  'share':           () => import('../lib/api-handlers/share.js'),
  'update-config':   () => import('../lib/api-handlers/update-config.js'),
  'update-courses':  () => import('../lib/api-handlers/update-courses.js'),
  'update-ramadan':  () => import('../lib/api-handlers/update-ramadan.js'),
  'aiub-scraper-new':() => import('../lib/api-handlers/aiub-scraper-new.js'),
};

export default async function handler(req, res) {
  // Extract action from query parameter (passed via vercel.json rewrite) or URL path
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let action = url.searchParams.get('action');

  if (!action) {
    const urlPath = url.pathname;
    action = urlPath.split('/').filter(Boolean).pop();
  }

  // If the query parser didn't catch a subpath rewrite (e.g. check-auth?t=123)
  if (action && action.includes('?')) {
    action = action.split('?')[0];
  }

  if (!action || !HANDLERS[action]) {
    res.status(400).json({ error: `Unknown API route: "${action}"` });
    return;
  }

  try {
    const mod = await HANDLERS[action]();
    await mod.default(req, res);
  } catch (err) {
    console.error(`[dispatcher] Error in "${action}":`, err);
    if (!res.writableEnded) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
}
