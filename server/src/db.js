const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { config } = require('./config');
const { numericControlKeys, toggleControlKeys, normalizeSchoolStage } = require('./fields');
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
      school_code TEXT,
      stage TEXT,
      merge_center TEXT,
      is_center INTEGER NOT NULL DEFAULT 0,
      contact TEXT,
      staff_count INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      collect_enabled INTEGER NOT NULL DEFAULT 0,
      collect_scope TEXT NOT NULL DEFAULT 'full',
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
      source TEXT NOT NULL DEFAULT 'web',
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
    if (!cols.includes('school_code')) db.exec('ALTER TABLE schools ADD COLUMN school_code TEXT');
    if (!cols.includes('stage')) db.exec('ALTER TABLE schools ADD COLUMN stage TEXT');
    if (!cols.includes('staff_count')) db.exec('ALTER TABLE schools ADD COLUMN staff_count INTEGER');
    if (!cols.includes('active')) db.exec('ALTER TABLE schools ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
    if (!cols.includes('collect_enabled')) {
      db.exec("ALTER TABLE schools ADD COLUMN collect_enabled INTEGER NOT NULL DEFAULT 0");
      // 存量库首次迁移：合并组学校（有 merge_center）默认纳入采集，其余默认关闭
      db.exec('UPDATE schools SET collect_enabled = 1 WHERE merge_center IS NOT NULL');
    }
    if (!cols.includes('collect_scope')) db.exec("ALTER TABLE schools ADD COLUMN collect_scope TEXT NOT NULL DEFAULT 'full'");
    const subCols = db.pragma('table_info(submissions)').map((c) => c.name);
    if (!subCols.includes('source')) db.exec("ALTER TABLE submissions ADD COLUMN source TEXT NOT NULL DEFAULT 'web'");
  } catch { /* ignore */ }

  // 版本唯一约束：防止并发/多实例下同校同版本重复插入被重复汇总
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uniq_submissions_school_version ON submissions(school_id, version)');
  } catch { /* 旧库若已有重复数据则跳过，插入路径仍有事务保护 */ }

  // 旧版 fillCode 只有 64 位。升级时轮换为 128 位随机码，避免专属链接可被枚举。
  const weakCodes = db.prepare('SELECT id, fill_code FROM schools').all()
    .filter((row) => !/^[0-9a-f]{32}$/.test(String(row.fill_code || '')));
  const rotate = db.prepare('UPDATE schools SET fill_code = ? WHERE id = ?');
  const rotateAll = db.transaction(() => {
    for (const row of weakCodes) rotate.run(generateFillCode(), row.id);
  });
  if (weakCodes.length > 0) rotateAll();

  return db;
}

function generateFillCode() {
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(16).toString('hex'); // 128 位随机码（32 位十六进制）
    const exists = db.prepare('SELECT 1 FROM schools WHERE fill_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('生成填表码失败，请重试');
}

// 幂等 upsert：同 (year, unit_name) 保留原 fill_code，仅更新合并关系/联系人/教职工数。
// 合并关系优先级：调用方显式提供（含显式 null=独立填报）> 内置规则。
// 只有当调用方未提供 mergeCenter 字段时才回退内置规则，保证桌面端拆组能真正生效。
function upsertSchool(params, options = {}) {
  initDatabase();
  const allowCreate = options.allowCreate !== false;
  const allowReactivate = options.allowReactivate !== false;
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
  const finalSchoolCode = String(params?.schoolCode || params?.school_code || builtInMerge?.schoolCode || '').trim() || null;
  const finalStage = String(params?.stage || params?.schoolStage || params?.school_stage || '').trim() || null;
  const finalStaffCount = Number.isFinite(Number(staffCount)) && Number(staffCount) > 0
    ? Math.round(Number(staffCount)) : null;

  // 标注采集：默认只有合并组学校纳入在线采集，其余学校需显式标注（admin 看板或参数）。
  // 名单重同步不得抹掉已有的人工标注 → UPDATE 只在“显式给值”或“合并组”时改动。
  const collectProvided = params && Object.prototype.hasOwnProperty.call(params, 'collectEnabled')
    && params.collectEnabled !== undefined;
  const scopeProvided = params && ['full', 'people'].includes(String(params.collectScope || ''));
  const explicitEnabled = collectProvided ? (params.collectEnabled ? 1 : 0) : null;
  const explicitScope = scopeProvided ? String(params.collectScope) : null;

  const existing = db.prepare('SELECT * FROM schools WHERE year = ? AND unit_name = ?').get(yr, name);
  if (existing) {
    if (!existing.active && !allowReactivate) return null;
    const activeUpdate = allowReactivate ? ', active = 1' : '';
    const nextEnabled = explicitEnabled !== null
      ? explicitEnabled
      : (finalMergeCenter ? 1 : Number(existing.collect_enabled) || 0);
    const nextScope = explicitScope || existing.collect_scope || 'full';
    db.prepare(`UPDATE schools SET school_code = COALESCE(?, school_code), stage = COALESCE(?, stage), merge_center = ?, is_center = ?, contact = ?, staff_count = COALESCE(?, staff_count), collect_enabled = ?, collect_scope = ?${activeUpdate} WHERE id = ?`)
      .run(finalSchoolCode, finalStage, finalMergeCenter, finalIsCenter ? 1 : 0, contact || null, finalStaffCount, nextEnabled, nextScope, existing.id);
    return db.prepare('SELECT * FROM schools WHERE id = ?').get(existing.id);
  }

  if (!allowCreate) return null;
  const code = generateFillCode();
  const insertEnabled = explicitEnabled !== null ? explicitEnabled : (finalMergeCenter ? 1 : 0);
  const insertScope = explicitScope || 'full';
  const info = db.prepare(
    'INSERT INTO schools (year, unit_name, fill_code, school_code, stage, merge_center, is_center, contact, staff_count, active, collect_enabled, collect_scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
  ).run(yr, name, code, finalSchoolCode, finalStage, finalMergeCenter, finalIsCenter ? 1 : 0, contact || null, finalStaffCount, insertEnabled, insertScope);
  return db.prepare('SELECT * FROM schools WHERE id = ?').get(info.lastInsertRowid);
}

// admin 看板“标注采集”开关：enable(full/people) / disable
function setSchoolCollect(schoolId, { enabled, scope }) {
  initDatabase();
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(Number(schoolId));
  if (!school) throw new Error('学校不存在');
  const nextScope = ['full', 'people'].includes(String(scope || '')) ? String(scope) : (school.collect_scope || 'full');
  db.prepare('UPDATE schools SET collect_enabled = ?, collect_scope = ? WHERE id = ?')
    .run(enabled ? 1 : 0, nextScope, school.id);
  return db.prepare('SELECT * FROM schools WHERE id = ?').get(school.id);
}

// 名单同步：先整体校验、后单事务写入，避免部分写入。
// snapshot=true 时按“年度快照对账”：本轮未出现的学校停用（active=0），
// 撤销/拆除的学校随之从填表页、看板和成员数中消失。
function syncSchools({ year, schools, snapshot = false, allowCreate = true, allowReactivate = true }) {
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
      schoolCode: item.schoolCode ?? item.school_code ?? null,
      stage: item.stage ?? item.schoolStage ?? item.school_stage ?? null,
      contact: item.contact || null,
      staffCount: item.staffCount ?? item.staff_count ?? null,
    };
    if (Object.prototype.hasOwnProperty.call(item, 'mergeCenter') || Object.prototype.hasOwnProperty.call(item, 'merge_center')) {
      entry.mergeCenter = item.mergeCenter !== undefined ? item.mergeCenter : item.merge_center;
    }
    if (Object.prototype.hasOwnProperty.call(item, 'collectEnabled')) entry.collectEnabled = item.collectEnabled;
    if (Object.prototype.hasOwnProperty.call(item, 'collectScope')) entry.collectScope = item.collectScope;
    normalized.push(entry);
  }

  const run = db.transaction(() => {
    const out = [];
    const ignoredUnitNames = [];
    for (const entry of normalized) {
      const school = upsertSchool(entry, { allowCreate, allowReactivate });
      if (school) out.push(school);
      else ignoredUnitNames.push(entry.unitName);
    }
    let deactivated = 0;
    if (snapshot) {
      const placeholders = normalized.map(() => '?').join(',');
      const info = db.prepare(
        `UPDATE schools SET active = 0 WHERE year = ? AND active = 1 AND unit_name NOT IN (${placeholders})`
      ).run(yr, ...normalized.map((e) => e.unitName));
      deactivated = info.changes;
    }
    return { out, deactivated, ignoredUnitNames };
  });
  const { out, deactivated, ignoredUnitNames } = run();
  return { year: yr, schools: out, deactivated, ignoredUnitNames };
}

function getSchoolByCode(code) {
  initDatabase();
  return db.prepare('SELECT * FROM schools WHERE fill_code = ?').get(String(code || '')) || null;
}

function getSchoolById(id) {
  initDatabase();
  const schoolId = Number(id);
  if (!Number.isInteger(schoolId) || schoolId <= 0) return null;
  return db.prepare('SELECT * FROM schools WHERE id = ?').get(schoolId) || null;
}

// 按单位名精确查在册学校（供桌面端回传时定位；空格归一化）
function getActiveSchoolByName(year, unitName) {
  initDatabase();
  const name = String(unitName || '').replace(/\s+/g, '').trim();
  if (!name) return null;
  return db.prepare(
    "SELECT * FROM schools WHERE year = ? AND active = 1 AND REPLACE(unit_name, ' ', '') = ?"
  ).get(Number(year) || config.defaultYear, name) || null;
}

function listSchools(year, options = {}) {
  initDatabase();
  const activeFilter = options.includeInactive ? '' : 'AND active = 1';
  const collectFilter = options.collectableOnly ? 'AND collect_enabled = 1' : '';
  return db.prepare(`SELECT * FROM schools WHERE year = ? ${activeFilter} ${collectFilter} ORDER BY COALESCE(stage, ''), merge_center IS NULL, merge_center, is_center DESC, unit_name`)
    .all(Number(year) || config.defaultYear);
}

function getLatestSubmission(schoolId) {
  initDatabase();
  return db.prepare('SELECT * FROM submissions WHERE school_id = ? ORDER BY version DESC LIMIT 1').get(schoolId) || null;
}

function insertSubmission({ schoolId, year, controls, meta, source = 'web' }) {
  initDatabase();
  const src = source === 'desktop' ? 'desktop' : 'web';
  // 版本分配和插入放同一事务，配合 (school_id, version) 唯一索引；
  // 多进程/新旧实例并发冲突时重试，避免重复版本被重复汇总。
  const attempt = db.transaction(() => {
    const row = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM submissions WHERE school_id = ?').get(schoolId);
    const version = (row?.v || 0) + 1;
    const info = db.prepare(
      'INSERT INTO submissions (school_id, year, payload_json, filler_name, filler_phone, note, source, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      schoolId,
      Number(year) || config.defaultYear,
      JSON.stringify(controls),
      meta.filler_name || null,
      meta.filler_phone || null,
      meta.note || null,
      src,
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
  const controls = safeParse(r.payload_json);
  const schoolStage = normalizeSchoolStage(controls.schoolStage || r.stage);
  if (schoolStage) controls.schoolStage = schoolStage;
  return {
    submissionId: r.id,
    unitName: r.unit_name,
    mergeCenter: r.merge_center,
    isCenter: !!r.is_center,
    year: r.year,
    version: r.version,
    // full=完整关键数（无报表校）；people=仅人员学生数（公办有报表校，财务走五件套）
    collectScope: r.collect_scope === 'people' ? 'people' : 'full',
    source: r.source === 'desktop' ? 'desktop' : 'web',
    submittedAt: r.created_at,
    filler: { name: r.filler_name, phone: r.filler_phone },
    note: r.note,
    controls,
  };
}

function mergeSubmissionControls(rows) {
  const numericKeys = numericControlKeys();
  const toggleKeys = toggleControlKeys();
  const controls = {};
  const schoolStages = new Set();

  // 金额按“分”整数累加再换回元，避免浮点累加误差（0.1+0.2 问题）
  const cents = {};
  for (const key of numericKeys) cents[key] = 0;
  for (const key of toggleKeys) controls[key] = false;

  for (const row of rows) {
    const source = safeParse(row.payload_json);
    const schoolStage = normalizeSchoolStage(source.schoolStage || row.stage);
    if (schoolStage) schoolStages.add(schoolStage);
    for (const key of numericKeys) {
      const value = Number(source[key] || 0);
      if (Number.isFinite(value)) cents[key] += Math.round(value * 100);
    }
    for (const key of toggleKeys) {
      controls[key] = controls[key] || !!source[key];
    }
  }

  for (const key of numericKeys) controls[key] = cents[key] / 100;
  // 合并组通常是同一学段；仅在来源学段一致时保留，避免伪造错误类别。
  // 多学段来源仍可由各分学段人数在桌面端安全推断。
  if (schoolStages.size === 1) controls.schoolStage = [...schoolStages][0];
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
      collectScope: 'full',
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
           sub.note, sub.version, sub.created_at, sub.source,
           sc.unit_name, sc.merge_center, sc.is_center, sc.stage, sc.collect_scope
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
  setSchoolCollect,
  getSchoolByCode,
  getSchoolById,
  getActiveSchoolByName,
  listSchools,
  getLatestSubmission,
  insertSubmission,
  listLatestSubmissions,
  latestSubmissionId,
  closeDatabase,
};
