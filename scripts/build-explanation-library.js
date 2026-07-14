// 从县级下发的《校验结果.xlsx》《数据变动原因说明.xlsx》提炼“建议原因”说明库：
//   validation: 公式编号 → 上年各校实际填报的校验说明（本校优先、同类学校常用、全县常用）
//   variance:   平台“数据变动原因”表的 11 个指标 → 各方向(增加/减少)常用变化原因 + 本校上年填报
// 产出 rules/说明库.json，随安装包分发；每年县里下发新表后重跑本脚本。
// 用法: node scripts/build-explanation-library.js [E:\经费年报]
const fs = require('fs');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { normalizeSchoolName } = require('../src/school-attributes');

const root = path.resolve(process.argv[2] || 'E:\\经费年报');
const outPath = path.resolve(__dirname, '..', 'rules', '说明库.json');

function topN(counter, n = 3) {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text, count]) => ({ text, count }));
}

function isPlaceholder(text) {
  const t = String(text || '').trim();
  return !t || t === '1' || t === '无' || t === '/';
}

// ===== 校验结果.xlsx：公式编号 → 学校实际填报的提示性信息说明 =====
function buildValidationLibrary() {
  const wb = XLSX.readFile(path.join(root, '校验结果.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', range: 2 });
  const byRule = {};
  for (const row of rows.slice(1)) {
    const [, dwdm, name, , , note, , ruleId, , , , , xxlbdm] = row;
    const id = String(ruleId || '').trim();
    const text = String(note || '').trim();
    if (!id || isPlaceholder(text)) continue;
    const entry = (byRule[id] = byRule[id] || { bySchool: {}, byTypeCounter: {}, counter: {} });
    const school = normalizeSchoolName(name);
    // 县本级(单位名称=沭阳县)不计入学校映射
    if (school && String(dwdm).length > 6) entry.bySchool[school] = text;
    const type = String(xxlbdm || '').trim();
    if (type) {
      entry.byTypeCounter[type] = entry.byTypeCounter[type] || {};
      entry.byTypeCounter[type][text] = (entry.byTypeCounter[type][text] || 0) + 1;
    }
    entry.counter[text] = (entry.counter[text] || 0) + 1;
  }
  const validation = {};
  for (const [id, entry] of Object.entries(byRule)) {
    const byType = {};
    for (const [type, counter] of Object.entries(entry.byTypeCounter)) byType[type] = topN(counter, 2);
    validation[id] = { bySchool: entry.bySchool, byType, top: topN(entry.counter, 3) };
  }
  return validation;
}

// ===== 数据变动原因说明.xlsx：指标+方向 → 常用变化原因；本校上年填报 =====
function buildVarianceLibrary() {
  const wb = XLSX.readFile(path.join(root, '数据变动原因说明.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', range: 2 });
  const byIndicator = {};
  let minPct = Infinity;
  for (const row of rows.slice(1)) {
    const [table, indicator, , , name, , , pct, dir, , reason, note] = row;
    const key = `${String(table).trim()}|${String(indicator).trim()}`;
    if (!String(indicator || '').trim()) continue;
    const p = Math.abs(Number(pct));
    if (Number.isFinite(p) && p > 0) minPct = Math.min(minPct, p);
    const direction = String(dir || '').trim(); // 增加/减少
    const reasonText = String(reason || '').trim();
    const entry = (byIndicator[key] = byIndicator[key] || { reasons: {}, bySchool: {} });
    if (direction && reasonText) {
      entry.reasons[direction] = entry.reasons[direction] || {};
      entry.reasons[direction][reasonText] = (entry.reasons[direction][reasonText] || 0) + 1;
    }
    const school = normalizeSchoolName(name);
    if (school) {
      entry.bySchool[school] = {
        dir: direction,
        reason: reasonText,
        note: isPlaceholder(note) ? '' : String(note).trim(),
      };
    }
  }
  const indicators = {};
  for (const [key, entry] of Object.entries(byIndicator)) {
    const reasons = {};
    for (const [dir, counter] of Object.entries(entry.reasons)) reasons[dir] = topN(counter, 3);
    indicators[key] = { reasons, bySchool: entry.bySchool };
  }
  return { threshold: Number.isFinite(minPct) ? minPct : 10, indicators };
}

const library = {
  generatedAt: new Date().toISOString(),
  source: '县级下发《校验结果.xlsx》《数据变动原因说明.xlsx》',
  validation: buildValidationLibrary(),
  variance: buildVarianceLibrary(),
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(library, null, 1), 'utf8');
const stats = {
  validationRules: Object.keys(library.validation).length,
  varianceIndicators: Object.keys(library.variance.indicators).length,
  threshold: library.variance.threshold,
  bytes: fs.statSync(outPath).size,
};
console.log(JSON.stringify(stats));
