const { app, safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { getHardwareIdentity } = require('./hardware-fingerprint');

const PRODUCT_KEY = 'fund-annual-report';
const PRODUCT_NAME = '经费年报';
const API_BASE = 'https://jyj.yunbg.vip/api/license';
const CACHE_FILE_VERSION = 1;
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const OFFLINE_LICENSE_FILE = 'offline_license.lic';
const OFFLINE_LICENSE_FORMAT = 'yunbg.offline-license';
const OFFLINE_LICENSE_VERSION = 1;
const SAFE_PREFIX = 'enc:';
const PLAIN_PREFIX = 'b64:';

function getDefaultLicenseServerUrl() {
  try {
    const url = new URL(API_BASE);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://jyj.yunbg.vip';
  }
}

function getDataDir() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getConfigPath() {
  return path.join(getDataDir(), 'license_config.json');
}

function getCachePath() {
  return path.join(getDataDir(), 'license_cache.json');
}

function getOfflineLicensePath() {
  return path.join(getDataDir(), OFFLINE_LICENSE_FILE);
}

function readLicenseConfig() {
  try {
    const filePath = getConfigPath();
    if (!fs.existsSync(filePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLicenseConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
}

function encodeConfigText(value) {
  if (!value) return '';
  try {
    if (safeStorage?.isEncryptionAvailable?.()) {
      return SAFE_PREFIX + safeStorage.encryptString(value).toString('base64');
    }
  } catch {
    // fall through to local encoding
  }
  return PLAIN_PREFIX + Buffer.from(value, 'utf8').toString('base64');
}

function decodeConfigText(value) {
  if (!value) return '';
  try {
    if (value.startsWith(SAFE_PREFIX)) {
      return safeStorage?.decryptString
        ? safeStorage.decryptString(Buffer.from(value.slice(SAFE_PREFIX.length), 'base64'))
        : '';
    }
    if (value.startsWith(PLAIN_PREFIX)) {
      return Buffer.from(value.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
    }
    return value;
  } catch {
    return '';
  }
}

function normalizeServerUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function isAllowedLicenseServerUrl(url) {
  try {
    const parsed = new URL(normalizeServerUrl(url));
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol !== 'http:') return false;
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function getLicenseServerUrl() {
  const config = readLicenseConfig();
  const stored = config.server_url || config.serverUrl || '';
  if (typeof stored === 'string' && isAllowedLicenseServerUrl(stored)) {
    return normalizeServerUrl(stored);
  }
  return getDefaultLicenseServerUrl();
}

function getLicenseApiBaseUrl() {
  const serverUrl = getLicenseServerUrl();
  return serverUrl.endsWith('/api/license') ? serverUrl : `${serverUrl}/api/license`;
}

function normalizeLicenseKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64);
}

function normalizeCustomerName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 160);
}

function getSavedLicenseKey() {
  const config = readLicenseConfig();
  return normalizeLicenseKey(decodeConfigText(config.license_key || config.licenseKey || ''));
}

function saveLicenseKey(licenseKey) {
  const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
  if (!normalizedLicenseKey) throw new Error('授权码不能为空');
  writeLicenseConfig({
    ...readLicenseConfig(),
    product_key: PRODUCT_KEY,
    license_key: encodeConfigText(normalizedLicenseKey),
  });
}

function normalizePem(value) {
  return String(value || '').replace(/\\n/g, '\n').trim();
}

function saveOfflinePublicKey(publicKey) {
  const normalizedKey = normalizePem(publicKey);
  if (!normalizedKey || !normalizedKey.includes('BEGIN PUBLIC KEY')) return;
  writeLicenseConfig({
    ...readLicenseConfig(),
    offline_public_key: encodeConfigText(normalizedKey),
  });
}

function readOptionalTextFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  } catch {
    // ignore optional key file read failures
  }
  return '';
}

function getOfflinePublicKeys() {
  const config = readLicenseConfig();
  const envKeys = [
    process.env.GZNB_LICENSE_PUBLIC_KEY || '',
    ...(process.env.GZNB_LICENSE_PUBLIC_KEYS || '').split('-----END PUBLIC KEY-----')
      .map((chunk) => chunk.trim() ? `${chunk.trim()}-----END PUBLIC KEY-----` : ''),
  ];
  const fileKeys = [
    path.join(process.cwd(), 'license_public_key.pem'),
    path.join(app.getAppPath?.() || process.cwd(), 'license_public_key.pem'),
    path.join(path.dirname(app.getPath('exe') || process.cwd()), 'license_public_key.pem'),
  ].map(readOptionalTextFile);

  return Array.from(new Set([
    ...envKeys,
    decodeConfigText(config.offline_public_key || config.offlinePublicKey || ''),
    ...fileKeys,
  ].map(normalizePem).filter((key) => key.includes('BEGIN PUBLIC KEY'))));
}

function saveVerifiedLicenseMetadata(status) {
  const config = readLicenseConfig();
  const nextConfig = {
    ...config,
    product_key: PRODUCT_KEY,
    customer_name: status.customer_name || '',
    expires_at: status.expires_at || '',
    last_verified_at: status.checkedAt || new Date().toISOString(),
    last_server_time: status.server_time || config.last_server_time || config.lastServerTime,
  };
  if (status.valid && normalizeLicenseKey(status.license_key || '')) {
    nextConfig.license_key = encodeConfigText(normalizeLicenseKey(status.license_key));
    nextConfig.last_valid_result = {
      valid: status.valid,
      product_key: status.product_key,
      product_name: status.product_name,
      license_key: status.license_key,
      customer_code: status.customer_code,
      customer_name: status.customer_name,
      plan: status.plan,
      expires_at: status.expires_at,
      seats: status.seats,
      used_seats: status.used_seats,
      server_time: status.server_time,
    };
  }
  writeLicenseConfig(nextConfig);
}

function createEmptyCacheFile() {
  return { version: CACHE_FILE_VERSION, entries: {} };
}

function isLicenseCache(value) {
  return !!value && typeof value === 'object'
    && typeof value.valid === 'boolean'
    && typeof value.cachedAt === 'string';
}

function readCacheFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getCachePath(), 'utf8'));
    if (parsed?.version === CACHE_FILE_VERSION && parsed.entries && typeof parsed.entries === 'object') {
      const entries = {};
      for (const [cacheKey, cache] of Object.entries(parsed.entries)) {
        if (cacheKey && isLicenseCache(cache)) entries[cacheKey] = cache;
      }
      return { version: CACHE_FILE_VERSION, entries };
    }
  } catch {
    // invalid cache will be rebuilt
  }
  return createEmptyCacheFile();
}

function getCacheLookupKeys(value) {
  const licenseKey = normalizeLicenseKey(value || '');
  return licenseKey ? [licenseKey] : [];
}

function findCacheEntry(cacheFile, key) {
  const lookupKeys = getCacheLookupKeys(key);
  for (const lookupKey of lookupKeys) {
    if (cacheFile.entries[lookupKey]) return cacheFile.entries[lookupKey];
  }
  return Object.values(cacheFile.entries).find((entry) => {
    const entryKeys = [
      normalizeLicenseKey(entry.license_key || ''),
      normalizeLicenseKey(entry.customer_code || ''),
    ].filter(Boolean);
    return lookupKeys.some((lookupKey) => entryKeys.includes(lookupKey));
  }) || null;
}

function readCache(key) {
  const normalizedKey = normalizeLicenseKey(key);
  if (!normalizedKey) return null;
  return findCacheEntry(readCacheFile(), normalizedKey);
}

function writeCache(keys, cache) {
  const cacheKeys = new Set();
  for (const key of keys) {
    for (const lookupKey of getCacheLookupKeys(key)) cacheKeys.add(lookupKey);
  }
  if (!cacheKeys.size) return;

  try {
    const cacheFile = readCacheFile();
    for (const cacheKey of cacheKeys) cacheFile.entries[cacheKey] = cache;
    fs.writeFileSync(getCachePath(), JSON.stringify(cacheFile, null, 2), 'utf8');
  } catch (error) {
    console.warn('[License] 授权缓存写入失败:', error);
  }
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDateString(value) {
  const text = String(value || '').trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function isExpiryCurrent(expiresAt) {
  const date = normalizeDateString(expiresAt);
  return !!date && date >= getTodayDateString();
}

function isCacheFresh(cache) {
  const cachedAtTime = new Date(cache.cachedAt).getTime();
  const now = Date.now();
  return Number.isFinite(cachedAtTime)
    && cachedAtTime <= now + 5 * 60 * 1000
    && now - cachedAtTime < OFFLINE_GRACE_MS;
}

function isSystemClockRolledBack() {
  const config = readLicenseConfig();
  const trustedTime = config.last_server_time
    || config.lastServerTime
    || String(config.last_valid_result?.server_time || config.lastValidResult?.server_time || '');
  const trustedTimeMs = new Date(trustedTime).getTime();
  if (!Number.isFinite(trustedTimeMs)) return false;
  return Date.now() + 5 * 60 * 1000 < trustedTimeMs;
}

function getCurrentCacheStatus(cache) {
  if (!cache.valid) return { valid: false, reason: cache.reason || 'expired' };
  if (!isExpiryCurrent(cache.expires_at)) return { valid: false, reason: 'expired' };
  if (cache.source !== 'offline' && !cache.device_id) return { valid: false, reason: 'device_mismatch' };
  if (cache.source === 'offline') return { valid: true };
  if (!isCacheFresh(cache)) return { valid: false, reason: 'network_error' };
  if (isSystemClockRolledBack()) return { valid: false, reason: 'clock_rollback' };
  return { valid: true };
}

async function buildDevicePayload() {
  const identity = await getHardwareIdentity();
  const appName = typeof app.getName === 'function' ? app.getName() : PRODUCT_NAME;
  const appVersion = typeof app.getVersion === 'function' ? app.getVersion() : '';
  return {
    device_id: identity.deviceId,
    device_name: `${os.hostname()} / ${appName || PRODUCT_NAME}`.slice(0, 180),
    app_version: appVersion,
    hardware: identity.hardware.slice(0, 240),
  };
}

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .filter((key) => typeof value[key] !== 'undefined')
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(',')}}`;
}

function verifyOfflineSignature(payload, signature) {
  const publicKeys = getOfflinePublicKeys();
  if (!publicKeys.length) throw new Error('offline_key_missing');

  const signedPayload = Buffer.from(canonicalStringify(payload), 'utf8');
  const signatureBuffer = Buffer.from(String(signature || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return publicKeys.some((publicKey) => {
    try {
      return crypto.verify('sha256', signedPayload, publicKey, signatureBuffer);
    } catch {
      return false;
    }
  });
}

function normalizeDeviceId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

function offlineStatus(reason, message, payload = {}) {
  return {
    valid: false,
    source: 'offline',
    product_key: payload.product_key || PRODUCT_KEY,
    product_name: payload.product_name || PRODUCT_NAME,
    license_key: payload.license_key,
    customer_code: payload.customer_code,
    customer_name: payload.customer_name,
    plan: payload.plan,
    expires_at: payload.expires_at,
    seats: payload.seats,
    used_seats: payload.used_seats,
    features: payload.features,
    reason,
    message,
    cached: true,
    checkedAt: new Date().toISOString(),
  };
}

function validateOfflineLicenseEnvelope(envelope, deviceId) {
  const payload = envelope?.payload;
  if (!payload || typeof payload !== 'object') return offlineStatus('offline_invalid', '离线授权文件格式不正确');
  if (envelope.format !== OFFLINE_LICENSE_FORMAT) {
    return offlineStatus('offline_invalid', '离线授权文件不是统一授权格式', payload);
  }
  if (envelope.version && envelope.version !== OFFLINE_LICENSE_VERSION) {
    return offlineStatus('offline_invalid', '离线授权文件版本不受支持', payload);
  }

  const payloadLicenseKey = normalizeLicenseKey(payload.license_key || '');
  if (payload.product_key !== PRODUCT_KEY || !payloadLicenseKey) {
    return offlineStatus('missing_product_or_license', '离线授权文件缺少产品或授权码', payload);
  }

  const savedLicenseKey = getSavedLicenseKey();
  if (savedLicenseKey && payloadLicenseKey !== savedLicenseKey) {
    return offlineStatus('license_mismatch', '离线授权文件与当前授权码不一致', payload);
  }
  if (!normalizeDateString(payload.expires_at)) {
    return offlineStatus('offline_invalid', '离线授权文件缺少有效到期日期', payload);
  }
  if (isSystemClockRolledBack()) {
    return offlineStatus('clock_rollback', '检测到本机时间异常，请联网校验后继续使用。', payload);
  }
  const today = getTodayDateString();
  if (normalizeDateString(payload.not_before) && normalizeDateString(payload.not_before) > today) {
    return offlineStatus('offline_not_started', '离线授权尚未生效', payload);
  }
  if (normalizeDateString(payload.expires_at) < today) {
    return offlineStatus('expired', '离线授权已过期', payload);
  }

  const allowedDeviceIds = Array.isArray(payload.device_ids)
    ? payload.device_ids.map(normalizeDeviceId).filter(Boolean)
    : [];
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (allowedDeviceIds.length > 0 && !allowedDeviceIds.includes(normalizedDeviceId)) {
    return offlineStatus('device_mismatch', '离线授权文件不属于当前电脑', payload);
  }

  if (!envelope.signature) return offlineStatus('offline_invalid', '离线授权文件缺少签名', payload);
  try {
    if (!verifyOfflineSignature(payload, envelope.signature)) {
      return offlineStatus('offline_invalid', '离线授权文件签名无效', payload);
    }
  } catch (error) {
    if (error?.message === 'offline_key_missing') {
      return offlineStatus('offline_key_missing', '客户端缺少离线授权公钥，请先完成一次在线授权，或把 license_public_key.pem 放到软件目录。', payload);
    }
    return offlineStatus('offline_invalid', '离线授权文件验签失败', payload);
  }

  return {
    valid: true,
    source: 'offline',
    product_key: payload.product_key,
    product_name: payload.product_name || PRODUCT_NAME,
    license_key: payloadLicenseKey,
    customer_code: payload.customer_code,
    customer_name: payload.customer_name,
    plan: payload.plan,
    expires_at: normalizeDateString(payload.expires_at),
    seats: payload.seats,
    used_seats: payload.used_seats,
    features: payload.features && typeof payload.features === 'object' ? payload.features : undefined,
    cached: true,
    checkedAt: new Date().toISOString(),
    device_id: normalizedDeviceId,
  };
}

async function readOfflineLicenseStatus() {
  try {
    const offlinePath = getOfflineLicensePath();
    if (!fs.existsSync(offlinePath)) return null;
    const envelope = JSON.parse(fs.readFileSync(offlinePath, 'utf8'));
    const device = await buildDevicePayload();
    return validateOfflineLicenseEnvelope(envelope, device.device_id);
  } catch {
    return offlineStatus('offline_invalid', '离线授权文件读取失败');
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;
    const req = transport.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'GET',
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Invalid response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;
    const req = transport.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 10000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            reject(new Error('Invalid response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.write(data);
    req.end();
  });
}

function unwrapApiResult(result) {
  if (result?.data && typeof result.data === 'object') {
    return {
      ...result.data,
      valid: typeof result.data.valid === 'boolean' ? result.data.valid : result.valid,
      message: result.data.message || result.message,
      server_time: result.data.server_time || result.server_time,
      offline_public_key: result.data.offline_public_key || result.offline_public_key,
    };
  }
  return result || {};
}

function normalizeStatusReason(result) {
  if (typeof result?.reason === 'string' && result.reason) return result.reason;
  if (result?.found === false) return 'not_found';
  return undefined;
}

function toLicenseStatus(rawResult) {
  const result = unwrapApiResult(rawResult);
  const reason = normalizeStatusReason(result);
  return {
    valid: !!result.valid,
    source: 'online',
    product_key: result.product_key || PRODUCT_KEY,
    product_name: result.product_name || PRODUCT_NAME,
    license_key: normalizeLicenseKey(result.license_key || '') || undefined,
    customer_code: result.customer_code || result.canonical_school_code || result.school_code,
    customer_name: result.customer_name || result.school_name,
    plan: result.plan,
    expires_at: normalizeDateString(result.expires_at) || result.expires_at,
    seats: typeof result.seats === 'number' ? result.seats : undefined,
    used_seats: typeof result.used_seats === 'number' ? result.used_seats : undefined,
    features: result.features && typeof result.features === 'object' ? result.features : undefined,
    reason,
    message: result.message,
    cached: false,
    checkedAt: new Date().toISOString(),
    server_time: result.server_time,
  };
}

function isOnlineBlockingStatus(status) {
  return !status.valid && [
    'not_found',
    'expired',
    'disabled',
    'seat_limit',
    'device_disabled',
    'product_disabled',
    'missing_product_or_license',
  ].includes(status.reason || '');
}

async function fetchOnlineLicenseStatus(licenseKey) {
  const url = new URL(`${getLicenseApiBaseUrl()}/v2/status`);
  url.searchParams.set('product_key', PRODUCT_KEY);
  url.searchParams.set('license_key', licenseKey);
  const result = await httpGet(url.toString());
  const unwrapped = unwrapApiResult(result);
  if (typeof unwrapped.offline_public_key === 'string') saveOfflinePublicKey(unwrapped.offline_public_key);
  const status = toLicenseStatus(unwrapped);
  if (!status.license_key) status.license_key = licenseKey;
  return status;
}

function cacheFromStatus(status) {
  return {
    valid: status.valid,
    source: status.source || (status.cached ? 'cache' : 'online'),
    product_key: status.product_key || PRODUCT_KEY,
    product_name: status.product_name || PRODUCT_NAME,
    license_key: status.license_key,
    customer_code: status.customer_code,
    customer_name: status.customer_name,
    plan: status.plan,
    expires_at: status.expires_at,
    seats: status.seats,
    used_seats: status.used_seats,
    features: status.features,
    reason: status.reason,
    message: status.message,
    server_time: status.server_time,
    device_id: status.device_id,
    cachedAt: status.checkedAt || new Date().toISOString(),
  };
}

function statusFromCache(cache) {
  const currentStatus = getCurrentCacheStatus(cache);
  return {
    valid: currentStatus.valid,
    source: cache.source || 'cache',
    product_key: cache.product_key || PRODUCT_KEY,
    product_name: cache.product_name || PRODUCT_NAME,
    license_key: cache.license_key,
    customer_code: cache.customer_code,
    customer_name: cache.customer_name,
    plan: cache.plan,
    expires_at: cache.expires_at,
    seats: cache.seats,
    used_seats: cache.used_seats,
    features: cache.features,
    reason: currentStatus.reason,
    message: cache.message,
    cached: true,
    checkedAt: cache.cachedAt,
    server_time: cache.server_time,
    device_id: cache.device_id,
  };
}

function buildCacheKeys(requestedLicenseKey, status) {
  return [
    requestedLicenseKey,
    status.license_key || '',
    status.customer_code || '',
  ].filter(Boolean);
}

async function getLicenseDeviceInfo() {
  const device = await buildDevicePayload();
  return {
    product_key: PRODUCT_KEY,
    product_name: PRODUCT_NAME,
    license_key: getSavedLicenseKey() || undefined,
    ...device,
  };
}

async function exportMachineRequest(licenseKeyInput = '') {
  const info = await getLicenseDeviceInfo();
  const licenseKey = normalizeLicenseKey(licenseKeyInput || info.license_key || '');
  return {
    format: 'yunbg.license-request',
    version: 1,
    ...info,
    license_key: licenseKey || info.license_key,
    generated_at: new Date().toISOString(),
  };
}

async function importOfflineLicenseText(raw) {
  try {
    const envelope = JSON.parse(raw);
    const device = await buildDevicePayload();
    const status = validateOfflineLicenseEnvelope(envelope, device.device_id);
    if (!status.valid) return status;

    fs.writeFileSync(getOfflineLicensePath(), JSON.stringify(envelope, null, 2), 'utf8');
    const cache = cacheFromStatus(status);
    writeCache(buildCacheKeys(status.license_key || '', status), cache);
    saveVerifiedLicenseMetadata(status);
    return status;
  } catch (error) {
    return offlineStatus('offline_invalid', error?.message || '离线授权文件解析失败');
  }
}

async function claimTrialLicense(customerNameInput, customerCodeInput = '') {
  const customerName = normalizeCustomerName(customerNameInput);
  if (!customerName) {
    return {
      valid: false,
      product_key: PRODUCT_KEY,
      product_name: PRODUCT_NAME,
      reason: 'customer_required',
      message: '请先填写学校名称。',
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const device = await buildDevicePayload();
    const result = await httpPost(`${getLicenseApiBaseUrl()}/v2/trial`, {
      product_key: PRODUCT_KEY,
      customer_name: customerName,
      customer_code: normalizeCustomerName(customerCodeInput) || undefined,
      ...device,
    });
    const unwrapped = unwrapApiResult(result);
    if (typeof unwrapped.offline_public_key === 'string') saveOfflinePublicKey(unwrapped.offline_public_key);

    const status = toLicenseStatus(unwrapped);
    status.device_id = device.device_id;
    if (status.valid && status.license_key) {
      const cache = cacheFromStatus(status);
      writeCache(buildCacheKeys(status.license_key || '', status), cache);
      saveVerifiedLicenseMetadata(status);
    }
    return status;
  } catch (error) {
    return {
      valid: false,
      product_key: PRODUCT_KEY,
      product_name: PRODUCT_NAME,
      customer_name: customerName,
      reason: 'network_error',
      message: error?.message || '无法连接授权中心，请检查网络后重试。',
      cached: false,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function verifyLicense(licenseKeyInput = '') {
  const requestedLicenseKey = normalizeLicenseKey(licenseKeyInput || getSavedLicenseKey());
  if (!requestedLicenseKey) {
    const offline = await readOfflineLicenseStatus();
    if (offline?.valid) {
      const cache = cacheFromStatus(offline);
      writeCache(buildCacheKeys(offline.license_key || '', offline), cache);
      return offline;
    }
    return offline || {
      valid: false,
      product_key: PRODUCT_KEY,
      product_name: PRODUCT_NAME,
      reason: 'missing_product_or_license',
      message: '请输入授权码后校验。',
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const preflightStatus = await fetchOnlineLicenseStatus(requestedLicenseKey);
    if (isOnlineBlockingStatus(preflightStatus)) {
      const cache = cacheFromStatus(preflightStatus);
      writeCache(buildCacheKeys(requestedLicenseKey, preflightStatus), cache);
      saveVerifiedLicenseMetadata(preflightStatus);
      return preflightStatus;
    }

    const device = await buildDevicePayload();
    const result = await httpPost(`${getLicenseApiBaseUrl()}/v2/verify`, {
      product_key: PRODUCT_KEY,
      license_key: requestedLicenseKey,
      ...device,
    });
    const unwrapped = unwrapApiResult(result);
    if (typeof unwrapped.offline_public_key === 'string') saveOfflinePublicKey(unwrapped.offline_public_key);

    const status = toLicenseStatus(unwrapped);
    status.device_id = device.device_id;
    if (!status.license_key) status.license_key = requestedLicenseKey;

    const cache = cacheFromStatus(status);
    writeCache(buildCacheKeys(requestedLicenseKey, status), cache);
    saveVerifiedLicenseMetadata(status);
    return status;
  } catch {
    const offline = await readOfflineLicenseStatus();
    if (offline?.valid) {
      const cache = cacheFromStatus(offline);
      writeCache(buildCacheKeys(offline.license_key || requestedLicenseKey, offline), cache);
      return offline;
    }

    const cache = readCache(requestedLicenseKey);
    if (cache) return statusFromCache(cache);

    return offline || {
      valid: false,
      product_key: PRODUCT_KEY,
      product_name: PRODUCT_NAME,
      license_key: requestedLicenseKey,
      reason: 'network_error',
      message: '无法连接授权中心，请检查网络后重试。',
      cached: false,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function getCachedLicenseStatus() {
  const offline = await readOfflineLicenseStatus();
  if (offline?.valid) return offline;

  const savedLicenseKey = getSavedLicenseKey();
  const cache = savedLicenseKey ? readCache(savedLicenseKey) : null;
  let status;
  if (cache) {
    status = statusFromCache(cache);
  } else {
    status = offline || {
      valid: false,
      product_key: PRODUCT_KEY,
      product_name: PRODUCT_NAME,
      license_key: savedLicenseKey || undefined,
      reason: savedLicenseKey ? 'not_found' : 'missing_product_or_license',
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    const device = await buildDevicePayload();
    const cachedDeviceId = normalizeDeviceId(status.device_id);
    const currentDeviceId = normalizeDeviceId(device.device_id);
    if (status.valid && cachedDeviceId && cachedDeviceId !== currentDeviceId) {
      status = {
        ...status,
        valid: false,
        reason: 'device_mismatch',
        message: '授权缓存不属于当前电脑，请重新联网校验。',
        device_id: device.device_id,
      };
    } else if (!status.device_id) {
      status.device_id = device.device_id;
    }
  } catch {
    // Device info is non-critical for cached status display.
  }
  status.message = status.message || describeLicenseStatus(status);
  return status;
}

function isLicenseUsableStatus(status) {
  return !!status && status.valid && isExpiryCurrent(status.expires_at) && !isSystemClockRolledBack();
}

async function ensureUsableLicense() {
  const cachedStatus = await getCachedLicenseStatus();
  if (isLicenseUsableStatus(cachedStatus)) return cachedStatus;

  const savedLicenseKey = getSavedLicenseKey();
  if (savedLicenseKey && ['not_found', 'network_error', 'missing_product_or_license', 'device_mismatch'].includes(cachedStatus.reason || '')) {
    return verifyLicense(savedLicenseKey);
  }
  return cachedStatus;
}

function describeLicenseStatus(status = {}) {
  if (status.valid) {
    const suffix = status.expires_at ? `，有效期至 ${status.expires_at}` : '';
    return `授权有效${suffix}`;
  }
  if (status.message) return status.message;

  const reasonMap = {
    missing_product_or_license: '请输入授权码后校验。',
    not_found: '授权码无效，请联系管理员确认。',
    expired: '授权已到期，请联系管理员续费。',
    disabled: '授权已停用，请联系管理员。',
    seat_limit: '该授权已达到电脑数量上限，请联系管理员停用旧电脑或增加席位。',
    device_disabled: '当前电脑授权已被停用，请联系管理员。',
    product_disabled: '产品授权服务已停用。',
    device_mismatch: '离线授权文件不属于当前电脑。',
    license_mismatch: '离线授权文件与当前授权码不一致。',
    network_error: '无法连接授权中心，且本地没有可用离线授权。',
    clock_rollback: '检测到本机时间异常，请联网校验后继续使用。',
    offline_invalid: '离线授权文件无效。',
    offline_key_missing: '客户端缺少离线授权公钥。',
  };
  return reasonMap[status.reason] || '授权无效，请重新校验。';
}

module.exports = {
  PRODUCT_KEY,
  PRODUCT_NAME,
  getLicenseServerUrl,
  getLicenseApiBaseUrl,
  normalizeLicenseKey,
  getSavedLicenseKey,
  saveLicenseKey,
  getLicenseDeviceInfo,
  exportMachineRequest,
  importOfflineLicenseText,
  claimTrialLicense,
  verifyLicense,
  getCachedLicenseStatus,
  ensureUsableLicense,
  isLicenseUsableStatus,
  describeLicenseStatus,
};
