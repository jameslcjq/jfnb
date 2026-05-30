const assert = require('assert');
const path = require('path');
const { sanitizeFileName, resolveInside, isPathInside } = require('../src/path-safety');
const { extractEduDataFromRows } = require('../src/report-engine');

function testPathSafety() {
  assert.strictEqual(sanitizeFileName('../A:B*?'), '.._A_B__');
  assert.strictEqual(sanitizeFileName('CON'), 'CON_');

  const base = path.resolve('C:/safe/base');
  assert.ok(isPathInside(base, path.join(base, 'child.xlsx')));
  assert.throws(() => resolveInside(base, '..', 'outside.xlsx'), /超出允许目录/);
}

function testEduRowsExtraction() {
  const rows = [
    {
      学校名称: '沭阳县中心小学',
      bxlx: '211',
      小学学生数: 100,
      初中学生数: 0,
      高中学生数: 0,
      幼儿园学生数: 0,
      小学随班就读: 2,
      初中随班就读: 0,
      高中残疾人: 0,
      小学住宿生: 3,
      初中住宿生: 0,
      高中住宿生: 0,
      教职工数: 10,
      教职工中在编人数: 8,
      专任教师: 9,
      专任教师中在编人员: 7,
    },
    {
      学校名称: '沭阳县教学点',
      bxlx: '218',
      小学学生数: 20,
      小学随班就读: 1,
      小学住宿生: 0,
      教职工数: 2,
      教职工中在编人数: 2,
      专任教师: 2,
      专任教师中在编人员: 2,
    },
  ];

  const data = extractEduDataFromRows(rows, '中心小学别名', {
    schoolAliases: { 中心小学别名: '沭阳县中心小学' },
    mergeGroups: {
      沭阳县中心小学: ['沭阳县中心小学', '沭阳县教学点', '已撤销学校'],
    },
    ignoredClosedSchools: ['已撤销学校'],
  });

  assert.ok(data);
  assert.strictEqual(data.学校名称, '沭阳县中心小学');
  assert.strictEqual(data.小学学生数, 120);
  assert.strictEqual(data.小学随班就读, 3);
  assert.strictEqual(data.教职工数, 12);
  assert.deepStrictEqual(data.合并缺失学校, []);
}

testPathSafety();
testEduRowsExtraction();
console.log('All tests passed.');
