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

  // 年度固定名单由服务端本地脚本维护（sync-school-info）；API 无权新增学校。
  // 测试先直接播种名单，再走 API 增量更新。
  const dbApi = require('../src/db');
  dbApi.syncSchools({
    year: 2025,
    snapshot: true,
    schools: [
      { unitName: '沭阳县中心园', stage: '幼儿园', mergeCenter: '沭阳县中心园', isCenter: true },
      { unitName: '沭阳县成员园A', stage: '幼儿园', mergeCenter: '沭阳县中心园' },
      { unitName: '沭阳县独立民办园', stage: '幼儿园' },
      // 七雄故意不配学段：用于“学段未配置须拒绝提交”的用例
      { unitName: '沭阳县七雄启萌幼儿园' },
    ],
  });

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
          { unitName: '沭阳县中心园', stage: '幼儿园', mergeCenter: '沭阳县中心园', isCenter: true },
          { unitName: '沭阳县成员园A', stage: '幼儿园', schoolCode: 'TEST001', mergeCenter: '沭阳县中心园' },
          { unitName: '沭阳县独立民办园', stage: '幼儿园', contact: '13500000000' },
        ],
      },
    });
    let j = JSON.parse(res.body);
    assert.strictEqual(j.ok, true);
    assert.strictEqual(j.count, 3);
    const codeA = j.schools.find((s) => s.unitName === '沭阳县成员园A').fillCode;
    const schoolIdA = j.schools.find((s) => s.unitName === '沭阳县成员园A').schoolId;
    assert.strictEqual(j.schools.find((s) => s.unitName === '沭阳县成员园A').stage, '幼儿园');
    assert.strictEqual(j.schools.find((s) => s.unitName === '沭阳县成员园A').schoolCode, 'TEST001');
    assert.ok(/^[0-9a-f]{32}$/.test(codeA), 'fillCode 应为128位随机码（32位十六进制）');
    assert.strictEqual(j.schools[0].url, 'http://localhost:9099/fill', '所有学校应返回同一个统一填报链接');
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

    // 未配置学段的学校不得静默绕过学段必填项。
    res = await request(server, {
      method: 'POST', path: `/fill/${builtInMerge.fillCode}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        staffCount: '5', teacherCount: '4', externalLongTermStaffCount: '0', retiredStaffCount: '0', studentCount: '60',
        tuitionIncome: '1', fiscalSubsidy: '0', wageTotal: '1', capitalExpense: '0',
        filler_name: '测试', filler_phone: '13800138000',
      }),
    });
    assert.strictEqual(res.status, 400, '未配置学段的真实提交应被拒绝');
    assert.ok(res.body.includes('学校学段未配置或不受支持'), '页面应明确提示维护学校学段');

    // 4) 统一入口列出采集学校，但不公开内部 fillCode
    res = await request(server, { method: 'GET', path: '/fill' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('沭阳县成员园A'));
    assert.ok(res.body.includes('沭阳县中心园'));
    assert.ok(!res.body.includes('沭阳县独立民办园'), '未标注采集的学校不应出现在统一入口');
    assert.ok(res.body.includes('id="schoolSelect"'));
    assert.ok(!res.body.includes(codeA), '统一入口不得泄露学校 fillCode');

    res = await request(server, { method: 'GET', path: `/fill/${codeA}` });
    assert.strictEqual(res.status, 302, '旧专属地址应兼容跳转到统一入口');
    assert.ok(String(res.headers.location || '').endsWith('/fill'));

    res = await request(server, { method: 'GET', path: `/f/${codeA}` });
    assert.strictEqual(res.status, 404, '单校链接应失效');

    // 5) 提交校验失败（缺必填）
    res = await request(server, {
      method: 'POST', path: '/fill',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ school_id: schoolIdA, tuitionIncome: '100', filler_name: '', filler_phone: '123' }),
    });
    assert.strictEqual(res.status, 400, '缺必填应 400 并回显');

    // 6) 正确提交
    res = await request(server, {
      method: 'POST', path: '/fill',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        school_id: schoolIdA, staffCount: '12', teacherCount: '9', externalLongTermStaffCount: '0', retiredStaffCount: '0', studentCount: '150',
        kindergartenStudentCount: '150', preschoolOneYearEndCount: '60', nurseryEndCount: '0',
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
      body: form({ school_id: schoolIdA, staffCount: '12', teacherCount: '9', externalLongTermStaffCount: '0', retiredStaffCount: '0', studentCount: '150', kindergartenStudentCount: '150', preschoolOneYearEndCount: '60', nurseryEndCount: '0', tuitionIncome: '130000', fiscalSubsidy: '0', wageTotal: '80000', capitalExpense: '5000', filler_name: '李四', filler_phone: '13800138000' }),
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
    assert.ok(res.body.includes('统一填报链接'), '看板应说明统一链接口径');
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
