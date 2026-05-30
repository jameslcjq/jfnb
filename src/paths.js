const fs = require('fs');
const path = require('path');

const SOFTWARE_DIR = 'D:\\laojiu\\gznb';
const DATA_DIR = process.env.GZNB_DATA_DIR || 'D:\\laojiu\\gzdata';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function copyFileIfMissing(from, to) {
  try {
    if (!from || !fs.existsSync(from) || fs.existsSync(to)) return;
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
  } catch {
    // 迁移失败不能阻止程序启动。
  }
}

function copyDirIfMissing(from, to) {
  try {
    if (!from || !fs.existsSync(from) || fs.existsSync(to)) return;
    fs.cpSync(from, to, { recursive: true });
  } catch {
    // 迁移失败不能阻止程序启动。
  }
}

function migrateLegacyUserData(app, dataDir) {
  const legacyDir = app.getPath('userData');
  if (!legacyDir || path.resolve(legacyDir) === path.resolve(dataDir)) return;

  for (const file of [
    'config.json',
    'reports.db',
    'reports.db-shm',
    'reports.db-wal',
    'school_accounts.json',
  ]) {
    copyFileIfMissing(path.join(legacyDir, file), path.join(dataDir, file));
  }

  copyDirIfMissing(path.join(legacyDir, 'logs'), path.join(dataDir, 'logs'));
}

function configureAppPaths(app) {
  const dataDir = ensureDir(DATA_DIR);
  migrateLegacyUserData(app, dataDir);
  app.setPath('userData', dataDir);
  return dataDir;
}

function ensureDataDir() {
  return ensureDir(DATA_DIR);
}

module.exports = {
  SOFTWARE_DIR,
  DATA_DIR,
  configureAppPaths,
  ensureDataDir,
};
