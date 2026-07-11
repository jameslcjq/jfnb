const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { sanitizeFileName, resolveInside, isPathInside } = require('../src/path-safety');
const { extractEduDataFromRows, computePrivateDraft, eduDataFromCollectControls, writeReport, WB } = require('../src/report-engine');
const collectClient = require('../src/collect-client');
const downloadIntercept = require('../src/download-intercept');

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

function buildMinimalPrevWorkbook(personCells = {}) {
  const wb = XLSX.utils.book_new();
  for (const name of ['人员情况表', '支出情况表', '费用情况表', '资产价值量情况表', '资产实物量情况表']) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['占位']]), name);
  }
  const personSheet = wb.Sheets['人员情况表'];
  for (const [addr, value] of Object.entries(personCells)) personSheet[addr] = { t: 'n', v: value };
  personSheet['!ref'] = 'A1:M50';
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

// 事业年报弃用：采集人数 → 事业年报数据结构映射，覆盖单学段与组合学校。
function testEduDataFromCollectControls() {
  const base = {
    staffCount: 12, teacherCount: 9, externalLongTermStaffCount: 2, retiredStaffCount: 3,
    studentCount: 0,
    kindergartenStudentCount: 0, preschoolOneYearEndCount: 0, nurseryEndCount: 0,
    primaryStudentCount: 0, primaryInclusiveStudentCount: 0, primaryBoardingStudentCount: 0,
    juniorStudentCount: 0, juniorInclusiveStudentCount: 0, juniorBoardingStudentCount: 0,
    seniorStudentCount: 0, seniorInclusiveStudentCount: 0, seniorBoardingStudentCount: 0,
  };
  const cases = [
    {
      stage: '幼儿园', bxlx: '111', values: {
        studentCount: 60, kindergartenStudentCount: 60, preschoolOneYearEndCount: 18, nurseryEndCount: 4,
      }, expected: { 幼儿园学生数: 60, 小学学生数: 0, 初中学生数: 0, 高中学生数: 0 },
    },
    {
      stage: '普通小学', bxlx: '211', values: {
        studentCount: 80, primaryStudentCount: 80, primaryInclusiveStudentCount: 3, primaryBoardingStudentCount: 5,
      }, expected: { 幼儿园学生数: 0, 小学学生数: 80, 初中学生数: 0, 高中学生数: 0 },
    },
    {
      stage: '九年制学校', bxlx: '312', values: {
        studentCount: 120, primaryStudentCount: 75, juniorStudentCount: 45,
      }, expected: { 幼儿园学生数: 0, 小学学生数: 75, 初中学生数: 45, 高中学生数: 0 },
    },
    {
      stage: '完全中学', bxlx: '341', values: {
        studentCount: 150, juniorStudentCount: 65, seniorStudentCount: 85,
      }, expected: { 幼儿园学生数: 0, 小学学生数: 0, 初中学生数: 65, 高中学生数: 85 },
    },
    {
      stage: '十二年制学校', bxlx: '345', values: {
        studentCount: 210, primaryStudentCount: 90, juniorStudentCount: 70, seniorStudentCount: 50,
      }, expected: { 幼儿园学生数: 0, 小学学生数: 90, 初中学生数: 70, 高中学生数: 50 },
    },
  ];

  for (const item of cases) {
    const mapped = eduDataFromCollectControls({ ...base, ...item.values, schoolStage: item.stage });
    assert.strictEqual(mapped.bxlx, item.bxlx, `${item.stage} 办学类型应正确`);
    assert.strictEqual(mapped.学生总数, item.values.studentCount, `${item.stage} 学生合计应正确`);
    for (const [key, expected] of Object.entries(item.expected)) {
      assert.strictEqual(mapped[key], expected, `${item.stage} ${key} 应正确`);
    }
    assert.strictEqual(mapped.年末编制外长期聘用人员, 2);
    assert.strictEqual(mapped.年末离退休人员, 3);
  }

  const kindergarten = eduDataFromCollectControls({ ...base, ...cases[0].values, stage: '幼儿园' });
  assert.strictEqual(kindergarten.年末学前一年在园儿童人数, 18);
  assert.strictEqual(kindergarten.年末托育幼儿人数, 4);

  // 没有显式类别时按非零学段明细推断，不根据“字段存在”误判。
  const inferredNineYear = eduDataFromCollectControls({
    ...base, studentCount: 30, primaryStudentCount: 20, juniorStudentCount: 10,
  });
  assert.strictEqual(inferredNineYear.bxlx, '312');

  // 单学段旧提交只有合计时，可由显式类别安全归段；不得固定写入幼儿园。
  const legacyPrimary = eduDataFromCollectControls({
    staffCount: 10, teacherCount: 8, studentCount: 80, schoolStage: '普通小学',
  });
  assert.strictEqual(legacyPrimary.小学学生数, 80);
  assert.strictEqual(legacyPrimary.幼儿园学生数, 0);

  // 无类别的升级前旧提交保留学生合计，但不猜测学段。
  const legacyUnknown = eduDataFromCollectControls({ staffCount: 10, teacherCount: 8, studentCount: 80 });
  assert.strictEqual(legacyUnknown.学生总数, 80);
  assert.strictEqual(legacyUnknown.bxlx, '');
  assert.strictEqual(legacyUnknown.幼儿园学生数, 0);
  assert.strictEqual(legacyUnknown.小学学生数, 0);

  // 未填教学人员 → 默认等于教职工数；明确填 0 时保留 0。
  const noTeacher = eduDataFromCollectControls({ staffCount: 10, studentCount: 80 });
  assert.strictEqual(noTeacher.专任教师, 10);
  const zeroTeacher = eduDataFromCollectControls({ staffCount: 10, teacherCount: 0, studentCount: 0, schoolStage: '普通小学' });
  assert.strictEqual(zeroTeacher.专任教师, 0);

  // 零学生学校依赖显式类别，仍应生成有效的全 0 学段数据。
  const zeroStudents = eduDataFromCollectControls({
    ...base, staffCount: 5, teacherCount: 4, schoolStage: '完全中学',
  });
  assert.ok(zeroStudents);
  assert.strictEqual(zeroStudents.bxlx, '341');
  assert.strictEqual(zeroStudents.学生总数, 0);

  // 无人数（升级前旧提交）→ null，走回退逻辑
  assert.strictEqual(eduDataFromCollectControls({ tuitionIncome: 1000 }), null);
  assert.strictEqual(eduDataFromCollectControls({}), null);

  // 端到端：组合学校的分学段、随班、寄宿和新增人员字段应进入人员表。
  const mapped = eduDataFromCollectControls({
    ...base,
    schoolStage: '十二年制学校', studentCount: 210,
    primaryStudentCount: 90, primaryInclusiveStudentCount: 2, primaryBoardingStudentCount: 8,
    juniorStudentCount: 70, juniorInclusiveStudentCount: 3, juniorBoardingStudentCount: 9,
    seniorStudentCount: 50, seniorInclusiveStudentCount: 4, seniorBoardingStudentCount: 10,
  });
  const tmp = buildMinimalPrevWorkbook({ J45: 11, J47: 6 });
  try {
    const computed = computePrivateDraft(new WB(tmp), mapped, {
      tuitionIncome: 120000, fiscalSubsidy: 0, wageTotal: 80000, capitalExpense: 0,
    });
    assert.strictEqual(computed.人员情况表.J14, 12, '年末教职工应取采集值');
    assert.strictEqual(computed.人员情况表.J15, 9, '年末专任教师应取采集值');
    assert.strictEqual(computed.人员情况表.J16, 2, '编制外长期聘用人员应取采集值');
    assert.strictEqual(computed.人员情况表.J17, 3, '离退休人员应取采集值');
    assert.strictEqual(computed.人员情况表.J30, 210, '年末学生数应取分学段合计');
    assert.deepStrictEqual(
      [computed.人员情况表.J31, computed.人员情况表.J32, computed.人员情况表.J33],
      [50, 70, 90],
      '高中、初中、小学年末人数应分别写入 J31-J33',
    );
    assert.deepStrictEqual(
      [computed.人员情况表.J34, computed.人员情况表.J35, computed.人员情况表.J36, computed.人员情况表.J37],
      [9, 4, 3, 2],
      '随班就读合计及高中、初中、小学明细应正确',
    );
    assert.deepStrictEqual(
      [computed.人员情况表.J38, computed.人员情况表.J39, computed.人员情况表.J40, computed.人员情况表.J41],
      [27, 10, 9, 8],
      '寄宿合计及高中、初中、小学明细应正确',
    );
    assert.strictEqual(computed.人员情况表.J44, 11, '年初学前一年人数应取上年 J45');
    assert.strictEqual(computed.人员情况表.J46, 6, '年初托育人数应取上年 J47');
    assert.ok(!computed.__meta.warnings.some((w) => w.includes('沿用上年')), '有采集人数时不应警告沿用上年');

    const kindergartenComputed = computePrivateDraft(new WB(tmp), kindergarten, {
      tuitionIncome: 120000, fiscalSubsidy: 0, wageTotal: 80000, capitalExpense: 0,
    });
    assert.strictEqual(kindergartenComputed.人员情况表.J45, 18, '年末学前一年人数应取采集值');
    assert.strictEqual(kindergartenComputed.人员情况表.J47, 4, '年末托育人数应取采集值');
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

async function testWriteReportCollectPersonCells() {
  const templatePath = path.join(os.tmpdir(), `gznb-layout-${process.pid}-${Date.now()}.xlsx`);
  const outputPath = path.join(os.tmpdir(), `gznb-output-${process.pid}-${Date.now()}.xlsx`);
  const wb = XLSX.utils.book_new();
  for (const name of ['人员情况表', '收入情况表', '支出情况表', '费用情况表', '资产价值量情况表', '资产实物量情况表']) {
    const ws = XLSX.utils.aoa_to_sheet([['占位']]);
    ws['!ref'] = 'A1:M110';
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, templatePath);

  try {
    const computed = {
      人员情况表: { J16: 2, J17: 3, J44: 11, J45: 18, J46: 6, J47: 4 },
      收入情况表: {}, 支出情况表: {}, 费用情况表: {},
      资产价值量情况表: {}, 资产实物量情况表: {},
    };
    await writeReport(computed, '测试学校', outputPath, templatePath);
    const output = XLSX.readFile(outputPath);
    const person = output.Sheets['人员情况表'];
    assert.deepStrictEqual(
      ['J16', 'J17', 'J44', 'J45', 'J46', 'J47'].map((addr) => person[addr]?.v),
      [2, 3, 11, 18, 6, 4],
      '新增人员、学前一年和托育人数应写入最终 Excel',
    );
  } finally {
    for (const file of [templatePath, outputPath]) {
      try { fs.unlinkSync(file); } catch { /* ignore */ }
    }
  }
}

// 下载拦截：URL 识别 + 内容复核（真实工作簿）
function testDownloadIntercept() {
  const { isEducationFundingReportDownload, inspectPrevReport } = downloadIntercept;
  assert.strictEqual(isEducationFundingReportDownload('https://jyjjxx.moe.edu.cn/JYJF1/file/excelFileDownload?x', '基表.xlsx'), true);
  assert.strictEqual(isEducationFundingReportDownload('blob:https://jyjjxx.moe.edu.cn/abc', '上年经费年报_甲.xlsx'), true);
  assert.strictEqual(isEducationFundingReportDownload('https://evil.com/x.xlsx', '基表.xlsx'), false, '非政府域名不拦');
  assert.strictEqual(isEducationFundingReportDownload('https://jyjjxx.moe.edu.cn/x', '说明.pdf'), false, '非 excel 不拦');

  // 正常基表：5+ sheet 且名含「中小学校」，sheet0 B4=单位名
  const good = XLSX.utils.book_new();
  const s0 = XLSX.utils.aoa_to_sheet([['人员情况表'], [], [], ['单位名称', '沭阳县测试小学']]);
  XLSX.utils.book_append_sheet(good, s0, '中小学校（单位）人员情况表');
  for (const n of ['收入表', '支出表', '费用表', '资产表']) {
    XLSX.utils.book_append_sheet(good, XLSX.utils.aoa_to_sheet([['占位']]), `中小学校${n}`);
  }
  const goodPath = path.join(os.tmpdir(), `prev-good-${process.pid}-${Date.now()}.xlsx`);
  XLSX.writeFile(good, goodPath);
  try {
    const r = inspectPrevReport(goodPath);
    assert.strictEqual(r.ok, true, '正常基表应通过');
    assert.strictEqual(r.unitName, '沭阳县测试小学');
  } finally { try { fs.unlinkSync(goodPath); } catch { /* ignore */ } }

  // 空模板/导错页：单 sheet，识别不出基表
  const bad = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(bad, XLSX.utils.aoa_to_sheet([['登录']]), 'Sheet1');
  const badPath = path.join(os.tmpdir(), `prev-bad-${process.pid}-${Date.now()}.xlsx`);
  XLSX.writeFile(bad, badPath);
  try {
    assert.strictEqual(inspectPrevReport(badPath).ok, false, '非基表应舍弃');
  } finally { try { fs.unlinkSync(badPath); } catch { /* ignore */ } }
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
  assert.strictEqual(Object.prototype.hasOwnProperty.call(JSON.parse(calls[0].opts.body), 'snapshot'), false,
    '桌面端局部名单不得请求年度快照对账');

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

  // 回传：POST /api/v1/submissions，body 带 submissions 数组
  const backfillCalls = [];
  const backfillFetch = async (url, opts) => {
    backfillCalls.push({ url, opts });
    return jsonRes({ ok: true, saved: 1, failed: 0, results: [{ unitName: 'A', ok: true, version: 3 }] });
  };
  const bf = await collectClient.backfillSubmissions(
    { serverUrl: 'https://h/collect', token: 't', submissions: [{ unitName: 'A', controls: { staffCount: 5 } }] }, backfillFetch);
  assert.strictEqual(bf.results[0].version, 3);
  assert.strictEqual(backfillCalls[0].url, 'https://h/collect/api/v1/submissions', '回传应打到 submissions 接口');
  assert.strictEqual(backfillCalls[0].opts.method, 'POST');
  assert.strictEqual(JSON.parse(backfillCalls[0].opts.body).submissions.length, 1);
  await assert.rejects(
    () => collectClient.backfillSubmissions({ serverUrl: 'https://h', token: 't', submissions: [] }, backfillFetch),
    /没有要回传/);
}

(async () => {
  testPathSafety();
  testEduRowsExtraction();
  testEduRowsFuzzyMatchWarnings();
  testEduRowsAmbiguousFuzzyMatch();
  testPrivateDraftSponsorWithdrawBalance();
  testPrivateDraftNetBalance();
  testEduDataFromCollectControls();
  testDownloadIntercept();
  await testWriteReportCollectPersonCells();
  await testCollectClient();
  console.log('All tests passed.');
})().catch((err) => { console.error(err); process.exit(1); });
