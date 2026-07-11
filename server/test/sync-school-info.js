const assert = require('assert');
const { assertSchoolYearMatches } = require('../scripts/sync-school-info');

const schools2025 = [
  { unitName: '甲学校', schoolYear: 2025 },
  { unitName: '乙学校', schoolYear: 2025 },
];

assert.strictEqual(assertSchoolYearMatches(schools2025, 2025), 2025);
assert.throws(
  () => assertSchoolYearMatches(schools2025, 2026),
  /学校名单年度与目标采集年度 2026 不一致/,
  '固定 2025 名单不得写入 2026 年度'
);
assert.throws(
  () => assertSchoolYearMatches([{ unitName: '缺年度学校' }], 2025),
  /缺年度学校\(缺失\)/,
  '每条学校数据都必须显式标注年度'
);
assert.throws(() => assertSchoolYearMatches(schools2025, 'not-a-year'), /目标采集年度无效/);

console.log('School info year safety tests passed.');
