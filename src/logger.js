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

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(ensureLogDir(), `app-${date}.log`);
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
