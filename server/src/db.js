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

  // 已上线旧库迁移：补 staff_count 列
  try {
    const cols = db.pragma('table_info(schools)').map((c) => c.name);
    if (!cols.includes('staff_count')) db.exec('ALTER TABLE schools ADD COLUMN staff_count INTEGER');
  } catch { /* ignore */ }

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

// 幂等 upsert：同 (year, unit_name) 保留原 fill_code，仅更新合并关系/联系人/教职工数
function upsertSchool({ year, unitName, mergeCenter = null, isCenter = false, contact = null, staffCount = null }) {
  initDatabase();
  const name = String(unitName || '').trim();
  if (!name) throw new Error('学校名称不能为空');
  const yr = Number(year) || config.defaultYear;
  const builtInMerge = resolveSchoolMerge(name);
  const finalMergeCenter = mergeCenter || builtInMerge?.mergeCenter || null;
  const finalIsCenter = !!(isCenter || builtInMerge?.isCenter);
  const finalStaffCount = Number.isFinite(Number(staffCount)) && Number(staffCount) > 0
    ? Math.round(Number(staffCount)) : null;

  const existing = db.prepare('SELECT * FROM schools WHERE year = ? AND unit_name = ?').get(yr, name);
  if (existing) {
    db.prepare('UPDATE schools SET merge_center = ?, is_center = ?, contact = ?, staff_count = COALESCE(?, staff_count) WHERE id = ?')
      .run(finalMergeCenter, finalIsCenter ? 1 : 0, contact || null, finalStaffCount, existing.id);
    return db.prepare('SELECT * FROM schools WHERE id = ?').get(existing.id);
  }

  const code = generateFillCode();
  const info = db.prepare(
    'INSERT INTO schools (year, unit_name, fill_code, merge_center, is_center, contact, staff_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(yr, name, code, finalMergeCenter, finalIsCenter ? 1 : 0, contact || null, finalStaffCount);
  return db.prepare('SELECT * FROM schools WHERE id = ?').get(info.lastInsertRowid);
}

function getSchoolByCode(code) {
  initDatabase();
  return db.prepare('SELECT * FROM schools WHERE fill_code = ?').get(String(code || '')) || null;
}

function listSchools(year) {
  initDatabase();
  return db.prepare('SELECT * FROM schools WHERE year = ? ORDER BY merge_center IS NULL, merge_center, is_center DESC, unit_name')
    .all(Number(year) || config.defaultYear);
}

function getLatestSubmission(schoolId) {
  initDatabase();
  return db.prepare('SELECT * FROM submissions WHERE school_id = ? ORDER BY version DESC LIMIT 1').get(schoolId) || null;
}

function insertSubmission({ schoolId, year, controls, meta }) {
  initDatabase();
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
}

function mapSubmissionRow(r) {
  return {
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

  for (const key of numericKeys) controls[key] = 0;
  for (const key of toggleKeys) controls[key] = false;

  for (const row of rows) {
    const source = safeParse(row.payload_json);
    for (const key of numericKeys) {
      const value = Number(source[key] || 0);
      if (Number.isFinite(value)) controls[key] += value;
    }
    for (const key of toggleKeys) {
      controls[key] = controls[key] || !!source[key];
    }
  }

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
    WHERE year = ? AND merge_center IS NOT NULL
    GROUP BY merge_center
  `).all(Number(year) || config.defaultYear);
  return new Map(rows.map((row) => [row.merge_center, row.count]));
}

function aggregateLatestSubmissions(rows, year, since) {
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
    .filter((row) => !since || row.created_at > since)
    .map((row) => ({ ...mapSubmissionRow(row), aggregated: false }));

  for (const [center, members] of groups.entries()) {
    const submittedAt = members.reduce((max, row) => (String(row.created_at) > String(max) ? row.created_at : max), '');
    if (since && submittedAt <= since) continue;
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

// 每校最新一次提交（供桌面端拉取），默认按合并中心园汇总；mode=raw 可取明细
function listLatestSubmissions(year, since, options = {}) {
  initDatabase();
  const yr = Number(year) || config.defaultYear;
  const rows = db.prepare(`
    SELECT sub.id, sub.school_id, sub.year, sub.payload_json, sub.filler_name, sub.filler_phone,
           sub.note, sub.version, sub.created_at,
           sc.unit_name, sc.merge_center, sc.is_center
    FROM submissions sub
    JOIN schools sc ON sc.id = sub.school_id
    JOIN (SELECT school_id, MAX(version) AS v FROM submissions WHERE year = ? GROUP BY school_id) latest
      ON latest.school_id = sub.school_id AND latest.v = sub.version
    WHERE sub.year = ?
    ORDER BY sub.created_at DESC
  `).all(yr, yr);

  if (options.raw) {
    return (since ? rows.filter((r) => r.created_at > since) : rows).map(mapSubmissionRow);
  }
  return aggregateLatestSubmissions(rows, yr, since);
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
  getSchoolByCode,
  listSchools,
  getLatestSubmission,
  insertSubmission,
  listLatestSubmissions,
  closeDatabase,
};
