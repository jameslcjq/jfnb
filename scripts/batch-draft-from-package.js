// 民办草稿路径真实数据彩排：用 2025 上报包重建件当“上年经费年报”，
// 从包中提取关键数(学费/财政补助/工资/资本性支出/结余等)作为经办输入，
// 走 generatePrivateDraft 重新生成经费年报并校验——即明年真实使用场景。
// 用法：node scripts/batch-draft-from-package.js [上报包根目录] [输出目录]
const fs = require('fs');
const path = require('path');
const { generatePrivateDraft, WB } = require('../src/report-engine');
const { sanitizeFileName } = require('../src/path-safety');
const { rebuildReportFromPackage } = require('./rebuild-report-from-package');

const dataRoot = path.resolve(process.argv[2] || 'E:\\经费年报\\2025年学校经费年报数据');
const outputRoot = path.resolve(process.argv[3] || 'E:\\经费年报\\outputs\\民办草稿彩排');
const templatePath = 'E:\\经费年报\\经费年报模板.xlsx';
const projectRoot = path.resolve(__dirname, '..');
const ruleFiles = [
  { path: path.join(projectRoot, 'rules', '自定义公式.xlsx'), source: '自定义公式' },
  { path: path.join(projectRoot, 'rules', '系统公式.xlsx'), source: '系统公式' },
];
const explanationLibrary = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(projectRoot, 'rules', '说明库.json'), 'utf8')); } catch { return null; }
})();

// 民办草稿支持的学校类型（中职有正式报表，不走草稿路径）。
const STAGE_BY_XXLBDM = {
  8: { stage: '幼儿园', bxlx: '111' },
  61: { stage: '普通小学', bxlx: '211' },
  413: { stage: '初级中学', bxlx: '311' },
  411: { stage: '高级中学', bxlx: '342' },
  414: { stage: '九年制学校', bxlx: '312' },
  412: { stage: '完全中学', bxlx: '341' },
  415: { stage: '十二年制学校', bxlx: '345' },
};

function tag(xml, name) {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`, 'i').exec(String(xml || ''));
  return match ? match[1].trim() : '';
}

function cellNum(sheet, addr) {
  return Number(WB.cellNum(sheet, addr)) || 0;
}

// 从重建件提取经办要填的关键数与教育事业数据。
function deriveInputs(workbook) {
  const wb = { workbook, findSheet: (name) => workbook.Sheets[name] };
  const income = workbook.Sheets['收入情况表'];
  const expense = workbook.Sheets['支出情况表'];
  const person = workbook.Sheets['人员情况表'];
  const c = (sheet, addr) => cellNum(sheet, addr);
  const totalIncome = c(income, 'J11');
  const totalExpense = c(expense, 'F14');
  const 高中 = c(person, 'J31'), 初中 = c(person, 'J32'), 小学 = c(person, 'J33');
  const 幼儿园 = Math.max(0, c(person, 'J30') - 高中 - 初中 - 小学);
  return {
    controls: {
      tuitionIncome: c(income, 'J27'),
      fiscalSubsidy: c(income, 'J12'),
      wageTotal: c(expense, 'F16'),
      capitalExpense: c(expense, 'F76'),
      otherIncome: c(income, 'J36'),
      netBalance: Math.round((totalIncome - totalExpense) * 100) / 100,
      hasHeating: c(income, 'J58') > 0,
      hasRent: c(expense, 'F59') > 0,
      rentExpense: c(expense, 'F59'),
      hasLoan: c(expense, 'F95') > 0,
      interestExpense: c(expense, 'F95'),
      hasDonation: c(expense, 'F96') > 0,
      donationIncome: 0,
      donationExpense: c(expense, 'F96'),
      hasSponsorInput: c(income, 'J43') > 0,
      sponsorInput: c(income, 'J43'),
      hasSponsorWithdraw: c(expense, 'F97') > 0,
      sponsorWithdraw: c(expense, 'F97'),
    },
    eduData: {
      教职工数: c(person, 'J14'),
      专任教师: c(person, 'J15'),
      年末编制外长期聘用人员: c(person, 'J16'),
      年末离退休人员: c(person, 'J17'),
      高中学生数: 高中, 初中学生数: 初中, 小学学生数: 小学, 幼儿园学生数: 幼儿园,
      高中随班就读: c(person, 'J35'), 初中随班就读: c(person, 'J36'), 小学随班就读: c(person, 'J37'),
      高中住宿生: c(person, 'J39'), 初中住宿生: c(person, 'J40'), 小学住宿生: c(person, 'J41'),
      年末学前一年在园儿童人数: c(person, 'J45'),
      年末托育幼儿人数: c(person, 'J47'),
    },
    financials: { totalIncome, totalExpense },
  };
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const results = [];
  for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const schoolDir = path.join(dataRoot, entry.name);
    const infoPath = path.join(schoolDir, 'ziptemp', 'ModelSchoolInfo.xml');
    if (!fs.existsSync(infoPath)) continue;
    const info = fs.readFileSync(infoPath, 'utf8');
    if (tag(info, 'LSGXDM') !== '25') continue; // 只测民办
    const xxlbdm = tag(info, 'XXLBDM');
    const stageInfo = STAGE_BY_XXLBDM[xxlbdm];
    const unitName = tag(info, 'XXMC') || entry.name.replace(/^[^_]+_/, '');
    const dataDir = path.join(schoolDir, 'ziptemp', tag(info, 'XXDM'));
    if (!fs.existsSync(path.join(dataDir, 'j2_1.xml'))) continue; // 合并填报分园无独立数据
    if (!stageInfo) { results.push({ unitName, xxlbdm, status: 'skipped', reason: '中职等非草稿类型' }); continue; }

    const schoolOut = path.join(outputRoot, sanitizeFileName(unitName));
    fs.mkdirSync(schoolOut, { recursive: true });
    try {
      // 1. 重建 2025 报表 = 明年的“上年经费年报”
      const prevPath = path.join(schoolOut, `${sanitizeFileName(unitName)}上年经费年报.xlsx`);
      const rebuilt = rebuildReportFromPackage(schoolDir, templatePath, prevPath);
      if (rebuilt.warnings.length) throw new Error(`重建警告：${rebuilt.warnings.join('；')}`);
      // 2. 从重建件提取经办关键数
      const { controls, eduData, financials } = deriveInputs(rebuilt.workbook);
      controls.schoolStage = stageInfo.stage;
      controls.stage = stageInfo.stage;
      eduData.学校名称 = unitName;
      eduData.bxlx = stageInfo.bxlx;
      // 3. 走民办草稿路径重新生成 + 校验
      const logs = [];
      const res = await generatePrivateDraft({
        unitName, prevReportPath: prevPath, eduData, controls,
        outputDir: schoolOut, layoutTemplatePath: templatePath,
        onLog: (message, type) => logs.push({ type, message }),
        ruleOptions: {
          reportRuleFiles: ruleFiles,
          reportRuleContext: {
            dqdm: tag(info, 'DQDM'), bbnd: '2025', xxlbdm,
            lsgxdm: '25', dwdm: tag(info, 'XXDM'), cxfldm: tag(info, 'CXFLDM'), phx: tag(info, 'PHX'),
          },
          explanationLibrary,
        },
      });
      const validation = res.computed.__meta.validation || {};
      const forced = (validation.failed || []).filter((item) => item.severity === '强制');
      results.push({
        unitName, xxlbdm, stage: stageInfo.stage,
        status: forced.length ? 'forced-failed' : 'passed',
        financials, controls: { ...controls },
        checked: validation.checked, passed: validation.passed,
        adjusted: (validation.adjusted || []).length,
        forced: forced.map((item) => ({ id: item.id, message: item.message, formula: item.formula, left: item.leftValue, right: item.rightValue })),
        hints: (validation.failed || []).filter((item) => item.severity !== '强制').map((item) => item.id),
        errorLogs: logs.filter((log) => log.type === 'error').map((log) => log.message),
      });
    } catch (error) {
      results.push({ unitName, xxlbdm, status: 'error', error: error.message });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    tested: results.filter((item) => item.status !== 'skipped').length,
    passed: results.filter((item) => item.status === 'passed').length,
    forcedFailed: results.filter((item) => item.status === 'forced-failed').length,
    errors: results.filter((item) => item.status === 'error').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    results,
  };
  fs.writeFileSync(path.join(outputRoot, '民办草稿彩排结果.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify({
    tested: summary.tested, passed: summary.passed, forcedFailed: summary.forcedFailed,
    errors: summary.errors, skipped: summary.skipped,
    failures: results.filter((item) => item.status !== 'passed' && item.status !== 'skipped')
      .map((item) => ({ unitName: item.unitName, stage: item.stage, status: item.status, forced: (item.forced || []).map((f) => f.id), error: item.error })),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
