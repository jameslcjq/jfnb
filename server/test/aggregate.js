// 合并组多成员汇总 + schoolMetaJson 可解析性 的针对性测试。
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.API_TOKEN = 'agg-api';
process.env.ADMIN_TOKEN = 'agg-admin';
process.env.PUBLIC_BASE_URL = 'http://localhost:9099';
process.env.COLLECT_YEAR_FOR_TEST = '2025';
process.env.DB_PATH = path.join(os.tmpdir(), `collect-agg-${Date.now()}.db`);

const { createApp } = require('../src/app');

function req(server, { method, path: p, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port: server.address().port, method, path: p,
      headers: { ...(data && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const form = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const API = { Authorization: 'Bearer agg-api' };
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };

(async () => {
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    // 推送：中心园 + 两个成员园（甲带教职工数，用于工资校验元数据）
    let res = await req(server, { method: 'POST', path: '/api/v1/schools/sync', headers: API, body: {
      schools: [
        { unitName: 'X中心园', mergeCenter: 'X中心园', isCenter: true },
        { unitName: 'X成员甲', mergeCenter: 'X中心园', staffCount: 12 },
        { unitName: 'X成员乙', mergeCenter: 'X中心园' },
      ] } });
    const pushed = JSON.parse(res.body);
    const codeJia = pushed.schools.find((s) => s.unitName === 'X成员甲').fillCode;
    const codeYi = pushed.schools.find((s) => s.unitName === 'X成员乙').fillCode;

    // 成员甲：有房租、结余 +8000；成员乙：无房租、亏空 -3000
    await req(server, { method: 'POST', path: '/fill', headers: FORM, body: form({
      fill_code: codeJia, tuitionIncome: '100000', fiscalSubsidy: '10000', wageTotal: '60000', capitalExpense: '2000',
      netBalance: '8000',
      hasRent: 'on', rentExpense: '1000', filler_name: '甲老师', filler_phone: '13800000001' }) });
    await req(server, { method: 'POST', path: '/fill', headers: FORM, body: form({
      fill_code: codeYi, tuitionIncome: '50000', fiscalSubsidy: '5000', wageTotal: '40000', capitalExpense: '3000',
      netBalance: '-3000',
      filler_name: '乙老师', filler_phone: '13800000002' }) });

    // 拉取 merged → 汇总到中心园
    res = await req(server, { method: 'GET', path: '/api/v1/submissions', headers: API });
    const j = JSON.parse(res.body);
    const center = j.submissions.find((s) => s.unitName === 'X中心园');
    assert.ok(center, '应有中心园汇总');
    assert.strictEqual(center.aggregated, true);
    assert.strictEqual(center.controls.tuitionIncome, 150000, '学费应为两成员之和');
    assert.strictEqual(center.controls.fiscalSubsidy, 15000, '财政补助应求和');
    assert.strictEqual(center.controls.wageTotal, 100000, '工资应求和');
    assert.strictEqual(center.controls.capitalExpense, 5000, '资本性支出应求和');
    assert.strictEqual(center.controls.rentExpense, 1000, '房租应求和（仅甲有）');
    assert.strictEqual(center.controls.netBalance, 5000, '结余应带符号求和：+8000 + (-3000) = 5000');
    assert.strictEqual(center.controls.hasRent, true, '开关取或：任一成员有房租即为真');
    assert.strictEqual(center.controls.hasLoan, false, '都无贷款则为假');
    assert.strictEqual(center.submittedMemberCount, 2, '两成员已提交');
    assert.strictEqual(center.memberCount, 3, '成员总数含中心园=3');
    assert.deepStrictEqual(center.sourceUnitNames.sort(), ['X成员乙', 'X成员甲'].sort());

    // schoolMetaJson 必须是可解析 JSON（回归 #3：曾被 HTML 实体转义导致 JSON.parse 失败）
    res = await req(server, { method: 'GET', path: '/fill' });
    const m = res.body.match(/<script type="application\/json" id="schoolMetaJson">([\s\S]*?)<\/script>/);
    assert.ok(m, '应含 schoolMetaJson');
    const meta = JSON.parse(m[1]); // 旧代码此处会抛错
    const names = Object.values(meta).map((x) => x.unitName);
    assert.ok(names.includes('X成员甲'), 'meta 应含成员校名');
    const jiaMeta = Object.values(meta).find((x) => x.unitName === 'X成员甲');
    assert.strictEqual(jiaMeta.staffCount, 12, '推送的教职工数应进 schoolMeta，供工资合理性提示');
    assert.ok(res.body.includes('wageWarnBox'), '确认页应有工资提示容器');
    assert.ok(res.body.includes('wageWarning'), '表单脚本应含工资合理性检查');

    // ===== F-14 金额精度：0.1 + 0.2 应精确等于 0.3 =====
    res = await req(server, { method: 'POST', path: '/api/v1/schools/sync', headers: API, body: {
      schools: [
        { unitName: 'P中心园', mergeCenter: 'P中心园', isCenter: true },
        { unitName: 'P成员甲', mergeCenter: 'P中心园' },
        { unitName: 'P成员乙', mergeCenter: 'P中心园' },
        { unitName: 'X中心园', mergeCenter: 'X中心园', isCenter: true },
        { unitName: 'X成员甲', mergeCenter: 'X中心园' },
        { unitName: 'X成员乙', mergeCenter: 'X中心园' },
      ] } });
    const pushed2 = JSON.parse(res.body).schools;
    const codePJia = pushed2.find((s) => s.unitName === 'P成员甲').fillCode;
    const codePYi = pushed2.find((s) => s.unitName === 'P成员乙').fillCode;
    for (const [code, cents] of [[codePJia, '0.1'], [codePYi, '0.2']]) {
      await req(server, { method: 'POST', path: '/fill', headers: FORM, body: form({
        fill_code: code, tuitionIncome: cents, fiscalSubsidy: '0', wageTotal: '0', capitalExpense: '0',
        filler_name: '测试', filler_phone: '13800000009' }) });
    }
    res = await req(server, { method: 'GET', path: '/api/v1/submissions', headers: API });
    const pCenter = JSON.parse(res.body).submissions.find((s) => s.unitName === 'P中心园');
    assert.strictEqual(pCenter.controls.tuitionIncome, 0.3, '0.1+0.2 应精确等于 0.3（按分累加）');

    // ===== F-09 sinceId 游标：响应带 cursor，增量拉取不漏不重 =====
    let full = JSON.parse(res.body);
    assert.ok(Number.isInteger(full.cursor) && full.cursor > 0, '响应应含 cursor');
    res = await req(server, { method: 'GET', path: `/api/v1/submissions?sinceId=${full.cursor}`, headers: API });
    assert.strictEqual(JSON.parse(res.body).count, 0, 'cursor 之后无新提交应返回 0 条');
    // cursor 之前的提交应能取到（sinceId=0 相当于全量）
    res = await req(server, { method: 'GET', path: '/api/v1/submissions?sinceId=0', headers: API });
    assert.ok(JSON.parse(res.body).count >= 2, 'sinceId=0 应返回全量');

    // ===== F-01 显式拆组：mergeCenter 显式 null 必须覆盖内置合并 =====
    res = await req(server, { method: 'POST', path: '/api/v1/schools/sync', headers: API, body: {
      schools: [{ unitName: '沭阳县七雄启萌幼儿园', mergeCenter: null }] } });
    const split = JSON.parse(res.body).schools[0];
    assert.strictEqual(split.mergeCenter, null, '显式 null 应拆出内置合并组');
    // 未提供 mergeCenter 字段时内置规则仍兜底
    res = await req(server, { method: 'POST', path: '/api/v1/schools/sync', headers: API, body: {
      schools: [{ unitName: '沭阳县东方幼儿园' }] } });
    assert.strictEqual(JSON.parse(res.body).schools[0].mergeCenter, '沭阳县仰龙湾儿童之家', '未提供字段时内置兜底');

    // ===== F-02 快照对账：snapshot=true 停用缺席学校 =====
    res = await req(server, { method: 'POST', path: '/api/v1/schools/sync', headers: API, body: {
      snapshot: true,
      schools: [
        { unitName: 'X中心园', mergeCenter: 'X中心园', isCenter: true },
        { unitName: 'X成员甲', mergeCenter: 'X中心园' },
        // X成员乙、P 系列、七雄/东方 本轮缺席 → 停用
      ] } });
    const snap = JSON.parse(res.body);
    assert.ok(snap.deactivated >= 5, `缺席学校应被停用（实际 ${snap.deactivated}）`);

    res = await req(server, { method: 'GET', path: '/fill' });
    assert.ok(!res.body.includes('X成员乙'), '停用学校不应出现在填表页');
    assert.ok(res.body.includes('X成员甲'), '在册学校仍在填表页');

    res = await req(server, { method: 'GET', path: '/api/v1/submissions', headers: API });
    const afterSnap = JSON.parse(res.body);
    const xCenter = afterSnap.submissions.find((s) => s.unitName === 'X中心园');
    assert.ok(xCenter, '在册合并组仍可拉取');
    assert.strictEqual(xCenter.memberCount, 2, '成员总数应只剩在册 2 所');
    assert.strictEqual(xCenter.controls.tuitionIncome, 100000, '停用成员（乙）的提交不再计入汇总，只剩甲的 100000');
    assert.deepStrictEqual(xCenter.sourceUnitNames, ['X成员甲'], '来源成员应只剩甲');
    assert.ok(!afterSnap.submissions.some((s) => s.unitName === 'P中心园'), '整组停用后不应再返回');

    // ===== F-15 整体校验：混入非法项时整批 400、不部分写入 =====
    res = await req(server, { method: 'POST', path: '/api/v1/schools/sync', headers: API, body: {
      schools: [{ unitName: '合法新园' }, { unitName: '' }] } });
    assert.strictEqual(res.status, 400, '含非法项应整批 400');
    res = await req(server, { method: 'GET', path: '/fill' });
    assert.ok(!res.body.includes('合法新园'), '失败批次的合法项也不应写入');

    console.log('All aggregate tests passed.');
  } finally {
    server.close();
    require('../src/db').closeDatabase();
    for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(process.env.DB_PATH + ext); } catch { /* ignore */ } }
  }
})().catch((e) => { console.error(e); process.exit(1); });
