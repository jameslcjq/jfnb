/**
 * auto-fill.js - 网报平台账号管理
 *
 * 验证码不做自动识别：该平台的验证码与服务器 Session 绑定，任何重新拉取图片的动作
 * 都会让页面上显示的图与服务器实际校验的值错位。登录时由用户看右侧 webview 手工输入。
 */

const path = require('path');
const fs = require('fs');
const { app, safeStorage } = require('electron');
const { normalizeSchoolName } = require('./name-normalize');

// ===== 学校账号管理 =====
const ACCOUNTS_FILE = () => path.join(app.getPath('userData'), 'school_accounts.json');

// 解密失败必须与“本来就没设密码”区分开。换机器、重装系统、管理员重置 Windows
// 登录密码都会让 DPAPI 密钥失效；若把失败当成空密码，下一次回写就会把所有学校的
// 网报密码一起存成空值，且不可恢复。
const DECRYPT_FAILED = Symbol('decrypt-failed');

/**
 * 读取账号原始记录（密码保持密文，不解密）。
 * 增删改都基于它：只改动目标那一条，其余记录的密文原样保留。
 */
function loadRawAccounts() {
  try {
    const filePath = ACCOUNTS_FILE();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(rawAccounts) {
  fs.writeFileSync(ACCOUNTS_FILE(), JSON.stringify(rawAccounts, null, 2), 'utf-8');
}

/**
 * 读取所有学校账号（密码已解密）
 */
function loadAccounts() {
  let needsMigration = false;
  let hasUndecryptable = false;
  const decrypted = loadRawAccounts().map((account) => {
    const stored = String(account?.password || '');
    if (stored && !stored.startsWith('enc:')) needsMigration = true;
    const plain = decryptPassword(stored);
    if (plain === DECRYPT_FAILED) {
      hasUndecryptable = true;
      return { ...account, password: '' };
    }
    return { ...account, password: plain };
  });
  // 只要有一条解不开就不做迁移：整表回写会把解不开的那几条写成空值。
  if (needsMigration && !hasUndecryptable && safeStorage?.isEncryptionAvailable?.()) {
    try { saveAccounts(decrypted); } catch { /* 迁移失败不影响本次读取 */ }
  }
  return decrypted;
}

/**
 * 保存学校账号列表（入参为明文密码，整表重新加密）。
 * 仅用于明文历史文件的一次性迁移；增删改请走 upsertAccount / deleteAccount。
 */
function saveAccounts(accounts) {
  writeAccounts((Array.isArray(accounts) ? accounts : []).map((account) => ({
    ...account,
    password: encryptPassword(account?.password || ''),
  })));
}

function encryptPassword(value) {
  const text = String(value || '');
  if (!text) return '';
  if (!safeStorage?.isEncryptionAvailable?.()) throw new Error('当前系统无法安全加密网报密码，已拒绝明文保存');
  return `enc:${safeStorage.encryptString(text).toString('base64')}`;
}

function decryptPassword(value) {
  const text = String(value || '');
  if (!text.startsWith('enc:')) return text;
  try {
    return safeStorage.decryptString(Buffer.from(text.slice(4), 'base64'));
  } catch {
    return DECRYPT_FAILED;
  }
}

/**
 * 添加或更新学校账号。
 * 学校名按共享归一化比对（与主进程的授权校验同一套），否则“X小学（分校）”和
 * “X小学分校”会被存成两条记录：界面上出现同一所学校的两个账号，自动登录可能
 * 用到作废的那份，删除时也只删掉其中一条。
 */
function upsertAccount(unitName, username, password) {
  const raw = loadRawAccounts();
  const key = normalizeSchoolName(unitName);
  const existing = raw.find((a) => normalizeSchoolName(a?.unitName) === key);
  if (existing) {
    existing.unitName = unitName;
    existing.username = username;
    existing.password = encryptPassword(password);
  } else {
    raw.push({ unitName, username, password: encryptPassword(password) });
  }
  writeAccounts(raw);
  return loadAccounts();
}

/**
 * 删除学校账号
 */
function deleteAccount(unitName) {
  const key = normalizeSchoolName(unitName);
  writeAccounts(loadRawAccounts().filter((a) => normalizeSchoolName(a?.unitName) !== key));
  return loadAccounts();
}

module.exports = {
  loadAccounts,
  saveAccounts,
  upsertAccount,
  deleteAccount,
};
