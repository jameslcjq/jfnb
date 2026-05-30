const path = require('path');

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

function sanitizeFileName(value, fallback = '未命名单位') {
  let name = String(value || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!name || name === '.' || name === '..') name = fallback;
  if (WINDOWS_RESERVED_NAMES.has(name.toUpperCase())) name = `${name}_`;
  return name.slice(0, 120);
}

function normalizeBaseDir(baseDir) {
  if (!baseDir) throw new Error('缺少基础目录');
  return path.resolve(baseDir);
}

function isPathInside(baseDir, targetPath) {
  const base = normalizeBaseDir(baseDir);
  const target = path.resolve(targetPath);
  const baseCompare = process.platform === 'win32' ? base.toLowerCase() : base;
  const targetCompare = process.platform === 'win32' ? target.toLowerCase() : target;
  return targetCompare === baseCompare || targetCompare.startsWith(baseCompare + path.sep);
}

function resolveInside(baseDir, ...segments) {
  const base = normalizeBaseDir(baseDir);
  const target = path.resolve(base, ...segments);
  if (!isPathInside(base, target)) {
    throw new Error(`目标路径超出允许目录：${target}`);
  }
  return target;
}

function assertPathInsideAny(baseDirs, targetPath) {
  const roots = (baseDirs || []).filter(Boolean);
  if (!roots.some((baseDir) => isPathInside(baseDir, targetPath))) {
    throw new Error(`目标路径不在允许目录内：${targetPath}`);
  }
  return path.resolve(targetPath);
}

module.exports = {
  sanitizeFileName,
  isPathInside,
  resolveInside,
  assertPathInsideAny,
};
