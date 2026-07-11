// 端到端冒烟测试：启动 app，走一遍 名单推送 → 填表提交 → 拉取 → 看板。
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.API_TOKEN = 'test-api-token';
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.PUBLIC_BASE_URL = 'http://localhost:9099';
process.env.COLLECT_YEAR_FOR_TEST = '2025';
process.env.DB_PATH = path.join(os.tmpdir(), `collect-smoke-${Date.now()}.db`);

const { createApp } = require('../src/app');

function request(server, { method, path: p, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request({
      host: '127.0.0.1', port: addr.port, method, path: p,
      headers: {
        ...(data && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function form(obj) {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

(async () => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const API = { Authorization: 'Bearer test-api-token' };

  try {
    // 1) 无 token 拒绝
    let res = await request(server, { method: 'GET', path: '/api/v1/submissions' });
    assert.strictEqual(res.status, 401, '无 token 应 401');

    // 2) 推送名单（一个合并组 + 一个独立园）
    res = await request(server, {
      method: 'POST', path: '/api/v1/schools/sync', headers: API,
      body: {
        year: 2025,
        schools: [
          { unitName: '沭阳县中心园', mergeCenter: '沭阳县中心园', isCenter: true },
          { unitName: '沭阳县成员园A', mergeCenter: '沭阳县中心园' },
          { unitName: '沭阳县独立民办园', contact: '13500000000' },
        ],
      },
    });
    let j = JSON.parse(res.body);
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.count, 3);
    const codeA = j.schools.find((s) => s.unitName === '沭阳县成员园A').fillCode;
    assert.ok(/^[0-9a-f]{16}$/.test(codeA), 'fillCode 应为16位十六进制');
    assert.ok(j.schools[0].url.endsWith('/fill'), '应只返回统一填报页');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(j.schools[0], 'commonUrl'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(j.schools[0], 'legacyUrl'), false);

    // 3) 幂等：再推一次，fillCode 不变
    res = await request(server, {
      method: 'POST', path: '/api/v1/schools/sync', headers: API,
      body: { year: 2025, schools: [{ unitName: '沭阳县成员园A', mergeCenter: '沭阳县中心园' }] },
    });
    const codeA2 = JSON.parse(res.body).schools[0].fillCode;
    assert.strictEqual(codeA2, codeA, '幂等推送 fillCode 应不变');

    // 3.1) 内置合并关系：即使上游没带 mergeCenter，也自动套用
    res = await request(server, {
      method: 'POST', path: '/api/v1/schools/sync', headers: API,
      body: { year: 2025, schools: [{ unitName: '沭阳县七雄启萌幼儿园' }] },
    });
    const builtInMerge = JSON.parse(res.body).schools[0];
    assert.strictEqual(builtInMerge.mergeCenter, '沭阳县仰龙湾儿童之家');
    assert.strictEqual(builtInMerge.isCenter, false);

    // 4) 打开统一填表页；单校链接不再提供
    res = await request(server, { method: 'GET', path: '/fill' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('选择填报学校'), '统一填报页应含学校下拉选择');
    assert.ok(res.body.includes('请填写【2025】年度数据'), '统一填报页应显示自动采集上年度');
    assert.ok(res.body.includes('沭阳县成员园A'), '统一填报页下拉中应含成员园');
    assert.ok(!res.body.includes('幼儿园名单'), '统一填报页不应显示上方学校表格');
    assert.ok(!res.body.includes('data-row-code'), '统一填报页不应渲染学校表格行');

    res = await request(server, { method: 'GET', path: `/fill?school=${codeA}` });
    assert.strictEqual(res.status, 200);
    assert.ok(!res.body.includes(`value="${codeA}" selected`), '查询参数不应预选学校');

    res = await request(server, { method: 'GET', path: `/f/${codeA}` });
    assert.strictEqual(res.status, 404, '单校链接应失效');

    // 5) 提交校验失败（缺必填）
    res = await request(server, {
      method: 'POST', path: '/fill',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ fill_code: codeA, tuitionIncome: '100', filler_name: '', filler_phone: '123' }),
    });
    assert.strictEqual(res.status, 400, '缺必填应 400 并回显');

    // 6) 正确提交
    res = await request(server, {
      method: 'POST', path: '/fill',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        fill_code: codeA,
        staffCount: '12', teacherCount: '9', studentCount: '150',
        tuitionIncome: '120000', fiscalSubsidy: '0', wageTotal: '80000', capitalExpense: '5000',
        hasRent: 'on', rentExpense: '3000',
        filler_name: '李四', filler_phone: '13800138000',
      }),
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('提交成功'));

    // 7) 更正重报 → version 递增
    res = await request(server, {
      method: 'POST', path: '/fill',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ fill_code: codeA, staffCount: '12', teacherCount: '9', studentCount: '150', tuitionIncome: '130000', fiscalSubsidy: '0', wageTotal: '80000', capitalExpense: '5000', filler_name: '李四', filler_phone: '13800138000' }),
    });
    assert.ok(res.body.includes('第 2 次'), '重报应为第2次');

    // 8) 默认拉取合并后的中心园提交
    res = await request(server, { method: 'GET', path: '/api/v1/submissions', headers: API });
    j = JSON.parse(res.body);
    assert.strictEqual(j.year, 2025);
    assert.strictEqual(j.count, 1, '只有一校提交');
    const sub = j.submissions[0];
    assert.strictEqual(j.mode, 'merged');
    assert.strictEqual(sub.unitName, '沭阳县中心园');
    assert.strictEqual(sub.aggregated, true);
    assert.strictEqual(sub.submittedMemberCount, 1);
    assert.deepStrictEqual(sub.sourceUnitNames, ['沭阳县成员园A']);
    assert.strictEqual(sub.version, 2);
    assert.strictEqual(sub.controls.tuitionIncome, 130000);
    assert.strictEqual(sub.controls.rentExpense, 0, '第2次未开房租，金额应为0');
    assert.strictEqual(sub.mergeCenter, '沭阳县中心园');

    // 8.1) raw 模式仍可取原始明细
    res = await request(server, { method: 'GET', path: '/api/v1/submissions?mode=raw', headers: API });
    j = JSON.parse(res.body);
    assert.strictEqual(j.mode, 'raw');
    assert.strictEqual(j.count, 1);
    assert.strictEqual(j.submissions[0].unitName, '沭阳县成员园A');

    // 9) 增量：since 用当前时间应过滤掉已有提交
    const future = '2999-01-01 00:00:00';
    res = await request(server, { method: 'GET', path: `/api/v1/submissions?since=${encodeURIComponent(future)}`, headers: API });
    assert.strictEqual(JSON.parse(res.body).count, 0, 'since 未来时间应无结果');

    // 10) 管理看板需登录
    res = await request(server, { method: 'GET', path: '/admin' });
    assert.ok(res.body.includes('管理令牌'), '未登录应显示登录页');

    res = await request(server, {
      method: 'POST', path: '/admin/login',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ token: 'test-admin-token' }),
    });
    const cookie = (res.headers['set-cookie'] || [''])[0].split(';')[0];
    assert.ok(cookie.startsWith('admin_token='));

    res = await request(server, { method: 'GET', path: '/admin', headers: { Cookie: cookie } });
    assert.ok(res.body.includes('采集进度看板'));
    assert.ok(res.body.includes('2026 年采集 2025 年数据'), '看板应显示自动年度口径');
    assert.ok(res.body.includes('统一填报入口'), '看板应提供统一填报入口');
    assert.ok(res.body.includes('沭阳县中心园'), '看板应含合并组');
    assert.ok(res.body.includes('沭阳县独立民办园'), '看板应含独立园');
    assert.ok(res.body.includes('1'), '统计应显示已填数');

    console.log('All server smoke tests passed.');
  } finally {
    server.close();
    const { closeDatabase } = require('../src/db');
    closeDatabase();
    try { fs.unlinkSync(process.env.DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(process.env.DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(process.env.DB_PATH + '-shm'); } catch { /* ignore */ }
  }
})().catch((err) => { console.error(err); process.exit(1); });
