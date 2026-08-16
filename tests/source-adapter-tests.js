/**
 * 解析层（source-scan / source-map / source-adapter）测试。
 *
 * tests/source-baseline.json 是**重构前**的原引擎在同一批夹具上的输出快照，
 * 用作金标准：解析层改造不得改变中科版式的任何一个数值。
 * 重新生成基线等于放弃这个保护，除非确认是有意的行为变更，否则不要重新生成。
 */

const assert = require('assert');
const path = require('path');
const { computeReport } = require('../src/report-engine');
const { createSource, detectVendor, VENDOR } = require('../src/source-adapter');
const scan = require('../src/source-scan');
const map = require('../src/source-map');
const fx = require('./source-fixtures');
const baseline = require('./source-baseline.json');

const OPTS = { heatingFeePerStudent: 25 };

function snapshot(computed) {
  const snap = {};
  for (const [sheet, cells] of Object.entries(computed)) {
    if (sheet === '__meta' || !cells || typeof cells !== 'object') continue;
    snap[sheet] = {};
    for (const [k, v] of Object.entries(cells)) {
      if (typeof v === 'number') snap[sheet][k] = Math.round(v * 100) / 100;
    }
  }
  return snap;
}

/**
 * 金标准：中科版式（有/无科目编码列两种）的输出必须与重构前逐格一致。
 */
function testZhongkeGoldenMaster() {
  for (const kind of ['zhongke', 'zhongkeNoCodes']) {
    const base = baseline[kind];
    assert.ok(base && base.ok, `基线缺失：${kind}`);
    const computed = computeReport(fx.buildWorkbooks(kind), fx.EDU_DATA, OPTS);
    const snap = snapshot(computed);

    for (const [sheet, cells] of Object.entries(base.snap)) {
      for (const [cell, expected] of Object.entries(cells)) {
        assert.strictEqual(
          snap[sheet] ? snap[sheet][cell] : undefined, expected,
          `${kind} ${sheet}.${cell} 与重构前基线不符：期望 ${expected}，实际 ${snap[sheet] && snap[sheet][cell]}`,
        );
      }
    }
    // 反向核对：不得凭空多出数值格
    for (const [sheet, cells] of Object.entries(snap)) {
      for (const cell of Object.keys(cells)) {
        assert.ok(
          base.snap[sheet] && base.snap[sheet][cell] !== undefined,
          `${kind} ${sheet}.${cell} 是重构后新增的数值格，基线中不存在`,
        );
      }
    }

    const report = computed.__meta.parseReport;
    assert.strictEqual(report.vendor, VENDOR.ZHONGKE, `${kind} 应识别为中科版式`);
    assert.strictEqual(report.missing.length, 0, `${kind} 不应有取不到的取数点`);
    assert.strictEqual(
      report.crossCheckMismatches.length, 0,
      `${kind} 编码扫描与固定单元格出现分歧：${JSON.stringify(report.crossCheckMismatches)}`,
    );
  }
}

/**
 * 中科版式必须以固定单元格取数（唯一经真实账套验证的基准），
 * 编码扫描只做交叉校验，不得抢过去当数据来源。
 */
function testZhongkeUsesFixedAddressAsAuthority() {
  const src = createSource(fx.buildWorkbooks('zhongke'));
  src.exp('wage.30101');
  src.exp('cap.31001');
  src.income('ie.fiscalAppropriation');
  src.balance('bs.currentAssets');
  for (const key of ['wage.30101', 'cap.31001', 'ie.fiscalAppropriation', 'bs.currentAssets']) {
    assert.strictEqual(src.trace[key].via, 'fixed', `${key} 在中科版式下应以固定单元格为准`);
    assert.strictEqual(src.trace[key].crossCheck, 'match', `${key} 交叉校验应一致`);
  }
}

/**
 * 交叉校验必须真的会报警——这是将来用真实中科文件验证编码映射的唯一机制。
 * 手工把某个编码的金额改掉，适配层应保持固定单元格取数并给出告警。
 */
function testCrossCheckDetectsCodeMappingError() {
  const workbooks = fx.buildWorkbooks('zhongke');
  const sheet = workbooks.经费支出明细表.findSheet('1月份');
  // D6 是 30101 基本工资的固定单元格。把 30101 这个编码挪到第 7 行，
  // 模拟"source-map 里的编码映射比真实版式错了一行"：
  // 按编码扫描会取到 D7，与固定单元格 D6 不符，适配层必须发现并告警。
  sheet.A6 = { t: 's', v: '39901' };
  sheet.A7 = { t: 's', v: '30101' };

  const src = createSource(workbooks);
  const value = src.exp('wage.30101');
  assert.strictEqual(value, fx.leftValue(6), '交叉校验不一致时仍必须按固定单元格取数');
  assert.strictEqual(src.trace['wage.30101'].via, 'fixed');
  assert.ok(
    src.warnings.some((w) => w.includes('wage.30101') && w.includes('核对')),
    `应就编码映射不一致给出告警，实际告警：${JSON.stringify(src.warnings)}`,
  );
}

/**
 * 非中科版式：行序打乱、单栏、金额列位置不同、无任何固定地址可用，
 * 仍应靠科目编码/名称把 confidence='high' 的取数点全部取到。
 */
function testContentOnlyVendorPath() {
  const computed = computeReport(fx.buildWorkbooks('contentOnly'), fx.EDU_DATA, OPTS);
  const report = computed.__meta.parseReport;

  assert.strictEqual(report.vendor, VENDOR.UNKNOWN, '无中科特征时应归为未识别厂商');
  assert.strictEqual(report.byFixedAddress, 0, '未识别厂商不得使用中科固定地址取数');
  assert.ok(report.byCode > 0, '应有取数点通过科目编码定位');
  assert.ok(report.byName > 0, '应有取数点通过科目名称定位');

  // 逐项核对：值只可能来自内容定位
  assert.strictEqual(computed.支出情况表.J17, 200000, '30101 基本工资');
  assert.strictEqual(computed.支出情况表.J58, 30000, '30213 维修(护)费');
  assert.strictEqual(computed.支出情况表.J62, 5000, '30217 公务接待费');
  assert.strictEqual(computed.支出情况表.J77, 53000, '31001 与 30901 房屋建筑物购建应合并');
  assert.strictEqual(computed.支出情况表.J86, 7000, '31099 其他资本性支出');
  assert.strictEqual(computed.资产价值量情况表.H17, 2000000, '科目余额表 160101（余额列在 F 而非 K）');
  assert.strictEqual(computed.资产价值量情况表.H26, 30000, '科目余额表 160205');
  assert.strictEqual(computed.收入情况表.J14, 500000, '收入费用表按行次名称定位');
  assert.strictEqual(computed.资产价值量情况表.G13, 3810019, '资产负债表按行次名称定位');

  // 取不到的点分两级：阻断级必须进 warnings，信息级只留在溯源报告里
  assert.ok(report.missing.length > 0, '该夹具只放了部分科目，应有缺失项');
  assert.strictEqual(
    report.blocking.length + report.benign.length, report.missing.length,
    '每个缺失取数点都必须归入阻断级或信息级，不允许无归类',
  );
  for (const key of report.blocking) {
    assert.ok(
      computed.__meta.warnings.some((w) => w.includes(key)) || report.warnings.length > 0,
      `阻断级取数点 ${key} 未产生告警，属于静默填 0`,
    );
  }
  for (const key of report.benign) {
    assert.ok(
      !computed.__meta.warnings.some((w) => w.includes(key)),
      `${key} 只是源表无此科目、取 0 正确，不该进 warnings 淹没真问题`,
    );
  }
  // 语义未定的取数点必须明确说明原因
  assert.ok(
    computed.__meta.warnings.some((w) => w.includes('confidence=unknown')),
    '语义未确定的取数点应给出可诊断的告警',
  );
}

/**
 * 告警分级：源表确实没有某个明细科目（该单位本年无此支出）不该报警；
 * 语义未定、段合计缺失、法定报表行次找不到、整表解析失败才该报警。
 *
 * 这是 35 条告警里 22 条是误报的那个问题——误报会把真问题淹掉。
 */
function testMissingPointsClassifiedByTier() {
  const computed = computeReport(fx.buildWorkbooks('contentOnly'), fx.EDU_DATA, OPTS);
  const report = computed.__meta.parseReport;

  // 该夹具没放 309 段科目（多数学校确实没有基本建设支出）→ 应归为信息级
  for (const key of ['cap.30902', 'cap.30906', 'cap.30913']) {
    assert.ok(report.benign.includes(key), `${key} 源表无此科目，应归为信息级`);
    assert.ok(
      report.notes.some((n) => n.includes(key)),
      `${key} 应记入信息级 notes 备查`,
    );
  }
  // 语义未定的 303 段 → 阻断级
  for (const key of ['personal.d48', 'personal.d55']) {
    assert.ok(report.blocking.includes(key), `${key} 语义未定会丢数，应归为阻断级`);
  }
  assert.deepStrictEqual(
    report.missingByReason.semanticsUnknown.includes('personal.d48'), true,
  );
  assert.ok(report.notes.length > 0, '应有信息级提示');
  assert.ok(
    report.notes.every((n) => !computed.__meta.warnings.includes(n)),
    '信息级提示不得混进 warnings',
  );
}

/**
 * 整张表没扫出任何科目编码时，不能当成"该单位所有科目都没有发生额"而静默取 0，
 * 必须识别为结构性解析失败并阻断。
 */
function testWholeSheetParseFailureIsBlocking() {
  const workbooks = fx.buildWorkbooks('contentOnly');
  // 把明细表换成一张没有任何科目编码的表（比如厂商导出的是纯文字版）
  workbooks.经费支出明细表 = fx.makeWorkbook({
    '支出明细表': fx.makeSheet({
      A1: '支出明细表', A3: '项目', B3: '金额',
      A4: '工资福利支出', B4: 3000000,
      A5: '商品和服务支出', B5: 900000,
    }, 'A1:B8'),
  });

  const computed = computeReport(workbooks, fx.EDU_DATA, OPTS);
  const report = computed.__meta.parseReport;
  assert.ok(
    report.missingByReason.parseFailed.length > 0 || report.blocking.length > 0,
    '整表无编码应识别为解析失败并阻断，不能静默取 0',
  );
  assert.ok(
    computed.__meta.warnings.some((w) => w.includes('未能解析出任何科目编码')),
    `应明确告知整表解析失败，实际告警：${JSON.stringify(computed.__meta.warnings.slice(0, 3))}`,
  );
  assert.strictEqual(
    report.missingByReason.codeAbsent.length, 0,
    '解析失败时不得把缺失科目降级为“该单位无此支出”',
  );
}

/**
 * 段合计（301/302）是倒挤控制数，缺失必须阻断而非降级。
 */
function testCriticalTotalsAbsenceIsBlocking() {
  const workbooks = fx.buildWorkbooks('contentOnly');
  const sheet = workbooks.经费支出明细表.findSheet('支出明细表');
  // 整行抹掉段合计（编码列 A 与名称列 B 都去掉）。
  // 只删编码不够——名称回退会命中"商品和服务支出"把它救回来，
  // 这本身说明兜底链有效，但这里要测的是真的定位不到时的分级。
  let removed = 0;
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith('!')) continue;
    if (sheet[addr] && (sheet[addr].v === '301' || sheet[addr].v === '302')) {
      const row = addr.slice(1);
      delete sheet[`A${row}`];
      delete sheet[`B${row}`];
      removed++;
    }
  }
  assert.strictEqual(removed, 2, '夹具中应恰有 301 与 302 两个段合计');

  const src = createSource(workbooks);
  src.exp('goods.total');
  assert.strictEqual(src.trace['goods.total'].reason, 'criticalAbsent',
    '段合计缺失应归为 criticalAbsent');
  assert.ok(
    src.warnings.some((w) => w.includes('段合计')),
    `段合计缺失应阻断告警，实际：${JSON.stringify(src.warnings)}`,
  );
  assert.ok(
    !src.notes.some((n) => n.includes('goods.total')),
    '段合计缺失不得降级为信息级',
  );
}

/**
 * 法定报表（资产负债表/收入费用表）的行次必然存在，找不到就是解析失败，
 * 不能当成"该单位没这项"。
 */
function testStatementRowAbsenceIsBlocking() {
  const workbooks = fx.buildWorkbooks('contentOnly');
  workbooks.资产负债表 = fx.makeWorkbook({
    '资产负债表': fx.makeSheet({ A1: '资产负债表', A4: '项目', C4: '期末余额' }, 'A1:C10'),
  });

  const src = createSource(workbooks);
  src.balance('bs.currentAssets');
  assert.strictEqual(src.trace['bs.currentAssets'].reason, 'statementAbsent');
  assert.ok(
    src.warnings.some((w) => w.includes('法定报表项目')),
    `法定报表行次缺失应阻断告警，实际：${JSON.stringify(src.warnings)}`,
  );
}

/**
 * 回归守卫：金额本身就是 3-8 位数字，绝不能被当成科目编码。
 * 这个 bug 曾导致真编码的金额列被误判为分栏边界、取数全变 0。
 */
function testAmountNotMistakenForCode() {
  const sheet = fx.makeSheet({
    A1: '科目余额表',
    A2: '科目编码', B2: '科目名称', K2: '期末余额',
    A3: '160101', B3: '房屋和构筑物', K3: 5100101,  // 金额是 7 位数字
    A4: '160201', B4: '房屋累计折旧', K4: 200201,   // 金额是 6 位数字
  }, 'A1:K5');

  const { byCode } = scan.scanCodeValueMap(sheet, {
    valueHeaders: map.ACCOUNT_BALANCE.valueHeaders,
    codeHeaders: map.CODE_HEADERS,
  });
  assert.strictEqual(byCode['160101'], 5100101, '金额被误判为编码会导致取数为 0');
  assert.strictEqual(byCode['160201'], 200201);
  assert.strictEqual(byCode['5100101'], undefined, '金额不得被登记成科目编码');
  assert.strictEqual(byCode['200201'], undefined);
}

/**
 * 多栏（左右分栏）版式：同一行左右两栏各有一套编码与金额，不能互相串。
 */
function testMultiPanelLayout() {
  const sheet = fx.makeSheet({
    A1: '支出明细表',
    A2: '科目编码', B2: '科目名称', D2: '本年累计',
    E2: '科目编码', F2: '科目名称', H2: '本年累计',
    A3: '30101', B3: '基本工资', D3: 111,
    E3: '31001', F3: '房屋建筑物购建', H3: 222,
    A4: '30199', B4: '其他工资福利支出', D4: 333,
    E4: '31099', F4: '其他资本性支出', H4: 444,
  }, 'A1:H5');

  const { byCode } = scan.scanCodeValueMap(sheet, {
    valueHeaders: map.EXPENSE_VALUE_HEADERS,
    codeHeaders: map.CODE_HEADERS,
  });
  assert.strictEqual(byCode['30101'], 111, '左栏金额应取 D 列');
  assert.strictEqual(byCode['31001'], 222, '右栏金额应取 H 列');
  assert.strictEqual(byCode['30199'], 333);
  assert.strictEqual(byCode['31099'], 444);
}

/**
 * 309 与 310 存在同名科目（如"房屋建筑物购建"），这两段只能按编码定位，
 * 名称回退会撞车，故适配层必须禁用其名称回退。
 */
function testCapitalCodesDoNotFallBackToName() {
  for (const entry of map.EXPENSE_CAPITAL) {
    assert.ok(
      map.NAME_AMBIGUOUS_KEYS.has(entry.key),
      `${entry.key} 属于 309/310 同名科目段，必须禁用名称回退`,
    );
  }
  const src = createSource(fx.buildWorkbooks('contentOnly'));
  src.exp('cap.31001');
  assert.notStrictEqual(src.trace['cap.31001'].via, 'name', '资本性支出不得按名称定位');
}

/**
 * 厂商识别：中科靠"按月分 sheet + 301/302 合计落在 D5/D19"识别；
 * 其余一律未识别（尚无样本，不猜特征）。允许界面手工指定。
 */
function testVendorDetection() {
  assert.strictEqual(detectVendor(fx.buildWorkbooks('zhongke')), VENDOR.ZHONGKE);
  const realStyle = fx.buildWorkbooks('zhongke');
  const monthSheet = realStyle.经费支出明细表.getSheet(0);
  realStyle.经费支出明细表 = fx.makeWorkbook({ '1月份 支出明细表': monthSheet });
  assert.strictEqual(
    detectVendor(realStyle), VENDOR.ZHONGKE,
    '真实中科导出的“1月份 支出明细表”sheet 名也必须识别为中科',
  );
  assert.strictEqual(detectVendor(fx.buildWorkbooks('contentOnly')), VENDOR.UNKNOWN);
  assert.strictEqual(
    detectVendor(fx.buildWorkbooks('zhongke'), VENDOR.UNKNOWN), VENDOR.UNKNOWN,
    '应允许手工指定厂商覆盖自动识别',
  );
}

/**
 * 取数点声明表的完整性：每个点都要有 confidence，且必须能被引擎取到。
 */
function testSourceMapIntegrity() {
  const all = [...map.EXPENSE_DETAIL, ...map.BALANCE_SHEET, ...map.INCOME_EXPENSE];
  const keys = new Set();
  for (const entry of all) {
    assert.ok(entry.key, '取数点必须有 key');
    assert.ok(!keys.has(entry.key), `取数点 key 重复：${entry.key}`);
    keys.add(entry.key);
    assert.ok(['high', 'inferred', 'unknown'].includes(entry.confidence),
      `${entry.key} 的 confidence 非法：${entry.confidence}`);
    if (entry.confidence !== 'unknown') {
      assert.ok(entry.code || (entry.names && entry.names.length),
        `${entry.key} 声明为可内容定位，必须给出编码或名称`);
    }
  }
  const summary = map.confidenceSummary();
  assert.strictEqual(summary.total, summary.high + summary.inferred + summary.unknown);
  assert.ok(summary.high > 0);
}

/**
 * 单位名称按内容识别。这是源文件归属到哪所学校的依据，
 * 认错会把两所学校的表混在一起，故各种版式都要覆盖。
 */
function testUnitNameByContent() {
  const cases = [
    {
      desc: '中科资产负债表：“编制单位：××”同格',
      cells: { A1: '资产负债表', A3: '编制单位：沭阳县第一实验小学' },
      expect: '沭阳县第一实验小学', via: 'label',
    },
    {
      desc: '“编制单位：”与名称分列',
      cells: { A1: '收入费用表', A3: '编制单位：', B3: '沭阳县第二中学' },
      expect: '沭阳县第二中学', via: 'label',
    },
    {
      desc: '无标签，靠学校类后缀识别',
      cells: { A1: '科目余额表', A2: '2025年度', C4: '沭阳县城西幼儿园' },
      expect: '沭阳县城西幼儿园', via: 'suffix',
    },
    {
      desc: '别家版式：单位名称在更靠下的行',
      cells: { A1: '支出明细表', A2: '', A5: '单位名称：沭阳县实验学校' },
      expect: '沭阳县实验学校', via: 'label',
    },
    {
      desc: '名称不含学校后缀时退回固定单元格',
      cells: { A1: '科目余额表', A3: '沭阳县教育局机关' },
      expect: '沭阳县教育局机关', via: 'fallback', fallbackAddr: 'A3',
    },
    {
      desc: '真实明细表同时出现校名与“单位:元”',
      cells: { A1: '明细表', B1: '经费支出汇总表', A2: '沭阳县刘集中心小学', H2: '单位:元' },
      expect: '沭阳县刘集中心小学', via: 'suffix', fallbackAddr: 'A2',
    },
  ];

  for (const c of cases) {
    const sheet = fx.makeSheet(c.cells, 'A1:F10');
    const hit = scan.findUnitName(sheet, { fallbackAddr: c.fallbackAddr });
    assert.ok(hit, `${c.desc}：未识别出单位名称`);
    assert.strictEqual(hit.name, c.expect, c.desc);
    assert.strictEqual(hit.via, c.via, `${c.desc}：识别途径应为 ${c.via}`);
  }

  // 报表标题不得被误当作单位名称（含“学校”二字但不以其结尾）
  const titleOnly = fx.makeSheet({ A1: '中小学校（单位）人员情况表', A2: '2025' }, 'A1:F6');
  assert.strictEqual(scan.findUnitName(titleOnly), null, '报表标题不应被当作单位名称');
}

/**
 * 文件类型识别不得依赖标题恰好落在 A1——各厂商表头行数与留空行不同。
 */
function testFileTypeIdentifiedBeyondA1() {
  const { identifyByContent } = require('../src/watcher');
  const makeWb = (cells, names = ['Sheet1']) => ({
    SheetNames: names,
    Sheets: { [names[0]]: fx.makeSheet(cells, 'A1:F8') },
  });

  assert.strictEqual(identifyByContent(makeWb({ A1: '科目余额表' })), '科目余额表');
  assert.strictEqual(
    identifyByContent(makeWb({ A2: '2025年度', B3: '科目余额表' })), '科目余额表',
    '标题在 B3 也应识别为科目余额表',
  );
  assert.strictEqual(
    identifyByContent(makeWb({ A3: '资产负债表', A4: '编制单位：××小学' })), '资产负债表',
  );
  assert.strictEqual(
    identifyByContent(makeWb({ B2: '收入费用表' })), '收入费用表',
  );
  assert.strictEqual(
    identifyByContent(makeWb({ A1: '学校代码' })), null,
    '教育事业年报应继续跳过',
  );
}

module.exports = {
  testUnitNameByContent,
  testFileTypeIdentifiedBeyondA1,
  testZhongkeGoldenMaster,
  testZhongkeUsesFixedAddressAsAuthority,
  testCrossCheckDetectsCodeMappingError,
  testContentOnlyVendorPath,
  testAmountNotMistakenForCode,
  testMultiPanelLayout,
  testCapitalCodesDoNotFallBackToName,
  testVendorDetection,
  testSourceMapIntegrity,
  testMissingPointsClassifiedByTier,
  testWholeSheetParseFailureIsBlocking,
  testCriticalTotalsAbsenceIsBlocking,
  testStatementRowAbsenceIsBlocking,
};
