const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('@e965/xlsx');
const { sanitizeFileName, resolveInside, isPathInside } = require('../src/path-safety');
const { extractEduDataFromRows, computeReport, computePrivateDraft, eduDataFromCollectControls, writeReport, WB } = require('../src/report-engine');
const { validateFormalControls } = require('../src/formal-controls');
const collectClient = require('../src/collect-client');
const downloadIntercept = require('../src/download-intercept');
const { resolveAppRole } = require('../src/app-role');
const { applyReportRules } = require('../src/report-rule-engine');
const { loadSchoolAttributes } = require('../src/school-attributes');
const { resolveRuleContext } = require('../src/report-engine');
const { buildExplanations, explanationsText, explainRule } = require('../src/rule-explanations');

function testAppRole() {
  assert.deepStrictEqual(resolveAppRole({ valid: false, reason: 'missing_product_or_license' }), {
    role: 'school', deploymentMode: 'standalone', unitName: '',
  }, '未填写授权中心密码应进入单机学校版');
  // 授权标记判角色
  assert.strictEqual(resolveAppRole({ valid: true, features: { role: 'operator' } }).role, 'operator', 'features.role=operator');
  assert.strictEqual(resolveAppRole({ valid: true, plan: 'operator-annual' }).role, 'operator', 'plan 含 operator');
  assert.strictEqual(resolveAppRole({ valid: true, features: { operator: true } }).role, 'operator', 'features.operator=true');
  const school = resolveAppRole({ valid: true, customer_name: '沭阳县某小学', plan: 'school' });
  assert.strictEqual(school.role, 'school', '无经办标记默认学校版');
  assert.strictEqual(school.unitName, '沭阳县某小学', '学校版取授权单位名');
  // roleOverride 兜底优先
  assert.strictEqual(resolveAppRole({ features: { role: 'operator' } }, 'school').role, 'school', 'override=school 强制学校版');
  assert.strictEqual(resolveAppRole({ customer_name: 'X' }, 'operator').role, 'operator', 'override=operator 强制经办版');
  assert.strictEqual(resolveAppRole({ customer_name: 'X' }, 'operator').unitName, '', '经办版无单位名');

  const standalone = resolveAppRole({ valid: true, customer_name: '通用学校授权', features: { deployment_mode: 'standalone' } });
  assert.strictEqual(standalone.role, 'school', '单机授权仍是学校身份');
  assert.strictEqual(standalone.deploymentMode, 'standalone', 'deployment_mode=standalone 应进入单机版');
  assert.strictEqual(standalone.unitName, '', '单机版单位名必须来自本地首次设置，而不是通用授权名称');

  const managedSchool = resolveAppRole({ valid: true, customer_name: '沭阳县某小学', features: { deployment_mode: 'managed' } });
  assert.strictEqual(managedSchool.deploymentMode, 'managed', 'managed 学校版保留联网模式');
  assert.strictEqual(managedSchool.unitName, '沭阳县某小学', '联网学校版继续取授权单位名');
  assert.strictEqual(resolveAppRole({ valid: true, features: { role: 'operator', deployment_mode: 'standalone' } }).deploymentMode, 'managed', '经办版不允许降为单机版');
  assert.strictEqual(resolveAppRole({}, '', 'standalone').deploymentMode, 'standalone', '本地部署兜底可用于故障恢复');
}

function testRendererUsesInPagePrompt() {
  const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
  assert.ok(!rendererSource.includes('window.prompt('), 'Electron 渲染进程不得调用不支持的 window.prompt');
  assert.ok(rendererSource.includes('showTextPrompt('), '输入场景应使用页面内模态框');
  assert.ok(htmlSource.includes('id="appPromptOverlay"'), '页面应包含统一输入模态框');
  assert.ok(htmlSource.includes('id="confirmInitialSetupBtn"'), '首次设置向导应提供确认按钮');
  assert.ok(rendererSource.includes('selectInitialWorkMode('), '首次设置应先选择填报类型');
  assert.ok(rendererSource.includes('confirmInitialSetupBtn.addEventListener'), '首次设置确认按钮应提交设置');
  assert.ok(!htmlSource.includes('id="loginForm"'), '应用启动不得再显示本机用户名密码登录');
  assert.ok(!rendererSource.includes('authLogin') && !preloadSource.includes('authLogin'), '渲染层不得再暴露本机登录接口');
  assert.ok(!mainSource.includes("require('./auth')") && !mainSource.includes('AUTH_REQUIRED'), '主进程不得再用本机登录拦截业务 IPC');
  assert.ok(htmlSource.includes('id="standaloneSetupSchoolStage"'), '首次设置向导必须包含学校类型');
  assert.ok(rendererSource.includes("String(profile.schoolStage || '').trim()"), '未选择学校类型时首次设置不得视为完成');
  assert.ok(htmlSource.includes('id="settingsCenterBtn"'), '主界面右上角应提供独立设置中心按钮');
  assert.ok(!htmlSource.includes('data-tab="settings"'), '设置中心不应继续占用业务标签栏');
  assert.ok(rendererSource.includes("settingsCenterBtn.addEventListener('click', () => activateTab('settings'))"), '右上角按钮应能打开设置中心');
  assert.ok(!htmlSource.includes('data-tab="license"'), '授权不应继续作为独立标签');
  assert.ok(!htmlSource.includes('data-tab="rules"'), '规则配置不应继续作为独立标签');
  assert.ok(rendererSource.includes("appRole === 'school' && !isStandaloneSchool()"), '联网学校版应启用自动回传');
  assert.ok(rendererSource.includes('正在自动回传'), '生成前应自动回传本地填报数据');
  assert.ok(mainSource.includes("runtimeRole.deploymentMode !== 'standalone' && !license.isLicenseUsableStatus(status)"),
    '单机学校版不得被授权校验门槛拦截');
  assert.ok(mainSource.includes("features.collect_token || features.collectToken"), '授权中心应预留采集连接参数下发');
  assert.ok(htmlSource.includes('导入文件提醒'), '学校状态页应提示准备导入文件');
  for (const reportName of ['资产负债表', '收入费用表', '经费支出明细表', '科目余额表', '上年经费年报']) {
    assert.ok(htmlSource.includes(reportName), `导入提醒应列出${reportName}`);
  }
  assert.ok(htmlSource.includes('D:\\laojiu\\jfnb\\导入'), '导入提醒应展示默认导入目录');
  assert.ok(htmlSource.includes('id="openWatchFolderBtn"'), '导入提醒应提供打开文件夹按钮');
  assert.ok(htmlSource.includes('id="importFeedback"'), '导入提醒应显示识别反馈');
  assert.ok(rendererSource.includes('const schoolLocked = isStandaloneSchool() && standaloneSetupComplete()'), '学校首次设置完成后应锁定本单位资料');
  assert.ok(rendererSource.includes('preflightGenerate(selected)'), '生成前应执行五件套复核');
  assert.ok(mainSource.includes("handleIpc('preflight-generate'"), '主进程应提供生成前复核');
  assert.ok(mainSource.includes('本单位名称和学校类型仅可在首次设置时确定'), '主进程应强制锁定首次设置的学校资料');
  assert.ok(preloadSource.includes("preflightGenerate: (schoolNames) => ipcRenderer.invoke('preflight-generate'"), 'preload 应暴露生成前复核接口');
  assert.ok(htmlSource.includes('data-stage-parts="kindergarten"'), '学校资料应标注幼儿园专属字段');
  assert.ok(htmlSource.includes('data-stage-parts="primary"'), '学校资料应标注小学专属字段');
  assert.ok(htmlSource.includes('data-stage-parts="junior"'), '学校资料应标注初中专属字段');
  assert.ok(htmlSource.includes('data-stage-parts="senior"'), '学校资料应标注高中专属字段');
  assert.ok(rendererSource.includes('STANDALONE_STAGE_PARTS'), '学校资料应按学校类型过滤填写字段');
  assert.ok(rendererSource.includes("querySelectorAll('[data-stage-parts]')"), '学校资料应沿用服务端的学段字段识别方式');
  assert.ok(rendererSource.includes('input.disabled = !show'), '不适用学段字段应同时禁用');
  assert.ok(!htmlSource.includes('id="selectAllSchools"'), '文件检测不应再显示全选控件');
  assert.ok(htmlSource.includes('>生成经费年报</button>'), '文件检测应只保留生成经费年报按钮');
  assert.ok(htmlSource.includes('data-tab="preview">经费年报</button>'), '报表预览标签应改名为经费年报');
}

function testDefaultWatchFolder() {
  const pathsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'paths.js'), 'utf8');
  const configSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'config.js'), 'utf8');
  assert.ok(pathsSource.includes("WATCH_DIR = process.env.GZNB_WATCH_DIR || 'D:\\\\laojiu\\\\jfnb\\\\导入'"), '默认监控目录应为导入文件夹');
  assert.ok(configSource.includes('watchFolder: WATCH_DIR'), '默认配置应使用独立导入目录');
  assert.ok(configSource.includes('migrateLegacyWatchFolder'), '旧版数据目录监控配置应迁移到导入目录');
}

function testPathSafety() {
  assert.strictEqual(sanitizeFileName('../A:B*?'), '.._A_B__');
  assert.strictEqual(sanitizeFileName('CON'), 'CON_');

  const base = path.resolve('C:/safe/base');
  assert.ok(isPathInside(base, path.join(base, 'child.xlsx')));
  assert.throws(() => resolveInside(base, '..', 'outside.xlsx'), /超出允许目录/);
}

function testRuleDrivenAutoBalance() {
  const report = XLSX.utils.book_new();
  const incomeRows = Array.from({ length: 13 }, () => []);
  incomeRows[8][8] = '代码';
  incomeRows[9][8] = '丙';
  incomeRows[9][9] = 1;
  incomeRows[10][8] = '01'; incomeRows[10][9] = 0;
  incomeRows[11][8] = '02'; incomeRows[11][9] = 10;
  incomeRows[12][8] = '03'; incomeRows[12][9] = 20;
  XLSX.utils.book_append_sheet(report, XLSX.utils.aoa_to_sheet(incomeRows), '收入情况表');

  const rules = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(rules, XLSX.utils.aoa_to_sheet([
    ['公式编号', '基表', '公式', '校验信息', '类型'],
    ['sum-01', 'j2_2', 'j2_2_01_all == j2_2_02_all + j2_2_03_all', '收入合计应等于明细之和', '强制'],
    ['context-01', 'j2_2', 'if dqdm == "320000" then j2_2_01_01 > 0', '地区条件缺失时不应误判', '提示'],
    ['compound-01', 'j2_2', 'j2_2_01_01 > 20 && j2_2_01_01 < 25', '复合条件必须整体计算', '提示'],
    ['precision-01', 'j2_2', 'j2_2_01_01 == 30.000000001', '金额计算浮点尾差不应误报', '强制'],
  ]), '自定义公式');
  const rulePath = path.join(os.tmpdir(), `gznb-rules-${process.pid}-${Date.now()}.xlsx`);
  XLSX.writeFile(rules, rulePath);

  try {
    const computed = { 收入情况表: { J11: 0 } };
    const result = applyReportRules({
      workbook: report,
      computed,
      ruleFiles: [{ path: rulePath, source: '自定义公式' }],
    });
    assert.strictEqual(report.Sheets.收入情况表.J11.v, 30, '规则应自动平衡由同表明细推导出的汇总字段');
    assert.strictEqual(computed.收入情况表.J11, 30, '自动平衡结果应同步回预览数据');
    assert.strictEqual(result.adjusted.length, 1, '应记录自动平衡日志');
    assert.strictEqual(result.failed.length, 1, '复合条件的第二个判断不通过时应正确提示');
    assert.strictEqual(result.failed[0].id, 'compound-01');
    assert.strictEqual(result.skipped.condition, 1, '缺少地区参数的条件公式应跳过，不得误判');
  } finally {
    try { fs.unlinkSync(rulePath); } catch { /* ignore */ }
  }
}

function buildIncomeSheetWorkbook(valuesByCode) {
  const report = XLSX.utils.book_new();
  const rows = Array.from({ length: 11 + Object.keys(valuesByCode).length }, () => []);
  rows[8][8] = '代码';
  rows[9][8] = '丙';
  rows[9][9] = 1;
  let rowIndex = 10;
  for (const [code, value] of Object.entries(valuesByCode)) {
    rows[rowIndex][8] = code;
    rows[rowIndex][9] = value;
    rowIndex += 1;
  }
  XLSX.utils.book_append_sheet(report, XLSX.utils.aoa_to_sheet(rows), '收入情况表');
  return report;
}

function writeRuleFile(ruleRows, tag) {
  const rules = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(rules, XLSX.utils.aoa_to_sheet([
    ['公式编号', '基表', '公式', '校验信息', '类型'],
    ...ruleRows,
  ]), '自定义公式');
  const rulePath = path.join(os.tmpdir(), `gznb-rules-${tag}-${process.pid}-${Date.now()}.xlsx`);
  XLSX.writeFile(rules, rulePath);
  return rulePath;
}

function testRuleEngineGuards() {
  // 行次：02=10, 03=5, 04=7, 05=0, 06=0, 07=0.1, 08=0.2
  const report = buildIncomeSheetWorkbook({ '02': 10, '03': 5, '04': 7, '05': 0, '06': 0, '07': 0.1, '08': 0.2 });
  const rulePath = writeRuleFile([
    ['guard-compound', 'j2_2', 'j2_2_02_01 == j2_2_03_01 && j2_2_03_01 == j2_2_04_01', '复合等式不得截断为首个比较符', '强制'],
    ['guard-hint', 'j2_2', 'j2_2_05_01 == j2_2_02_01 + j2_2_03_01', '提示级等式不得改数', '提示'],
    ['guard-round', 'j2_2', 'j2_2_06_01 == j2_2_07_01 + j2_2_08_01', '调平结果应按分取整', '强制'],
    ['guard-phx', 'j2_2', 'if phx == "普惠性幼儿园" then j2_2_02_01 > 100', '普惠性属性应参与条件判断', '提示'],
  ], 'guards');

  try {
    const result = applyReportRules({
      workbook: report,
      computed: {},
      ruleFiles: [{ path: rulePath, source: '自定义公式' }],
      ruleContext: { phx: '普惠性幼儿园' },
    });
    const ws = report.Sheets.收入情况表;
    assert.strictEqual(result.adjusted.length, 1, '仅强制级结构等式可自动调平');
    assert.strictEqual(result.adjusted[0].ruleId, 'guard-round');
    assert.strictEqual(result.adjusted[0].after, 0.3, '调平日志金额应按分取整');
    assert.strictEqual(ws.J15.v, 0.3, '0.1+0.2 应写入 0.3 而非浮点尾差');
    assert.strictEqual(ws.J11.v, 10, '复合等式失败时不得把布尔值写进金额单元格');
    assert.strictEqual(ws.J14.v, 0, '提示级等式失败不修改数据');
    const failedIds = result.failed.map((item) => item.id);
    assert.deepStrictEqual(new Set(failedIds), new Set(['guard-compound', 'guard-hint', 'guard-phx']));
    assert.strictEqual(result.failed[0].severity, '强制', '未过清单应强制级排前');
    assert.ok(result.summary.includes('须修改数据') && result.summary.includes('无须改数'), '摘要应区分强制与提示');
  } finally {
    try { fs.unlinkSync(rulePath); } catch { /* ignore */ }
  }
}

function testEmptyAppendixEvaluated() {
  // 无附表 sheet 时，附表字段(j2_2f/j2_3f)按空附表取 0，使附表规则被评估而非跳过。
  const report = buildIncomeSheetWorkbook({ '01': 100, '02': 60, '03': 40 });
  const rulePath = writeRuleFile([
    ['appx-pass', 'j2_2', 'j2_2_01_01 >= j2_2_02_01 + j2_2f_01_01', '合计>=财政+附表(空附表=0)', '强制'],
    ['appx-sum', 'j2_2', 'j2_2f_01_01 == j2_2f_02_01 + j2_2f_03_01', '空附表内部等式成立', '强制'],
    ['appx-fail', 'j2_2', 'j2_2f_01_01 > 0', '空附表大于0应判失败(不再跳过)', '提示'],
  ], 'appendix');
  try {
    const result = applyReportRules({
      workbook: report,
      computed: {},
      ruleFiles: [{ path: rulePath, source: '自定义公式' }],
    });
    assert.strictEqual(result.skipped.unsupported, 0, '附表规则不应再计入未支持跳过');
    assert.strictEqual(result.passed, 2, '空附表下两条结构规则应通过');
    assert.deepStrictEqual(result.failed.map((item) => item.id), ['appx-fail'], '仅“空附表>0”应失败');
  } finally {
    try { fs.unlinkSync(rulePath); } catch { /* ignore */ }
  }
}

function testAutoBalanceRollback() {
  // 总数 100 本对（明细缺项）：调平会把 01 改成 40，导致原本通过的强制规则 01>=05 失败，应整体回滚。
  const report = buildIncomeSheetWorkbook({ '01': 100, '02': 30, '03': 10, '05': 90 });
  const rulePath = writeRuleFile([
    ['sum-total', 'j2_2', 'j2_2_01_01 == j2_2_02_01 + j2_2_03_01', '合计等于明细之和', '强制'],
    ['floor-total', 'j2_2', 'j2_2_01_01 >= j2_2_05_01', '合计不得低于下限', '强制'],
  ], 'rollback');

  try {
    const result = applyReportRules({
      workbook: report,
      computed: {},
      ruleFiles: [{ path: rulePath, source: '自定义公式' }],
    });
    assert.strictEqual(report.Sheets.收入情况表.J11.v, 100, '调平引发强制回归时应恢复原值');
    assert.strictEqual(result.adjusted.length, 0, '回滚后不保留调平记录');
    assert.strictEqual(result.balanceReverted?.count, 1, '应记录回滚详情');
    assert.deepStrictEqual(result.failed.map((item) => item.id), ['sum-total'], '原失败规则维持待人工复核');
  } finally {
    try { fs.unlinkSync(rulePath); } catch { /* ignore */ }
  }
}

function testSchoolAttributeContext() {
  const attrPath = path.join(os.tmpdir(), `gznb-attrs-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(attrPath, JSON.stringify([
    { name: '沭阳县测试小学（本部）', dwdm: '1132000001S', dqdm: '321322001', xxlbdm: '61', lsgxdm: '21', cxfldm: '121', phx: '' },
  ]), 'utf8');
  try {
    const attributes = loadSchoolAttributes(attrPath);
    const options = {
      reportRuleContext: { dqdm: '321322', bbnd: '2025' },
      schoolAttributes: attributes,
    };
    const merged = resolveRuleContext(options, '沭阳县测试小学(本部)');
    assert.strictEqual(merged.xxlbdm, '61', '应按归一化学校名合并学校类别代码');
    assert.strictEqual(merged.dqdm, '321322001', '本校地区代码应覆盖全局参数');
    assert.strictEqual(merged.bbnd, '2025', '全局参数应保留');
    assert.strictEqual(merged.phx, undefined, '空属性不应覆盖');
    const fallback = resolveRuleContext(options, '沭阳县未知学校');
    assert.strictEqual(fallback.xxlbdm, undefined, '未匹配学校时使用全局参数');
    assert.strictEqual(fallback.dqdm, '321322');
  } finally {
    try { fs.unlinkSync(attrPath); } catch { /* ignore */ }
  }
}

function testRuleExplanations() {
  // 强制未过不进说明清单；提示未过逐条给出可上报的情况说明。
  const validation = {
    enabled: true,
    failed: [
      { id: '12436', source: '系统公式', severity: '提示', message: '除一般公共预算教育经费外一般大于0' },
      { id: '322003', source: '自定义公式', severity: '提示', message: '小学生均公用经费 800-2200', leftValue: 640.5 },
      { id: '323337', source: '自定义公式', severity: '提示', message: '市县 收=支' },
      { id: '999999', source: '系统公式', severity: '提示', message: '某未建模提示规则大于0' },
      { id: '11938', source: '系统公式', severity: '强制', message: '房屋折旧<=原值' },
    ],
  };
  const list = buildExplanations(validation);
  assert.strictEqual(list.length, 4, '强制项不进情况说明清单');
  assert.ok(list.every((item) => item.explanation && item.explanation.length > 8), '每条提示都应有说明文本');
  assert.ok(explainRule({ id: '12436', message: '' }).includes('教育经费'), '结构性规则应命中专用说明');
  assert.ok(explainRule({ id: '322003', message: '', leftValue: 640.5 }).includes('640.5'), '区间类说明应带实际值');
  assert.ok(explainRule({ id: '323337', message: '' }).includes('结转结余'), '收支类应说明为结转结余');
  assert.strictEqual(explainRule({ id: '999999', message: '大于0' }), null, '未建模规则走通用兜底');
  const text = explanationsText('测试学校', validation);
  assert.ok(text.includes('测试学校') && text.includes('情况说明'), '导出文本应含单位名与标题');
  assert.ok(!text.includes('11938'), '强制项不应出现在情况说明文本');
  assert.strictEqual(buildExplanations({ enabled: false }).length, 0, '未启用校验时无说明');
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

function testFormalControlsValidation() {
  const invalid = validateFormalControls({
    schoolStage: '九年制学校', staffCount: 10, studentCount: 100,
    externalLongTermStaffCount: 0, retiredStaffCount: 0,
    primaryStudentCount: 0, primaryInclusiveStudentCount: 0, primaryBoardingStudentCount: 0,
    juniorStudentCount: 0, juniorInclusiveStudentCount: 0, juniorBoardingStudentCount: 0,
  });
  assert.strictEqual(invalid.ok, false, '多学段明细合计与总数不一致必须拒绝');
  assert.ok(invalid.errors.studentCount);

  const valid = validateFormalControls({
    schoolStage: '九年制学校', staffCount: 10, teacherCount: 8,
    externalLongTermStaffCount: 2, retiredStaffCount: 3, studentCount: 100,
    primaryStudentCount: 60, primaryInclusiveStudentCount: 2, primaryBoardingStudentCount: 4,
    juniorStudentCount: 40, juniorInclusiveStudentCount: 1, juniorBoardingStudentCount: 3,
  });
  assert.strictEqual(valid.ok, true, JSON.stringify(valid.errors));
  assert.strictEqual(valid.controls.seniorStudentCount, 0, '不适用学段应归零');
}

function testFormalReportYearEndFields() {
  const blank = { sheetNames: [], findSheet: () => null, getSheet: () => ({}) };
  const prevPerson = { J45: { v: 7 }, J47: { v: 4 } };
  const prev = {
    sheetNames: [],
    findSheet: (name) => name === '人员情况表' ? prevPerson : null,
    getSheet: () => ({}),
  };
  const computed = computeReport({
    收入费用表: blank, 经费支出明细表: blank, 科目余额表: blank,
    资产负债表: blank, 上年经费年报: prev,
  }, {
    教职工数: 10, 专任教师: 8, 年末编制外长期聘用人员: 2, 年末离退休人员: 3,
    幼儿园学生数: 20, 小学学生数: 0, 初中学生数: 0, 高中学生数: 0,
    小学随班就读: 0, 初中随班就读: 0, 高中随班就读: 0,
    小学住宿生: 0, 初中住宿生: 0, 高中住宿生: 0,
    年末学前一年在园儿童人数: 6, 年末托育幼儿人数: 5,
  }, { heatingFeePerStudent: 0 });
  assert.strictEqual(computed.人员情况表.J16, 2);
  assert.strictEqual(computed.人员情况表.J17, 3);
  assert.strictEqual(computed.人员情况表.J44, 7);
  assert.strictEqual(computed.人员情况表.J45, 6);
  assert.strictEqual(computed.人员情况表.J46, 4);
  assert.strictEqual(computed.人员情况表.J47, 5);
  assert.strictEqual(computed.收入情况表.J58, 0, '取暖费单价 0 必须保持为 0');
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

// 免费试用 / 完整版功能闸：核心报表隐藏 + 禁止导出，激活后解锁。
function testFreemiumGating() {
  const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');

  // 渲染层：支出表为锁定的核心报表，解锁看在线授权是否有效。
  assert.ok(rendererSource.includes("LOCKED_TABLES = new Set(['支出表'])"), '支出表应作为免费版锁定的核心报表');
  assert.ok(rendererSource.includes('function isFullVersionUnlocked'), '渲染层应有完整版解锁判定');
  assert.ok(rendererSource.includes('return licenseIsValid(licenseState)'), '解锁应取决于有效在线授权');
  assert.ok(rendererSource.includes('LOCKED_TABLES.has(tableName) && !isFullVersionUnlocked()'), '预览应对锁定核心报表显示占位');
  assert.ok(rendererSource.includes("goActivate('导出Excel')"), '免费版点导出应引导激活');

  // 主进程：免费版生成后不保留可导出的 .xlsx；导出/保存修正被拦截。
  assert.ok(mainSource.includes('async function isFullVersionUnlocked'), '主进程应有完整版解锁判定');
  assert.ok(mainSource.includes('result.exportLocked = true'), '免费版生成结果应标记导出锁定');
  assert.ok(mainSource.includes("handleIpc('reveal-output'"), '应提供受授权保护的导出定位 IPC');
  assert.ok(mainSource.includes('免费版不支持导出/保存修正'), '免费版应拦截保存修正导出');
  assert.ok(preloadSource.includes("revealOutput: (filePath) => ipcRenderer.invoke('reveal-output'"), 'preload 应暴露导出定位接口');
}

(async () => {
  testPathSafety();
  testRuleDrivenAutoBalance();
  testRuleEngineGuards();
  testAutoBalanceRollback();
  testEmptyAppendixEvaluated();
  testSchoolAttributeContext();
  testRuleExplanations();
  testEduRowsExtraction();
  testEduRowsFuzzyMatchWarnings();
  testEduRowsAmbiguousFuzzyMatch();
  testPrivateDraftSponsorWithdrawBalance();
  testPrivateDraftNetBalance();
  testAppRole();
  testRendererUsesInPagePrompt();
  testDefaultWatchFolder();
  testFreemiumGating();
  testEduDataFromCollectControls();
  testFormalControlsValidation();
  testFormalReportYearEndFields();
  testDownloadIntercept();
  await testWriteReportCollectPersonCells();
  await testCollectClient();
  console.log('All tests passed.');
})().catch((err) => { console.error(err); process.exit(1); });
