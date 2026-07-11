const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { sanitizeFileName, resolveInside, isPathInside } = require('../src/path-safety');
const { extractEduDataFromRows, computePrivateDraft, eduDataFromCollectControls, WB } = require('../src/report-engine');
const collectClient = require('../src/collect-client');

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

function testEduRowsFuzzyMatchWarnings() {
  const rows = [
    { 学校名称: '沭阳县中心小学', bxlx: '211', 小学学生数: 100 },
  ];

  const data = extractEduDataFromRows(rows, '中心小学');
  assert.ok(data);
  assert.strictEqual(data.学校名称, '沭阳县中心小学');
  assert.ok(Array.isArray(data.匹配警告));
  assert.strictEqual(data.匹配警告.length, 1);
  assert.match(data.匹配警告[0], /模糊匹配/);
}

function testEduRowsAmbiguousFuzzyMatch() {
  const rows = [
    { 学校名称: '沭阳县实验小学', bxlx: '211' },
    { 学校名称: '沭阳县第二实验小学', bxlx: '211' },
  ];

  assert.throws(
    () => extractEduDataFromRows(rows, '实验小学'),
    /模糊匹配到多个候选/,
  );
}

function buildMinimalPrevWorkbook() {
  const wb = XLSX.utils.book_new();
  for (const name of ['人员情况表', '支出情况表', '费用情况表', '资产价值量情况表', '资产实物量情况表']) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['占位']]), name);
  }
  const tmp = path.join(os.tmpdir(), `gznb-prev-${process.pid}-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, tmp);
  return tmp;
}

// 民办草稿：举办者抽回必须落到明细行 F97，且小计 F94 = 明细之和，
// 否则政府平台“合计=明细之和”校验不过（回归 6b5053f 之后的修复）。
function testPrivateDraftSponsorWithdrawBalance() {
  const tmp = buildMinimalPrevWorkbook();
  try {
    const computed = computePrivateDraft(new WB(tmp), null, {
      tuitionIncome: 120000, fiscalSubsidy: 0, wageTotal: 80000, capitalExpense: 5000,
      hasLoan: true, interestExpense: 1000,
      hasDonation: true, donationIncome: 500, donationExpense: 300,
      hasSponsorWithdraw: true, sponsorWithdraw: 2000,
    });
    const e = computed.支出情况表;
    assert.strictEqual(e.F95, 1000, '利息应在 F95');
    assert.strictEqual(e.F96, 300, '捐赠支出应在 F96');
    assert.strictEqual(e.F97, 2000, '举办者抽回应落到 F97');
    assert.strictEqual(e.F94, e.F95 + e.F96 + e.F97, 'F94 应等于明细之和');
    assert.strictEqual(e.F94, 3300);

    const off = computePrivateDraft(new WB(tmp), null, {
      tuitionIncome: 100000, fiscalSubsidy: 0, wageTotal: 60000, capitalExpense: 0,
    });
    assert.strictEqual(off.支出情况表.F97, 0, '未开举办者抽回时 F97 应为 0');
    assert.strictEqual(off.支出情况表.F94, off.支出情况表.F95 + off.支出情况表.F96 + off.支出情况表.F97);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// 结余：商品服务支出 = 收入 − 关键支出 − 结余；结余为正支出应减少，为负应增加
function testPrivateDraftNetBalance() {
  const tmp = buildMinimalPrevWorkbook();
  try {
    const base = { tuitionIncome: 120000, fiscalSubsidy: 0, wageTotal: 80000, capitalExpense: 5000 };
    const f47 = (controls) => computePrivateDraft(new WB(tmp), null, controls).支出情况表.F47;

    const noBalance = f47({ ...base });                            // 120000-80000-5000 = 35000
    const surplus = f47({ ...base, netBalance: 10000 });           // 25000
    const deficit = f47({ ...base, netBalance: -8000 });           // 43000
    assert.strictEqual(noBalance, 35000);
    assert.strictEqual(surplus, 25000, '结余 1 万应让商品服务支出少 1 万');
    assert.strictEqual(deficit, 43000, '亏空 8 千应让商品服务支出多 8 千');

    // 结余大到吃穿收入 → 商品服务支出置 0 并给警告
    const over = computePrivateDraft(new WB(tmp), null, { ...base, netBalance: 40000 });
    assert.strictEqual(over.支出情况表.F47, 0);
    assert.ok(over.__meta.warnings.some((w) => w.includes('结余')), '超额结余应有警告');
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// 事业年报弃用：采集人数 → 事业年报数据结构映射，年末人员/学生数应正确进人员情况表
function testEduDataFromCollectControls() {
  const mapped = eduDataFromCollectControls({ staffCount: 12, teacherCount: 9, studentCount: 150 });
  assert.strictEqual(mapped.教职工数, 12);
  assert.strictEqual(mapped.专任教师, 9);
  assert.strictEqual(mapped.幼儿园学生数, 150);
  assert.strictEqual(mapped.小学学生数, 0);
  assert.strictEqual(mapped.bxlx, '111');

  // 未填专任教师 → 默认等于教职工数
  const noTeacher = eduDataFromCollectControls({ staffCount: 10, studentCount: 80 });
  assert.strictEqual(noTeacher.专任教师, 10);

  // 无人数（升级前旧提交）→ null，走回退逻辑
  assert.strictEqual(eduDataFromCollectControls({ tuitionIncome: 1000 }), null);
  assert.strictEqual(eduDataFromCollectControls({}), null);

  // 端到端：映射结果喂 computePrivateDraft，人员情况表年末数应生效
  const tmp = buildMinimalPrevWorkbook();
  try {
    const computed = computePrivateDraft(new WB(tmp), mapped, {
      tuitionIncome: 120000, fiscalSubsidy: 0, wageTotal: 80000, capitalExpense: 0,
      staffCount: 12, teacherCount: 9, studentCount: 150,
    });
    assert.strictEqual(computed.人员情况表.J14, 12, '年末教职工应取采集值');
    assert.strictEqual(computed.人员情况表.J15, 9, '年末专任教师应取采集值');
    assert.strictEqual(computed.人员情况表.J30, 150, '年末学生数应取采集值');
    assert.ok(!computed.__meta.warnings.some((w) => w.includes('沿用上年')), '有采集人数时不应警告沿用上年');
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// 采集客户端：URL 拼接、鉴权头、严格响应校验、https 强制（用假 fetch，不联网）
async function testCollectClient() {
  const calls = [];
  const jsonRes = (obj, status = 200) => ({
    ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(obj),
  });
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    if (String(url).includes('/schools/sync')) {
      return jsonRes({ ok: true, year: 2026, count: 1, deactivated: 0, schools: [{ unitName: 'A', fillCode: 'x', url: 'u' }] });
    }
    return jsonRes({ ok: true, year: 2026, mode: 'merged', cursor: 5, count: 0, submissions: [] });
  };

  const push = await collectClient.pushSchools(
    { serverUrl: 'https://h/collect/', token: 't', year: 2026, schools: [{ unitName: 'A' }] }, fakeFetch);
  assert.strictEqual(push.count, 1);
  assert.strictEqual(calls[0].url, 'https://h/collect/api/v1/schools/sync', '末尾斜杠应去掉再拼路径');
  assert.strictEqual(calls[0].opts.method, 'POST');
  assert.strictEqual(calls[0].opts.headers.Authorization, 'Bearer t');
  assert.strictEqual(JSON.parse(calls[0].opts.body).snapshot, true, '推送应带快照对账标志');

  const subs = await collectClient.fetchSubmissions(
    { serverUrl: 'https://h/collect', token: 't', year: 2026, sinceId: 3 }, fakeFetch);
  assert.strictEqual(subs.mode, 'merged');
  assert.ok(calls[1].url.includes('mode=merged'), '默认应取合并汇总');
  assert.ok(calls[1].url.includes('sinceId=3'), '应带 sinceId 增量游标');

  // F-08：HTTP 200 但非 JSON（代理错误页）必须报错，不能吞成“成功 0 条”
  const htmlFetch = async () => ({ ok: true, status: 200, text: async () => '<html>Bad Gateway</html>' });
  await assert.rejects(
    () => collectClient.fetchSubmissions({ serverUrl: 'https://h', token: 't', year: 2026 }, htmlFetch),
    /不是有效数据/);
  // ok 字段缺失/false 也应报错
  const notOkFetch = async () => ({ ok: true, status: 200, text: async () => '{}' });
  await assert.rejects(
    () => collectClient.fetchSubmissions({ serverUrl: 'https://h', token: 't', year: 2026 }, notOkFetch),
    /失败/);

  // F-17：非本机地址禁止 http；本机回环允许
  await assert.rejects(
    () => collectClient.fetchSubmissions({ serverUrl: 'http://jyj.yunbg.vip/collect', token: 't', year: 2026 }, fakeFetch),
    /https/);
  const local = await collectClient.fetchSubmissions(
    { serverUrl: 'http://127.0.0.1:4000', token: 't', year: 2026 }, fakeFetch);
  assert.strictEqual(local.ok, true, '本机 http 应放行用于联调');

  await assert.rejects(
    () => collectClient.pushSchools({ serverUrl: '', token: 't', year: 2026, schools: [{ unitName: 'A' }] }, fakeFetch),
    /服务器地址/);
  await assert.rejects(
    () => collectClient.fetchSubmissions({ serverUrl: 'https://h', token: '', year: 2026 }, fakeFetch),
    /令牌/);
}

(async () => {
  testPathSafety();
  testEduRowsExtraction();
  testEduRowsFuzzyMatchWarnings();
  testEduRowsAmbiguousFuzzyMatch();
  testPrivateDraftSponsorWithdrawBalance();
  testPrivateDraftNetBalance();
  testEduDataFromCollectControls();
  await testCollectClient();
  console.log('All tests passed.');
})().catch((err) => { console.error(err); process.exit(1); });
