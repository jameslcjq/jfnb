// 每日备份：用 VACUUM INTO 生成一致性快照（自动处理 WAL），保留最近 14 天。
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('../src/config');

const KEEP_DAYS = 14;

function backup() {
  if (!fs.existsSync(config.dbPath)) {
    console.error(`数据库不存在：${config.dbPath}`);
    process.exit(1);
  }
  // 默认放数据库同级 backups/（自定义 DB_PATH 时不会写到意外的父目录）；可用 BACKUP_DIR 覆盖
  const backupDir = process.env.BACKUP_DIR
    ? String(process.env.BACKUP_DIR)
    : path.join(path.dirname(config.dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  // 备份前验证可写，失败时给出明确报错而不是静默
  const probe = path.join(backupDir, `.write-test-${process.pid}`);
  try {
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (error) {
    console.error(`备份目录不可写：${backupDir}（${error.message}）`);
    process.exit(1);
  }

  // 同一天重复执行也保留独立快照，避免先删除当天旧备份后新备份失败造成空档。
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `collect-${stamp}.db`);

  const source = new Database(config.dbPath, { readonly: true });
  source.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  source.close();
  console.log(`已备份到 ${dest}`);

  // 清理过期备份
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  for (const name of fs.readdirSync(backupDir)) {
    if (!/^collect-\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3}Z)?\.db$/.test(name)) continue;
    const full = path.join(backupDir, name);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      console.log(`已删除过期备份 ${name}`);
    }
  }
}

backup();
