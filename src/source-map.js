/**
 * 源报表取数点声明表（厂商无关的语义层）
 *
 * 每个取数点声明三种定位方式，按优先级回退：
 *   code  —《政府支出经济分类科目》/《政府会计制度》统一编码，全国一致 → 首选
 *   names — 科目名称及常见别名，源表不带编码列时使用 → 回退
 *   zhongke — 中科版式的固定单元格，仅作为中科文件的兜底与交叉校验基准
 *
 * confidence 字段说明（决定非中科厂商能否解析该点）：
 *   'high'     — 编码有代码注释或计算逻辑双重印证，可用于任意厂商
 *   'inferred' — 按《政府支出经济分类科目》标准序列推断，尚无真实样本印证
 *   'unknown'  — 语义未确定，仅中科固定地址可用；其他厂商取 0 并告警
 *
 * ⚠️ 'inferred' 与 'unknown' 必须用真实样本核对后才能改判 'high'。
 *    核对办法见本文件末尾 verifyAgainstSample 说明。
 */

// ===== 经费支出明细表：301 工资福利支出 =====
// D5=301 合计，D6..D18 依《政府支出经济分类科目》301 类 13 个明细顺序排列。
// 印证：D6 在引擎中命名为 sourceBasicWage（基本工资），D18 命名为 sourceOtherWage
//      （其他工资福利支出），首尾两端与标准序列吻合，故中间项按标准序列推断。
const EXPENSE_WAGE = [
  // critical：段合计是引擎的控制数（商品和服务支出按合计倒挤办公费），
  // 静默丢失会连带整段失真，故取不到必须阻断，不能只当"该单位无此科目"。
  { key: 'wage.total', code: '301', names: ['工资福利支出'], zhongke: 'D5', confidence: 'high', critical: true },
  { key: 'wage.30101', code: '30101', names: ['基本工资'], zhongke: 'D6', confidence: 'high' },
  { key: 'wage.30102', code: '30102', names: ['津贴补贴'], zhongke: 'D7', confidence: 'inferred' },
  { key: 'wage.30103', code: '30103', names: ['奖金'], zhongke: 'D8', confidence: 'inferred' },
  { key: 'wage.30106', code: '30106', names: ['伙食补助费'], zhongke: 'D9', confidence: 'inferred' },
  { key: 'wage.30107', code: '30107', names: ['绩效工资'], zhongke: 'D10', confidence: 'inferred' },
  { key: 'wage.30108', code: '30108', names: ['机关事业单位基本养老保险缴费'], zhongke: 'D11', confidence: 'inferred' },
  { key: 'wage.30109', code: '30109', names: ['职业年金缴费'], zhongke: 'D12', confidence: 'inferred' },
  { key: 'wage.30110', code: '30110', names: ['职工基本医疗保险缴费'], zhongke: 'D13', confidence: 'inferred' },
  { key: 'wage.30111', code: '30111', names: ['公务员医疗补助缴费'], zhongke: 'D14', confidence: 'inferred' },
  { key: 'wage.30112', code: '30112', names: ['其他社会保障缴费'], zhongke: 'D15', confidence: 'inferred' },
  { key: 'wage.30113', code: '30113', names: ['住房公积金'], zhongke: 'D16', confidence: 'inferred' },
  { key: 'wage.30114', code: '30114', names: ['医疗费'], zhongke: 'D17', confidence: 'inferred' },
  { key: 'wage.30199', code: '30199', names: ['其他工资福利支出'], zhongke: 'D18', confidence: 'high' },
];

// ===== 经费支出明细表：302 商品和服务支出 =====
// 印证：引擎注释（report-engine.js 维修（护）费=J58、公务接待费=J62）与 D31/D35 对应，
//      与标准序列 30213/30217 位置吻合，故整段按标准序列推断。
// D20(30201 办公费)、D27(30208 取暖费) 引擎不读：办公费为倒挤项、取暖费用测算值替代。
const EXPENSE_GOODS = [
  { key: 'goods.total', code: '302', names: ['商品和服务支出'], zhongke: 'D19', confidence: 'high', critical: true },
  { key: 'goods.30202', code: '30202', names: ['印刷费'], zhongke: 'D21', confidence: 'inferred' },
  { key: 'goods.30203', code: '30203', names: ['咨询费'], zhongke: 'D22', confidence: 'inferred' },
  { key: 'goods.30204', code: '30204', names: ['手续费'], zhongke: 'D23', confidence: 'inferred' },
  { key: 'goods.30205', code: '30205', names: ['水费'], zhongke: 'D24', confidence: 'inferred' },
  { key: 'goods.30206', code: '30206', names: ['电费'], zhongke: 'D25', confidence: 'inferred' },
  { key: 'goods.30207', code: '30207', names: ['邮电费'], zhongke: 'D26', confidence: 'inferred' },
  { key: 'goods.30209', code: '30209', names: ['物业管理费'], zhongke: 'D28', confidence: 'inferred' },
  { key: 'goods.30211', code: '30211', names: ['差旅费'], zhongke: 'D29', confidence: 'inferred' },
  { key: 'goods.30212', code: '30212', names: ['因公出国(境)费用', '因公出国费用'], zhongke: 'D30', confidence: 'inferred' },
  { key: 'goods.30213', code: '30213', names: ['维修(护)费', '维修费', '维护费'], zhongke: 'D31', confidence: 'high' },
  { key: 'goods.30214', code: '30214', names: ['租赁费'], zhongke: 'D32', confidence: 'inferred' },
  { key: 'goods.30215', code: '30215', names: ['会议费'], zhongke: 'D33', confidence: 'inferred' },
  { key: 'goods.30216', code: '30216', names: ['培训费'], zhongke: 'D34', confidence: 'inferred' },
  { key: 'goods.30217', code: '30217', names: ['公务接待费'], zhongke: 'D35', confidence: 'high' },
  { key: 'goods.30218', code: '30218', names: ['专用材料费'], zhongke: 'D36', confidence: 'inferred' },
  { key: 'goods.d38', code: null, names: [], zhongke: 'D38', confidence: 'unknown' },
  { key: 'goods.d39', code: null, names: [], zhongke: 'D39', confidence: 'unknown' },
  { key: 'goods.30227', code: '30227', names: ['委托业务费'], zhongke: 'D40', confidence: 'inferred' },
  { key: 'goods.30228', code: '30228', names: ['工会经费'], zhongke: 'D41', confidence: 'inferred' },
  { key: 'goods.30229', code: '30229', names: ['福利费'], zhongke: 'D42', confidence: 'inferred' },
  { key: 'goods.30231', code: '30231', names: ['公务用车运行维护费'], zhongke: 'D43', confidence: 'inferred' },
  { key: 'goods.30239', code: '30239', names: ['其他交通费用'], zhongke: 'D44', confidence: 'inferred' },
  { key: 'goods.30299', code: '30299', names: ['其他商品和服务支出'], zhongke: 'D45', confidence: 'inferred' },
];

// ===== 经费支出明细表：303 对个人和家庭的补助 =====
// D48..D55 共 8 项。⚠️ D48 在引擎中被 支出情况表.J33 与 J75 同时读取（见 REUSED_CELLS），
// 语义存疑，暂标 unknown，不做编码映射，保持逐格兜底。
const EXPENSE_PERSONAL = [
  { key: 'personal.d48', code: null, names: [], zhongke: 'D48', confidence: 'unknown' },
  { key: 'personal.d49', code: null, names: [], zhongke: 'D49', confidence: 'unknown' },
  { key: 'personal.d50', code: null, names: [], zhongke: 'D50', confidence: 'unknown' },
  { key: 'personal.d51', code: null, names: [], zhongke: 'D51', confidence: 'unknown' },
  { key: 'personal.d52', code: null, names: [], zhongke: 'D52', confidence: 'unknown' },
  { key: 'personal.d53', code: null, names: [], zhongke: 'D53', confidence: 'unknown' },
  { key: 'personal.d54', code: null, names: [], zhongke: 'D54', confidence: 'unknown' },
  { key: 'personal.d55', code: null, names: [], zhongke: 'D55', confidence: 'unknown' },
  { key: 'personal.d60', code: null, names: [], zhongke: 'D60', confidence: 'unknown' },
  { key: 'personal.h4', code: null, names: [], zhongke: 'H4', confidence: 'unknown' },
];

// ===== 经费支出明细表：309 基本建设支出 / 310 资本性支出 =====
// 这两段编码来自 report-engine.js 原有逐行注释，可信度最高。
const EXPENSE_CAPITAL = [
  { key: 'cap.30901', code: '30901', names: ['房屋建筑物购建'], zhongke: 'H11', confidence: 'high' },
  { key: 'cap.30902', code: '30902', names: ['办公设备购置'], zhongke: 'H12', confidence: 'high' },
  { key: 'cap.30903', code: '30903', names: ['专用设备购置'], zhongke: 'H13', confidence: 'high' },
  { key: 'cap.30905', code: '30905', names: ['基础设施建设'], zhongke: 'H14', confidence: 'high' },
  { key: 'cap.30906', code: '30906', names: ['大型修缮'], zhongke: 'H15', confidence: 'high' },
  { key: 'cap.30907', code: '30907', names: ['信息网络及软件购置更新'], zhongke: 'H16', confidence: 'high' },
  { key: 'cap.30908', code: '30908', names: ['物资储备'], zhongke: 'H17', confidence: 'high' },
  { key: 'cap.30913', code: '30913', names: ['公务用车购置'], zhongke: 'H18', confidence: 'high' },
  { key: 'cap.30919', code: '30919', names: ['其他交通工具购置'], zhongke: 'H19', confidence: 'high' },
  { key: 'cap.30921', code: '30921', names: ['文物和陈列品购置'], zhongke: 'H20', confidence: 'high' },
  { key: 'cap.30922', code: '30922', names: ['无形资产购置'], zhongke: 'H21', confidence: 'high' },
  { key: 'cap.30999', code: '30999', names: ['其他基本建设支出'], zhongke: 'H22', confidence: 'high' },
  { key: 'cap.31001', code: '31001', names: ['房屋建筑物购建'], zhongke: 'H24', confidence: 'high' },
  { key: 'cap.31002', code: '31002', names: ['办公设备购置'], zhongke: 'H25', confidence: 'high' },
  { key: 'cap.31003', code: '31003', names: ['专用设备购置'], zhongke: 'H26', confidence: 'high' },
  { key: 'cap.31005', code: '31005', names: ['基础设施建设'], zhongke: 'H27', confidence: 'high' },
  { key: 'cap.31006', code: '31006', names: ['大型修缮'], zhongke: 'H28', confidence: 'high' },
  { key: 'cap.31007', code: '31007', names: ['信息网络及软件购置更新'], zhongke: 'H29', confidence: 'high' },
  { key: 'cap.31008', code: '31008', names: ['物资储备'], zhongke: 'H30', confidence: 'high' },
  { key: 'cap.31009', code: '31009', names: ['土地补偿'], zhongke: 'H31', confidence: 'high' },
  { key: 'cap.31010', code: '31010', names: ['安置补助'], zhongke: 'H32', confidence: 'high' },
  { key: 'cap.31011', code: '31011', names: ['地上附着物和青苗补偿'], zhongke: 'H33', confidence: 'high' },
  { key: 'cap.31012', code: '31012', names: ['拆迁补偿'], zhongke: 'H34', confidence: 'high' },
  { key: 'cap.31013', code: '31013', names: ['公务用车购置'], zhongke: 'H35', confidence: 'high' },
  { key: 'cap.31019', code: '31019', names: ['其他交通工具购置'], zhongke: 'H36', confidence: 'high' },
  { key: 'cap.31021', code: '31021', names: ['文物和陈列品购置'], zhongke: 'H37', confidence: 'high' },
  { key: 'cap.31022', code: '31022', names: ['无形资产购置'], zhongke: 'H38', confidence: 'high' },
  { key: 'cap.31099', code: '31099', names: ['其他资本性支出'], zhongke: 'H39', confidence: 'high' },
];

const EXPENSE_DETAIL = [...EXPENSE_WAGE, ...EXPENSE_GOODS, ...EXPENSE_PERSONAL, ...EXPENSE_CAPITAL];

/**
 * ⚠️ 309 与 310 存在同名科目（如 30901 与 31001 均为"房屋建筑物购建"）。
 * 因此这两段**只能按编码定位，名称回退会撞车**。names 仅用于人工排查展示。
 */
const NAME_AMBIGUOUS_KEYS = new Set(EXPENSE_CAPITAL.map((e) => e.key));

/**
 * 原引擎中被重复读取的单元格，重构必须原样保留（不是本次要修的问题）。
 * D48 → 支出情况表.J33 与 J75；D19 → publicExpenseSource 与 goodsServiceTotal。
 */
const REUSED_CELLS = ['D19', 'D48'];

// ===== 科目余额表：会计科目编码 → 期末余额 =====
// 原引擎已按编码扫描（A 列编码 / K 列期末余额），此处只把列位置改为按表头识别。
const ACCOUNT_BALANCE = {
  valueHeaders: ['期末余额', '期末数', '年末余额'],
  codes: [
    { code: '160101', names: ['房屋和构筑物'], confidence: 'high' },
    { code: '160102', names: ['设备'], confidence: 'high' },
    { code: '160104', names: ['图书和档案', '图书、档案'], confidence: 'high' },
    { code: '160105', names: ['家具和用具', '家具、用具及装具'], confidence: 'high' },
    { code: '160201', names: ['房屋和构筑物累计折旧', '房屋折旧'], confidence: 'high' },
    { code: '160202', names: ['设备累计折旧', '设备折旧'], confidence: 'high' },
    { code: '160205', names: ['家具用具累计折旧', '家具折旧'], confidence: 'high' },
  ],
};

// ===== 资产负债表 =====
// 只有 3 个取数点。行次名称为《政府会计制度》法定报表项目，各厂商一致。
const BALANCE_SHEET = [
  { key: 'bs.currentAssets', names: ['流动资产合计'], zhongke: 'B19', confidence: 'inferred' },
  { key: 'bs.construction', names: ['在建工程'], zhongke: 'B27', confidence: 'inferred' },
  { key: 'bs.e29', names: [], zhongke: 'E29', confidence: 'unknown' },
];

// ===== 收入费用表 =====
// 只有 2 个取数点。
const INCOME_EXPENSE = [
  { key: 'ie.fiscalAppropriation', names: ['财政拨款收入'], zhongke: 'D6', confidence: 'inferred' },
  { key: 'ie.businessIncome', names: ['经营收入'], zhongke: 'D17', confidence: 'inferred' },
];

/** 明细表金额列表头候选（各厂商措辞） */
const EXPENSE_VALUE_HEADERS = ['本年累计', '本年累计数', '累计发生额', '本期累计', '金额', '合计'];
const EXPENSE_NAME_HEADERS = ['科目名称', '项目', '项目名称', '经济科目', '经济分类科目'];

/**
 * 编码列表头候选。用于把编码列与金额列区分开——金额本身也是 3-8 位数字，
 * 不做区分会被误判成科目编码（见 source-scan.js isCodeCell 的说明）。
 */
const CODE_HEADERS = ['科目编码', '科目代码', '编码', '代码', '经济科目编码', '科目号'];

/** 收入费用表 / 资产负债表 金额列表头候选 */
const STATEMENT_VALUE_HEADERS = ['本年金额', '本年数', '本期金额', '年末余额', '期末余额', '金额'];

function byKey(list) {
  const map = new Map();
  for (const entry of list) map.set(entry.key, entry);
  return map;
}

const EXPENSE_BY_KEY = byKey(EXPENSE_DETAIL);
const BALANCE_BY_KEY = byKey(BALANCE_SHEET);
const INCOME_BY_KEY = byKey(INCOME_EXPENSE);

/** 统计各置信度取数点数量，供界面/日志展示"支持程度" */
function confidenceSummary() {
  const all = [...EXPENSE_DETAIL, ...BALANCE_SHEET, ...INCOME_EXPENSE,
    ...ACCOUNT_BALANCE.codes.map((c) => ({ ...c, key: `acc.${c.code}` }))];
  const tally = { high: 0, inferred: 0, unknown: 0 };
  for (const entry of all) tally[entry.confidence] = (tally[entry.confidence] || 0) + 1;
  return { total: all.length, ...tally };
}

module.exports = {
  EXPENSE_DETAIL,
  EXPENSE_WAGE,
  EXPENSE_GOODS,
  EXPENSE_PERSONAL,
  EXPENSE_CAPITAL,
  EXPENSE_BY_KEY,
  NAME_AMBIGUOUS_KEYS,
  REUSED_CELLS,
  ACCOUNT_BALANCE,
  BALANCE_SHEET,
  BALANCE_BY_KEY,
  INCOME_EXPENSE,
  INCOME_BY_KEY,
  EXPENSE_VALUE_HEADERS,
  EXPENSE_NAME_HEADERS,
  CODE_HEADERS,
  STATEMENT_VALUE_HEADERS,
  confidenceSummary,
};
