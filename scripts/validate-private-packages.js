// 只对教财上报包中的民办学校执行：包数据重建 Excel -> 系统内置规则引擎校验。
// 用法：node scripts/validate-private-packages.js [2025上报包根目录] [输出目录] [模板]
const fs = require('fs');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { applyReportRules } = require('../src/report-rule-engine');
const { sanitizeFileName } = require('../src/path-safety');
const {
  rebuildReportFromPackage,
  TABLE_CONFIG,
  resolveColumnData,
  pickWholeSchoolRecord,
} = require('./rebuild-report-from-package');

const dataRoot = path.resolve(process.argv[2] || 'E:\\经费年报\\2025年学校经费年报数据');
const outputRoot = path.resolve(process.argv[3] || path.join(dataRoot, '民办学校系统构建验证'));
const templatePath = path.resolve(process.argv[4] || 'E:\\经费年报\\经费年报模板.xlsx');
const projectRoot = path.resolve(__dirname, '..');
const rebuiltRoot = path.join(outputRoot, '重建年报');
const resultPath = path.join(outputRoot, '民办学校系统构建验证.json');
const ruleFiles = [
  { path: path.join(projectRoot, 'rules', '自定义公式.xlsx'), source: '自定义公式' },
  { path: path.join(projectRoot, 'rules', '系统公式.xlsx'), source: '系统公式' },
];

const TYPE_NAMES = {
  111: '学前教育', 211: '中等职业学校', 311: '小学初中一贯制', 341: '初中高中一贯制',
  342: '小学初中高中一贯制', 412: '完全中学', 413: '初级中学', 414: '九年制学校',
  415: '十二年制学校', 61: '普通小学', 8: '幼儿园',
};

function tag(xml, name) {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`, 'i').exec(String(xml || ''));
  return match ? match[1].trim() : '';
}

function amountFromRecord(record, name) {
  const value = Number(tag(record, name));
  return Number.isFinite(value) ? Math.round(value) / 100 : 0;
}

function findDataDir(schoolDir) {
  const ziptemp = path.join(schoolDir, 'ziptemp');
  if (!fs.existsSync(ziptemp)) return '';
  return fs.readdirSync(ziptemp, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(ziptemp, entry.name))
    .find((dir) => fs.existsSync(path.join(dir, 'j2_1.xml'))) || '';
}

function readSchool(schoolDir) {
  const infoPath = path.join(schoolDir, 'ziptemp', 'ModelSchoolInfo.xml');
  if (!fs.existsSync(infoPath)) return null;
  const infoXml = fs.readFileSync(infoPath, 'utf8');
  const dataDir = findDataDir(schoolDir);
  const context = {
    dwdm: tag(infoXml, 'XXDM'),
    dqdm: tag(infoXml, 'DQDM'),
    xxlbdm: tag(infoXml, 'XXLBDM'),
    lsgxdm: tag(infoXml, 'LSGXDM'),
    cxfldm: tag(infoXml, 'CXFLDM'),
    phx: tag(infoXml, 'PHX'),
    bbnd: '2025',
  };
  return {
    schoolDir,
    dataDir,
    unitName: tag(infoXml, 'XXMC') || path.basename(schoolDir).replace(/^[^_]+_/, ''),
    context,
  };
}

function verifyPackageMapping(workbook, dataDir) {
  const errors = [];
  let comparedCells = 0;
  for (const [table, config] of Object.entries(TABLE_CONFIG)) {
    const xmlPath = path.join(dataDir, `${table}.xml`);
    if (!fs.existsSync(xmlPath)) {
      errors.push(`${table}.xml 缺失`);
      continue;
    }
    const record = pickWholeSchoolRecord(fs.readFileSync(xmlPath, 'utf8'), table);
    const ws = workbook.Sheets[config.sheet];
    if (!ws) {
      errors.push(`模板缺少 ${config.sheet}`);
      continue;
    }
    for (const [prefix, column] of Object.entries(config.columns)) {
      const { values, rows, allRows, writableRows, fieldCount } = resolveColumnData(record, ws, config, prefix, column);
      if (!rows) {
        errors.push(`${table} ${prefix}→${column} 数量 ${fieldCount}/${allRows.length}/${writableRows.length}`);
        continue;
      }
      rows.forEach((row, index) => {
        const target = ws[`${column}${row}`];
        if (target && String(target.v).trim() === '--') return;
        const expected = config.cents ? Math.round(values[index]) / 100 : values[index];
        const actual = Number(target?.v);
        comparedCells += 1;
        const tolerance = config.cents ? 0.005 : 0;
        if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
          errors.push(`${table} ${column}${row} 期望${expected} 实际${target?.v ?? '空'}`);
        }
      });
    }
  }
  return { comparedCells, errors };
}

function workbookVerification(workbook) {
  const expectedSheets = Object.values(TABLE_CONFIG).map((item) => item.sheet);
  const missingSheets = [...new Set(expectedSheets)].filter((name) => !workbook.SheetNames.includes(name));
  const formulaErrors = [];
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    for (const [addr, cell] of Object.entries(ws || {})) {
      if (addr.startsWith('!') || !cell) continue;
      if (typeof cell.v === 'string' && /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/.test(cell.v)) {
        formulaErrors.push(`${sheetName}!${addr}`);
      }
    }
  }
  return { missingSheets, formulaErrors };
}

function sourceFinancials(dataDir) {
  const incomeXml = fs.readFileSync(path.join(dataDir, 'j2_2.xml'), 'utf8');
  const expenseXml = fs.readFileSync(path.join(dataDir, 'j2_3.xml'), 'utf8');
  const incomeRecord = pickWholeSchoolRecord(incomeXml, 'j2_2');
  const expenseRecord = pickWholeSchoolRecord(expenseXml, 'j2_3');
  const totalIncome = amountFromRecord(incomeRecord, 'j_bnsr_zj');
  const totalExpense = amountFromRecord(expenseRecord, 'j_hj_zj');
  return {
    totalIncome,
    totalExpense,
    surplus: Math.round((totalIncome - totalExpense) * 100) / 100,
  };
}

async function main() {
  if (!fs.existsSync(dataRoot)) throw new Error(`上报包目录不存在：${dataRoot}`);
  if (!fs.existsSync(templatePath)) throw new Error(`模板不存在：${templatePath}`);
  for (const rule of ruleFiles) if (!fs.existsSync(rule.path)) throw new Error(`规则文件不存在：${rule.path}`);
  fs.mkdirSync(rebuiltRoot, { recursive: true });

  const schools = fs.readdirSync(dataRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSchool(path.join(dataRoot, entry.name)))
    .filter(Boolean)
    .filter((school) => school.context.lsgxdm === '25');
  const results = [];

  for (const school of schools) {
    const missingTables = Object.keys(TABLE_CONFIG)
      .filter((table) => !school.dataDir || !fs.existsSync(path.join(school.dataDir, `${table}.xml`)));
    if (missingTables.length) {
      results.push({
        ...school,
        typeName: TYPE_NAMES[school.context.xxlbdm] || school.context.xxlbdm || '未知',
        status: 'skipped',
        missingTables,
      });
      continue;
    }

    const fileName = `${school.context.dwdm}_${sanitizeFileName(school.unitName)}_系统重建年报.xlsx`;
    const outputPath = path.join(rebuiltRoot, fileName);
    try {
      const rebuilt = rebuildReportFromPackage(school.schoolDir, templatePath, '');
      const mapping = verifyPackageMapping(rebuilt.workbook, school.dataDir);
      const computed = {};
      const validation = applyReportRules({
        workbook: rebuilt.workbook,
        computed,
        ruleFiles,
        ruleContext: school.context,
        explanationContext: { unitName: school.unitName, xxlbdm: school.context.xxlbdm },
      });
      XLSX.writeFile(rebuilt.workbook, outputPath, { bookType: 'xlsx' });
      const workbookCheck = workbookVerification(rebuilt.workbook);
      const forcedFailed = validation.failed.filter((item) => item.severity === '强制');
      const hintFailed = validation.failed.filter((item) => item.severity !== '强制');
      const systemPass = rebuilt.warnings.length === 0
        && mapping.errors.length === 0
        && workbookCheck.missingSheets.length === 0
        && workbookCheck.formulaErrors.length === 0
        && forcedFailed.length === 0;
      results.push({
        ...school,
        typeName: TYPE_NAMES[school.context.xxlbdm] || school.context.xxlbdm || '未知',
        status: systemPass ? 'passed' : 'failed',
        outputPath,
        financials: sourceFinancials(school.dataDir),
        rebuildWarnings: rebuilt.warnings,
        mapping,
        workbookCheck,
        validation: {
          loaded: validation.loaded,
          checked: validation.checked,
          passed: validation.passed,
          adjusted: validation.adjusted,
          forcedFailed,
          hintFailed,
          skipped: validation.skipped,
          skippedDetails: validation.skippedDetails,
          summary: validation.summary,
        },
      });
    } catch (error) {
      results.push({
        ...school,
        typeName: TYPE_NAMES[school.context.xxlbdm] || school.context.xxlbdm || '未知',
        status: 'failed',
        error: error.stack || error.message,
      });
    }
  }

  const tested = results.filter((item) => item.status !== 'skipped');
  const summary = {
    generatedAt: new Date().toISOString(),
    dataRoot,
    templatePath,
    outputRoot,
    privateCount: schools.length,
    testedCount: tested.length,
    skippedCount: results.filter((item) => item.status === 'skipped').length,
    passedCount: results.filter((item) => item.status === 'passed').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    totalForcedFailed: tested.reduce((sum, item) => sum + (item.validation?.forcedFailed?.length || 0), 0),
    totalHintFailed: tested.reduce((sum, item) => sum + (item.validation?.hintFailed?.length || 0), 0),
    totalAdjusted: tested.reduce((sum, item) => sum + (item.validation?.adjusted?.length || 0), 0),
    totalSkippedRules: tested.reduce((sum, item) => sum + Object.values(item.validation?.skipped || {}).reduce((a, b) => a + Number(b || 0), 0), 0),
    results,
  };
  fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify({ ...summary, results: results.map((item) => ({
    unitName: item.unitName,
    typeName: item.typeName,
    status: item.status,
    forcedFailed: item.validation?.forcedFailed?.length || 0,
    hintFailed: item.validation?.hintFailed?.length || 0,
    adjusted: item.validation?.adjusted?.length || 0,
    skippedRules: item.validation?.skipped || {},
    warningCount: item.rebuildWarnings?.length || 0,
    mappingErrors: item.mapping?.errors?.length || 0,
    missingTables: item.missingTables || [],
    error: item.error || '',
  })) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
