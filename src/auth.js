const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const DEFAULT_USERNAME = 'admin';
const INITIAL_PASSWORD = '123456';

let currentUser = null;

function normalizeUsername(username) {
  return String(username || '').trim();
}

function credentialPath() {
  return path.join(app.getPath('userData'), 'auth.json');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password || ''), salt, 32).toString('hex');
}

function readCredential() {
  try {
    const parsed = JSON.parse(fs.readFileSync(credentialPath(), 'utf8'));
    if (parsed?.username && parsed?.salt && parsed?.passwordHash) return parsed;
  } catch { /* first run */ }
  return null;
}

function passwordMatches(password, credential) {
  if (!credential) return String(password || '') === INITIAL_PASSWORD;
  const actual = Buffer.from(hashPassword(password, credential.salt), 'hex');
  const expected = Buffer.from(String(credential.passwordHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function login(username, password) {
  const normalizedUsername = normalizeUsername(username);
  const credential = readCredential();
  if (normalizedUsername === (credential?.username || DEFAULT_USERNAME) && passwordMatches(password, credential)) {
    currentUser = {
      username: DEFAULT_USERNAME,
      displayName: '管理员',
      role: 'admin',
      loggedInAt: new Date().toISOString(),
    };
    return { ok: true, user: currentUser, mustChangePassword: !credential };
  }

  return { ok: false, message: '用户名或密码错误' };
}

function changePassword(currentPassword, newPassword) {
  if (!currentUser) return { ok: false, message: '请先登录' };
  const credential = readCredential();
  if (!passwordMatches(currentPassword, credential)) return { ok: false, message: '当前密码不正确' };
  const next = String(newPassword || '');
  if (next.length < 8) return { ok: false, message: '新密码至少 8 位' };
  if (next === INITIAL_PASSWORD) return { ok: false, message: '新密码不能继续使用初始密码' };
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(credentialPath(), JSON.stringify({
    version: 1,
    username: currentUser.username,
    salt,
    passwordHash: hashPassword(next, salt),
    updatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
  return { ok: true };
}

function logout() {
  currentUser = null;
  return { ok: true };
}

function isLoggedIn() {
  return Boolean(currentUser);
}

function getStatus() {
  return {
    ok: true,
    loggedIn: isLoggedIn(),
    user: currentUser,
  };
}

module.exports = {
  login,
  logout,
  isLoggedIn,
  getStatus,
  changePassword,
};
