const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { config } = require('./config');
const { numericControlKeys, toggleControlKeys } = require('./fields');
const { resolveSchoolMerge } = require('./school-merges');

let db = null;

function initDatabase() {
  if (db) return db;
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      unit_name TEXT NOT NULL,
      fill_code TEXT NOT NULL UNIQUE,
      merge_center TEXT,
      is_center INTEGER NOT NULL DEFAULT 0,
      contact TEXT,
      staff_count INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(year, unit_name)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      filler_name TEXT,
      filler_phone TEXT,
      note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_school ON submissions(school_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_year ON submissions(year);
    CREATE INDEX IF NOT EXISTS idx_schools_year ON schools(year);
  `);

  // 已上线旧库迁移：补列（幂等）
  try {
    const cols = db.pragma('table_info(schools)').map((c) => c.name);
    if (!cols.includes('staff_count')) db.exec('ALTER TABLE schools ADD COLUMN staff_count INTEGER');
    if (!cols.includes('active')) db.exec('ALTER TABLE schools ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  } catch { /* ignore */ }

  // 版本唯一约束：防止并发/多实例下同校同版本重复插入被重复汇总
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uniq_submissions_school_version ON submissions(school_id, version)');
  } catch { /* 旧库若已有重复数据则跳过，插入路径仍有事务保护 */ }

  return db;
}

function generateFillCode() {
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(8).toString('hex'); // 16 位十六进制
    const exists = db.prepare('SELECT 1 FROM schools WHERE fill_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('生成填表码失败，请重试');
}

// 幂等 upsert：同 (year, unit_name) 保留原 fill_code，仅更新合并关系/联系人/教职工数。
// 合并关系优先级：调用方显式提供（含显式 null=独立填报）> 内置规则。
// 只有当调用方未提供 mergeCenter 字段时才回退内置规则，保证桌面端拆组能真正生效。
function upsertSchool(params) {
  initDatabase();
  const { year, unitName, isCenter = false, contact = null, staffCount = null } = params || {};
  const name = String(unitName || '').trim();
  if (!name) throw new Error('学校名称不能为空');
  const yr = Number(year) || config.defaultYear;

  const mergeProvided = params && Object.prototype.hasOwnProperty.call(params, 'mergeCenter')
    && params.mergeCenter !== undefined;
  const builtInMerge = mergeProvided ? null : resolveSchoolMerge(name);
  const finalMergeCenter = mergeProvided
    ? (params.mergeCenter ? String(params.mergeCenter).trim() || null : null)
    : (builtInMerge?.mergeCenter || null);
  const finalIsCenter = !!(isCenter || (!mergeProvided && builtInMerge?.isCenter));
  const finalStaffCount = Number.isFinite(Number(staffCount)) && Number(staffCount) > 0
    ? Math.round(Number(staffCount)) : null;

  const existing = db.prepare('SELECT * FROM schools WHERE year = ? AND unit_name = ?').get(yr, name);
  if (existing) {
    db.prepare('UPDATE schools SET merge_center = ?, is_center = ?, contact = ?, staff_count = COALESCE(?, staff_count), active = 1 WHERE id = ?')
      .run(finalMergeCenter, finalIsCenter ? 1 : 0, contact || null, finalStaffCount, existing.id);
    return db.prepare('SELECT * FROM schools WHERE id = ?').get(existing.id);
  }

  const code = generateFillCode();
  const info = db.prepare(
    'INSERT INTO schools (year, unit_name, fill_code, merge_center, is_center, contact, staff_count, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  ).run(yr, name, code, finalMergeCenter, finalIsCenter ? 1 : 0, contact || null, finalStaffCount);
  return db.prepare('SELECT * FROM schools WHERE id = ?').get(info.lastInsertRowid);
}

// 名单同步：先整体校验、后单事务写入，避免部分写入。
// snapshot=true 时按“年度快照对账”：本轮未出现的学校停用（active=0），
// 撤销/拆除的学校随之从填表页、看板和成员数中消失。
function syncSchools({ year, schools, snapshot = false }) {
  initDatabase();
  const yr = Number(year) || config.defaultYear;
  if (!Array.isArray(schools) || schools.length === 0) throw new Error('名单为空');

  const seen = new Set();
  const normalized = [];
  for (let i = 0; i < schools.length; i++) {
    const item = schools[i];
    if (!item || typeof item !== 'object') throw new Error(`名单第 ${i + 1} 项格式不正确`);
    const name = String(item.unitName || item.unit_name || '').trim();
    if (!name) throw new Error(`名单第 ${i + 1} 项缺少学校名称`);
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = {
      year: yr,
      unitName: name,
      isCenter: !!(item.isCenter || item.is_center),
      contact: item.contact || null,
      staffCount: item.staffCount ?? item.staff_count ?? null,
    };
    if (Object.prototype.hasOwnProperty.call(item, 'mergeCenter') || Object.prototype.hasOwnProperty.call(item, 'merge_center')) {
      entry.mergeCenter = item.mergeCenter !== undefined ? item.mergeCenter : item.merge_center;
    }
    normalized.push(entry);
  }

  const run = db.transaction(() => {
    const out = normalized.map((entry) => upsertSchool(entry));
    let deactivated = 0;
    if (snapshot) {
      const placeholders = normalized.map(() => '?').join(',');
      const info = db.prepare(
        `UPDATE schools SET active = 0 WHERE year = ? AND active = 1 AND unit_name NOT IN (${placeholders})`
      ).run(yr, ...normalized.map((e) => e.unitName));
      deactivated = info.changes;
    }
    return { out, deactivated };
  });
  const { out, deactivated } = run();
  return { year: yr, schools: out, deactivated };
}

function getSchoolByCode(code) {
  initDatabase();
  return db.prepare('SELECT * FROM schools WHERE fill_code = ?').get(String(code || '')) || null;
}

function listSchools(year, options = {}) {
  initDatabase();
  const activeFilter = options.includeInactive ? '' : 'AND active = 1';
  return db.prepare(`SELECT * FROM schools WHERE year = ? ${activeFilter} ORDER BY merge_center IS NULL, merge_center, is_center DESC, unit_name`)
    .all(Number(year) || config.defaultYear);
}

function getLatestSubmission(schoolId) {
  initDatabase();
  return db.prepare('SELECT * FROM submissions WHERE school_id = ? ORDER BY version DESC LIMIT 1').get(schoolId) || null;
}

function insertSubmission({ schoolId, year, controls, meta }) {
  initDatabase();
  // 版本分配和插入放同一事务，配合 (school_id, version) 唯一索引；
  // 多进程/新旧实例并发冲突时重试，避免重复版本被重复汇总。
  const attempt = db.transaction(() => {
    const row = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM submissions WHERE school_id = ?').get(schoolId);
    const version = (row?.v || 0) + 1;
    const info = db.prepare(
      'INSERT INTO submissions (school_id, year, payload_json, filler_name, filler_phone, note, version) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      schoolId,
      Number(year) || config.defaultYear,
      JSON.stringify(controls),
      meta.filler_name || null,
      meta.filler_phone || null,
      meta.note || null,
      version
    );
    return db.prepare('SELECT * FROM submissions WHERE id = ?').get(info.lastInsertRowid);
  });

  let lastError = null;
  for (let i = 0; i < 5; i++) {
    try {
      return attempt();
    } catch (error) {
      lastError = error;
      if (!String(error.code || '').startsWith('SQLITE_CONSTRAINT')) throw error;
    }
  }
  throw lastError;
}

function mapSubmissionRow(r) {
  return {
    submissionId: r.id,
    unitName: r.unit_name,
    mergeCenter: r.merge_center,
    isCenter: !!r.is_center,
    year: r.year,
    version: r.version,
    submittedAt: r.created_at,
    filler: { name: r.filler_name, phone: r.filler_phone },
    note: r.note,
    controls: safeParse(r.payload_json),
  };
}

function mergeSubmissionControls(rows) {
  const numericKeys = numericControlKeys();
  const toggleKeys = toggleControlKeys();
  const controls = {};

  // 金额按“分”整数累加再换回元，避免浮点累加误差（0.1+0.2 问题）
  const cents = {};
  for (const key of numericKeys) cents[key] = 0;
  for (const key of toggleKeys) controls[key] = false;

  for (const row of rows) {
    const source = safeParse(row.payload_json);
    for (const key of numericKeys) {
      const value = Number(source[key] || 0);
      if (Number.isFinite(value)) cents[key] += Math.round(value * 100);
    }
    for (const key of toggleKeys) {
      controls[key] = controls[key] || !!source[key];
    }
  }

  for (const key of numericKeys) controls[key] = cents[key] / 100;
  return controls;
}

function latestText(rows, key) {
  const sorted = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return sorted[0]?.[key] || null;
}

function countGroupMembers(year) {
  initDatabase();
  const rows = db.prepare(`
    SELECT merge_center, COUNT(*) AS count
    FROM schools
    WHERE year = ? AND merge_center IS NOT NULL AND active = 1
    GROUP BY merge_center
  `).all(Number(year) || config.defaultYear);
  return new Map(rows.map((row) => [row.merge_center, row.count]));
}

function aggregateLatestSubmissions(rows, year, since, sinceId) {
  const groups = new Map();
  const independentRows = [];
  for (const row of rows) {
    if (row.merge_center) {
      if (!groups.has(row.merge_center)) groups.set(row.merge_center, []);
      groups.get(row.merge_center).push(row);
    } else {
      independentRows.push(row);
    }
  }

  const memberCounts = countGroupMembers(year);
  const out = independentRows
    .filter((row) => (!since || row.created_at > since) && (!sinceId || row.id > sinceId))
    .map((row) => ({ ...mapSubmissionRow(row), aggregated: false }));

  for (const [center, members] of groups.entries()) {
    const submittedAt = members.reduce((max, row) => (String(row.created_at) > String(max) ? row.created_at : max), '');
    const maxRowId = members.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    if (since && submittedAt <= since) continue;
    if (sinceId && maxRowId <= sinceId) continue;
    const centerRow = members.find((row) => row.unit_name === center);
    out.push({
      unitName: center,
      mergeCenter: center,
      isCenter: true,
      year: Number(year) || config.defaultYear,
      version: Math.max(...members.map((row) => Number(row.version || 0))),
      submittedAt,
      filler: {
        name: latestText(members, 'filler_name'),
        phone: latestText(members, 'filler_phone'),
      },
      note: members
        .filter((row) => row.note)
        .map((row) => `${row.unit_name}：${row.note}`)
        .join('\n'),
      controls: mergeSubmissionControls(members),
      aggregated: true,
      memberCount: memberCounts.get(center) || members.length,
      submittedMemberCount: members.length,
      sourceUnitNames: members.map((row) => row.unit_name),
      members: members.map(mapSubmissionRow),
      centerSubmitted: !!centerRow,
    });
  }

  return out.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

// 每校最新一次提交（供桌面端拉取），默认按合并中心园汇总；mode=raw 可取明细。
// 只统计 active=1 的学校（快照对账停用的学校连同其历史提交一并排除）。
// 增量优先用 sinceId（提交自增 id，单调、无同秒漏单问题）；since（秒级时间）仅作兼容。
function listLatestSubmissions(year, since, options = {}) {
  initDatabase();
  const yr = Number(year) || config.defaultYear;
  const sinceId = Number(options.sinceId) > 0 ? Number(options.sinceId) : null;
  const rows = db.prepare(`
    SELECT sub.id, sub.school_id, sub.year, sub.payload_json, sub.filler_name, sub.filler_phone,
           sub.note, sub.version, sub.created_at,
           sc.unit_name, sc.merge_center, sc.is_center
    FROM submissions sub
    JOIN schools sc ON sc.id = sub.school_id AND sc.active = 1
    JOIN (SELECT school_id, MAX(version) AS v FROM submissions WHERE year = ? GROUP BY school_id) latest
      ON latest.school_id = sub.school_id AND latest.v = sub.version
    WHERE sub.year = ?
    ORDER BY sub.created_at DESC
  `).all(yr, yr);

  if (options.raw) {
    return rows
      .filter((r) => (!since || r.created_at > since) && (!sinceId || r.id > sinceId))
      .map(mapSubmissionRow);
  }
  return aggregateLatestSubmissions(rows, yr, since, sinceId);
}

// 当前年度提交流水的最大自增 id，作为下次增量拉取的游标（cursor）
function latestSubmissionId(year) {
  initDatabase();
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) AS max_id FROM submissions WHERE year = ?')
    .get(Number(year) || config.defaultYear);
  return row?.max_id || 0;
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return {}; }
}

function closeDatabase() {
  if (db) { db.close(); db = null; }
}

module.exports = {
  initDatabase,
  upsertSchool,
  syncSchools,
  getSchoolByCode,
  listSchools,
  getLatestSubmission,
  insertSubmission,
  listLatestSubmissions,
  latestSubmissionId,
  closeDatabase,
};
