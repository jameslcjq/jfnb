const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

/**
 * 初始化数据库
 */
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'reports.db');
  db = new Database(dbPath);

  // 启用 WAL 模式提升并发性能
  db.pragma('journal_mode = WAL');
  // 启用外键约束（CASCADE 删除生效）
  db.pragma('foreign_keys = ON');

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_name TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      year INTEGER,
      filled INTEGER NOT NULL DEFAULT 0,
      filled_at TEXT,
      bxlx TEXT,
      school_type TEXT,
      meta_json TEXT
    );

    CREATE TABLE IF NOT EXISTS report_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      sheet_name TEXT NOT NULL,
      cell_addr TEXT NOT NULL,
      field_label TEXT,
      value REAL,
      level TEXT,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_report_data_report ON report_data(report_id);
    CREATE INDEX IF NOT EXISTS idx_reports_unit ON reports(unit_name);

    CREATE TABLE IF NOT EXISTS collected_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_name TEXT NOT NULL,
      year INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      version INTEGER,
      filler_name TEXT,
      filler_phone TEXT,
      merge_center TEXT,
      is_center INTEGER NOT NULL DEFAULT 0,
      source_units TEXT,
      member_count INTEGER,
      submitted_member_count INTEGER,
      collect_scope TEXT NOT NULL DEFAULT 'full',
      submitted_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      generated_at TEXT,
      generated_fingerprint TEXT,
      UNIQUE(unit_name, year)
    );

    CREATE INDEX IF NOT EXISTS idx_collected_year ON collected_submissions(year);
  `);

  // 数据库迁移：为旧库添加新字段
  const migrateColumn = (table, col, type) => {
    try {
      const cols = db.pragma(`table_info(${table})`).map(c => c.name);
      if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch (e) { /* ignore */ }
  };
  migrateColumn('reports', 'bxlx', 'TEXT');
  migrateColumn('reports', 'school_type', 'TEXT');
  migrateColumn('reports', 'meta_json', 'TEXT');
  migrateColumn('report_data', 'level', 'TEXT');
  migrateColumn('collected_submissions', 'member_count', 'INTEGER');
  migrateColumn('collected_submissions', 'submitted_member_count', 'INTEGER');
  migrateColumn('collected_submissions', 'generated_fingerprint', 'TEXT');
  migrateColumn('collected_submissions', 'collect_scope', "TEXT NOT NULL DEFAULT 'full'");
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_report_data_level ON report_data(report_id, level)'); } catch (e) { /* ignore */ }

  // 旧版把“生成年份”误存为报表年度。若 year 与 generated_at 的自然年相同，
  // 可确定这是旧口径，迁移为实际填报的上年度；已正确保存的历史行不动。
  try {
    db.exec("UPDATE reports SET year = year - 1 WHERE year >= 2000 AND year = CAST(strftime('%Y', generated_at) AS INTEGER)");
  } catch { /* 迁移失败不阻止启动 */ }

  // 启动时清理：每个学校只保留最新一条 report（旧数据迁移）
  try {
    db.exec(`
      DELETE FROM report_data WHERE report_id IN (
        SELECT r.id FROM reports r
        WHERE r.id NOT IN (
          SELECT MAX(id) FROM reports GROUP BY unit_name
        )
      );
      DELETE FROM reports WHERE id NOT IN (
        SELECT MAX(id) FROM reports GROUP BY unit_name
      );
    `);
  } catch (e) {
    // ignore
  }

  return db;
}

/**
 * 保存生成的年报数据到数据库
 * @param {string} unitName - 单位名称
 * @param {object} computed - computeReport的结果
 * @param {number} year - 报表年份
 * @param {object} [opts] - 可选参数 { bxlx, schoolType, levelData }
 * @returns {number} 插入的report_id
 */
function saveReport(unitName, computed, year = new Date().getFullYear() - 1, opts = {}) {
  if (!db) initDatabase();

  const { bxlx, schoolType, levelData } = opts;

  const deletePrevReports = db.prepare('DELETE FROM reports WHERE unit_name = ?');
  const insertReport = db.prepare(
    'INSERT INTO reports (unit_name, year, bxlx, school_type, meta_json) VALUES (?, ?, ?, ?, ?)'
  );
  const insertData = db.prepare(
    'INSERT INTO report_data (report_id, sheet_name, cell_addr, field_label, value, level) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const saveSheetData = (reportId, computed, level) => {
    const lvl = level || null;

    // 人员情况表
    const p = computed.人员情况表 || {};
    const personData = [
      ['J12', '年初在职教职工', p.J12],
      ['J13', '年初教学人员', p.J13],
      ['J14', '年末在职教职工', p.J14],
      ['J15', '年末教学人员', p.J15],
      ['J16', '年末编制外长期聘用人员', p.J16],
      ['J17', '年末离退休人员', p.J17],
      ['M12', '年末编制差', p.M12],
      ['J18', '年初学生数', p.J18],
      ['J19', '年初高中学生', p.J19],
      ['J20', '年初初中学生', p.J20],
      ['J21', '年初小学学生', p.J21],
      ['J22', '年初随班就读', p.J22],
      ['J23', '年初随班高中', p.J23],
      ['J24', '年初随班初中', p.J24],
      ['J25', '年初随班小学', p.J25],
      ['J26', '年初寄宿学生', p.J26],
      ['J27', '年初寄宿高中', p.J27],
      ['J28', '年初寄宿初中', p.J28],
      ['J29', '年初寄宿小学', p.J29],
      ['J30', '年末学生数', p.J30],
      ['J31', '年末高中学生', p.J31],
      ['J32', '年末初中学生', p.J32],
      ['J33', '年末小学学生', p.J33],
      ['J34', '年末随班就读', p.J34],
      ['J35', '年末随班高中', p.J35],
      ['J36', '年末随班初中', p.J36],
      ['J37', '年末随班小学', p.J37],
      ['J38', '年末寄宿学生', p.J38],
      ['J39', '年末寄宿高中', p.J39],
      ['J40', '年末寄宿初中', p.J40],
      ['J41', '年末寄宿小学', p.J41],
      ['J44', '年初学前一年在园儿童', p.J44],
      ['J45', '年末学前一年在园儿童', p.J45],
      ['J46', '年初托育幼儿', p.J46],
      ['J47', '年末托育幼儿', p.J47],
    ];
    for (const [addr, label, value] of personData) {
      insertData.run(reportId, '人员情况表', addr, label, value || 0, lvl);
    }

    // 收入情况表
    const incomeData = [
      ['J11', '收入合计', computed.收入情况表.J11],
      ['J12', '一般公共预算安排的教育经费', computed.收入情况表.J12],
      ['J13', '一般公共预算教育经费', computed.收入情况表.J13],
      ['J14', '一般公共预算教育经费', computed.收入情况表.J14],
      ['J26', '事业预算收入', computed.收入情况表.J26],
      ['J27', '学费/保育教育费', computed.收入情况表.J27],
      ['J36', '其他预算收入', computed.收入情况表.J36],
      ['J41', '课后服务费收入', computed.收入情况表.J41],
      ['J43', '民办学校中举办者投入', computed.收入情况表.J43],
      ['J55', '其他收入-生均公用经费', computed.收入情况表.J55],
      ['J56', '其他收入-随班就读经费', computed.收入情况表.J56],
      ['J57', '其他收入-寄宿生公用经费', computed.收入情况表.J57],
      ['J58', '其他收入-取暖经费', computed.收入情况表.J58],
    ];
    for (const [addr, label, value] of incomeData) {
      insertData.run(reportId, '收入情况表', addr, label, value || 0, lvl);
    }

    // 支出情况表
    const expKeys = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 45, 46,
      47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
      76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87,
      88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
      98, 99, 100, 101, 102, 103, 104, 105, 106];
    const expenseSheet = computed.支出情况表 || {};
    for (const row of expKeys) {
      const val = expenseSheet[`J${row}`];
      if (val != null) {
        insertData.run(reportId, '支出情况表', `J${row}`, `J${row}`, val, lvl);
      }
      const totalVal = expenseSheet[`F${row}`];
      if (totalVal != null) {
        insertData.run(reportId, '支出情况表', `F${row}`, `F${row}_总支出`, totalVal, lvl);
      }
    }

    // 费用情况表
    const feeData = [
      ['F12', '本年费用合计', computed.费用情况表.F12],
      ['F13', '业务活动费用合计', computed.费用情况表.F13],
      ['G13', '工资福利费用', computed.费用情况表.G13],
      ['I13', '对个人和家庭补助', computed.费用情况表.I13],
      ['K13', '补助中奖助学金', computed.费用情况表.K13],
      ['L13', '商品和服务费用', computed.费用情况表.L13],
      ['M13', '固定资产折旧', computed.费用情况表.M13],
      ['F14', '单位管理费用合计', computed.费用情况表.F14],
      ['G14', '外聘教职工工资福利', computed.费用情况表.G14],
      ['I14', '离退休费', computed.费用情况表.I14],
      ['J14', '单位管理费用-离退休费', computed.费用情况表.J14],
      ['F16', '固定资产处置减少', computed.费用情况表.F16],
    ];
    for (const [addr, label, value] of feeData) {
      insertData.run(reportId, '费用情况表', addr, label, value || 0, lvl);
    }

    // 资产价值量情况表
    for (let r = 12; r <= 36; r++) {
      for (const col of ['F', 'G', 'H', 'L', 'M']) {
        const key = `${col}${r}`;
        const val = computed.资产价值量情况表[key];
        if (val != null && val !== 0) {
          insertData.run(reportId, '资产价值量情况表', key, key, val, lvl);
        }
      }
    }

    // 资产实物量情况表
    for (let r = 11; r <= 30; r++) {
      const val = computed.资产实物量情况表[`J${r}`];
      if (val != null && val !== 0) {
        insertData.run(reportId, '资产实物量情况表', `J${r}`, `J${r}`, val, lvl);
      }
    }
  };

  const transaction = db.transaction((unitName, computed, year) => {
    deletePrevReports.run(unitName);
    const result = insertReport.run(unitName, year, bxlx || null, schoolType || null, computed.__meta ? JSON.stringify(computed.__meta) : null);
    const reportId = result.lastInsertRowid;

    // 保存综表数据 (level = null)
    saveSheetData(reportId, computed, null);

    // 保存各学段分表数据
    if (levelData && typeof levelData === 'object') {
      for (const [level, levelComputed] of Object.entries(levelData)) {
        saveSheetData(reportId, levelComputed, level);
      }
    }

    return reportId;
  });

  return transaction(unitName, computed, year);
}

/**
 * 获取所有报表记录
 */
function getAllReports() {
  if (!db) initDatabase();
  return db.prepare(`
    SELECT id, unit_name, generated_at, year, filled, filled_at, bxlx, school_type, meta_json
    FROM reports ORDER BY generated_at DESC
  `).all();
}

/**
 * 获取指定报表的详细数据
 * @param {number} reportId
 * @param {string|null} [level] - null=综表, '小学'/'初中'/'高中'=分表
 */
function getReportData(reportId, level) {
  if (!db) initDatabase();
  if (level === undefined) {
    return db.prepare(`
      SELECT sheet_name, cell_addr, field_label, value, level
      FROM report_data WHERE report_id = ? ORDER BY id
    `).all(reportId);
  }
  if (level === null) {
    return db.prepare(`
      SELECT sheet_name, cell_addr, field_label, value, level
      FROM report_data WHERE report_id = ? AND level IS NULL ORDER BY id
    `).all(reportId);
  }
  return db.prepare(`
    SELECT sheet_name, cell_addr, field_label, value, level
    FROM report_data WHERE report_id = ? AND level = ? ORDER BY id
  `).all(reportId, level);
}

/**
 * 获取指定报表按表分组的数据
 * @param {number} reportId
 * @param {string|null} [level] - undefined=全部, null=综表, string=分表
 */
function getReportDataGrouped(reportId, level) {
  if (!db) initDatabase();
  const rows = getReportData(reportId, level);
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.sheet_name]) grouped[row.sheet_name] = [];
    grouped[row.sheet_name].push(row);
  }
  return grouped;
}

/**
 * 获取指定报表的学段列表
 */
function getReportLevels(reportId) {
  if (!db) initDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT level FROM report_data WHERE report_id = ? AND level IS NOT NULL ORDER BY level
  `).all(reportId);
  return rows.map(r => r.level);
}

/**
 * 标记报表已填报
 */
function markFilled(reportId) {
  if (!db) initDatabase();
  db.prepare(
    "UPDATE reports SET filled = 1, filled_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(reportId);
}

/**
 * 获取未填报的报表
 */
function getUnfilledReports() {
  if (!db) initDatabase();
  return db.prepare(`
    SELECT id, unit_name, generated_at, year 
    FROM reports WHERE filled = 0 ORDER BY generated_at DESC
  `).all();
}

/**
 * 删除报表记录
 */
function deleteReport(reportId) {
  if (!db) initDatabase();
  db.prepare('DELETE FROM report_data WHERE report_id = ?').run(reportId);
  db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
}

/**
 * 关闭数据库连接
 */
// ===== 在线采集数据（民办/无报表/合并填报学校） =====

// 采集行内容指纹：控制数、版本、成员集合任一变化都会改变指纹。
// 用于判断“生成后数据是否变过”，不依赖两台机器的时钟/时区。
function collectedFingerprint(row) {
  const crypto = require('crypto');
  const basis = [
    row.payload_json || '',
    row.version ?? '',
    row.source_units || '',
    row.member_count ?? '',
    row.submitted_member_count ?? '',
    row.submitted_at || '',
  ].join('|');
  return crypto.createHash('sha1').update(basis).digest('hex');
}

function rowToCollected(row) {
  if (!row) return null;
  let controls = {};
  try { controls = JSON.parse(row.payload_json); } catch { controls = {}; }
  let sourceUnits = [];
  try { sourceUnits = row.source_units ? JSON.parse(row.source_units) : []; } catch { sourceUnits = []; }
  // 指纹存在时按指纹判失效（可靠）；旧记录无指纹时退回时间字符串比较
  const stale = row.generated_at
    ? (row.generated_fingerprint
      ? collectedFingerprint(row) !== row.generated_fingerprint
      : !!(row.submitted_at && row.submitted_at > row.generated_at))
    : false;
  return {
    unitName: row.unit_name,
    year: row.year,
    controls,
    version: row.version,
    fillerName: row.filler_name,
    fillerPhone: row.filler_phone,
    mergeCenter: row.merge_center,
    isCenter: !!row.is_center,
    sourceUnits,
    memberCount: row.member_count,
    submittedMemberCount: row.submitted_member_count,
    collectScope: row.collect_scope === 'people' ? 'people' : 'full',
    submittedAt: row.submitted_at,
    syncedAt: row.synced_at,
    generatedAt: row.generated_at,
    stale,
  };
}

/**
 * 落库一条采集提交（按 unit_name+year 覆盖，保留 generated_at 以便判断是否需重报）
 */
function upsertCollectedSubmission(sub) {
  if (!db) initDatabase();
  db.prepare(`
    INSERT INTO collected_submissions
      (unit_name, year, payload_json, version, filler_name, filler_phone, merge_center, is_center, source_units, member_count, submitted_member_count, collect_scope, submitted_at, synced_at)
    VALUES (@unit_name, @year, @payload_json, @version, @filler_name, @filler_phone, @merge_center, @is_center, @source_units, @member_count, @submitted_member_count, @collect_scope, @submitted_at, datetime('now','localtime'))
    ON CONFLICT(unit_name, year) DO UPDATE SET
      payload_json = excluded.payload_json,
      version = excluded.version,
      filler_name = excluded.filler_name,
      filler_phone = excluded.filler_phone,
      merge_center = excluded.merge_center,
      is_center = excluded.is_center,
      source_units = excluded.source_units,
      member_count = excluded.member_count,
      submitted_member_count = excluded.submitted_member_count,
      collect_scope = excluded.collect_scope,
      submitted_at = excluded.submitted_at,
      synced_at = datetime('now','localtime')
  `).run({
    unit_name: sub.unitName,
    year: Number(sub.year),
    payload_json: JSON.stringify(sub.controls || {}),
    version: sub.version != null ? Number(sub.version) : null,
    filler_name: sub.fillerName || sub.filler_name || (sub.filler && sub.filler.name) || null,
    filler_phone: sub.fillerPhone || sub.filler_phone || (sub.filler && sub.filler.phone) || null,
    merge_center: sub.mergeCenter || null,
    is_center: sub.isCenter ? 1 : 0,
    source_units: sub.sourceUnits ? JSON.stringify(sub.sourceUnits)
      : (sub.sourceUnitNames ? JSON.stringify(sub.sourceUnitNames) : null),
    member_count: sub.memberCount != null ? Number(sub.memberCount) : null,
    submitted_member_count: sub.submittedMemberCount != null ? Number(sub.submittedMemberCount) : null,
    collect_scope: sub.collectScope === 'people' ? 'people' : 'full',
    submitted_at: sub.submittedAt || null,
  });
  return getCollectedSubmission(sub.unitName, sub.year);
}

function getCollectedSubmission(unitName, year) {
  if (!db) initDatabase();
  const row = db.prepare('SELECT * FROM collected_submissions WHERE unit_name = ? AND year = ?').get(unitName, Number(year));
  return rowToCollected(row);
}

function listCollectedSubmissions(year) {
  if (!db) initDatabase();
  const rows = db.prepare('SELECT * FROM collected_submissions WHERE year = ? ORDER BY unit_name').all(Number(year));
  return rows.map(rowToCollected);
}

function markCollectedGenerated(unitName, year) {
  if (!db) initDatabase();
  const row = db.prepare('SELECT * FROM collected_submissions WHERE unit_name = ? AND year = ?')
    .get(unitName, Number(year));
  if (!row) return;
  // 记录生成时的数据指纹：之后任何控制数/成员/版本变化都会触发“建议重新生成”
  db.prepare("UPDATE collected_submissions SET generated_at = datetime('now','localtime'), generated_fingerprint = ? WHERE id = ?")
    .run(collectedFingerprint(row), row.id);
}

// 全量同步对账：删除本轮响应中缺席的本地采集行（服务端重置/拆组/停用后不再残留旧聚合行）
function pruneCollectedSubmissions(year, keepUnitNames) {
  if (!db) initDatabase();
  const keep = new Set((keepUnitNames || []).map((n) => String(n)));
  const rows = db.prepare('SELECT id, unit_name FROM collected_submissions WHERE year = ?').all(Number(year));
  let removed = 0;
  const del = db.prepare('DELETE FROM collected_submissions WHERE id = ?');
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!keep.has(row.unit_name)) { del.run(row.id); removed++; }
    }
  });
  tx();
  return removed;
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  saveReport,
  getAllReports,
  getReportData,
  getReportDataGrouped,
  getReportLevels,
  markFilled,
  getUnfilledReports,
  deleteReport,
  upsertCollectedSubmission,
  getCollectedSubmission,
  listCollectedSubmissions,
  markCollectedGenerated,
  pruneCollectedSubmissions,
  closeDatabase,
};
