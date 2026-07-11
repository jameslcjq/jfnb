const db = require('../src/db');
const { config } = require('../src/config');
const { activeSchoolInfo2025 } = require('../src/school-info-2025');

function assertSchoolYearMatches(schools, targetYear) {
  const year = Number(targetYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`目标采集年度无效：${targetYear}`);
  }
  if (!Array.isArray(schools) || schools.length === 0) throw new Error('学校名单为空');

  const mismatches = schools.filter((school) => Number(school?.schoolYear) !== year);
  if (mismatches.length > 0) {
    const examples = mismatches.slice(0, 3)
      .map((school) => `${school?.unitName || '未命名学校'}(${school?.schoolYear ?? '缺失'})`)
      .join('、');
    throw new Error(`学校名单年度与目标采集年度 ${year} 不一致：${examples}${mismatches.length > 3 ? ` 等 ${mismatches.length} 所` : ''}`);
  }
  return year;
}

function main() {
  const schools = activeSchoolInfo2025();
  const year = assertSchoolYearMatches(schools, config.collectionYear);
  try {
    const result = db.syncSchools({ year, schools, snapshot: true });
    const activeSchools = db.listSchools(year);
    const stages = new Map();
    for (const school of activeSchools) {
      const stage = school.stage || '未分类';
      stages.set(stage, (stages.get(stage) || 0) + 1);
    }

    console.log(JSON.stringify({
      ok: true,
      year,
      count: result.schools.length,
      active: activeSchools.length,
      deactivated: result.deactivated,
      stages: Object.fromEntries(stages),
    }, null, 2));
  } finally {
    db.closeDatabase();
  }
}

if (require.main === module) main();

module.exports = { assertSchoolYearMatches };
