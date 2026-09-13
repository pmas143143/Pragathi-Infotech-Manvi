const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, ensureSchema } = require('./db');

const SESSION_TTL = 60 * 60 * 8;
const CSRF_TTL = SESSION_TTL;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILED = 5;

function randomToken(bytes = 32) { return crypto.randomBytes(bytes).toString('hex'); }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function csrfCookie(value, maxAge = CSRF_TTL) {
  return `pragathi_csrf=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function getCookie(req, name) {
  const h = req.headers.cookie || '';
  const m = h.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function getSessionToken(req) { return getCookie(req, 'pragathi_session'); }
function clientKey(req, username) {
  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown';
  return sha256(ip + '|' + String(username).toLowerCase());
}
function json(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(data));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 20000) req.destroy(new Error('Request too large')); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

async function rateStatus(sql, key) {
  const rows = await sql`SELECT failed_count, first_failed_at, blocked_until FROM login_attempts WHERE attempt_key=${key} LIMIT 1`;
  if (!rows.length) return { blocked: false };
  const r = rows[0];
  const now = Date.now();
  if (r.blocked_until && new Date(r.blocked_until).getTime() > now) {
    return { blocked: true, retry: Math.max(1, Math.ceil((new Date(r.blocked_until).getTime() - now) / 1000)) };
  }
  if (!r.first_failed_at || now - new Date(r.first_failed_at).getTime() > RATE_WINDOW_MS) {
    await sql`DELETE FROM login_attempts WHERE attempt_key=${key}`;
    return { blocked: false };
  }
  return { blocked: false };
}
async function recordFailure(sql, key) {
  const rows = await sql`SELECT failed_count, first_failed_at FROM login_attempts WHERE attempt_key=${key} LIMIT 1`;
  const now = new Date();
  if (!rows.length || !rows[0].first_failed_at || now.getTime() - new Date(rows[0].first_failed_at).getTime() > RATE_WINDOW_MS) {
    await sql`INSERT INTO login_attempts(attempt_key,failed_count,first_failed_at,blocked_until) VALUES(${key},1,NOW(),NULL) ON CONFLICT(attempt_key) DO UPDATE SET failed_count=1,first_failed_at=NOW(),blocked_until=NULL`;
    return 1;
  }
  const count = Number(rows[0].failed_count || 0) + 1;
  if (count >= MAX_FAILED) {
    await sql`UPDATE login_attempts SET failed_count=${count},blocked_until=NOW()+INTERVAL '15 minutes' WHERE attempt_key=${key}`;
  } else {
    await sql`UPDATE login_attempts SET failed_count=${count} WHERE attempt_key=${key}`;
  }
  return count;
}
async function clearFailures(sql, key) { await sql`DELETE FROM login_attempts WHERE attempt_key=${key}`; }

async function requireAuth(req, res) {
  const token = getSessionToken(req);
  if (!token) { json(res, 401, { ok: false, error: 'Not authenticated' }); return null; }
  const sql = db(); await ensureSchema(sql);
  const hash = sha256(token);
  const rows = await sql`
    SELECT a.id,a.username,a.password_changed_at,s.id AS session_id,s.csrf_token_hash,s.expires_at
    FROM admin_sessions s JOIN admin_users a ON a.id=s.admin_id
    WHERE s.token_hash=${hash} AND s.expires_at>NOW() LIMIT 1`;
  if (!rows.length) {
    json(res, 401, { ok: false, error: 'Session expired. Please log in again.' });
    return null;
  }
  return rows[0];
}
function requireCsrf(req, res) {
  const a = String(req.headers['x-csrf-token'] || '');
  const b = getCookie(req, 'pragathi_csrf');
  if (!a || !b || a !== b) { json(res, 403, { ok: false, error: 'Security token expired. Refresh the page and try again.' }); return false; }
  return true;
}

async function login(username, password, req, res) {
  const sql = db(); await ensureSchema(sql);
  const key = clientKey(req, username);
  const rate = await rateStatus(sql, key);
  if (rate.blocked) {
    res.setHeader('Retry-After', String(rate.retry));
    json(res, 429, { ok: false, error: `Too many failed attempts. Try again in ${Math.ceil(rate.retry / 60)} minute(s).` });
    return false;
  }

  const rows = await sql`SELECT id,username,password_hash FROM admin_users WHERE username=${username} LIMIT 1`;
  const valid = rows.length ? await bcrypt.compare(password, rows[0].password_hash) : false;
  if (!valid) {
    const count = await recordFailure(sql, key);
    if (count >= MAX_FAILED) {
      res.setHeader('Retry-After', String(LOCK_MS / 1000));
      json(res, 429, { ok: false, error: 'Too many failed attempts. Login is temporarily locked for 15 minutes.' });
    } else {
      json(res, 401, { ok: false, error: 'Invalid username or password.' });
    }
    return false;
  }

  await clearFailures(sql, key);
  const token = randomToken(32);
  const csrf = randomToken(24);
  const tokenHash = sha256(token);
  const csrfHash = sha256(csrf);
  await sql`DELETE FROM admin_sessions WHERE expires_at<=NOW() OR admin_id=${rows[0].id}`;
  await sql`INSERT INTO admin_sessions(admin_id,token_hash,csrf_token_hash,expires_at) VALUES(${rows[0].id},${tokenHash},${csrfHash},NOW()+INTERVAL '8 hours')`;
  json(res, 200, { ok: true, csrf, username: rows[0].username }, {
    'Set-Cookie': [cookie('pragathi_session', token, SESSION_TTL), csrfCookie(csrf)]
  });
  return true;
}

async function destroySession(req) {
  const token = getSessionToken(req); if (!token) return;
  const sql = db(); await ensureSchema(sql);
  await sql`DELETE FROM admin_sessions WHERE token_hash=${sha256(token)}`;
}

module.exports = {
  bcrypt, db, ensureSchema, randomToken, sha256, cookie, csrfCookie, getCookie, getSessionToken,
  json, body, requireAuth, requireCsrf, login, destroySession
};
