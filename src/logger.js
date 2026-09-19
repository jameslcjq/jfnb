const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logDir = null;

function ensureLogDir() {
  if (!logDir) {
    logDir = path.join(app.getPath('userData'), 'logs');
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

// 日志按天分文件，长期运行会无限累积。每天首次写入时清掉过期文件。
const LOG_RETENTION_DAYS = 30;
let prunedForDate = '';

function pruneOldLogs(dir, today) {
  if (prunedForDate === today) return;
  prunedForDate = today;
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(dir)) {
      const match = /^app-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
      if (!match) continue;
      if (new Date(`${match[1]}T00:00:00Z`).getTime() >= cutoff) continue;
      try { fs.unlinkSync(path.join(dir, name)); } catch { /* 清理失败不影响写日志 */ }
    }
  } catch { /* 目录不可读时跳过 */ }
}

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10);
  const dir = ensureLogDir();
  pruneOldLogs(dir, date);
  return path.join(dir, `app-${date}.log`);
}

function format(level, message, meta) {
  const time = new Date().toISOString();
  const text = typeof message === 'string' ? message : JSON.stringify(message);
  const extra = meta === undefined ? '' : ` ${safeStringify(meta)}`;
  return `[${time}] [${level}] ${text}${extra}\n`;
}

function safeStringify(value) {
  try {
    if (value instanceof Error) {
      return JSON.stringify({ message: value.message, stack: value.stack });
    }
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function write(level, message, meta) {
  try {
    fs.appendFileSync(getLogFilePath(), format(level, message, meta), 'utf8');
  } catch {
    // 日志失败不能影响主业务
  }
}

module.exports = {
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta),
  debug: (message, meta) => write('DEBUG', message, meta),
  getLogDir: () => ensureLogDir(),
  getLogFilePath,
};
