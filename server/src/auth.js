const crypto = require('crypto');
const { config } = require('./config');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// 桌面端接口令牌：Authorization: Bearer xxx 或 x-api-token 头
function requireApiToken(req, res, next) {
  if (!config.apiToken) {
    return res.status(503).json({ ok: false, message: '服务端未配置 API_TOKEN' });
  }
  const header = String(req.headers['authorization'] || '');
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = bearer || String(req.headers['x-api-token'] || '');
  if (!safeEqual(token, config.apiToken)) {
    return res.status(401).json({ ok: false, message: '接口令牌无效' });
  }
  return next();
}

// 极简 cookie 解析（避免额外依赖）
function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = val;
  }
  return out;
}

function isAdmin(req) {
  if (!config.adminToken) return false;
  const cookies = parseCookies(req);
  return safeEqual(cookies.admin_token, config.adminToken);
}

module.exports = { requireApiToken, isAdmin, safeEqual, parseCookies };
