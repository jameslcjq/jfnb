/**
 * 源报表夹具：合成不同厂商版式的工作簿，用于解析层的金标准测试。
 *
 * 三套夹具的作用：
 *   buildZhongke({ withCodes: true })  — 中科版式 + 科目编码列，验证编码扫描与固定地址一致
 *   buildZhongke({ withCodes: false }) — 中科版式但无编码列，验证固定地址兜底仍取到数
 *   buildContentOnly()                 — 打乱行序的单栏版式（模拟别家厂商），
 *                                        验证纯内容定位能取到 confidence='high' 的取数点
 *
 * ⚠️ 夹具里的编码位置是按 source-map.js 的声明摆的，因此它**不能证明**这些编码
 *    在真实中科文件里也是这个位置。它证明的是"重构没有改变取数结果"。
 *    编码映射是否符合真实账套，要靠真实样本 + 适配层的交叉校验告警来确认。
 */

const XLSX = require('@e965/xlsx');

/** 把 { 'D5': 123, 'A5': '301' } 这样的字面表变成 SheetJS sheet */
function makeSheet(cells, ref) {
  const sheet = {};
  for (const [addr, value] of Object.entries(cells)) {
    if (value == null) continue;
    sheet[addr] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: String(value) };
  }
  sheet['!ref'] = ref;
  return sheet;
}

/** 构造 WB 包装器的替身（与 src/report-engine.js 的 WB 接口一致） */
function makeWorkbook(sheetMap) {
  const names = Object.keys(sheetMap);
  return {
    sheetNames: names,
    findSheet(keyword) {
      if (sheetMap[keyword]) return sheetMap[keyword];
      const hit = names.find((n) => n.includes(keyword));
      return hit ? sheetMap[hit] : null;
    },
    getSheet(index) { return sheetMap[names[index]] || null; },
  };
}

/**
 * 经费支出明细表的行 → 科目编码对照（左栏 D 列 / 右栏 H 列）。
 * 与 src/source-map.js 保持同步；未确定语义的行不给编码。
 */
const LEFT_CODES = {
  5: '301', 6: '30101', 7: '30102', 8: '30103', 9: '30106', 10: '30107',
  11: '30108', 12: '30109', 13: '30110', 14: '30111', 15: '30112', 16: '30113',
  17: '30114', 18: '30199',
  19: '302', 20: '30201', 21: '30202', 22: '30203', 23: '30204', 24: '30205',
  25: '30206', 26: '30207', 27: '30208', 28: '30209', 29: '30211', 30: '30212',
  31: '30213', 32: '30214', 33: '30215', 34: '30216', 35: '30217', 36: '30218',
  40: '30227', 41: '30228', 42: '30229', 43: '30231', 44: '30239', 45: '30299',
  // 48-55、60 语义未定，故意不给编码
};

const RIGHT_CODES = {
  11: '30901', 12: '30902', 13: '30903', 14: '30905', 15: '30906', 16: '30907',
  17: '30908', 18: '30913', 19: '30919', 20: '30921', 21: '30922', 22: '30999',
  24: '31001', 25: '31002', 26: '31003', 27: '31005', 28: '31006', 29: '31007',
  30: '31008', 31: '31009', 32: '31010', 33: '31011', 34: '31012', 35: '31013',
  36: '31019', 37: '31021', 38: '31022', 39: '31099',
  // 4 行语义未定
};

/** 引擎实际读取的左栏行 / 右栏行 */
const LEFT_ROWS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40,
  41, 42, 43, 44, 45, 48, 49, 50, 51, 52, 53, 54, 55, 60];
const RIGHT_ROWS = [4, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];

/**
 * 哨兵值：每格一个互不相同的可识别数字，任何串行/错位都会在结果里暴露。
 * 同时必须满足会计恒等关系，否则引擎的"合计倒挤"校验会直接抛错：
 *   - D5(301 合计) / D19(302 合计) 必须大于本段明细之和，留出办公费倒挤与取暖费测算的空间
 *   - 明细项取 row*10，保证两位数级差、互不相同
 */
function leftValue(row) {
  if (row === 5) return 3000;    // 301 工资福利支出合计
  if (row === 19) return 40000;  // 302 商品和服务支出合计（含倒挤的办公费与测算取暖费）
  return row * 10;
}
function rightValue(row) { return 7000 + row; }

/**
 * 中科版式：明细表按月分 sheet，左栏 A=编码 B=名称 D=金额，右栏 E=编码 F=名称 H=金额。
 */
function buildZhongke({ withCodes = true } = {}) {
  // 表头在第 3 行：H4 是引擎的取数点，故右栏数据自第 4 行起，表头必须在其上方。
  // A2 为单位名称（watcher.js 的 UNIT_NAME_CELLS 按此定位经费支出明细表的单位）。
  const cells = {
    A1: '××小学 支出明细表',
    A2: '××实验小学',
    A3: '科目编码', B3: '科目名称', D3: '本年累计',
    E3: '科目编码', F3: '科目名称', H3: '本年累计',
  };
  for (const row of LEFT_ROWS) {
    cells[`D${row}`] = leftValue(row);
    if (withCodes && LEFT_CODES[row]) cells[`A${row}`] = LEFT_CODES[row];
  }
  for (const row of RIGHT_ROWS) {
    cells[`H${row}`] = rightValue(row);
    if (withCodes && RIGHT_CODES[row]) cells[`E${row}`] = RIGHT_CODES[row];
  }
  const expDetail = makeWorkbook({
    '1月份': makeSheet(cells, 'A1:H62'),
    '12月份': makeSheet({ A1: '占位' }, 'A1:A1'),
  });

  // 科目余额表：A=编码，K=期末余额
  const accCells = { A1: '科目余额表', A3: '××实验小学', A5: '科目编码', B5: '科目名称', K5: '期末余额' };
  const accCodes = { 160101: 5100101, 160102: 5100102, 160104: 5100104, 160105: 5100105,
    160201: 200201, 160202: 200202, 160205: 200205 };
  let r = 6;
  for (const [code, value] of Object.entries(accCodes)) {
    accCells[`A${r}`] = code;
    accCells[`C${r}`] = 0;          // 期初余额列，验证不会被误取
    accCells[`K${r}`] = value;
    r++;
  }
  const account = makeWorkbook({ '第一页': makeSheet(accCells, `A1:K${r}`) });

  // 资产负债表：A=项目 B=年末余额；E29 为未定语义取数点
  const balance = makeWorkbook({
    '第1页': makeSheet({
      A1: '资产负债表', A3: '编制单位：××实验小学',
      A5: '资产', B5: '年末余额', D5: '负债和净资产', E5: '年末余额',
      A19: '流动资产合计', B19: 810019,
      A27: '在建工程', B27: 810027,
      D29: '未确定项目', E29: 820029,
    }, 'A1:E32'),
  });

  // 收入费用表
  const income = makeWorkbook({
    '第1页': makeSheet({
      A1: '收入费用表', B3: '××实验小学',
      A5: '项目', D5: '本年金额',
      A6: '财政拨款收入', D6: 500000,
      A17: '经营收入', D17: 3300,
    }, 'A1:D20'),
  });

  return { 经费支出明细表: expDetail, 科目余额表: account, 资产负债表: balance, 收入费用表: income };
}

/**
 * 模拟"别家厂商"：单栏版式、行序完全不同、金额列在别的位置、无固定地址可用。
 * 只放 confidence='high' 的科目，用来验证纯内容定位路径。
 */
function buildContentOnly() {
  // 行序刻意打乱，金额需满足"明细不超合计"，否则引擎的倒挤校验会正常抛错。
  const rows = [
    ['科目编码', '科目名称', '期初数', '本年累计'],
    ['302', '商品和服务支出', 0, 620000],
    ['31099', '其他资本性支出', 0, 7000],
    ['30101', '基本工资', 0, 200000],
    ['30213', '维修(护)费', 0, 30000],
    ['301', '工资福利支出', 0, 300000],
    ['31001', '房屋建筑物购建', 0, 41000],
    ['30217', '公务接待费', 0, 5000],
    ['30199', '其他工资福利支出', 0, 50000],
    ['30901', '房屋建筑物购建', 0, 12000],
  ];
  const cells = { A1: '某校 支出明细表（另一家软件导出）' };
  rows.forEach((row, i) => {
    const r = i + 3;
    cells[`A${r}`] = row[0];
    cells[`B${r}`] = row[1];
    cells[`C${r}`] = row[2];
    cells[`D${r}`] = row[3];
  });
  const expDetail = makeWorkbook({ '支出明细表': makeSheet(cells, `A1:D${rows.length + 3}`) });

  const accCells = { A1: '科目余额表', A3: '某校', A4: '科目编码', B4: '科目名称', F4: '期末余额' };
  // 编码列在 A、期末余额列在 F（而非中科的 K），验证按表头识别列；行序同样打乱。
  // 折旧须小于对应类别原值，否则引擎会做折旧重分类并告警。
  const accCodes = {
    160102: 800000, 160101: 2000000, 160205: 30000,
    160104: 150000, 160105: 90000, 160201: 400000, 160202: 250000,
  };
  let r = 5;
  for (const [code, value] of Object.entries(accCodes)) {
    accCells[`A${r}`] = code;
    accCells[`D${r}`] = 1;  // 期初余额，不应被取到
    accCells[`F${r}`] = value;
    r++;
  }
  const account = makeWorkbook({ '科目余额表': makeSheet(accCells, `A1:F${r}`) });

  const balance = makeWorkbook({
    '资产负债表': makeSheet({
      A1: '资产负债表', A4: '项目', C4: '期末余额',
      A9: '在建工程', C9: 3810027,
      A15: '流动资产合计', C15: 3810019,
    }, 'A1:C20'),
  });

  const income = makeWorkbook({
    '收入费用表': makeSheet({
      A1: '收入费用表', A4: '项目', C4: '本期金额',
      A8: '经营收入', C8: 3300,
      A12: '财政拨款收入', C12: 500000,
    }, 'A1:C15'),
  });

  return { 经费支出明细表: expDetail, 科目余额表: account, 资产负债表: balance, 收入费用表: income };
}

/** 上年经费年报替身（平台自有模板，与厂商无关） */
function buildPrevYear() {
  const person = makeSheet({
    J14: 40, J15: 32, J30: 600, J34: 5, J38: 120,
    J31: 0, J32: 200, J33: 400, J35: 0, J36: 2, J37: 3,
    J39: 0, J40: 50, J41: 70, J45: 18, J47: 9,
  }, 'A1:M50');
  const asset = makeSheet({}, 'A1:M40');
  const phys = makeSheet({}, 'A1:M40');
  return makeWorkbook({
    '人员情况表': person,
    '资产价值量情况表': asset,
    '资产实物量情况表': phys,
  });
}

/** 标准 eduData，保证计算路径确定 */
const EDU_DATA = {
  教职工数: 45, 专任教师: 36, 年末编制外长期聘用人员: 4, 年末离退休人员: 6,
  幼儿园学生数: 0, 小学学生数: 420, 初中学生数: 210, 高中学生数: 0,
  小学随班就读: 3, 初中随班就读: 2, 高中随班就读: 0,
  小学住宿生: 80, 初中住宿生: 45, 高中住宿生: 0,
  年末学前一年在园儿童人数: 0, 年末托育幼儿人数: 0,
};

function buildWorkbooks(kind) {
  const base = kind === 'contentOnly' ? buildContentOnly()
    : kind === 'zhongkeNoCodes' ? buildZhongke({ withCodes: false })
      : buildZhongke({ withCodes: true });
  return { ...base, 上年经费年报: buildPrevYear() };
}

module.exports = {
  makeSheet,
  makeWorkbook,
  buildZhongke,
  buildContentOnly,
  buildPrevYear,
  buildWorkbooks,
  EDU_DATA,
  LEFT_ROWS,
  RIGHT_ROWS,
  LEFT_CODES,
  RIGHT_CODES,
  leftValue,
  rightValue,
};
