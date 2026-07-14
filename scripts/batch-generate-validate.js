const fs = require('fs');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { generateReport, WB } = require('../src/report-engine');
const { loadSchoolAttributes } = require('../src/school-attributes');

const root = path.resolve(process.argv[2] || 'E:\\经费年报');
const outputRoot = path.resolve(process.argv[3] || path.join(root, `批量生成校验_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`));
const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(root, '经费年报模板.xlsx');
const ruleFiles = [
  { path: path.join(projectRoot, 'rules', '自定义公式.xlsx'), source: '自定义公式' },
  { path: path.join(projectRoot, 'rules', '系统公式.xlsx'), source: '系统公式' },
];
const schoolAttributes = loadSchoolAttributes(path.join(projectRoot, 'rules', '学校属性.json'));

const SOURCE_PATTERNS = {
  资产负债表: /资产负债表\.(xlsx|xls)$/i,
  收入费用表: /收入费用表\.(xlsx|xls)$/i,
  经费支出明细表: /经费支出明细表\.(xlsx|xls)$/i,
  科目余额表: /科目余额表\.(xlsx|xls)$/i,
  上年经费年报: /上年经费年报\.(xlsx|xls)$/i,
};

function num(value) {
  const parsed = Number(String(value == null ? '' : value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function listDirectories(baseDir) {
  const found = [];
  const ignored = new Set(['.git', '.agents', '.codex', 'node_modules', 'release', '校验规则']);
  function visit(dir, depth) {
    if (depth > 2 || path.resolve(dir) === path.resolve(outputRoot)) return;
    found.push(dir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignored.has(entry.name) || entry.name.startsWith('批量生成校验_')) continue;
      const fullPath = path.join(dir, entry.name);
      if (path.resolve(fullPath) === projectRoot) continue;
      visit(fullPath, depth + 1);
    }
  }
  visit(baseDir, 0);
  return found;
}

function findDataset(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
  const sources = {};
  for (const [type, pattern] of Object.entries(SOURCE_PATTERNS)) {
    const match = files.find((name) => pattern.test(name));
    if (match) sources[type] = path.join(dir, match);
  }
  const missing = Object.keys(SOURCE_PATTERNS).filter((type) => !sources[type]);
  if (missing.length) return null;
  const currentReport = files.find((name) => /经费年报\.(xlsx|xls)$/i.test(name)
    && !/上年经费年报|经费年报模板/.test(name));
  return { dir, sources, currentReport: currentReport ? path.join(dir, currentReport) : '' };
}

function inferBxlx(data) {
  const kindergarten = data.幼儿园学生数 > 0;
  const primary = data.小学学生数 > 0;
  const junior = data.初中学生数 > 0;
  const senior = data.高中学生数 > 0;
  if (primary && junior && senior) return '342';
  if (junior && senior) return '341';
  if (primary && junior) return '311';
  if (senior) return '221';
  if (junior) return '211';
  if (primary) return '211';
  if (kindergarten) return '111';
  return '';
}

function extractEduData(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  const report = new WB(reportPath);
  const person = report.findSheet('人员情况表');
  if (!person) return null;
  const cv = (addr) => num(WB.cellVal(person, addr));
  const data = {
    学校名称: String(WB.cellVal(person, 'B4') || path.basename(reportPath).replace(/经费年报\.xlsx?$/i, '')).trim(),
    教职工数: cv('J14'),
    专任教师: cv('J15'),
    年末编制外长期聘用人员: cv('J16'),
    年末离退休人员: cv('J17'),
    高中学生数: cv('J31'),
    初中学生数: cv('J32'),
    小学学生数: cv('J33'),
    高中随班就读: cv('J35'),
    初中随班就读: cv('J36'),
    小学随班就读: cv('J37'),
    高中住宿生: cv('J39'),
    初中住宿生: cv('J40'),
    小学住宿生: cv('J41'),
    年末学前一年在园儿童人数: cv('J45'),
    年末托育幼儿人数: cv('J47'),
  };
  data.幼儿园学生数 = Math.max(0, cv('J30') - data.高中学生数 - data.初中学生数 - data.小学学生数);
  data.bxlx = inferBxlx(data);
  return data;
}

function verifyOutput(filePath) {
  const workbook = XLSX.readFile(filePath, { cellFormula: true });
  const expectedSheets = ['人员情况表', '收入情况表', '支出情况表', '费用情况表', '债务情况表', '资产价值量情况表', '资产实物量情况表'];
  const missingSheets = expectedSheets.filter((name) => !workbook.SheetNames.includes(name));
  const errorCells = [];
  let formulaCells = 0;
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    for (const [addr, cell] of Object.entries(ws)) {
      if (addr.startsWith('!') || !cell) continue;
      if (cell.f) formulaCells += 1;
      if (typeof cell.v === 'string' && /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/.test(cell.v)) {
        errorCells.push(`${sheetName}!${addr}`);
      }
    }
  }
  return { missingSheets, formulaCells, errorCells };
}

async function main() {
  if (!fs.existsSync(templatePath)) throw new Error(`缺少模板：${templatePath}`);
  for (const rule of ruleFiles) if (!fs.existsSync(rule.path)) throw new Error(`缺少规则：${rule.path}`);
  const datasets = listDirectories(root).map(findDataset).filter(Boolean);
  fs.mkdirSync(outputRoot, { recursive: true });
  const results = [];

  for (const dataset of datasets) {
    const relative = path.relative(root, dataset.dir) || path.basename(dataset.dir);
    const outputDir = path.join(outputRoot, relative.replace(/[\\/:*?"<>|]/g, '_'));
    fs.mkdirSync(outputDir, { recursive: true });
    const eduData = extractEduData(dataset.currentReport);
    const logs = [];
    const result = await generateReport(
      dataset.sources,
      eduData,
      outputDir,
      templatePath,
      (message, type) => logs.push({ type, message }),
      {
        reportRuleFiles: ruleFiles,
        reportRuleContext: { dqdm: '321322', bbnd: '2025' },
        schoolAttributes,
      },
    );
    if (!result.ok) {
      results.push({ directory: dataset.dir, ok: false, message: result.message, logs });
      continue;
    }
    const validation = result.computed?.__meta?.validation || {};
    results.push({
      directory: dataset.dir,
      ok: true,
      unitName: result.unitName,
      schoolType: result.schoolType,
      eduDataSource: dataset.currentReport || '',
      outputPath: result.outputPath,
      verification: verifyOutput(result.outputPath),
      validation: {
        loaded: validation.loaded || 0,
        checked: validation.checked || 0,
        passed: validation.passed || 0,
        adjusted: validation.adjusted || [],
        failed: validation.failed || [],
        skipped: validation.skipped || {},
      },
      logs,
    });
  }

  const summaryPath = path.join(outputRoot, '批量校验结果.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), root, outputRoot, results }, null, 2), 'utf8');
  console.log(JSON.stringify({ outputRoot, summaryPath, datasets: datasets.length, success: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results: results.map((item) => ({ directory: path.relative(root, item.directory), ok: item.ok, unitName: item.unitName, checked: item.validation?.checked, passed: item.validation?.passed, adjusted: item.validation?.adjusted?.length, failedRules: item.validation?.failed?.length, message: item.message })) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
