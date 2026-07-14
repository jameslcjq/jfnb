const XLSX = require('@e965/xlsx');
const path = require('path');
const { sanitizeFileName, resolveInside } = require('./path-safety');
const { applyReportRules, validationWarnings } = require('./report-rule-engine');
const { explanationsText, buildVarianceSuggestions } = require('./rule-explanations');
const fs = require('fs');

// 非义务教育学校类别代码（322065）：这些学校财政取暖经费(附11)须为 0。
// 幼儿园(8)、高中(411)、职业/技工(416/421/422)、特教及其他(211/212/22/23/24/25/62/72)。
const NON_COMPULSORY_XXLBDM = new Set(['211', '212', '22', '23', '24', '25', '411', '416', '421', '422', '62', '72', '8']);

function num(val) {
  if (val == null) return 0;
  if (typeof val === 'object' && val.result != null) return num(val.result);
  if (typeof val === 'object' && val.v != null) return num(val.v);
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function sumValues(values) {
  return values.reduce((sum, value) => sum + (num(value) || 0), 0);
}

// 有取暖费支出而未填年末取暖面积时（强制公式 12046、提示公式 322025 会打回），
// 默认按年末教学及辅助用房与行政办公用房面积填报取暖面积，供经办复核调整。
function applyHeatedAreaLinkage(支出情况表, 资产实物量情况表, warnings = []) {
  const heatingExpense = num(支出情况表.F54) || num(支出情况表.J54);
  const heatedArea = num(资产实物量情况表.J24);
  const usableArea = num(资产实物量情况表.J20) + num(资产实物量情况表.J21);
  if (heatingExpense > 0 && heatedArea === 0 && usableArea > 0) {
    资产实物量情况表.J24 = usableArea;
    warnings.push(`有取暖费支出但年末取暖面积为空，已按教学及辅助用房与行政办公用房面积默认填报 ${usableArea} 平方米，请核实。`);
  }
}

function clampNonNegative(value) {
  return Math.max(0, num(value));
}

// 生成即通过：按资金列填报支出表 84 行“年末预算结转结余”。
// 官方强制公式 428/429/430/949 要求 收入(该资金)-支出(该列) <= 对应结转结余列，
// 差额=当年未支出的财政资金，正是结转结余的定义。列语义（支出表位置号→模板列）：
//   1合计F｜2财政补助G｜3一般公共预算H｜4一般公共预算教育I｜5教育事业费+基建J｜6政府性基金K｜7专项债L｜8特别国债M
// 收入表单列（本年收入 J 列）：code 02→行12(一般公共预算) 03→13 04→14 05→15 06→16 12→22 14→24 15→25。
// 财政补助总列(位置2)无任何强制约束，且提示 322160 要求市县该列结转为 0，故恒填 0，
// 既满足 10627(84_01>=84_02) 又不触发 322160，无需区分市县/省级。
function applyCarryoverBalance(收入情况表, 支出情况表, options = {}) {
  const round2 = (value) => Math.round(value * 100) / 100;
  // 模型将支出表财政各列合并写为合计行 fiscal 值（支出情况表.J14）；政府性基金/债务列模型未拆分，取 0。
  const 一般公共预算支出 = num(支出情况表.J14);
  // 公办义务教育学校（公办小学/初中/一贯制）财政收支相等、无结余（国库集中支付，
  // 财政据实拨付即支出额）。若源账因确认时点导致一般公共预算收入略高于支出，且全部
  // 财政收入均为教育事业费（02==03==04、无基建/教育费附加），调减到与支出一致，
  // 使 323337/338/339 收支相等且不产生财政结转。收入<支出（动用往年结余）不处理。
  if (options.publicCompulsory) {
    const 财政收入 = num(收入情况表.J12);
    const 单一教育事业费 = num(收入情况表.J12) === num(收入情况表.J13)
      && num(收入情况表.J13) === num(收入情况表.J14);
    if (单一教育事业费 && 财政收入 > 一般公共预算支出 + 0.005) {
      const 非财政 = round2(num(收入情况表.J11) - 财政收入);
      收入情况表.J14 = round2(一般公共预算支出);
      收入情况表.J13 = round2(一般公共预算支出);
      收入情况表.J12 = round2(一般公共预算支出);
      收入情况表.J11 = round2(一般公共预算支出 + 非财政);
    }
  }
  const inc = (row) => num(收入情况表[`J${row}`]);
  const 政府性基金支出 = num(支出情况表.K14);
  const 专项债支出 = num(支出情况表.L14);
  const 特别国债支出 = num(支出情况表.M14);
  const c05 = Math.max(0, (inc(14) + inc(15)) - 一般公共预算支出); // 教育事业费+基本建设
  const c04 = Math.max(0, inc(13) - 一般公共预算支出);            // 一般公共预算教育经费
  const c03 = Math.max(0, inc(12) - 一般公共预算支出);            // 一般公共预算安排的教育经费
  const c08 = Math.max(0, inc(25) - 特别国债支出);
  const c07 = Math.max(0, inc(24) - 专项债支出);
  const c06 = Math.max(0, inc(22) - 政府性基金支出, c07 + c08);   // 12211: 84_06 >= 84_07+84_08
  const c01 = Math.max(0, c03, c06);                              // 总结转 >= 各资金列
  // c03>=c04>=c05 由收入层级(02>=03>=04+05)与同一支出额天然成立，无需额外抬升。
  支出情况表.__carryover = {
    F: round2(c01), G: 0, H: round2(c03), I: round2(c04),
    J: round2(c05), K: round2(c06), L: round2(c07), M: round2(c08),
  };
}

// 生成即通过：累计折旧不得超过对应类别原值（强制 11938 房屋/11939 设备/11941 家具）。
// 源账套若给已划出或未登记的固定资产计提了折旧（典型：房屋有折旧无原值），按列把超额
// 折旧重分类到仍有容量（原值>折旧）的类别；折旧合计(12408/12410)与净值(12267)保持不变。
// 只动写表覆盖的 F(年初)/G(年末)/H(自用) 三列，其余列引擎恒为 0。
function reconcileDepreciation(资产价值量情况表, warnings = []) {
  const categories = [
    { name: '房屋和构筑物', dep: 24, orig: 17 },
    { name: '设备', dep: 25, orig: 18 },
    { name: '家具和用具', dep: 26, orig: 21 },
  ];
  const round2 = (value) => Math.round(value * 100) / 100;
  const cell = (col, row) => num(资产价值量情况表[`${col}${row}`]);
  const moved = [];
  for (const col of ['F', 'G', 'H']) {
    let excess = 0;
    for (const c of categories) {
      const over = cell(col, c.dep) - cell(col, c.orig);
      if (over > 0.005) {
        excess = round2(excess + over);
        if (col === 'G') moved.push({ name: c.name, amount: round2(over) });
        资产价值量情况表[`${col}${c.dep}`] = cell(col, c.orig);
      }
    }
    if (excess <= 0.005) continue;
    const room = categories
      .map((c) => ({ c, cap: round2(cell(col, c.orig) - cell(col, c.dep)) }))
      .filter((item) => item.cap > 0.005)
      .sort((a, b) => b.cap - a.cap);
    for (const { c, cap } of room) {
      if (excess <= 0.005) break;
      const add = Math.min(cap, excess);
      资产价值量情况表[`${col}${c.dep}`] = round2(cell(col, c.dep) + add);
      excess = round2(excess - add);
    }
    if (excess > 0.005 && col === 'G') {
      warnings.push(`固定资产累计折旧超过原值合计 ${excess.toFixed(2)} 元，无类别可容纳，请核对科目余额表 1601/1602 明细。`);
    }
  }
  if (moved.length) {
    const detail = moved.map((m) => `${m.name}${m.amount.toFixed(2)}元`).join('、');
    warnings.push(`源账套存在无对应原值的累计折旧（${detail}），已按类别容量重分类到设备/家具折旧以通过“折旧不超原值”校验，请核实固定资产明细账。`);
  }
}

// 生成即通过：有在职教职工则基本工资等工资明细必须 >0（强制 358）。
// 个别学校财政导出把全部工资挤进“其他工资福利支出(30199)”，基本/津贴/奖金/绩效均为 0。
// 工资合计(433)由各子项相加，其他工资福利与基本工资同为子项，互移不改变合计；
// 按合计不变把其他工资福利重分类到基本工资(行17)，保留其“其中”子项(行31，满足 434 的 17>=18)。
// 仅在“有在职教职工 + 工资明细全空 + 其他工资福利>0”时触发（正常已拆分的学校不受影响）。
function reconcileWageItemization(人员情况表, 支出情况表, warnings = []) {
  const hasStaff = num(人员情况表.J12) + num(人员情况表.J14) > 0;
  const itemized = num(支出情况表.F17) + num(支出情况表.F18) + num(支出情况表.F20) + num(支出情况表.F22);
  const otherTotal = num(支出情况表.F30);
  const floorSub = num(支出情况表.F31); // 其他工资福利之“其中”(code18)，434 要求行30 >= 行31
  if (!hasStaff || itemized > 0.005 || otherTotal <= 0.005) return;
  const round2 = (value) => Math.round(value * 100) / 100;
  const moveTotal = round2(otherTotal - floorSub);
  if (moveTotal <= 0.005) return;
  const otherFiscal = num(支出情况表.J30);
  const moveFiscal = round2(Math.min(otherFiscal, moveTotal));
  支出情况表.F17 = round2(num(支出情况表.F17) + moveTotal);
  支出情况表.J17 = round2(num(支出情况表.J17) + moveFiscal);
  支出情况表.F30 = round2(otherTotal - moveTotal);
  支出情况表.J30 = round2(otherFiscal - moveFiscal);
  warnings.push(`源明细表未拆分工资科目（全部计入其他工资福利支出 ${otherTotal.toFixed(2)} 元），已在工资合计不变的前提下重分类 ${moveTotal.toFixed(2)} 元至基本工资以通过校验，请核实工资明细账。`);
}

const PRIMARY_SCHOOL_MERGE_GROUPS = {
  '\u6cad\u9633\u53bf\u97e9\u5c71\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u97e9\u5c71\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u97e9\u5c71\u9547\u5c1a\u5e84\u6559\u5b66\u70b9',
  ],
  '\u6cad\u9633\u53bf\u6851\u589f\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u6851\u589f\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u6851\u589f\u9547\u8212\u7a91\u6559\u5b66\u70b9',
  ],
  '\u6cad\u9633\u53bf\u5218\u96c6\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u5218\u96c6\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u5218\u96c6\u9547\u897f\u5468\u96c6\u6559\u5b66\u70b9',
  ],
  '\u6cad\u9633\u53bf\u674e\u6052\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u674e\u6052\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u674e\u6052\u9547\u6c64\u5c71\u6559\u5b66\u70b9',
  ],
  '\u6cad\u9633\u53bf\u989c\u96c6\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u989c\u96c6\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u989c\u96c6\u9547\u623f\u5729\u5c0f\u5b66',
  ],
  '\u6cad\u9633\u53bf\u6f7c\u9633\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u6f7c\u9633\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u6f7c\u9633\u9547\u9a6c\u5cad\u5c0f\u5b66',
  ],
  '\u6cad\u9633\u53bf\u803f\u5729\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u803f\u5729\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u803f\u5729\u9547\u6c82\u5357\u6559\u5b66\u70b9',
    '\u6cad\u9633\u53bf\u803f\u5729\u9547\u6dee\u897f\u5c0f\u5b66',
  ],
  '\u6cad\u9633\u53bf\u8d24\u5b98\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u8d24\u5b98\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u8d24\u5b98\u9547\u5b98\u6797\u5c0f\u5b66',
  ],
  '\u6cad\u9633\u53bf\u6e56\u4e1c\u4e2d\u5fc3\u5c0f\u5b66': [
    '\u6cad\u9633\u53bf\u6e56\u4e1c\u4e2d\u5fc3\u5c0f\u5b66',
    '\u6cad\u9633\u53bf\u6e56\u4e1c\u9547\u6768\u6e7e\u5c0f\u5b66',
  ],
};

const KINDERGARTEN_MERGE_GROUPS = {
  '沭阳县仰龙湾儿童之家': [
    '沭阳县仰龙湾儿童之家',
    '沭阳县七雄启萌幼儿园',
    '沭阳县东方幼儿园',
    '沭阳县津典幼儿园',
    '沭阳县陇集镇实验幼儿园',
    '沭阳县豆豆蚁儿童之家',
    '沭阳县京师幼儿园',
    '沭阳县庙头镇中心幼儿园',
    '沭阳县塘沟实验幼儿园',
    '沭阳县青伊湖镇世纪鹏幼儿园',
    '沭阳县颖都幼儿园',
    '沭阳县华冲仲林幼儿园',
    '沭阳县西城馥邦幼儿园',
    '沭阳县未来儿童学苑',
    '沭阳县大风车幼儿园',
    '沭阳县大唐世家幼儿园',
    '沭阳县优童实验幼儿园',
    '沭阳县潼阳镇晨光幼儿园',
    '沭阳县悦来镇叶新庄幼儿园',
  ],
  '沭阳县怀文幼儿园': [
    '沭阳县怀文幼儿园',
    '沭阳县耿圩中心幼儿园',
    '沭阳县钱集镇中心幼儿园',
    '沭阳豪园幼儿园',
    '沭阳县卫星幼儿园',
    '沭阳县马厂中心幼儿园',
    '沭阳县马厂实验学校幼儿园',
    '沭阳县西湖钟书幼儿园',
    '沭阳县湖东古北幼儿园',
    '沭阳县书香名邸幼儿园',
    '沭阳天下景城幼儿园',
    '沭阳县金色摇篮幼儿园',
    '沭阳县沭城镇苏通花苑幼儿园',
    '沭阳县沭城镇东城幼儿园',
    '沭阳县兴华幼儿园',
    '沭阳县青苹果幼儿园',
    '沭阳县太平幼儿园',
    '沭阳县博爱幼儿园',
    '沭阳县胡集镇中心幼儿园',
    '沭阳县香溢幼儿园',
    '沭阳县十字中心幼儿园',
    '沭阳县悦来镇实验幼儿园',
    '沭阳县桑墟明星幼儿园',
    '沭阳县颜集镇阳光幼儿园',
    '沭阳县沂涛中心幼儿园',
    '沭阳县北丁集乡润城幼儿园',
    '沭阳县扎下镇中心幼儿园',
    '沭阳县周集中心幼儿园',
  ],
  '沭阳县南京路幼儿园': [
    '沭阳县南京路幼儿园',
    '沭阳中新幼儿园',
    '沭阳县马厂镇英皇幼儿园',
    '沭阳县汤涧中心幼儿园',
    '沭阳县悦来镇芳芳幼儿园',
    '沭阳县张圩乡蓓蕾幼儿园',
    '沭阳红岩幼儿园',
  ],
  '沭阳县沭城镇祥和幼儿园': [
    '沭阳县沭城镇祥和幼儿园',
    '沭阳虞姬幼儿园',
    '沭阳县桑墟镇爱心幼儿园',
    '沭阳县桑墟镇棒棒幼儿园',
    '沭阳县韩山镇汉王路幼儿园',
  ],
};

function normalizeSchoolName(name) {
  return String(name || '').replace(/\s+/g, '').replace(/[（）()]/g, '').trim();
}

function applySchoolAlias(name, aliases = {}) {
  const normalized = normalizeSchoolName(name);
  for (const [alias, standardName] of Object.entries(aliases || {})) {
    if (normalizeSchoolName(alias) === normalized && standardName) return String(standardName);
  }
  return String(name || '');
}

function resolveEduMergeGroups(customGroups = {}) {
  const groups = { ...PRIMARY_SCHOOL_MERGE_GROUPS, ...KINDERGARTEN_MERGE_GROUPS };
  for (const [centerName, members] of Object.entries(customGroups || {})) {
    if (!centerName) continue;
    if (members === null) {
      delete groups[centerName];
    } else if (Array.isArray(members)) {
      groups[centerName] = members;
    }
  }
  return groups;
}

class EduDataMatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EduDataMatchError';
  }
}

function formatSchoolCandidates(matches) {
  return Array.from(new Set(matches.map((item) => item.name))).join('、');
}

function resolveEduDataMatch(entries, unitName, options = {}) {
  const aliases = options.schoolAliases || options.regionRules?.schoolAliases || {};
  const ignoredClosedSchools = new Set((options.ignoredClosedSchools || options.regionRules?.ignoredClosedSchools || []).map(normalizeSchoolName));
  const aliasedUnitName = applySchoolAlias(unitName, aliases);
  const targetName = normalizeSchoolName(aliasedUnitName);
  const shortName = targetName.replace(/沭阳县/g, '').replace(/县/g, '');
  const rowByName = new Map();
  const fuzzyMatches = [];
  const warnings = [];
  let exactMatch = null;

  for (const entry of entries) {
    const name = String(entry.name || '').trim();
    if (!name) continue;
    const normalized = normalizeSchoolName(name);
    const item = { name, value: entry.value };
    rowByName.set(normalized, item);
    if (normalized === targetName) exactMatch = item;
    if (shortName && normalized.includes(shortName)) fuzzyMatches.push(item);
  }

  const mergeGroups = resolveEduMergeGroups(options.kindergartenMergeGroups || options.mergeGroups || options.regionRules?.mergeGroups);
  for (const [centerName, members] of Object.entries(mergeGroups)) {
    if (normalizeSchoolName(centerName) !== targetName) continue;
    const mergeMissing = [];
    const matchEntries = members.map((name) => {
      const lookupName = applySchoolAlias(name, aliases);
      const entry = rowByName.get(normalizeSchoolName(lookupName));
      if (!entry && !ignoredClosedSchools.has(normalizeSchoolName(name))) mergeMissing.push(name);
      return entry;
    }).filter(Boolean);
    const centerEntry = rowByName.get(normalizeSchoolName(applySchoolAlias(centerName, aliases)));
    const matchEntry = centerEntry || matchEntries[0] || exactMatch || null;
    return {
      match: matchEntry ? matchEntry.value : null,
      matchRows: matchEntries.map((entry) => entry.value),
      mergeMembers: members,
      mergeMissing,
      warnings,
    };
  }

  if (exactMatch) {
    return {
      match: exactMatch.value,
      matchRows: [],
      mergeMembers: null,
      mergeMissing: [],
      warnings,
    };
  }

  if (fuzzyMatches.length > 1) {
    throw new EduDataMatchError(`教育事业年报中“${unitName}”未精确匹配，模糊匹配到多个候选：${formatSchoolCandidates(fuzzyMatches)}。请在规则配置中设置学校别名或合并关系后重试。`);
  }

  if (fuzzyMatches.length === 1) {
    warnings.push(`教育事业年报未找到精确学校名“${aliasedUnitName}”，已使用模糊匹配“${fuzzyMatches[0].name}”，请复核。`);
    return {
      match: fuzzyMatches[0].value,
      matchRows: [],
      mergeMembers: null,
      mergeMissing: [],
      warnings,
    };
  }

  return {
    match: null,
    matchRows: [],
    mergeMembers: null,
    mergeMissing: [],
    warnings,
  };
}

/**
 * SheetJS 工作簿包装器 - 提供方便的读取接口
 */
class WB {
  constructor(filePath) {
    this.wb = XLSX.readFile(filePath);
  }

  get sheetNames() { return this.wb.SheetNames; }

  /**
   * 按名称查找工作表（支持模糊匹配）
   */
  findSheet(keyword) {
    // 精确匹配
    if (this.wb.Sheets[keyword]) return this.wb.Sheets[keyword];
    // 包含匹配
    const name = this.wb.SheetNames.find((n) => n.includes(keyword));
    return name ? this.wb.Sheets[name] : null;
  }

  /**
   * 获取第N个工作表（0-indexed）
   */
  getSheet(index) {
    return this.wb.Sheets[this.wb.SheetNames[index]] || null;
  }

  /**
   * 从指定工作表读取单元格值
   */
  static cellVal(sheet, addr) {
    if (!sheet) return null;
    const cell = sheet[addr];
    return cell ? (cell.v != null ? cell.v : null) : null;
  }

  static cellNum(sheet, addr) {
    return num(WB.cellVal(sheet, addr));
  }
}

/**
 * 从教育事业年报中提取指定学校的人员数据
 */
function extractEduData(eduFilePath, unitName, options = {}) {
  try {
    const wb = new WB(eduFilePath);
    const sheet = wb.getSheet(0);
    if (!sheet) return null;

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    // 按表头名称建立列号映射（防止列顺序变动）
    const colMap = {};
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      const header = sheet[addr] ? String(sheet[addr].v || '').trim() : '';
      if (header) colMap[header] = c;
    }

    // 查找学校所在行；普通小学中心校按固定教学点规则汇总。
    const nameCol = colMap['学校名称'] ?? 1;
    const entries = [];
    for (let r = 1; r <= range.e.r; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: nameCol })];
      if (!cell) continue;
      const name = String(cell.v || '');
      entries.push({ name, value: r });
    }

    const match = resolveEduDataMatch(entries, unitName, options);
    let matchRow = match.match;
    let matchRows = match.matchRows;
    if (matchRow == null || matchRow < 0) return null;
    if (matchRows.length === 0) matchRows = [matchRow];

    const byName = (headerName) => {
      const c = colMap[headerName];
      if (c === undefined) return 0;
      return sumValues(matchRows.map((r) => {
        const addr = XLSX.utils.encode_cell({ r, c });
        return sheet[addr] ? sheet[addr].v : 0;
      }));
    };
    const textByName = (headerName) => {
      const c = colMap[headerName];
      if (c === undefined) return '';
      const addr = XLSX.utils.encode_cell({ r: matchRow, c });
      return String(sheet[addr] ? sheet[addr].v : '').trim();
    };
    const mergedSchoolName = String(sheet[XLSX.utils.encode_cell({ r: matchRow, c: nameCol })]?.v || '');

    return {
      学校名称: mergedSchoolName,
      合并成员学校: match.mergeMembers ? match.mergeMembers.slice() : null,
      合并缺失学校: match.mergeMissing,
      匹配警告: match.warnings,
      bxlx: textByName('bxlx'),
      幼儿园学生数: byName('幼儿园学生数'),
      小学学生数: byName('小学学生数'),
      初中学生数: byName('初中学生数'),
      高中学生数: byName('高中学生数'),
      小学随班就读: byName('小学随班就读'),
      初中随班就读: byName('初中随班就读'),
      高中随班就读: byName('高中残疾人'),
      小学住宿生: byName('小学住宿生'),
      初中住宿生: byName('初中住宿生'),
      高中住宿生: byName('高中住宿生'),
      教职工数: byName('教职工数'),
      教职工中在编: byName('教职工中在编人数'),
      专任教师: byName('专任教师'),
      专任教师中在编: byName('专任教师中在编人员'),
    };
  } catch (error) {
    if (error instanceof EduDataMatchError) throw error;
    return null;
  }
}

function extractEduDataFromRows(rows, unitName, options = {}) {
  try {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const match = resolveEduDataMatch(rows.map((row) => ({ name: row['学校名称'], value: row })), unitName, options);
    let matchRow = match.match;
    let matchRows = match.matchRows;

    if (!matchRow) return null;
    if (matchRows.length === 0) matchRows = [matchRow];

    const byName = (headerName) => sumValues(matchRows.map((row) => row[headerName]));
    const textByName = (headerName) => String(matchRow[headerName] ?? '').trim();

    return {
      学校名称: String(matchRow['学校名称'] || ''),
      合并成员学校: match.mergeMembers ? match.mergeMembers.slice() : null,
      合并缺失学校: match.mergeMissing,
      匹配警告: match.warnings,
      bxlx: textByName('bxlx'),
      幼儿园学生数: byName('幼儿园学生数'),
      小学学生数: byName('小学学生数'),
      初中学生数: byName('初中学生数'),
      高中学生数: byName('高中学生数'),
      小学随班就读: byName('小学随班就读'),
      初中随班就读: byName('初中随班就读'),
      高中随班就读: byName('高中残疾人'),
      小学住宿生: byName('小学住宿生'),
      初中住宿生: byName('初中住宿生'),
      高中住宿生: byName('高中住宿生'),
      教职工数: byName('教职工数'),
      教职工中在编: byName('教职工中在编人数'),
      专任教师: byName('专任教师'),
      专任教师中在编: byName('专任教师中在编人员'),
    };
  } catch (error) {
    if (error instanceof EduDataMatchError) throw error;
    return null;
  }
}

// ===== 办学类型映射表 =====
const BXLX_MAP = {
  '111': { type: '幼儿园', levels: ['幼儿园'] },
  '211': { type: '普通小学', levels: ['小学'] },
  '218': { type: '教学点', levels: ['小学'] },
  '311': { type: '初级中学', levels: ['初中'] },
  '312': { type: '九年制学校', levels: ['小学', '初中'] },
  '341': { type: '完全中学', levels: ['初中', '高中'] },
  '342': { type: '高级中学', levels: ['高中'] },
  '345': { type: '十二年制学校', levels: ['小学', '初中', '高中'] },
  '512': { type: '特殊教育', levels: ['特殊教育'] },
};

// 政府系统中各学段对应的类别名称和代码
const LEVEL_GOV_INFO = {
  '幼儿园': { govName: '幼儿园', govCode: '111' },
  '小学':   { govName: '普通小学', govCode: '61' },
  '初中':   { govName: '初级中学', govCode: '413' },
  '高中':   { govName: '高级中学', govCode: '342' },
};

/**
 * 从上年经费年报识别学校学段类型
 * 检测 sheet 名是否包含学段相关前缀（支持多种命名：
 *   "小学_支出情况表"、"普通小学_人员情况表"、"初中_收入表"、"初级中学_支出表" 等）
 */
function identifySchoolType(prevYearWb) {
  const names = prevYearWb.sheetNames;
  const levelSet = new Set();

  for (const name of names) {
    const n = name.replace(/[-_]/g, '');
    if (n.startsWith('小学') || n.startsWith('普通小学')) levelSet.add('小学');
    else if (n.startsWith('初中') || n.startsWith('初级中学')) levelSet.add('初中');
    else if (n.startsWith('高中') || n.startsWith('高级中学')) levelSet.add('高中');
    else if (n.startsWith('幼儿园') || n.startsWith('幼')) levelSet.add('幼儿园');
  }

  const levels = [];
  for (const l of ['幼儿园', '小学', '初中', '高中']) {
    if (levelSet.has(l)) levels.push(l);
  }

  return levels;
}

/**
 * 也可以从教育事业年报的 bxlx 字段推断学段
 */
function levelsFromBxlx(bxlx) {
  const entry = BXLX_MAP[String(bxlx)];
  return entry ? entry.levels : [];
}

/**
 * 在工作簿中按多种命名模式查找学段对应的 sheet
 * 如"小学"可能匹配"小学_人员情况表"、"普通小学_人员情况表"、"小学-人员情况表"等
 */
function findLevelSheet(wb, level, sheetSuffix) {
  const govName = LEVEL_GOV_INFO[level] ? LEVEL_GOV_INFO[level].govName : level;
  const candidates = [
    `${level}_${sheetSuffix}`, `${level}${sheetSuffix}`, `${level}-${sheetSuffix}`,
    `${govName}_${sheetSuffix}`, `${govName}${sheetSuffix}`, `${govName}-${sheetSuffix}`,
  ];
  for (const name of candidates) {
    const sheet = wb.findSheet(name);
    if (sheet) return sheet;
  }
  return null;
}

/**
 * 从各源文件计算年报数据
 */
function computeReport(workbooks, eduData, opts = {}) {
  const { 收入费用表, 经费支出明细表, 科目余额表, 资产负债表, 上年经费年报 } = workbooks;
  const warnings = Array.isArray(eduData?.匹配警告) ? eduData.匹配警告.slice() : [];

  const cv = WB.cellNum; // shorthand

  // ===== Sheet 1: 人员情况表 =====
  const 人员情况表 = {};

  const prevPersonSheet = 上年经费年报.findSheet('人员情况表');
  const detectedLevels = identifySchoolType(上年经费年报);
  const prevLevelSheets = detectedLevels
    .map((level) => ({ level, sheet: findLevelSheet(上年经费年报, level, '人员情况表') }))
    .filter((item) => item.sheet);
  const useLevelPersonSheets = prevLevelSheets.length > 1;

  const prevByLevel = (level, detailAddr, totalAddr) => {
    const item = prevLevelSheets.find((entry) => entry.level === level);
    if (!item) return 0;
    const detail = cv(item.sheet, detailAddr);
    return detail || cv(item.sheet, totalAddr);
  };

  if (useLevelPersonSheets) {
    const sheets = prevLevelSheets.map((item) => item.sheet);
    人员情况表.J12 = sumValues(sheets.map((sheet) => cv(sheet, 'J14')));
    人员情况表.J13 = sumValues(sheets.map((sheet) => cv(sheet, 'J15')));
    人员情况表.J18 = sumValues(sheets.map((sheet) => cv(sheet, 'J30')));
    人员情况表.J22 = sumValues(sheets.map((sheet) => cv(sheet, 'J34')));
    人员情况表.J26 = sumValues(sheets.map((sheet) => cv(sheet, 'J38')));
  } else if (prevPersonSheet) {
    人员情况表.J12 = cv(prevPersonSheet, 'J14');
    人员情况表.J13 = cv(prevPersonSheet, 'J15');
    人员情况表.J18 = cv(prevPersonSheet, 'J30');
    人员情况表.J22 = cv(prevPersonSheet, 'J34');
    人员情况表.J26 = cv(prevPersonSheet, 'J38');
  }

  if (eduData) {
    人员情况表.J14 = eduData.教职工数;
    人员情况表.J15 = eduData.专任教师;
    人员情况表.J16 = eduData.年末编制外长期聘用人员 || 0;
    人员情况表.J17 = eduData.年末离退休人员 || 0;
    人员情况表.J30 = eduData.幼儿园学生数 + eduData.小学学生数 + eduData.初中学生数 + eduData.高中学生数;
    人员情况表.J34 = eduData.小学随班就读 + eduData.初中随班就读 + (eduData.高中随班就读 || 0);
    人员情况表.J38 = eduData.小学住宿生 + eduData.初中住宿生 + eduData.高中住宿生;

    // 年末学生数分学段明细
    人员情况表.J31 = eduData.高中学生数 || 0;    // 代码21 年末高中
    人员情况表.J32 = eduData.初中学生数 || 0;    // 代码22 年末初中
    人员情况表.J33 = eduData.小学学生数 || 0;    // 代码23 年末小学
    // 年末随班就读分学段
    人员情况表.J35 = eduData.高中随班就读 || 0;    // 代码25 年末随班高中
    人员情况表.J36 = eduData.初中随班就读 || 0;  // 代码26 年末随班初中
    人员情况表.J37 = eduData.小学随班就读 || 0;  // 代码27 年末随班小学
    // 年末寄宿分学段
    人员情况表.J39 = eduData.高中住宿生 || 0;    // 代码29 年末寄宿高中
    人员情况表.J40 = eduData.初中住宿生 || 0;    // 代码30 年末寄宿初中
    人员情况表.J41 = eduData.小学住宿生 || 0;    // 代码31 年末寄宿小学
    人员情况表.J44 = prevPersonSheet ? (cv(prevPersonSheet, 'J45') || 0) : 0;
    人员情况表.J45 = eduData.年末学前一年在园儿童人数 || 0;
    人员情况表.J46 = prevPersonSheet ? (cv(prevPersonSheet, 'J47') || 0) : 0;
    人员情况表.J47 = eduData.年末托育幼儿人数 || 0;
  }

  // 从上年经费年报提取年初分学段明细（综表的人员情况表也需要）
  if (useLevelPersonSheets) {
    // 多学段上年表按各学段分表汇总，避免只抓到某一张分表。
    人员情况表.J19 = prevByLevel('高中', 'J31', 'J30');
    人员情况表.J20 = prevByLevel('初中', 'J32', 'J30');
    人员情况表.J21 = prevByLevel('小学', 'J33', 'J30');
    人员情况表.J23 = prevByLevel('高中', 'J35', 'J34');
    人员情况表.J24 = prevByLevel('初中', 'J36', 'J34');
    人员情况表.J25 = prevByLevel('小学', 'J37', 'J34');
    人员情况表.J27 = prevByLevel('高中', 'J39', 'J38');
    人员情况表.J28 = prevByLevel('初中', 'J40', 'J38');
    人员情况表.J29 = prevByLevel('小学', 'J41', 'J38');
  } else if (prevPersonSheet) {
    // 年初学生数分学段 (代码09/10/11)
    人员情况表.J19 = cv(prevPersonSheet, 'J31') || 0; // 年初高中 ← 上年年末高中
    人员情况表.J20 = cv(prevPersonSheet, 'J32') || 0; // 年初初中
    人员情况表.J21 = cv(prevPersonSheet, 'J33') || 0; // 年初小学
    // 年初随班就读分学段 (代码13/14/15)
    人员情况表.J23 = cv(prevPersonSheet, 'J35') || 0;
    人员情况表.J24 = cv(prevPersonSheet, 'J36') || 0;
    人员情况表.J25 = cv(prevPersonSheet, 'J37') || 0;
    // 年初寄宿分学段 (代码17/18/19)
    人员情况表.J27 = cv(prevPersonSheet, 'J39') || 0;
    人员情况表.J28 = cv(prevPersonSheet, 'J40') || 0;
    人员情况表.J29 = cv(prevPersonSheet, 'J41') || 0;
  }

  // M12 编制差 =（年初在职-年初教学）+（年末在职-年末教学）
  // 编制差为 0 表示无管理人员，费用表不需要填管理费用；非 0 时须按比例拆分
  人员情况表.M12 = (人员情况表.J12 || 0) - (人员情况表.J13 || 0) +
    (人员情况表.J14 || 0) - (人员情况表.J15 || 0);

  // ===== Sheet 2: 收入情况表 =====
  const 收入情况表 = {};
  const incomeSheet = 收入费用表.findSheet('第1页') || 收入费用表.getSheet(0);

  收入情况表.J14 = cv(incomeSheet, 'D6');
  收入情况表.J41 = cv(incomeSheet, 'D17');
  收入情况表.J36 = 收入情况表.J41;

  // J57 寄宿生公用经费 = 年加权人数 × 300元/生·年（标准单价，暂不变）
  // 年加权 = (年初寄宿生×8月 + 年末寄宿生×4月) / 12月
  收入情况表.J57 = Math.ceil(((人员情况表.J26 || 0) * 8 + (人员情况表.J38 || 0) * 4) / 12) * 300;
  const heatingFeePerStudent = Number(opts.heatingFeePerStudent ?? opts.regionRules?.heatingFeePerStudent ?? 25);
  // J58 取暖经费 = 年加权学生数 × 地区配置单价。
  // 322065：幼儿园/高中/职校等非义务教育学校（xxlbdm 见 NON_COMPULSORY_XXLBDM）该项须为 0。
  const 非义务教育 = NON_COMPULSORY_XXLBDM.has(String(opts.xxlbdm || ''));
  收入情况表.J58 = 非义务教育 ? 0
    : Math.ceil(((人员情况表.J18 || 0) * 8 + (人员情况表.J30 || 0) * 4) / 12) * heatingFeePerStudent;

  const expDetailSheet = 经费支出明细表.findSheet('1月份') || 经费支出明细表.findSheet('支出明细表') || 经费支出明细表.getSheet(0);
  const ed = (addr) => cv(expDetailSheet, addr);

  收入情况表.J56 = 0;
  const publicExpenseSource = ed('D19');
  const publicExpenseBalance = publicExpenseSource - 收入情况表.J56 - 收入情况表.J57 - 收入情况表.J58;
  if (publicExpenseBalance < 0) {
    warnings.push(`财政补助收入中安排的公用经费测算为 ${publicExpenseBalance.toFixed(2)} 元，已写 0；请复核寄宿生公用经费和取暖经费。`);
  }
  收入情况表.J55 = Math.max(0, publicExpenseBalance);
  // 模板公式会被固化，这里同步补齐实际模板中的收入合计行。
  收入情况表.J13 = 收入情况表.J14;
  收入情况表.J12 = 收入情况表.J13;
  收入情况表.J36 = 收入情况表.J41;
  收入情况表.J11 = 收入情况表.J12 + 收入情况表.J36;

  // ===== Sheet 3: 支出情况表 =====
  const 支出情况表 = {};
  const serviceFeeIncome = clampNonNegative(收入情况表.J41);
  const sourceBasicWage = ed('D6');
  const sourceOtherWage = ed('D18');
  const serviceFeeInWage = Math.min(serviceFeeIncome, sourceBasicWage + sourceOtherWage);
  const extraOtherWage = Math.max(0, serviceFeeInWage - sourceOtherWage);

  支出情况表.J17 = sourceBasicWage - extraOtherWage;
  支出情况表.J18 = ed('D7');
  支出情况表.J19 = 0;
  支出情况表.J20 = ed('D8');
  支出情况表.J21 = ed('D9');
  支出情况表.J22 = ed('D10');
  支出情况表.J23 = ed('D11');
  支出情况表.J24 = ed('D12');
  支出情况表.J25 = ed('D13');
  支出情况表.J26 = ed('D14');
  支出情况表.J27 = ed('D15');
  支出情况表.J28 = ed('D16');
  支出情况表.J29 = ed('D17');
  支出情况表.J30 = Math.max(0, sourceOtherWage - serviceFeeInWage);
  支出情况表.J31 = 0;
  支出情况表.F17 = 支出情况表.J17;
  支出情况表.F30 = sourceOtherWage + extraOtherWage;
  // 工资科目未拆分（全在其他工资福利）时重分类到基本工资，使强制 358 生成即通过。
  reconcileWageItemization(人员情况表, 支出情况表, warnings);

  支出情况表.J16 = 支出情况表.J17 + 支出情况表.J18 + 支出情况表.J19 +
    支出情况表.J20 + 支出情况表.J21 + 支出情况表.J22 + 支出情况表.J23 +
    支出情况表.J24 + 支出情况表.J25 + 支出情况表.J26 + 支出情况表.J27 +
    支出情况表.J28 + 支出情况表.J29 + 支出情况表.J30 + 支出情况表.J31;

  支出情况表.J33 = ed('D48');
  支出情况表.J34 = ed('D49');
  支出情况表.J35 = ed('D50');
  支出情况表.J36 = ed('D51');
  支出情况表.J37 = ed('D52');
  支出情况表.J38 = ed('D53');
  支出情况表.J39 = ed('D54');
  支出情况表.J41 = ed('D55');
  支出情况表.J40 = 支出情况表.J41;
  支出情况表.J45 = ed('D60');
  支出情况表.J46 = cv(expDetailSheet, 'H4');

  支出情况表.J32 = 支出情况表.J33 + 支出情况表.J34 + 支出情况表.J35 +
    支出情况表.J36 + 支出情况表.J37 + 支出情况表.J38 + 支出情况表.J39 +
    支出情况表.J40 + 支出情况表.J45 + 支出情况表.J46;

  支出情况表.J49 = ed('D21');
  支出情况表.J50 = ed('D23');
  支出情况表.J51 = ed('D24');
  支出情况表.J52 = ed('D25');
  支出情况表.J53 = ed('D26');
  支出情况表.J54 = 收入情况表.J58;
  支出情况表.J55 = ed('D28');
  支出情况表.J56 = ed('D29');
  支出情况表.J57 = ed('D30');
  支出情况表.J58 = ed('D31');
  支出情况表.J59 = ed('D32');
  支出情况表.J60 = ed('D33');
  支出情况表.J61 = ed('D34');
  支出情况表.J62 = ed('D35');
  支出情况表.J63 = ed('D36');
  支出情况表.J64 = ed('D38');
  支出情况表.J65 = ed('D39');
  支出情况表.J66 = ed('D40') + ed('D22');
  支出情况表.J67 = ed('D41');
  支出情况表.J68 = ed('D42');
  支出情况表.J69 = ed('D43');
  支出情况表.J70 = ed('D44');
  支出情况表.J71 = 0;
  支出情况表.J72 = ed('D45');
  // J73 其他商品和服务支出：按"扣除维修（护）费、公务接待费和其他商品服务支出后的商品服务支出"控制比例。
  // 若超过 15%，超过部分自动回到办公费 J48，保持商品和服务支出总额仍等于源表 302 合计。
  const goodsServiceTotal = ed('D19');
  const otherServiceRatioBase = Math.max(0, goodsServiceTotal - 支出情况表.J58 - 支出情况表.J62);
  const maxOtherService = otherServiceRatioBase * 0.15 / 1.15;
  支出情况表.J73 = Math.max(0, otherServiceRatioBase * 3 / 25 - 1000);
  if (支出情况表.J73 > maxOtherService) {
    支出情况表.J73 = maxOtherService;
  }
  支出情况表.J74 = 0;
  支出情况表.J75 = ed('D48');

  const adjustableGoodsRows = [73, 67, 66, 65, 64, 63, 61, 60, 59, 56, 55, 52, 51, 50, 49];
  const goodsRows = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
    63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75];
  const fixedGoodsRows = goodsRows.filter((row) => row !== 48 && !adjustableGoodsRows.includes(row));
  const minRetainedGoods = {};
  for (const row of [48, ...adjustableGoodsRows]) {
    minRetainedGoods[`J${row}`] = Math.max(0, (支出情况表[`J${row}`] || 0) * 0.5);
  }

  const j48Deductions = 支出情况表.J49 + 支出情况表.J50 + 支出情况表.J51 +
    支出情况表.J52 + 支出情况表.J53 + 支出情况表.J54 + 支出情况表.J55 +
    支出情况表.J56 + 支出情况表.J57 + 支出情况表.J58 + 支出情况表.J59 +
    支出情况表.J60 + 支出情况表.J61 + 支出情况表.J62 + 支出情况表.J63 +
    支出情况表.J64 + 支出情况表.J65 + 支出情况表.J66 + 支出情况表.J67 +
    支出情况表.J68 + 支出情况表.J69 + 支出情况表.J70 + 支出情况表.J71 +
    支出情况表.J73 + 支出情况表.J74;
  支出情况表.J48 = goodsServiceTotal - j48Deductions;
  if (支出情况表.J48 < 0) {
    let shortage = -支出情况表.J48;
    支出情况表.J48 = 0;
    for (const row of adjustableGoodsRows) {
      const key = `J${row}`;
      const available = Math.max(0, 支出情况表[key] || 0);
      const cut = Math.min(Math.max(0, available - minRetainedGoods[key]), shortage);
      支出情况表[key] = available - cut;
      shortage -= cut;
      if (shortage <= 0) break;
    }
    if (shortage > 0.005) {
      throw new Error(`商品和服务支出可调项目最多只能调减 50%，仍差 ${shortage.toFixed(2)} 元无法分配。请手动调整取暖费或源支出明细。`);
    }
  }

  const fixedGoodsTotal = sumValues(fixedGoodsRows.map((row) => 支出情况表[`J${row}`]));
  if (fixedGoodsTotal > goodsServiceTotal + 0.005) {
    throw new Error(`商品和服务支出分配后会出现负数：固定项目合计 ${fixedGoodsTotal.toFixed(2)} 元，已超过商品和服务支出总额 ${goodsServiceTotal.toFixed(2)} 元。请调整取暖费或源支出明细。`);
  }

  支出情况表.J47 = 支出情况表.J48 + 支出情况表.J49 + 支出情况表.J50 +
    支出情况表.J51 + 支出情况表.J52 + 支出情况表.J53 + 支出情况表.J54 +
    支出情况表.J55 + 支出情况表.J56 + 支出情况表.J57 + 支出情况表.J58 +
    支出情况表.J59 + 支出情况表.J60 + 支出情况表.J61 + 支出情况表.J62 +
    支出情况表.J63 + 支出情况表.J64 + 支出情况表.J65 + 支出情况表.J66 +
    支出情况表.J67 + 支出情况表.J68 + 支出情况表.J69 + 支出情况表.J70 +
    支出情况表.J71 + 支出情况表.J72 + 支出情况表.J73 + 支出情况表.J74 +
    支出情况表.J75;
  const goodsServiceDiff = goodsServiceTotal - 支出情况表.J47;
  if (Math.abs(goodsServiceDiff) > 0.005) {
    支出情况表.J48 += goodsServiceDiff;
    支出情况表.J47 = goodsServiceTotal;
  }
  for (const [key, minValue] of Object.entries(minRetainedGoods)) {
    if ((支出情况表[key] || 0) < minValue - 0.005) {
      throw new Error(`商品和服务支出分配后 ${key} 低于原金额 50% 保留线，请手动调整取暖费或源支出明细。`);
    }
  }
  for (const row of goodsRows) {
    const key = `J${row}`;
    if ((支出情况表[key] || 0) < -0.005) {
      throw new Error(`商品和服务支出分配后 ${key} 出现负数 ${支出情况表[key].toFixed(2)} 元，请调整取暖费或源支出明细。`);
    }
    if (Math.abs(支出情况表[key] || 0) < 0.005) 支出情况表[key] = 0;
  }

  // 310 资本性支出明细
  支出情况表.J77 = cv(expDetailSheet, 'H24'); // 31001 房屋建筑物购建
  支出情况表.J78 = cv(expDetailSheet, 'H25'); // 31002 办公设备购置
  支出情况表.J79 = cv(expDetailSheet, 'H26'); // 31003 专用设备购置
  支出情况表.J80 = cv(expDetailSheet, 'H28'); // 31006 大型修缮
  支出情况表.J81 = cv(expDetailSheet, 'H29'); // 31007 信息网络及软件购置更新
  支出情况表.J82 = cv(expDetailSheet, 'H35'); // 31013 公务用车购置
  支出情况表.J83 = cv(expDetailSheet, 'H36'); // 31019 其他交通工具购置
  支出情况表.J84 = cv(expDetailSheet, 'H37'); // 31021 文物和陈列品购置
  支出情况表.J85 = cv(expDetailSheet, 'H38'); // 31022 无形资产购置
  // J86 = 73 行“10.其他资本性支出”；J87 = 74 行“其中：图书购置”是 J86 的子项，
  // 明细表中无对应经济科目，默认 0（图书按 31099 归入其他资本性支出）。
  支出情况表.J86 = cv(expDetailSheet, 'H39') // 31099 其他资本性支出
    + cv(expDetailSheet, 'H27') // 31005 基础设施建设
    + cv(expDetailSheet, 'H30') // 31008 物资储备
    + cv(expDetailSheet, 'H31') // 31009 土地补偿
    + cv(expDetailSheet, 'H32') // 31010 安置补助
    + cv(expDetailSheet, 'H33') // 31011 地上附着物和青苗补偿
    + cv(expDetailSheet, 'H34'); // 31012 拆迁补偿
  支出情况表.J87 = 0;

  // 309 基本建设支出按账务处理规则并入对应 310 资本性支出明细，
  // 无对应行次的子项统一并入 J86 (73 行 10.其他资本性支出)。
  支出情况表.J77 += cv(expDetailSheet, 'H11'); // 30901 房屋建筑物购建
  支出情况表.J78 += cv(expDetailSheet, 'H12'); // 30902 办公设备购置
  支出情况表.J79 += cv(expDetailSheet, 'H13'); // 30903 专用设备购置
  支出情况表.J80 += cv(expDetailSheet, 'H15'); // 30906 大型修缮
  支出情况表.J81 += cv(expDetailSheet, 'H16'); // 30907 信息网络及软件购置更新
  支出情况表.J82 += cv(expDetailSheet, 'H18'); // 30913 公务用车购置
  支出情况表.J83 += cv(expDetailSheet, 'H19'); // 30919 其他交通工具购置
  支出情况表.J84 += cv(expDetailSheet, 'H20'); // 30921 文物和陈列品购置
  支出情况表.J85 += cv(expDetailSheet, 'H21'); // 30922 无形资产购置
  支出情况表.J86 += cv(expDetailSheet, 'H14') // 30905 基础设施建设
    + cv(expDetailSheet, 'H17') // 30908 物资储备
    + cv(expDetailSheet, 'H22'); // 30999 其他基本建设支出

  支出情况表.J76 = 支出情况表.J77 + 支出情况表.J78 + 支出情况表.J79 +
    支出情况表.J80 + 支出情况表.J81 + 支出情况表.J82 + 支出情况表.J83 +
    支出情况表.J84 + 支出情况表.J85 + 支出情况表.J86 + 支出情况表.J87;

  支出情况表.J15 = 支出情况表.J16 + 支出情况表.J32 + 支出情况表.J47 + 支出情况表.J76;
  支出情况表.F16 = 支出情况表.J16 + serviceFeeInWage;
  支出情况表.F15 = 支出情况表.F16 + 支出情况表.J32 + 支出情况表.J47 + 支出情况表.J76;
  支出情况表.J14 = 支出情况表.J15;
  支出情况表.F14 = 支出情况表.F15;
  支出情况表.J99 = 0;
  支出情况表.J100 = 0;
  支出情况表.J101 = 0;
  // 附:项目支出中的资本性支出明细（行103-113）镜像 310 资本性支出明细（行77-87）。
  // 资本性支出多为项目支出，官方据此校验（10035/36/37 房屋建筑物、10051/52/53 大型修缮、964 义务教育）。
  // 镜像满足强制 835-843(附<=主)、475(附资本=各分项之和)；col6/7/8 主附均不写、模板恒 0，
  // 自动满足 12773-12796 的“主==附”相等约束。行113 其中图书为行112 的“其中”，不计入合计。
  const capitalMirror = [[103, 77], [104, 78], [105, 79], [106, 80], [107, 81], [108, 82], [109, 83], [110, 84], [111, 85], [112, 86], [113, 87]];
  for (const [dst, src] of capitalMirror) {
    支出情况表[`J${dst}`] = 支出情况表[`J${src}`] || 0;
    if (支出情况表[`F${src}`] != null) 支出情况表[`F${dst}`] = 支出情况表[`F${src}`];
  }
  支出情况表.J102 = capitalMirror.slice(0, 10).reduce((sum, [dst]) => sum + (支出情况表[`J${dst}`] || 0), 0);
  支出情况表.J98 = 支出情况表.J99 + 支出情况表.J100 + 支出情况表.J101 + 支出情况表.J102;

  // ===== Sheet 4: 费用情况表 =====
  const 费用情况表 = {};
  // G13 业务活动工资福利：无编制差时全额计入；有编制差时取 95%（剩 5% 计入管理费用 G14）
  if (人员情况表.M12 === 0) {
    费用情况表.G13 = ed('D5');
  } else {
    费用情况表.G13 = Math.ceil(支出情况表.F16 * 0.95 * 100) / 100;
  }
  费用情况表.I13 = 支出情况表.J37 + 支出情况表.J36 + 支出情况表.J40 + 支出情况表.J46;
  费用情况表.K13 = 支出情况表.J40;
  费用情况表.L13 = 支出情况表.J47 - 支出情况表.J67;
  // G14 单位管理费用工资福利 = 总工资福利 - 业务活动工资福利（编制差为 0 时此值为 0）
  费用情况表.G14 = 支出情况表.F16 - 费用情况表.G13;
  费用情况表.J14 = 支出情况表.J34;
  费用情况表.I14 = 费用情况表.J14;
  费用情况表.F13 = 费用情况表.G13 + 费用情况表.I13 + 费用情况表.L13 + (费用情况表.M13 || 0);
  费用情况表.F14 = 费用情况表.G14 + 费用情况表.I14 + (支出情况表.J67 || 0);

  // ===== Sheet 6: 资产价值量情况表 =====
  const 资产价值量情况表 = {};
  const prevAssetSheet = 上年经费年报.findSheet('资产价值量情况表');
  const balanceSheet = 资产负债表.findSheet('第1页') || 资产负债表.getSheet(0);
  const accountSheet = 科目余额表.findSheet('第一页') || 科目余额表.getSheet(0);

  const prevAV = (addr) => cv(prevAssetSheet, addr);
  const bs = (addr) => cv(balanceSheet, addr);

  // 按科目编码扫描科目余额表，建立 编码 → 期末余额 映射（防止行偏移）
  const accByCode = {};
  if (accountSheet) {
    const accRange = XLSX.utils.decode_range(accountSheet['!ref'] || 'A1');
    for (let r = 0; r <= accRange.e.r; r++) {
      const codeCell = accountSheet[XLSX.utils.encode_cell({ r, c: 0 })];
      if (!codeCell) continue;
      const code = String(codeCell.v || '').trim();
      if (!/^\d+$/.test(code)) continue;
      const balCell = accountSheet[XLSX.utils.encode_cell({ r, c: 10 })]; // K列 期末余额
      accByCode[code] = num(balCell ? balCell.v : 0);
    }
  }
  const accCode = (code) => accByCode[code] || 0;

  for (let r = 12; r <= 36; r++) 资产价值量情况表[`F${r}`] = prevAV(`G${r}`);

  // 固定资产原值（科目 160101-160105）
  资产价值量情况表.H17 = accCode('160101'); // 房屋和构筑物
  资产价值量情况表.H18 = accCode('160102'); // 设备
  资产价值量情况表.H20 = accCode('160104'); // 图书和档案
  资产价值量情况表.H21 = accCode('160105'); // 家具和用具
  // 累计折旧（科目 160201/160202/160205）
  资产价值量情况表.H24 = accCode('160201'); // 房屋折旧
  资产价值量情况表.H25 = accCode('160202'); // 设备折旧
  资产价值量情况表.H26 = accCode('160205'); // 家具折旧

  资产价值量情况表.G17 = 资产价值量情况表.H17;
  资产价值量情况表.G18 = 资产价值量情况表.H18;
  资产价值量情况表.G19 = 0;
  资产价值量情况表.G20 = 资产价值量情况表.H20;
  资产价值量情况表.G21 = 资产价值量情况表.H21;
  资产价值量情况表.G22 = 0;

  资产价值量情况表.H16 = 资产价值量情况表.H17 + 资产价值量情况表.H18 + 资产价值量情况表.H20 + 资产价值量情况表.H21;
  资产价值量情况表.G16 = 资产价值量情况表.H16;

  资产价值量情况表.H23 = 资产价值量情况表.H24 + 资产价值量情况表.H25 + 资产价值量情况表.H26;
  资产价值量情况表.G23 = 资产价值量情况表.H23;
  资产价值量情况表.G24 = 资产价值量情况表.H24;
  资产价值量情况表.G25 = 资产价值量情况表.H25;
  资产价值量情况表.G26 = 资产价值量情况表.H26;

  // 折旧超原值时按类别容量重分类（合计与净值不变），使 11938/11939/11941 生成即通过。
  reconcileDepreciation(资产价值量情况表, warnings);

  资产价值量情况表.H15 = 资产价值量情况表.H16 - 资产价值量情况表.H23;
  资产价值量情况表.G15 = 资产价值量情况表.H15;

  资产价值量情况表.G13 = bs('B19');
  资产价值量情况表.G14 = 0;
  资产价值量情况表.G27 = bs('B27');
  资产价值量情况表.G35 = bs('E29');

  资产价值量情况表.G12 = 资产价值量情况表.G13 + (资产价值量情况表.G14 || 0) +
    资产价值量情况表.G15 + 资产价值量情况表.G27 + 0 + 0;
  资产价值量情况表.G36 = 资产价值量情况表.G12 - 资产价值量情况表.G35;

  资产价值量情况表.M16 = (资产价值量情况表.F16 || 0) > 资产价值量情况表.G16
    ? (资产价值量情况表.F16 || 0) - 资产价值量情况表.G16 : 0;
  资产价值量情况表.M15 = 资产价值量情况表.M16;

  for (const row of [17, 18, 19, 20, 21, 22]) {
    const f = 资产价值量情况表[`F${row}`] || 0;
    const g = 资产价值量情况表[`G${row}`] || 0;
    资产价值量情况表[`L${row}`] = g > f ? g - f : 0;
    资产价值量情况表[`M${row}`] = f > g ? f - g : 0;
  }

  费用情况表.M13 = 资产价值量情况表.G23 - (资产价值量情况表.F23 || 0);
  费用情况表.F16 = 资产价值量情况表.M15;
  费用情况表.F13 = 费用情况表.G13 + 费用情况表.I13 + 费用情况表.L13 + 费用情况表.M13;
  费用情况表.F12 = 费用情况表.F13 + 费用情况表.F14 + 费用情况表.F16;

  // ===== Sheet 7: 资产实物量情况表 =====
  const 资产实物量情况表 = {};
  const prevPhysSheet = 上年经费年报.findSheet('资产实物量情况表');
  if (prevPhysSheet) {
    for (let row = 11; row <= 30; row++) {
      资产实物量情况表[`J${row}`] = cv(prevPhysSheet, `J${row}`);
    }
  }
  applyHeatedAreaLinkage(支出情况表, 资产实物量情况表, warnings);
  // 公办义务教育（小学61/初中413/一贯制414 且隶属关系为公办 11/12/21/22）收支相等、无结余。
  const publicCompulsory = ['61', '413', '414'].includes(String(opts.xxlbdm || ''))
    && ['11', '12', '21', '22'].includes(String(opts.lsgxdm || ''));
  applyCarryoverBalance(收入情况表, 支出情况表, { publicCompulsory });

  const computed = { 人员情况表, 收入情况表, 支出情况表, 费用情况表, 资产价值量情况表, 资产实物量情况表 };
  computed.__meta = { warnings };
  return computed;
}

// ===== 多学段拆分填报（ZXXCFMode=2）：按学生数比例把全校合计拆成各学段记录 =====
// 学段类别代码（拆分记录的 zxxcfxxlb）：小学61 / 初中413 / 高中411。
const STAGE_CODES = { 小学: '61', 初中: '413', 高中: '411' };
// 在校生行（人员表 J 键）：年末 小学J33/初中J32/高中J31；年初 小学J21/初中J20/高中J19。
// 拆分比例用“年初+年末”做权重，任一有值即可（兼容个别源数据只填了年初或年末）。
const STAGE_YEAREND_ROW = { 小学: 33, 初中: 32, 高中: 31 };
const STAGE_YEARINIT_ROW = { 小学: 21, 初中: 20, 高中: 19 };
// 各学段学生行组 [年初在校, 年末在校, 年初随班, 年末随班, 年初寄宿, 年末寄宿]。
const STAGE_STUDENT_ROWS = {
  高中: [19, 31, 23, 35, 27, 39],
  初中: [20, 32, 24, 36, 28, 40],
  小学: [21, 33, 25, 37, 29, 41],
};
// 学生汇总行（与上面六组一一对应）：年初总/年末总、年初随班总/年末随班总、年初寄宿总/年末寄宿总。
const STUDENT_TOTAL_ROWS = [18, 30, 22, 34, 26, 38];
const STAFF_ROWS = [12, 13, 14, 15, 16, 17]; // 在职教职工/教学人员/编外/离退休等，按比例拆分。

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

// 按比例拆分一张金额表的全部数值单元格；最后一个学段取“总额-其余之和”保证加总精确等于全校。
function splitAmountTable(totalTable, ratios) {
  const keys = Object.keys(totalTable).filter((key) => typeof totalTable[key] === 'number');
  const parts = ratios.map(() => ({}));
  for (const key of keys) {
    const total = totalTable[key];
    let assigned = 0;
    ratios.forEach((r, index) => {
      const value = index < ratios.length - 1 ? round2(total * r.ratio) : round2(total - assigned);
      parts[index][key] = value;
      assigned = round2(assigned + value);
    });
  }
  return parts;
}

// 学段记录 xxlbdm 为单学段类别（小学61/初中413），按 268/922 其“分学段明细行”
// （年初/年末 高中/初中/小学 在校、随班、寄宿）必须为 0——明细行仅一贯制/完中用。
// 拆分后的人员表在此清零明细行并重算编制差；学生汇总行由 splitAmountTable 按比例拆好。
function finalizeStagePerson(person) {
  zeroStageBreakdownRows(person);
  person.M12 = (person.J12 || 0) - (person.J13 || 0) + (person.J14 || 0) - (person.J15 || 0);
  return person;
}

// 单学段学校（非完中/一贯制）：268/922 要求年初/年末各学段在校、随班、寄宿明细行为 0，
// 学生数只填汇总行。多学段（whole-school 完中/一贯制）豁免，保留明细行。
function zeroStageBreakdownRows(person) {
  for (const stage of Object.keys(STAGE_STUDENT_ROWS)) {
    for (const row of STAGE_STUDENT_ROWS[stage]) person[`J${row}`] = 0;
  }
}

// 逐单元格独立取整会使“合计=分项之和”产生 1 分漂移（被浮点噪声推过容差）。
// 拆分后按分项重算资产价值量表的原值(16)/折旧(23)/净值(15)合计，消除 334/12410/12411 等求和漂移。
function finalizeStageTotals(computed) {
  const av = computed.资产价值量情况表;
  if (!av) return;
  for (const col of ['F', 'G', 'H', 'L', 'M']) {
    const sum = (rows) => rows.reduce((total, row) => round2(total + num(av[`${col}${row}`])), 0);
    if ([17, 18, 19, 20, 21, 22].some((row) => av[`${col}${row}`] != null)) av[`${col}16`] = sum([17, 18, 19, 20, 21, 22]);
    if ([24, 25, 26].some((row) => av[`${col}${row}`] != null)) av[`${col}23`] = sum([24, 25, 26]);
    if (av[`${col}16`] != null && av[`${col}23`] != null) av[`${col}15`] = round2(num(av[`${col}16`]) - num(av[`${col}23`]));
  }
  // 费用表 12293：业务活动费用(行13)合计列 = 各资金列之和（列2/4/7/8/9/10=G/I/L/M/N/O）。
  const fee = computed.费用情况表;
  if (fee) {
    fee.F13 = round2(num(fee.G13) + num(fee.I13) + num(fee.L13) + num(fee.M13) + num(fee.N13) + num(fee.O13));
  }
}

/**
 * 把全校合计 computed 按各学段年末在校生比例拆成多条学段记录（含 code 供上报选择拆分学段类别）。
 * 仅对含 2 个及以上中小学学段的学校拆分；幼儿园段不并入中小学拆分。加总精确等于全校合计。
 */
function splitComputedByStage(computed, levels) {
  const eduLevels = ['小学', '初中', '高中'].filter((level) => levels.includes(level));
  if (eduLevels.length < 2) return [];
  const person = computed.人员情况表;
  const counts = eduLevels.map((level) => ({
    level,
    n: num(person[`J${STAGE_YEAREND_ROW[level]}`]) + num(person[`J${STAGE_YEARINIT_ROW[level]}`]),
  }));
  const total = counts.reduce((sum, item) => sum + item.n, 0);
  if (total <= 0) return [];
  const ratios = counts.map((item) => ({ level: item.level, ratio: item.n / total }));

  // 人员表与各金额表统一按比例拆分（末位学段取余额，保证各学段加总精确等于全校合计）。
  const sheets = ['人员情况表', '收入情况表', '支出情况表', '费用情况表', '资产价值量情况表', '资产实物量情况表', '债务情况表'];
  const splitBySheet = {};
  for (const sheet of sheets) {
    if (computed[sheet]) splitBySheet[sheet] = splitAmountTable(computed[sheet], ratios);
  }

  return ratios.map((r, index) => {
    const stageComputed = {};
    for (const sheet of sheets) {
      if (splitBySheet[sheet]) stageComputed[sheet] = splitBySheet[sheet][index];
    }
    finalizeStagePerson(stageComputed.人员情况表 || (stageComputed.人员情况表 = {}));
    finalizeStageTotals(stageComputed);
    stageComputed.__meta = { warnings: [], stage: r.level, stageCode: STAGE_CODES[r.level], ratio: round2(r.ratio) };
    return { level: r.level, code: STAGE_CODES[r.level], ratio: r.ratio, computed: stageComputed };
  });
}


/**
 * 将计算结果转为网页展示数据 (对齐 7 张表)
 */
function computedToPreview(computed, unitName) {
  return {
    unitName,
    computed,
    warnings: computed.__meta?.warnings || [],
    validation: computed.__meta?.validation || null,
    sheets: [
      { name: '人员情况表' },
      { name: '收入表' },
      { name: '支出表' },
      { name: '费用表' },
      { name: '债务表' },
      { name: '价值量表' },
      { name: '实物量表' },
    ],
  };
}

function attachValidationResult(computed, validation, onLog = () => {}) {
  if (!validation?.enabled) return;
  const messages = validationWarnings(validation);
  computed.__meta = {
    ...(computed.__meta || {}),
    validation,
    warnings: [...new Set([...(computed.__meta?.warnings || []), ...messages])],
  };
  onLog(`规则校验：${validation.summary}`, validation.failed.length ? 'warn' : 'success');
  for (const adjustment of validation.adjusted) {
    onLog(`规则自动平衡：${adjustment.target} ${adjustment.before} → ${adjustment.after}（${adjustment.source} ${adjustment.ruleId}）`, 'log');
  }
}

// 平台“数据变动原因”表的 11 个固定指标（来自县下发《数据变动原因说明.xlsx》），
// 本年数取生成值、上年数取上年经费年报同格：j2_2/j2_1/j2_7 单数值列 J；
// j2_3 取第 1 列合计 F；j2_6 年末数在 G 列。行号=code+固定偏移，已对照模板核实。
const VARIANCE_INDICATORS = [
  { key: 'j2_1|年末教学人员', name: '年末教学人员', sheet: '人员情况表', cell: 'J15' },
  { key: 'j2_2|1.教育事业费', name: '收入表 1.教育事业费', sheet: '收入情况表', cell: 'J14' },
  { key: 'j2_2|三、事业预算收入', name: '收入表 三、事业预算收入', sheet: '收入情况表', cell: 'J26' },
  { key: 'j2_2|其中：学费∕保育教育费', name: '收入表 其中：学费/保育教育费', sheet: '收入情况表', cell: 'J27' },
  { key: 'j2_2|住宿费', name: '收入表 住宿费', sheet: '收入情况表', cell: 'J29' },
  // 支出表正式路径以 J 键存财政列、F 列合计可能未显式赋值（写表时 F 回退 J），取数同样回退。
  { key: 'j2_3|（一）工资福利支出', name: '支出表 （一）工资福利支出', sheet: '支出情况表', cell: 'F16', altCell: 'J16' },
  { key: 'j2_3|（二）对个人和家庭的补助支出', name: '支出表 （二）对个人和家庭的补助支出', sheet: '支出情况表', cell: 'F32', altCell: 'J32' },
  { key: 'j2_3|（三）商品和服务支出', name: '支出表 （三）商品和服务支出', sheet: '支出情况表', cell: 'F47', altCell: 'J47' },
  { key: 'j2_3|（四）资本性支出', name: '支出表 （四）资本性支出', sheet: '支出情况表', cell: 'F76', altCell: 'J76' },
  { key: 'j2_6|年末固定资产原值', name: '资产表 年末固定资产原值', sheet: '资产价值量情况表', cell: 'G16' },
  { key: 'j2_7|年末产权房屋建筑面积', name: '实物量表 年末产权房屋建筑面积', sheet: '资产实物量情况表', cell: 'J20' },
];

// 采集变动指标行：cur 取本次生成 computed（F 合计未赋值时回退 J 财政列，与写表逻辑一致），
// prev 取上年经费年报同格。
function collectVarianceRows(computed, prevYearWb) {
  const rows = [];
  for (const item of VARIANCE_INDICATORS) {
    const sheet = computed[item.sheet] || {};
    const cur = sheet[item.cell] != null ? num(sheet[item.cell])
      : (item.altCell ? num(sheet[item.altCell]) : 0);
    const prevSheet = prevYearWb ? prevYearWb.findSheet(item.sheet) : null;
    const prev = prevSheet ? num(WB.cellNum(prevSheet, item.cell)) : 0;
    rows.push({ key: item.key, name: item.name, prev, cur });
  }
  return rows;
}

// 在报表旁写出“校验情况说明 + 数据变动原因建议”，供经办直接粘贴到上报平台。返回文件路径或 ''。
function writeExplanationFile(unitName, validation, outputDir, options = {}) {
  const hintFailed = (validation?.failed || []).filter((item) => item.severity !== '强制');
  const varianceSuggestions = options.varianceSuggestions || [];
  if (!validation?.enabled || (!hintFailed.length && !varianceSuggestions.length)) return '';
  try {
    const filePath = resolveInside(outputDir, `${sanitizeFileName(unitName)}校验情况说明.txt`);
    const context = { unitName, xxlbdm: options.xxlbdm || '', library: options.library || null };
    fs.writeFileSync(filePath, '﻿' + explanationsText(unitName, validation, context, varianceSuggestions), 'utf8');
    return filePath;
  } catch {
    return '';
  }
}

function cvMaybe(sheet, addr) {
  return WB.cellNum(sheet, addr);
}

function getAnnualSheet(wb, keyword) {
  return wb.findSheet(keyword)
    || wb.findSheet(`中小学校（单位）${keyword}`)
    || wb.sheetNames.map((name) => wb.wb.Sheets[name]).find((sheet, index) => wb.sheetNames[index].includes(keyword))
    || null;
}

function readRowAmount(sheet, row, preferredCol = 'F') {
  return cvMaybe(sheet, `${preferredCol}${row}`) || cvMaybe(sheet, `J${row}`);
}

function splitByPreviousRows(prevSheet, rows, total, fallbackRow) {
  const result = {};
  const positiveRows = rows.map((row) => ({ row, value: Math.max(0, readRowAmount(prevSheet, row)) }));
  const base = sumValues(positiveRows.map((item) => item.value));
  if (base <= 0) {
    for (const row of rows) result[row] = 0;
    result[fallbackRow || rows[0]] = total;
    return result;
  }
  let allocated = 0;
  rows.forEach((row, index) => {
    const value = index === rows.length - 1
      ? total - allocated
      : Math.round((positiveRows[index].value / base) * total * 100) / 100;
    result[row] = value;
    allocated += value;
  });
  return result;
}

function tuneOtherGoodsServiceShare(expenseSheet, prefix = 'F', warnings = []) {
  const read = (row) => expenseSheet[`${prefix}${row}`] || 0;
  const write = (row, value) => { expenseSheet[`${prefix}${row}`] = Math.max(0, value); };
  const goodsTotal = read(47);
  if (goodsTotal <= 0) return;

  const base = Math.max(0, goodsTotal - read(58) - read(62));
  const maxOther = base * 0.15 / 1.15;
  const currentOther = read(73);
  if (currentOther <= maxOther) return;

  const excess = currentOther - maxOther;
  write(73, maxOther);
  write(48, read(48) + excess);
  warnings.push(`其他商品和服务支出超过15%控制线，已将 ${excess.toFixed(2)} 元调入办公费，商品和服务支出总额保持不变。`);
}

function setTotalAndFiscal(target, row, total, fiscal = 0) {
  target[`F${row}`] = num(total);
  target[`J${row}`] = num(fiscal);
}

function buildSourceMap() {
  const data = {};
  return {
    data,
    set(sheet, addr, source, method, confidence = 'draft') {
      if (!data[sheet]) data[sheet] = {};
      data[sheet][addr] = { source, method, confidence };
    },
  };
}

/**
 * 事业年报弃用后，年末人员/学生数改由采集表单填报。
 * 优先使用 schoolStage/stage 判断学校类别；旧数据没有显式类别时，按非零的
 * 分学段学生数推断。只有 studentCount 的升级前数据保留总人数，但不再误判为幼儿园。
 */
function eduDataFromCollectControls(controls = {}) {
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(controls, key);
  const hasNumber = (key) => hasOwn(key) && controls[key] !== ''
    && controls[key] != null && Number.isFinite(Number(controls[key]));
  const count = (key) => hasNumber(key) ? Math.max(0, Math.round(Number(controls[key]))) : 0;

  const personKeys = [
    'staffCount', 'teacherCount', 'externalLongTermStaffCount', 'retiredStaffCount', 'studentCount',
  ];
  const stageCountKeys = [
    'kindergartenStudentCount', 'primaryStudentCount', 'juniorStudentCount', 'seniorStudentCount',
  ];
  if (![...personKeys, ...stageCountKeys].some(hasNumber)) return null;

  const stageDefinitions = {
    '幼儿园': { bxlx: '111', parts: ['kindergarten'] },
    '普通小学': { bxlx: '211', parts: ['primary'] },
    '小学': { bxlx: '211', parts: ['primary'] },
    '初级中学': { bxlx: '311', parts: ['junior'] },
    '初中': { bxlx: '311', parts: ['junior'] },
    '高级中学': { bxlx: '342', parts: ['senior'] },
    '高中': { bxlx: '342', parts: ['senior'] },
    '九年制学校': { bxlx: '312', parts: ['primary', 'junior'] },
    '完全中学': { bxlx: '341', parts: ['junior', 'senior'] },
    '十二年制学校': { bxlx: '345', parts: ['primary', 'junior', 'senior'] },
  };
  const partCounts = {
    kindergarten: count('kindergartenStudentCount'),
    primary: count('primaryStudentCount'),
    junior: count('juniorStudentCount'),
    senior: count('seniorStudentCount'),
  };
  const explicitStage = String(controls.schoolStage || controls.stage || '').trim();
  const positiveParts = Object.keys(partCounts).filter((part) => partCounts[part] > 0);
  const signature = positiveParts.join('+');
  const inferredDefinitions = {
    kindergarten: stageDefinitions['幼儿园'],
    primary: stageDefinitions['普通小学'],
    junior: stageDefinitions['初级中学'],
    senior: stageDefinitions['高级中学'],
    'primary+junior': stageDefinitions['九年制学校'],
    'junior+senior': stageDefinitions['完全中学'],
    'primary+junior+senior': stageDefinitions['十二年制学校'],
  };
  const stageDefinition = stageDefinitions[explicitStage] || inferredDefinitions[signature] || null;

  const reportedStudentTotal = count('studentCount');
  // 兼容只有总人数的单学段旧提交：有明确学校类别时可安全落到该学段。
  if (positiveParts.length === 0 && reportedStudentTotal > 0 && stageDefinition?.parts.length === 1) {
    partCounts[stageDefinition.parts[0]] = reportedStudentTotal;
  }
  const detailedStudentTotal = sumValues(Object.values(partCounts));
  const studentTotal = detailedStudentTotal > 0 ? detailedStudentTotal : reportedStudentTotal;
  const staff = count('staffCount');
  const teachers = hasNumber('teacherCount') ? count('teacherCount') : staff;

  return {
    学校名称: '',
    bxlx: stageDefinition?.bxlx || '',
    学校类别: explicitStage,
    学生总数: studentTotal,
    幼儿园学生数: partCounts.kindergarten,
    小学学生数: partCounts.primary,
    初中学生数: partCounts.junior,
    高中学生数: partCounts.senior,
    小学随班就读: count('primaryInclusiveStudentCount'),
    初中随班就读: count('juniorInclusiveStudentCount'),
    高中随班就读: count('seniorInclusiveStudentCount'),
    小学住宿生: count('primaryBoardingStudentCount'),
    初中住宿生: count('juniorBoardingStudentCount'),
    高中住宿生: count('seniorBoardingStudentCount'),
    年末学前一年在园儿童人数: count('preschoolOneYearEndCount'),
    年末托育幼儿人数: count('nurseryEndCount'),
    教职工数: staff,
    教职工中在编: 0,
    专任教师: teachers,
    专任教师中在编: 0,
    年末编制外长期聘用人员: count('externalLongTermStaffCount'),
    年末离退休人员: count('retiredStaffCount'),
  };
}

function computePrivateDraft(prevYearWb, eduData, controls = {}, opts = {}) {
  const meta = buildSourceMap();
  const warnings = Array.isArray(eduData?.匹配警告) ? eduData.匹配警告.slice() : [];
  const prevPersonSheet = getAnnualSheet(prevYearWb, '人员情况表');
  const prevExpenseSheet = getAnnualSheet(prevYearWb, '支出情况表') || getAnnualSheet(prevYearWb, '教育经费支出情况表');
  const prevFeeSheet = getAnnualSheet(prevYearWb, '费用情况表');
  const prevAssetSheet = getAnnualSheet(prevYearWb, '资产价值量情况表');
  const prevPhysSheet = getAnnualSheet(prevYearWb, '资产实物量情况表');

  if (!prevPersonSheet) throw new Error('上年经费年报缺少人员情况表');
  if (!prevExpenseSheet) throw new Error('上年经费年报缺少支出情况表');

  for (const key of ['tuitionIncome', 'fiscalSubsidy', 'wageTotal', 'capitalExpense']) {
    if (controls[key] == null || controls[key] === '' || Number.isNaN(Number(controls[key]))) {
      throw new Error(`民办草稿缺少关键数：${key}`);
    }
  }

  const tuitionIncome = clampNonNegative(controls.tuitionIncome);
  const fiscalSubsidy = clampNonNegative(controls.fiscalSubsidy);
  const wageTotal = clampNonNegative(controls.wageTotal);
  const capitalExpense = clampNonNegative(controls.capitalExpense);
  const rentExpense = controls.hasRent ? clampNonNegative(controls.rentExpense) : 0;
  const interestExpense = controls.hasLoan ? clampNonNegative(controls.interestExpense) : 0;
  const sponsorInput = controls.hasSponsorInput ? clampNonNegative(controls.sponsorInput) : 0;
  const sponsorWithdraw = controls.hasSponsorWithdraw ? clampNonNegative(controls.sponsorWithdraw) : 0;
  const donationIncome = controls.hasDonation ? clampNonNegative(controls.donationIncome) : 0;
  const donationExpense = controls.hasDonation ? clampNonNegative(controls.donationExpense) : 0;
  const otherIncome = clampNonNegative(controls.otherIncome);
  // 本年收支结余：结余为正、亏空为负，不做非负截断。
  // 商品服务支出按“收入 − 关键支出 − 结余”反推，避免把结余算成支出导致虚高。
  const netBalance = num(controls.netBalance);

  const 人员情况表 = {};
  人员情况表.J12 = cvMaybe(prevPersonSheet, 'J14');
  人员情况表.J13 = cvMaybe(prevPersonSheet, 'J15');
  人员情况表.J44 = cvMaybe(prevPersonSheet, 'J45');
  人员情况表.J46 = cvMaybe(prevPersonSheet, 'J47');
  人员情况表.J18 = cvMaybe(prevPersonSheet, 'J30');
  人员情况表.J22 = cvMaybe(prevPersonSheet, 'J34');
  人员情况表.J26 = cvMaybe(prevPersonSheet, 'J38');
  for (const [to, from] of [['J19', 'J31'], ['J20', 'J32'], ['J21', 'J33'], ['J23', 'J35'], ['J24', 'J36'], ['J25', 'J37'], ['J27', 'J39'], ['J28', 'J40'], ['J29', 'J41']]) {
    人员情况表[to] = cvMaybe(prevPersonSheet, from);
  }
  if (eduData) {
    人员情况表.J14 = eduData.教职工数 || 0;
    人员情况表.J15 = eduData.专任教师 ?? eduData.教职工数 ?? 0;
    人员情况表.J16 = eduData.年末编制外长期聘用人员 || 0;
    人员情况表.J17 = eduData.年末离退休人员 || 0;
    人员情况表.J30 = eduData.学生总数 ?? ((eduData.幼儿园学生数 || 0) + (eduData.小学学生数 || 0) + (eduData.初中学生数 || 0) + (eduData.高中学生数 || 0));
    人员情况表.J31 = eduData.高中学生数 || 0;
    人员情况表.J32 = eduData.初中学生数 || 0;
    人员情况表.J33 = eduData.小学学生数 || 0;
    人员情况表.J34 = (eduData.小学随班就读 || 0) + (eduData.初中随班就读 || 0) + (eduData.高中随班就读 || 0);
    人员情况表.J35 = eduData.高中随班就读 || 0;
    人员情况表.J36 = eduData.初中随班就读 || 0;
    人员情况表.J37 = eduData.小学随班就读 || 0;
    人员情况表.J38 = (eduData.小学住宿生 || 0) + (eduData.初中住宿生 || 0) + (eduData.高中住宿生 || 0);
    人员情况表.J39 = eduData.高中住宿生 || 0;
    人员情况表.J40 = eduData.初中住宿生 || 0;
    人员情况表.J41 = eduData.小学住宿生 || 0;
    人员情况表.J45 = eduData.年末学前一年在园儿童人数 || 0;
    人员情况表.J47 = eduData.年末托育幼儿人数 || 0;
    if (Array.isArray(eduData.合并缺失学校) && eduData.合并缺失学校.length > 0) {
      warnings.push(`教育事业年报合并汇总时有 ${eduData.合并缺失学校.length} 所成员校未匹配：${eduData.合并缺失学校.join('、')}`);
    }
  } else {
    人员情况表.J14 = 人员情况表.J12;
    人员情况表.J15 = 人员情况表.J13;
    人员情况表.J16 = cvMaybe(prevPersonSheet, 'J16');
    人员情况表.J17 = cvMaybe(prevPersonSheet, 'J17');
    人员情况表.J30 = 人员情况表.J18;
    人员情况表.J45 = 人员情况表.J44;
    人员情况表.J47 = 人员情况表.J46;
    warnings.push('未匹配教育事业年报，年末人员和学生数暂沿用上年。');
  }
  人员情况表.M12 = (人员情况表.J12 || 0) - (人员情况表.J13 || 0) + (人员情况表.J14 || 0) - (人员情况表.J15 || 0);

  const 收入情况表 = {};
  收入情况表.J14 = fiscalSubsidy;
  收入情况表.J13 = fiscalSubsidy;
  收入情况表.J12 = fiscalSubsidy;
  收入情况表.J26 = tuitionIncome;
  收入情况表.J27 = tuitionIncome;
  收入情况表.J36 = otherIncome + donationIncome;
  收入情况表.J41 = 0;
  收入情况表.J43 = sponsorInput;
  收入情况表.J55 = fiscalSubsidy;
  收入情况表.J56 = 0;
  收入情况表.J57 = 0;
  const heatingFeePerStudent = Number(opts.heatingFeePerStudent ?? opts.regionRules?.heatingFeePerStudent ?? 25);
  const calculatedHeating = Math.ceil(((人员情况表.J18 || 0) * 8 + (人员情况表.J30 || 0) * 4) / 12) * heatingFeePerStudent;
  收入情况表.J58 = controls.hasHeating ? Math.min(calculatedHeating, fiscalSubsidy) : 0;
  收入情况表.J55 = Math.max(0, fiscalSubsidy - 收入情况表.J58);
  if (controls.hasHeating && calculatedHeating > fiscalSubsidy) {
    warnings.push(`按学生数测算取暖费为 ${calculatedHeating.toFixed(2)} 元，但财政补助只有 ${fiscalSubsidy.toFixed(2)} 元，已按财政补助上限生成。`);
  }
  收入情况表.J11 = 收入情况表.J12 + 收入情况表.J26 + 收入情况表.J36 + 收入情况表.J43;

  const 支出情况表 = {};
  const wageRows = [17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  const wageSplit = splitByPreviousRows(prevExpenseSheet, wageRows, wageTotal, 30);
  for (const row of wageRows) setTotalAndFiscal(支出情况表, row, wageSplit[row], 0);
  支出情况表.F16 = sumValues(wageRows.map((row) => 支出情况表[`F${row}`]));
  支出情况表.J16 = 0;

  const personalRows = [33, 34, 35, 36, 37, 38, 39, 40, 41, 45, 46];
  for (const row of personalRows) setTotalAndFiscal(支出情况表, row, 0, 0);
  支出情况表.F32 = 0;
  支出情况表.J32 = 0;

  const totalIncome = 收入情况表.J11;
  let goodsTotal = totalIncome - wageTotal - capitalExpense - interestExpense - sponsorWithdraw - donationExpense - netBalance;
  if (goodsTotal < 0) {
    warnings.push(`关键支出加结余已超过收入合计 ${Math.abs(goodsTotal).toFixed(2)} 元，商品服务支出暂置 0，请复核关键数和结余。`);
    goodsTotal = 0;
  }
  const goodsRows = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 74, 75];
  const heatingExpense = 收入情况表.J58 || 0;
  // 74校方责任险/75转拨为 73 其他商品服务的“其中”项，无法从收支反推、草稿置 0（由经办填报），
  // 不参与按上年结构的平行分摊，避免其超过 73（446/10192），也避免上年报表行错位带来的误配。
  setTotalAndFiscal(支出情况表, 74, 0, 0);
  setTotalAndFiscal(支出情况表, 75, 0, 0);
  const goodsBaseRows = goodsRows.filter((row) => ![54, 59, 74, 75].includes(row));
  const fixedGoods = rentExpense + heatingExpense;
  if (fixedGoods > goodsTotal) {
    warnings.push('取暖费和租赁费已超过按收支平衡反推的商品和服务支出余额，草稿会暂时保留固定项目，请补充收入或调整关键支出。');
  }
  const goodsResidual = Math.max(0, goodsTotal - fixedGoods);
  const goodsSplit = splitByPreviousRows(prevExpenseSheet, goodsBaseRows, goodsResidual, 48);
  for (const row of goodsBaseRows) setTotalAndFiscal(支出情况表, row, goodsSplit[row], 0);
  setTotalAndFiscal(支出情况表, 54, heatingExpense, 0);
  setTotalAndFiscal(支出情况表, 59, rentExpense, 0);
  支出情况表.F47 = sumValues(goodsRows.map((row) => 支出情况表[`F${row}`]));
  支出情况表.J47 = 0;
  tuneOtherGoodsServiceShare(支出情况表, 'F', warnings);
  支出情况表.F47 = sumValues(goodsRows.map((row) => 支出情况表[`F${row}`]));

  const capitalRows = [77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87];
  const capitalSplit = splitByPreviousRows(prevExpenseSheet, capitalRows, capitalExpense, 78);
  for (const row of capitalRows) setTotalAndFiscal(支出情况表, row, capitalSplit[row], 0);
  支出情况表.F76 = sumValues(capitalRows.map((row) => 支出情况表[`F${row}`]));
  支出情况表.J76 = 0;

  for (const row of [88, 89, 90, 91, 92, 93, 96, 97, 99, 100, 101]) setTotalAndFiscal(支出情况表, row, 0, 0);
  setTotalAndFiscal(支出情况表, 95, interestExpense, 0);
  setTotalAndFiscal(支出情况表, 96, donationExpense, 0);
  setTotalAndFiscal(支出情况表, 97, sponsorWithdraw, 0);
  支出情况表.F94 = 支出情况表.F95 + 支出情况表.F96 + 支出情况表.F97;
  支出情况表.J94 = 0;
  if (sponsorWithdraw > 0) warnings.push('举办者抽回已列入其他支出明细 F97，请提交前复核平台口径。');
  // 附:项目支出资本性明细(行103-113)镜像 310 资本性支出明细(行77-87)，与正式路径一致。
  const capitalMirror = [[103, 77], [104, 78], [105, 79], [106, 80], [107, 81], [108, 82], [109, 83], [110, 84], [111, 85], [112, 86], [113, 87]];
  for (const [dst, src] of capitalMirror) setTotalAndFiscal(支出情况表, dst, 支出情况表[`F${src}`] || 0, 0);
  支出情况表.F102 = capitalMirror.slice(0, 10).reduce((sum, [dst]) => sum + (支出情况表[`F${dst}`] || 0), 0);
  支出情况表.J102 = 0;
  支出情况表.F98 = 支出情况表.F99 + 支出情况表.F100 + 支出情况表.F101 + 支出情况表.F102;
  支出情况表.J98 = 0;
  支出情况表.F15 = 支出情况表.F16 + 支出情况表.F32 + 支出情况表.F47 + 支出情况表.F76 + 支出情况表.F88;
  支出情况表.J15 = 0;
  支出情况表.F14 = 支出情况表.F15 + 支出情况表.F94;
  支出情况表.J14 = 0;

  const 费用情况表 = {};
  费用情况表.G13 = 支出情况表.F16;
  费用情况表.I13 = 支出情况表.F32;
  费用情况表.K13 = 支出情况表.F40 || 0;
  费用情况表.L13 = 支出情况表.F47;
  费用情况表.M13 = prevFeeSheet ? cvMaybe(prevFeeSheet, 'M13') : 0;
  费用情况表.F13 = 费用情况表.G13 + 费用情况表.I13 + 费用情况表.L13 + 费用情况表.M13;
  费用情况表.G14 = 0;
  费用情况表.I14 = 0;
  费用情况表.J14 = 0;
  费用情况表.L14 = 0;
  费用情况表.F14 = 0;
  费用情况表.F16 = 0;
  费用情况表.F12 = 费用情况表.F13 + 费用情况表.F14 + 费用情况表.F16;

  const 资产价值量情况表 = {};
  const prevAV = (addr) => cvMaybe(prevAssetSheet, addr);
  for (let r = 12; r <= 36; r++) {
    资产价值量情况表[`F${r}`] = prevAV(`G${r}`);
    资产价值量情况表[`G${r}`] = prevAV(`G${r}`);
  }
  if (capitalExpense > 0) {
    资产价值量情况表.G16 = (资产价值量情况表.F16 || 0) + capitalExpense;
    资产价值量情况表.G15 = (资产价值量情况表.F15 || 0) + capitalExpense;
    资产价值量情况表.G12 = (资产价值量情况表.F12 || 0) + capitalExpense;
    资产价值量情况表.G36 = (资产价值量情况表.G12 || 0) - (资产价值量情况表.G35 || 0);
    资产价值量情况表.L16 = capitalExpense;
    资产价值量情况表.L15 = capitalExpense;
    warnings.push('已按资本性支出增加固定资产原值，仍建议核对资产价值量表。');
  }

  const 资产实物量情况表 = {};
  if (prevPhysSheet) {
    for (let row = 11; row <= 30; row++) 资产实物量情况表[`J${row}`] = cvMaybe(prevPhysSheet, `J${row}`);
  }
  applyHeatedAreaLinkage(支出情况表, 资产实物量情况表, warnings);
  reconcileDepreciation(资产价值量情况表, warnings);
  // 民办隶属关系非公办，收支不强制相等；财政补助减财政支出的差额记入年末结转结余（428/429/430）。
  applyCarryoverBalance(收入情况表, 支出情况表, { publicCompulsory: false });

  meta.set('收入情况表', 'J26', 'manual', '用户填写学费/保育费收入', 'confirmed');
  meta.set('收入情况表', 'J14', 'manual', '用户填写财政补助收入', 'confirmed');
  meta.set('收入情况表', 'J36', otherIncome > 0 || donationIncome > 0 ? 'manual' : 'estimated', '用户填写其他收入/捐赠收入', otherIncome > 0 || donationIncome > 0 ? 'confirmed' : 'draft');
  meta.set('收入情况表', 'J43', sponsorInput > 0 ? 'manual' : 'estimated', '用户填写举办者投入', sponsorInput > 0 ? 'confirmed' : 'draft');
  meta.set('收入情况表', 'J58', controls.hasHeating ? 'derived' : 'estimated', '按学生数和取暖费标准生成', controls.hasHeating ? 'draft' : 'empty');
  meta.set('支出情况表', 'F16', 'manual', '用户填写工资福利总额后按上年结构拆分', 'confirmed');
  meta.set('支出情况表', 'F47', 'derived', '收入扣除工资、资本性支出、其他支出和收支结余后反推', 'draft');
  meta.set('支出情况表', 'F48', 'derived', '按上年结构拆分；如其他商品服务超比例则调入办公费', 'draft');
  meta.set('支出情况表', 'F54', controls.hasHeating ? 'derived' : 'estimated', '与收入取暖经费联动', controls.hasHeating ? 'draft' : 'empty');
  meta.set('支出情况表', 'F59', rentExpense > 0 ? 'manual' : 'estimated', '用户填写房租/租赁费', rentExpense > 0 ? 'confirmed' : 'draft');
  meta.set('支出情况表', 'F73', 'derived', '按上年结构拆分并执行15%控制线', 'draft');
  meta.set('支出情况表', 'F76', 'manual', '用户填写资本性支出后按上年结构拆分', 'confirmed');
  meta.set('支出情况表', 'F94', interestExpense > 0 || sponsorWithdraw > 0 || donationExpense > 0 ? 'manual' : 'estimated', '利息、捐赠支出和举办者抽回汇总', interestExpense > 0 || sponsorWithdraw > 0 || donationExpense > 0 ? 'confirmed' : 'draft');
  meta.set('支出情况表', 'F95', interestExpense > 0 ? 'manual' : 'estimated', '用户填写利息支出', interestExpense > 0 ? 'confirmed' : 'draft');
  meta.set('支出情况表', 'F96', donationExpense > 0 ? 'manual' : 'estimated', '用户填写捐赠支出', donationExpense > 0 ? 'confirmed' : 'draft');
  meta.set('支出情况表', 'F97', sponsorWithdraw > 0 ? 'manual' : 'estimated', '用户填写举办者抽回', sponsorWithdraw > 0 ? 'confirmed' : 'draft');

  const computed = { 人员情况表, 收入情况表, 支出情况表, 费用情况表, 资产价值量情况表, 资产实物量情况表 };
  computed.__meta = { sources: meta.data, warnings, mode: 'private-draft' };
  return computed;
}

async function generatePrivateDraft({ unitName, prevReportPath, eduData, controls, outputDir, layoutTemplatePath, onLog = () => {}, ruleOptions = {} }) {
  if (!prevReportPath) throw new Error('请选择上年经费年报文件');
  if (!layoutTemplatePath) throw new Error('缺少经费年报模板');
  const prevYearWb = new WB(prevReportPath);
  const computed = computePrivateDraft(prevYearWb, eduData, controls, ruleOptions);
  // 单学段民办：分学段学生明细行清零，学生数只填汇总行（268/922）。
  const draftLevels = eduData && eduData.bxlx ? levelsFromBxlx(String(eduData.bxlx)) : [];
  if (draftLevels.length <= 1) zeroStageBreakdownRows(computed.人员情况表);
  const outputBaseDir = outputDir || path.dirname(prevReportPath);
  const outputPath = resolveInside(outputBaseDir, `${sanitizeFileName(unitName)}民办草稿经费年报.xlsx`);
  onLog('正在生成民办草稿...', 'log');
  for (const warning of computed.__meta.warnings || []) onLog(warning, 'warn');
  const validation = await writeReport(computed, unitName, outputPath, layoutTemplatePath, ruleOptions);
  attachValidationResult(computed, validation, onLog);
  // 民办草稿同样给出数据变动原因建议（对比上年经费年报）与情况说明文件。
  const varianceSuggestions = buildVarianceSuggestions(
    collectVarianceRows(computed, prevYearWb),
    { unitName, library: ruleOptions.explanationLibrary || null },
  );
  const explanationPath = writeExplanationFile(unitName, validation, outputBaseDir, {
    xxlbdm: resolveRuleContext(ruleOptions, unitName).xxlbdm || '',
    library: ruleOptions.explanationLibrary || null,
    varianceSuggestions,
  });
  if (explanationPath) onLog(`已生成情况说明与变动原因建议：${path.basename(explanationPath)}`, 'log');
  const preview = computedToPreview(computed, unitName);
  preview.mode = 'private-draft';
  preview.warnings = computed.__meta.warnings || [];
  preview.sources = computed.__meta.sources || {};
  preview.outputPath = outputPath;
  preview.explanationPath = explanationPath;
  preview.varianceSuggestions = varianceSuggestions;
  return {
    ok: true,
    message: '已生成民办草稿',
    outputPath,
    unitName,
    preview,
    computed,
    warnings: preview.warnings,
    bxlx: eduData && eduData.bxlx,
    schoolType: '民办草稿',
    levels: [],
  };
}

/**
 * 基于标准模板写入输出 Excel
 */
async function writeReport(computed, unitName, outputPath, layoutTemplatePath, ruleOptions = {}) {
  const workbook = XLSX.readFile(layoutTemplatePath, {
    cellFormula: true,
    cellNF: true,
    cellStyles: true,
  });
  const { 人员情况表, 收入情况表, 支出情况表, 费用情况表, 资产价值量情况表, 资产实物量情况表 } = computed;

  const setCell = (ws, addr, val) => {
    const value = val == null ? 0 : val;
    const cell = ws[addr] || {};
    cell.v = value;
    cell.t = typeof value === 'number' ? 'n' : 's';
    delete cell.f;
    ws[addr] = cell;
  };

  // 固化模板中的公式，避免外链公式残留
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    for (const addr of Object.keys(ws)) {
      if (addr.startsWith('!')) continue;
      const cell = ws[addr];
      if (cell && cell.f) {
        const value = cell.v == null ? 0 : cell.v;
        cell.v = value;
        cell.t = typeof value === 'number' ? 'n' : 's';
        delete cell.f;
      }
    }

    if (ws.A4 && String(ws.A4.v || '').includes('单位名称')) {
      setCell(ws, 'B4', unitName);
    }
  }

  const mustSheet = (name) => {
    const ws = workbook.Sheets[name];
    if (!ws) throw new Error(`模板缺少工作表：${name}`);
    return ws;
  };

  // Sheet 1
  const ws1 = mustSheet('人员情况表');
  setCell(ws1, 'J12', 人员情况表.J12 || 0);
  setCell(ws1, 'M12', 人员情况表.M12 || 0);
  setCell(ws1, 'J13', 人员情况表.J13 || 0);
  setCell(ws1, 'J14', 人员情况表.J14 || 0);
  setCell(ws1, 'J15', 人员情况表.J15 || 0);
  setCell(ws1, 'J16', 人员情况表.J16 || 0);
  setCell(ws1, 'J17', 人员情况表.J17 || 0);
  setCell(ws1, 'J18', 人员情况表.J18 || 0);
  setCell(ws1, 'J19', 人员情况表.J19 || 0);
  setCell(ws1, 'J20', 人员情况表.J20 || 0);
  setCell(ws1, 'J21', 人员情况表.J21 || 0);
  setCell(ws1, 'J22', 人员情况表.J22 || 0);
  setCell(ws1, 'J23', 人员情况表.J23 || 0);
  setCell(ws1, 'J24', 人员情况表.J24 || 0);
  setCell(ws1, 'J25', 人员情况表.J25 || 0);
  setCell(ws1, 'J26', 人员情况表.J26 || 0);
  setCell(ws1, 'J27', 人员情况表.J27 || 0);
  setCell(ws1, 'J28', 人员情况表.J28 || 0);
  setCell(ws1, 'J29', 人员情况表.J29 || 0);
  setCell(ws1, 'J30', 人员情况表.J30 || 0);
  setCell(ws1, 'J31', 人员情况表.J31 || 0);
  setCell(ws1, 'J32', 人员情况表.J32 || 0);
  setCell(ws1, 'J33', 人员情况表.J33 || 0);
  setCell(ws1, 'J34', 人员情况表.J34 || 0);
  setCell(ws1, 'J35', 人员情况表.J35 || 0);
  setCell(ws1, 'J36', 人员情况表.J36 || 0);
  setCell(ws1, 'J37', 人员情况表.J37 || 0);
  setCell(ws1, 'J38', 人员情况表.J38 || 0);
  setCell(ws1, 'J39', 人员情况表.J39 || 0);
  setCell(ws1, 'J40', 人员情况表.J40 || 0);
  setCell(ws1, 'J41', 人员情况表.J41 || 0);
  setCell(ws1, 'J44', 人员情况表.J44 || 0);
  setCell(ws1, 'J45', 人员情况表.J45 || 0);
  setCell(ws1, 'J46', 人员情况表.J46 || 0);
  setCell(ws1, 'J47', 人员情况表.J47 || 0);

  // Sheet 2
  const ws2 = mustSheet('收入情况表');
  setCell(ws2, 'J11', 收入情况表.J11 || 0);
  setCell(ws2, 'J12', 收入情况表.J12 || 0);
  setCell(ws2, 'J13', 收入情况表.J13 || 0);
  setCell(ws2, 'J14', 收入情况表.J14 || 0);
  setCell(ws2, 'J26', 收入情况表.J26 || 0);
  setCell(ws2, 'J27', 收入情况表.J27 || 0);
  setCell(ws2, 'J36', 收入情况表.J36 || 0);
  setCell(ws2, 'J41', 收入情况表.J41 || 0);
  setCell(ws2, 'J43', 收入情况表.J43 || 0);
  setCell(ws2, 'J55', 收入情况表.J55 || 0);
  setCell(ws2, 'J56', 收入情况表.J56 || 0);
  setCell(ws2, 'J57', 收入情况表.J57 || 0);
  setCell(ws2, 'J58', 收入情况表.J58 || 0);

  // Sheet 3
  const ws3 = mustSheet('支出情况表');
  const fillRow = (row, val) => {
    const v = val || 0;
    for (const col of ['F', 'G', 'H', 'I', 'J']) setCell(ws3, `${col}${row}`, v);
  };
  const fillExpenseRow = (row) => {
    const total = 支出情况表[`F${row}`] != null ? 支出情况表[`F${row}`] : (支出情况表[`J${row}`] || 0);
    const fiscal = 支出情况表[`J${row}`] || 0;
    setCell(ws3, `F${row}`, total);
    for (const col of ['G', 'H', 'I', 'J']) setCell(ws3, `${col}${row}`, fiscal);
  };
  fillExpenseRow(14);
  fillExpenseRow(15);
  fillExpenseRow(16);
  setCell(ws3, 'F17', 支出情况表.F17 || 支出情况表.J17 || 0);
  for (const col of ['G', 'H', 'I', 'J']) setCell(ws3, `${col}17`, 支出情况表.J17 || 0);
  for (let r = 18; r <= 31; r++) fillExpenseRow(r);
  setCell(ws3, 'F30', 支出情况表.F30 || 支出情况表.J30 || 0);
  for (let r = 32; r <= 46; r++) fillExpenseRow(r);
  for (let r = 47; r <= 75; r++) fillExpenseRow(r);
  for (let r = 76; r <= 88; r++) fillExpenseRow(r);
  for (let r = 89; r <= 113; r++) fillExpenseRow(r);
  // 84 行“年末预算结转结余”（模板行 97）按资金列覆盖统一填充，满足 428/429/430/949。
  if (支出情况表.__carryover) {
    for (const [col, value] of Object.entries(支出情况表.__carryover)) setCell(ws3, `${col}97`, value);
  }

  // Sheet 4
  const ws4 = mustSheet('费用情况表');
  setCell(ws4, 'F12', 费用情况表.F12 || 0);
  setCell(ws4, 'F13', 费用情况表.F13 || 0);
  setCell(ws4, 'G13', 费用情况表.G13 || 0);
  setCell(ws4, 'I13', 费用情况表.I13 || 0);
  setCell(ws4, 'K13', 费用情况表.K13 || 0);
  setCell(ws4, 'L13', 费用情况表.L13 || 0);
  setCell(ws4, 'M13', 费用情况表.M13 || 0);
  setCell(ws4, 'F14', 费用情况表.F14 || 0);
  setCell(ws4, 'G14', 费用情况表.G14 || 0);
  setCell(ws4, 'I14', 费用情况表.I14 || 0);
  setCell(ws4, 'J14', 费用情况表.J14 || 0);
  setCell(ws4, 'L14', 支出情况表.J67 || 0);
  setCell(ws4, 'F16', 费用情况表.F16 || 0);

  // Sheet 6
  const ws6 = mustSheet('资产价值量情况表');
  for (let r = 12; r <= 36; r++) {
    for (const col of ['F', 'G', 'H', 'L', 'M']) {
      const key = `${col}${r}`;
      if (资产价值量情况表[key] != null) setCell(ws6, key, 资产价值量情况表[key]);
    }
  }

  // Sheet 7
  const ws7 = mustSheet('资产实物量情况表');
  for (let r = 11; r <= 30; r++) {
    if (资产实物量情况表[`J${r}`] != null) setCell(ws7, `J${r}`, 资产实物量情况表[`J${r}`]);
  }

  const resolvedContext = resolveRuleContext(ruleOptions, unitName);
  const validation = applyReportRules({
    workbook,
    computed,
    ruleFiles: ruleOptions.reportRuleFiles || [],
    ruleContext: resolvedContext,
    // 提示级说明优先取本校上年在平台的实际填报（rules/说明库.json，由县下发两表提炼）。
    explanationContext: {
      unitName,
      xxlbdm: resolvedContext.xxlbdm || '',
      library: ruleOptions.explanationLibrary || null,
    },
  });
  XLSX.writeFile(workbook, outputPath, { bookType: 'xlsx' });
  return validation;
}

/**
 * 合并全局校验参数与本校属性（学校类别、隶属关系、单位代码、城乡分类、普惠性等）。
 * 属性表按归一化学校名索引，缺失时回退到全局参数。
 */
function resolveRuleContext(ruleOptions = {}, unitName = '') {
  const base = { ...(ruleOptions.reportRuleContext || {}) };
  const attributes = ruleOptions.schoolAttributes || {};
  const aliased = applySchoolAlias(unitName, ruleOptions.schoolAliases);
  const hit = attributes[normalizeSchoolName(aliased)] || attributes[normalizeSchoolName(unitName)];
  if (!hit) return base;
  for (const [key, value] of Object.entries(hit)) {
    if (value != null && String(value).trim() !== '') base[key] = String(value).trim();
  }
  return base;
}


/**
 * 主入口：生成单个学校的经费年报
 * @param {object} filePaths - 5种源文件路径
 * @param {object|null} eduData - 教育事业年报中该学校的数据（已提取）
 * @param {string} outputDir - 输出目录
 * @param {string} layoutTemplatePath - 标准版式模板路径
 * @param {function} onLog - 日志回调
 */
async function generateReport(filePaths, eduData, outputDir, layoutTemplatePath, onLog = () => {}, opts = {}) {
  try {
    onLog('开始读取源文件...', 'log');

    const workbooks = {};
    const fileKeys = ['资产负债表', '收入费用表', '经费支出明细表', '科目余额表', '上年经费年报'];

    for (const key of fileKeys) {
      if (!filePaths[key]) throw new Error(`缺少文件：${key}`);
      onLog(`读取：${path.basename(filePaths[key])}`, 'log');
      workbooks[key] = new WB(filePaths[key]);
    }

    // ===== 核对5张表的单位名称一致性 =====
    onLog('核对单位名称...', 'log');
    const unitNameConfigs = {
      '资产负债表': { sheet: 0, addr: 'A3', clean: (v) => String(v).replace(/编制单位[:：]\s*/g, '').trim() },
      '收入费用表': { sheet: 0, addr: 'B3', clean: (v) => String(v).trim() },
      '经费支出明细表': { sheet: 0, addr: 'A2', clean: (v) => String(v).trim() },
      '科目余额表': { sheet: 0, addr: 'A3', clean: (v) => String(v).trim() },
      '上年经费年报': { sheet: 0, addr: 'B4', clean: (v) => String(v).trim() },
    };

    let unitName = null;
    const nameResults = [];

    for (const key of fileKeys) {
      const cfg = unitNameConfigs[key];
      const sheet = workbooks[key].getSheet(cfg.sheet);
      const raw = WB.cellVal(sheet, cfg.addr);
      const name = raw ? cfg.clean(raw) : '';
      nameResults.push({ file: key, name });

      if (!name) {
        throw new Error(`无法从 [${key}] 中提取单位名称（单元格 ${cfg.addr} 为空）`);
      }

      if (!unitName) {
        unitName = name;
      } else if (unitName !== name) {
        throw new Error(`单位名称不一致！\n  ${nameResults[0].file}：${unitName}\n  ${key}：${name}\n请检查文件是否属于同一单位。`);
      }
    }

    onLog(`单位名称核对通过：${unitName}`, 'success');

    // 教育事业年报数据（由调用方提前提取传入）
    if (eduData) {
      onLog(`教育事业年报匹配：${eduData.学校名称}（教职工${eduData.教职工数}人，学生${eduData.小学学生数 + eduData.初中学生数 + eduData.高中学生数 + eduData.幼儿园学生数}人）`, 'log');
      if (Array.isArray(eduData.合并成员学校) && eduData.合并成员学校.length > 1) {
        onLog(`已按合并规则汇总 ${eduData.合并成员学校.length} 所学校。`, 'log');
      }
      if (Array.isArray(eduData.合并缺失学校) && eduData.合并缺失学校.length > 0) {
        onLog(`合并成员未匹配：${eduData.合并缺失学校.join('、')}`, 'warn');
      }
      if (Array.isArray(eduData.匹配警告)) {
        for (const warning of eduData.匹配警告) onLog(warning, 'warn');
      }
    } else {
      onLog('未提供教育事业年报数据，人员情况表年末数据将为空', 'warn');
    }

    onLog('计算年报数据...', 'log');
    // 解析本校学校类别与隶属关系（用于取暖经费、公办义务教育收支相等等按校型判定的生成逻辑）。
    const ruleContext = resolveRuleContext(opts, unitName);
    const computed = computeReport(workbooks, eduData, {
      ...opts, xxlbdm: ruleContext.xxlbdm || '', lsgxdm: ruleContext.lsgxdm || '',
    });

    // ===== 学段检测（仅标记，不分摊） =====
    let levels = identifySchoolType(workbooks['上年经费年报']);
    let bxlx = null;
    let schoolType = null;

    if (levels.length === 0 && eduData && eduData.bxlx) {
      levels = levelsFromBxlx(eduData.bxlx);
      bxlx = String(eduData.bxlx);
    }

    if (levels.length > 1) {
      schoolType = levels.join('+');
      onLog(`检测到多学段学校：${schoolType}（${levels.join('、')}）`, 'log');
    } else if (levels.length === 1) {
      schoolType = levels[0];
      onLog(`单学段学校：${schoolType}`, 'log');
    }

    const outputFileName = `${sanitizeFileName(unitName)}经费年报.xlsx`;
    const outputPath = resolveInside(outputDir, outputFileName);

    onLog('生成年报文件...', 'log');
    // 多学段拆分需用到分学段明细行，故先按明细行做拆分；单学段学校随后清零明细行（268/922）。
    const stages = splitComputedByStage(computed, levels);
    if (levels.length <= 1) zeroStageBreakdownRows(computed.人员情况表);
    const validation = await writeReport(computed, unitName, outputPath, layoutTemplatePath, opts);
    attachValidationResult(computed, validation, onLog);
    // 数据变动原因建议：本年生成值对比上年经费年报，超阈值指标按说明库给出建议原因。
    const varianceSuggestions = buildVarianceSuggestions(
      collectVarianceRows(computed, workbooks['上年经费年报']),
      { unitName, library: opts.explanationLibrary || null },
    );
    if (varianceSuggestions.length) {
      onLog(`数据变动超阈值指标 ${varianceSuggestions.length} 项，已生成变动原因建议（上报平台“数据变动原因”表参考）。`, 'log');
    }
    const explanationPath = writeExplanationFile(unitName, validation, outputDir, {
      xxlbdm: ruleContext.xxlbdm || '',
      library: opts.explanationLibrary || null,
      varianceSuggestions,
    });
    if (explanationPath) onLog(`已生成情况说明与变动原因建议：${path.basename(explanationPath)}`, 'log');

    // 多学段学校（ZXXCFMode=2）：按学生数比例拆分，另存各学段记录 Excel 供上报拆分填报。
    const stageReports = [];
    for (const stage of stages) {
      const stageFileName = `${sanitizeFileName(unitName)}经费年报_${stage.level}(${stage.code}).xlsx`;
      const stagePath = resolveInside(outputDir, stageFileName);
      const stageValidation = await writeReport(stage.computed, unitName, stagePath, layoutTemplatePath, {
        ...opts, xxlbdm: stage.code, lsgxdm: ruleContext.lsgxdm || '',
      });
      stageReports.push({ level: stage.level, code: stage.code, ratio: stage.ratio, outputPath: stagePath, validation: stageValidation });
      onLog(`已拆分生成${stage.level}(${stage.code})记录：占比 ${(stage.ratio * 100).toFixed(1)}%，${path.basename(stagePath)}`, 'log');
    }
    if (stages.length) onLog(`多学段拆分：${stages.length} 个学段记录 + 全校合计，加总等于全校合计，请复核各学段比例。`, 'warn');

    const preview = computedToPreview(computed, unitName);
    preview.outputPath = outputPath;
    preview.explanationPath = explanationPath;
    preview.stageReports = stageReports;
    preview.varianceSuggestions = varianceSuggestions;

    onLog(`已生成：${outputFileName}`, 'success');
    return {
      ok: true, message: '已完成', outputPath, unitName, preview, computed,
      bxlx, schoolType, levels, stageReports,
    };
  } catch (error) {
    onLog(error.message, 'error');
    return { ok: false, message: error.message };
  }
}

module.exports = {
  generateReport, generatePrivateDraft, computeReport, computePrivateDraft, eduDataFromCollectControls,
  extractEduData, extractEduDataFromRows, writeReport, WB, resolveRuleContext,
  PRIMARY_SCHOOL_MERGE_GROUPS, KINDERGARTEN_MERGE_GROUPS, resolveEduMergeGroups,
  BXLX_MAP, LEVEL_GOV_INFO, identifySchoolType, levelsFromBxlx, findLevelSheet,
  splitComputedByStage,
};
