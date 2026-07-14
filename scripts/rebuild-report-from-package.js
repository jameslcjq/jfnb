// 从教财上报包(ziptemp/<dwdm>/j2_X.xml)重建经费年报 Excel。
// 用途：①用 2025 真实数据做民办草稿/规则引擎批量测试（重建件即明年的“上年经费年报”）；
//       ②学校丢失报表文件时按包重建。
// 映射依据（已逐列核对）：XML 字段按表内行次顺序存储、模板“--”格不存储；
// 金额表(j2_2/j2_3/j2_6)以分存储(÷100)，j2_1 人数/j2_7 面积为原值。
// 多学段拆分包(ZXXCFMode=2)取全校合计记录（zxxcfxxlb == xxlbdm）。
const fs = require('fs');
const path = require('path');
const XLSX = require('@e965/xlsx');

// 表配置：XML 前缀 → 模板列；行 = 代码 + rowOffset；'--' 格跳过。
const TABLE_CONFIG = {
  j2_1: {
    sheet: '人员情况表', codeCol: 'I', rowOffset: 10, cents: false, columns: { j_sl: 'J' },
    // 2025新增“学前一年/托育”字段在 XML 末尾追加，但在模板中分别插入代码34-37，不能按 XML 顺序直填。
    fieldsByCode: {
      j_sl: [
        'jgs', 'nczzjzg', 'ncjxry', 'nmzzjzg', 'nmjxry', 'nmbzwry', 'nmltxry',
        'ncxss', 'ncgz', 'nccz', 'ncxx', 'ncsbjd', 'ncgzsbjd', 'ncczsbjd', 'ncxxsbjd',
        'ncjsxs', 'ncgzjsxs', 'ncczjsxs', 'ncxxjsxs', 'nmxss', 'nmgz', 'nmcz', 'nmxx',
        'nmsbjd', 'nmgzsbjd', 'nmczsbjd', 'nmxxsbjd', 'nmjsxs', 'nmgzjsxs', 'nmczjsxs',
        'nmxxjsxs', 'ffqrzxlxsrs', 'fdqpxrs', 'fncxqynzyyers', 'fnmxqynzyetrs',
        'fnctyyers', 'fnmtyyers',
      ],
    },
  },
  j2_2: {
    sheet: '收入情况表', codeCol: 'I', rowOffset: 10, cents: true, columns: { j_bnsr: 'J' },
    // 2025新增字段同样追加在 XML 末尾，需按模板代码显式定位。
    fieldsByCode: {
      j_bnsr: [
        'zj', 'ybggysjyjf', 'ybggjyjf', 'jysyf', 'jbjsjf', 'jyffj', 'ybggkxjsjf',
        'ybggshbzjf', 'ybggwsjkjf', 'ybggzfbzjf', 'qtybggjyjf', 'zfxjjjyjf', 'cpgyj',
        'dfzfzxzwjyjf', 'gzapjyjf', 'syyssr', 'byjyf', 'byf', 'zsf', 'sjbzyssr',
        'fsdwsjyssr', 'jyyssr', 'zwyssr', 'ftjczbkyssr', 'tzyssy', 'qtyssr', 'lxyssr',
        'jzyssr', 'zjyssr', 'stjyssr', 'khfwfsr', 'gyqybk', 'mbxxjbztr', 'ybggysjbjszjf',
        'dfzfybzwsrjyjf', 'bnsjsqbjf', 'tyyrbyf', 'etbyjyf', 'bnsjsqbyf', 'bnsjsqzsf',
        'bnsjgkk', 'gbyeybyf', 'gbyeyzsf', 'bnsjjsjz', 'czapgyjf', 'czapsbjf',
        'czapjssgy', 'czapqnjf', 'jyjjbnjzsr', 'jyjjbncshdjf', 'zrxx',
      ],
    },
  },
  j2_3: {
    sheet: '支出情况表', codeCol: 'E', rowOffset: 13, cents: true,
    columns: { j_hj: 'F', j_czbz: 'G', j_czys: 'H', j_ggcz: 'I', j_jysy: 'J', j_zfjj: 'K', j_dfzfzwsr: 'L', j_gzapjfzc: 'M' },
  },
  j2_4: {
    sheet: '费用情况表', codeCol: 'E', rowOffset: 11, cents: true,
    columns: {
      j_hj: 'F', j_gzfl: 'G', j_wpjzg: 'H', j_dgrhjtbz: 'I', j_ltx: 'J',
      j_jzxj: 'K', j_sphfw: 'L', j_gdzczj: 'M', j_wxzctx: 'N', j_jtzyjj: 'O',
    },
  },
  j2_5: {
    sheet: '债务情况表', codeCol: 'H', rowOffset: 10, cents: true,
    columns: { j_zj: 'I', j_bn: 'J' },
  },
  j2_6: {
    sheet: '资产价值量情况表', codeCol: 'E', rowOffset: 11, cents: true,
    columns: { j_nc: 'F', j_hj: 'G', j_zy: 'H', j_xz: 'I', j_czcj: 'J', j_qt: 'K', j_zmzjz: 'L', j_czzcz: 'M' },
  },
  j2_7: { sheet: '资产实物量情况表', codeCol: 'I', rowOffset: 10, cents: false, columns: { j_sl: 'J' } },
};

function pickWholeSchoolRecord(xml, table) {
  const records = xml.split(`</${table}>`).filter((rec) => rec.includes('<RecordID>'));
  if (records.length <= 1) return records[0] || '';
  for (const rec of records) {
    const xxlb = /<xxlbdm>([^<]*)</.exec(rec);
    const seg = /<zxxcfxxlb>([^<]*)</.exec(rec);
    if (xxlb && seg && xxlb[1] === seg[1]) return rec;
  }
  return records[0];
}

// 按前缀提取字段值序列（保持文档顺序）。
function fieldSequence(record, prefix) {
  const re = new RegExp(`<(${prefix}_\\w+)>([^<]*)<`, 'g');
  const values = [];
  let match;
  while ((match = re.exec(record))) {
    // 前缀须精确到分组段：j_hj_xxx 属于 j_hj，而 j_hj 不应吞掉 j_hjx 等。
    values.push(Number(match[2]) || 0);
  }
  return values;
}

function fieldValue(record, fieldName) {
  const escaped = String(fieldName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<${escaped}>([^<]*)<`).exec(record);
  return match ? (Number(match[1]) || 0) : 0;
}

// 模板中该表的代码行，以及指定列可填的代码行。
// 部分上报 XML 会保留模板“--”行的零值（例如 j2_3 合计列102行），
// 另一些资金列则直接省略“--”行。因此同时支持“全代码行”和“仅可填行”两种序列。
function codedRows(templateWs, config) {
  const range = XLSX.utils.decode_range(templateWs['!ref']);
  const codeColIdx = XLSX.utils.decode_col(config.codeCol);
  const rows = [];
  for (let r = 0; r <= range.e.r; r++) {
    const codeCell = templateWs[XLSX.utils.encode_cell({ r, c: codeColIdx })];
    if (!codeCell || !/^\d+$/.test(String(codeCell.v).trim())) continue;
    rows.push(r + 1);
  }
  return rows;
}

function fillableRows(templateWs, config, column) {
  return codedRows(templateWs, config).filter((row) => {
    const cell = templateWs[`${column}${row}`];
    return !cell || String(cell.v).trim() !== '--';
  });
}

function resolveColumnData(record, templateWs, config, prefix, column) {
  const allRows = codedRows(templateWs, config);
  const writableRows = fillableRows(templateWs, config, column);
  const fields = config.fieldsByCode?.[prefix];
  if (fields) {
    if (fields.length !== allRows.length) {
      return { values: [], rows: null, allRows, writableRows, fieldCount: fields.length };
    }
    return {
      values: fields.map((suffix) => fieldValue(record, `${prefix}_${suffix}`)),
      rows: allRows,
      allRows,
      writableRows,
      fieldCount: fields.length,
    };
  }
  const values = fieldSequence(record, prefix);
  const rows = values.length === allRows.length
    ? allRows
    : (values.length === writableRows.length ? writableRows : null);
  return { values, rows, allRows, writableRows, fieldCount: values.length };
}

/**
 * 从上报包目录重建经费年报工作簿并写出 xlsx。返回 { outPath, unitName, warnings }。
 */
function rebuildReportFromPackage(schoolPackageDir, templatePath, outPath) {
  const ziptemp = path.join(schoolPackageDir, 'ziptemp');
  const dwdm = fs.readdirSync(ziptemp).find((n) => fs.statSync(path.join(ziptemp, n)).isDirectory());
  if (!dwdm) throw new Error(`上报包缺少数据目录：${schoolPackageDir}`);
  const dataDir = path.join(ziptemp, dwdm);
  const workbook = XLSX.readFile(templatePath, { cellFormula: true, cellNF: true, cellStyles: true });
  const warnings = [];

  for (const [table, config] of Object.entries(TABLE_CONFIG)) {
    const xmlPath = path.join(dataDir, `${table}.xml`);
    if (!fs.existsSync(xmlPath)) { warnings.push(`${table}.xml 缺失`); continue; }
    const record = pickWholeSchoolRecord(fs.readFileSync(xmlPath, 'utf8'), table);
    const ws = workbook.Sheets[config.sheet];
    for (const [prefix, column] of Object.entries(config.columns)) {
      const { values, rows, allRows, writableRows, fieldCount } = resolveColumnData(record, ws, config, prefix, column);
      if (!rows) {
        warnings.push(`${table} ${prefix}→${column} 字段数 ${fieldCount} 与模板代码行 ${allRows.length}/可填行 ${writableRows.length} 均不一致，跳过该列`);
        continue;
      }
      rows.forEach((row, index) => {
        const templateCell = ws[`${column}${row}`];
        if (templateCell && String(templateCell.v).trim() === '--') return;
        const raw = values[index];
        const value = config.cents ? Math.round(raw) / 100 : raw;
        const addr = `${column}${row}`;
        const cell = ws[addr] || {};
        cell.v = value;
        cell.t = 'n';
        delete cell.f;
        ws[addr] = cell;
      });
    }
  }
  if (outPath) XLSX.writeFile(workbook, outPath, { bookType: 'xlsx' });
  return { outPath, dwdm, warnings, workbook };
}

module.exports = {
  rebuildReportFromPackage,
  TABLE_CONFIG,
  codedRows,
  fillableRows,
  fieldSequence,
  resolveColumnData,
  pickWholeSchoolRecord,
};

if (require.main === module) {
  const [schoolDir, out] = process.argv.slice(2);
  if (!schoolDir) {
    console.error('用法: node scripts/rebuild-report-from-package.js <学校包目录> [输出xlsx]');
    process.exit(1);
  }
  const result = rebuildReportFromPackage(
    path.resolve(schoolDir),
    'E:\\经费年报\\经费年报模板.xlsx',
    path.resolve(out || `${path.basename(schoolDir)}_重建经费年报.xlsx`),
  );
  console.log(JSON.stringify({ out: result.outPath, warnings: result.warnings }, null, 2));
}
