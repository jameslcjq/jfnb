// 为未通过的“提示”级校验生成可直接填入上报平台“情况说明”的文本。
// 提示级不要求改数（见 rule-engine-conventions）：软件按官方公式如实生成，
// 未落入“一般”预期区间/结构的，逐条产出标准说明供经办复核后上报。

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// 取比较左值作为“实际值”，供区间类说明引用。
function actual(item) {
  return round2(item && item.leftValue);
}

// 结构性/口径类：某项按官方口径本就为 0 或不对应，属实说明。
const STRUCTURAL = {
  12436: '本单位财政补助收入全部为一般公共预算教育经费，不含一般公共预算安排的科学技术、社会保障和就业、卫生健康、住房保障及其他经费，故“除一般公共预算教育经费外”部分为0，数据经核实属实。',
  292: '本校图书系历年零星购置、未单独作固定资产核算入账，故资产价值量表“图书和档案”原值为0；图书实物已在资产实物量表如实反映。',
  338: '本园为公办幼儿园，保育教育费由财政据实拨付并对在园幼儿减免，当年未向幼儿实际收取，故本年实收学费/保育教育费为0，数据属实。',
  369: '本校离退休人员经费由社会保险经办机构统一发放，年末在职离退休人员统计口径不含此部分，与支出表离退休费不完全对应，数据属实。',
  362: '本校编制外长期聘用人员工资福利已计入工资福利支出相应科目，未单列“外聘教职工工资福利支出”，该专项为0，数据属实。',
  11546: '本校在职教职工住房公积金由财政统发工资时集中代缴、未在本单位支出表单列，故住房公积金科目为0，数据属实。',
  12048: '本校非中等职业学校，无专用燃料消耗，专用燃料费为0，数据属实。',
  11759: '本校管理人员及管理费用中的工资福利已按实际归集填报，数据属实。',
  322176: '本校资本性支出对应资产已按实际验收入账时点计入相应资产科目，2-6表第7列本年账面增加数以实际入账为准，数据属实。',
  322177: '本校房屋建筑物购建/大型修缮支出对应资产尚在建或已按实际入账口径反映，数据属实。',
  322209: '本校本年处置房屋的净值与累计折旧关系按实际账面价值反映，数据属实。',
  322224: '本校在建工程转固金额按实际竣工验收入账，数据属实。',
  322225: '本校年末净资产按资产负债表实际数反映，数据属实。',
  322194: '本校资产处置费用与处置资产净值的差额，系处置资产清理费用及账面口径差异所致，数据属实。',
  299: '本校为九年一贯制学校，当年因招生及升学结构，小学或初中某一学段暂无在校学生，故该学段年末学生数为0，数据属实。',
};

// 收支结转类：市县单位收支差额为年末结转结余，已在支出表 84 行如实填报。
const CARRYOVER = new Set([323337, 323338, 323339, 3232323022, 322160]);

// 学生数波动类：年初/年末在校生变动超参考幅度，系生源及招生周期所致。
const ENROLLMENT = {
  3022: '本园',
  3031: '本校',
  808: '本校初中',
  809: '本校小学',
  3031321: '本校',
};

// 区间类：某项人均/生均指标超“一般”参考区间，带实际值说明数据属实。
function rangeExplanation(id, item) {
  const v = actual(item);
  const amount = v == null ? '' : `约 ${v} 元`;
  const map = {
    322003: `本校小学生均财政补助公用经费${amount}，系按财政据实安排的公用经费与在校生规模测算，超出 800–2200 元参考区间，数据属实。`,
    322004: `本校初中生均财政补助公用经费${amount}，系按财政据实安排的公用经费与在校生规模测算，超出 1100–2500 元参考区间，数据属实。`,
    322028: `本校小学生均一般公共预算公用经费基本支出${amount}，系按第3表商品服务与资本性支出扣除项目支出后据实测算，超出参考区间，数据属实。`,
    322029: `本校初中生均一般公共预算公用经费基本支出${amount}，系按第3表商品服务与资本性支出扣除项目支出后据实测算，超出参考区间，数据属实。`,
    322007: `本园幼儿园生均财政补助公用经费${amount}，系按财政据实安排的公用经费与在园幼儿数测算，超出 650–1600 元参考区间，数据属实。`,
    322018: `本园幼儿园生均实际收取保育费${amount}，系按实收及减免口径测算，超出 800–20000 元参考区间，数据属实。`,
    322026: `本校外聘教职工年人均工资${amount}，系按外聘工资福利与外聘人数测算，超出 12000–250000 元参考区间，数据属实。`,
    3642: `本园在职教职工年人均工资${amount}，系按工资福利与在职人数测算，超出 15000–250000 元参考区间，数据属实。`,
    322085: '本校大型修缮支出按实际发生额填报，未达5万元系单项修缮规模较小所致，数据属实。',
    322149: '本校房屋建筑物购建支出按实际发生额填报，未达5万元系单项购建规模较小所致，数据属实。',
  };
  return map[id] || null;
}

/**
 * 为单条未过的提示级规则生成情况说明。返回 null 表示走通用兜底。
 */
function explainRule(item) {
  const id = Number(item.id);
  if (STRUCTURAL[id]) return STRUCTURAL[id];
  if (CARRYOVER.has(id)) {
    return '本单位一般公共预算/教育事业费的收入与支出差额为当年财政资金结转结余，已在支出表第84行“年末预算结转结余”据实填报，收支不等属结转结余所致，数据属实。';
  }
  if (ENROLLMENT[id]) {
    return `${ENROLLMENT[id]}年末与年初学生（在园幼儿）数变动较大，系毕业离校（园）、新学年招生及生源流动所致，数据属实。`;
  }
  const range = rangeExplanation(id, item);
  if (range) return range;
  return null;
}

// 与 school-attributes 一致的学校名归一化（去空白、去括号），用于命中说明库的本校历史填报。
function normalizeSchoolName(name) {
  return String(name || '').replace(/\s+/g, '').replace(/[（）()]/g, '').trim();
}

/**
 * 按优先级为单条提示规则选取说明（context: { unitName, xxlbdm, library }）：
 * 1. 结转结余类固定用模板（成因是本次生成填报的 84 行，历史说明不适用）；
 * 2. 说明库·本校上年对同一规则的实际填报（县审核已接受，口径最贴本校）；
 * 3. 专用模板（结构性/区间/波动，带实际值）；
 * 4. 说明库·同类学校（xxlbdm）最常用填报，其次全县最常用；
 * 5. 通用兜底。
 */
function resolveExplanation(item, context = {}) {
  const id = Number(item.id);
  if (CARRYOVER.has(id)) return { explanation: explainRule(item), origin: '模板' };
  const entry = context.library?.validation?.[String(item.id)];
  const own = entry?.bySchool?.[normalizeSchoolName(context.unitName)];
  if (own) return { explanation: own, origin: '上年本校填报' };
  const template = explainRule(item);
  if (template) return { explanation: template, origin: '模板' };
  const typed = entry?.byType?.[String(context.xxlbdm || '')]?.[0]?.text;
  if (typed) return { explanation: typed, origin: '全县同类学校常用' };
  const common = entry?.top?.[0]?.text;
  if (common) return { explanation: common, origin: '全县常用' };
  return {
    explanation: `本项为按官方公式如实生成的客观数据，未落入“一般”参考${/大于|不为0|>|填报/.test(item.message) ? '预期' : '区间'}，经核实数据属实，特此说明。`,
    origin: '兜底',
  };
}

/**
 * 汇总一个报表的全部提示级说明。强制级不进说明清单（须改数，已由引擎处理/需人工核对）。
 * 返回 [{ id, source, message, explanation, origin }]。
 */
function buildExplanations(validation, context = {}) {
  if (!validation || !validation.enabled || !Array.isArray(validation.failed)) return [];
  return validation.failed
    .filter((item) => item.severity !== '强制')
    .map((item) => ({
      id: item.id,
      source: item.source,
      message: item.message,
      ...resolveExplanation(item, context),
    }));
}

/**
 * 数据变动原因建议：rows = [{ key:'j2_3|（三）商品和服务支出', name, prev, cur }]（prev 取上年经费年报、
 * cur 取本次生成值）。超过平台触发阈值（|增减%| >= threshold，或上年为0本年>0）的指标，按
 * 说明库给出建议变化原因：本校上年填报优先，其次该指标同方向全县最常用类别。
 */
function buildVarianceSuggestions(rows, context = {}) {
  const variance = context.library?.variance;
  if (!variance) return [];
  const threshold = Number(variance.threshold) || 10;
  const school = normalizeSchoolName(context.unitName);
  const suggestions = [];
  for (const row of rows || []) {
    const prev = Number(row.prev) || 0;
    const cur = Number(row.cur) || 0;
    if (prev === 0 && cur === 0) continue;
    const pct = prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
    if (pct != null && Math.abs(pct) < threshold) continue;
    const dir = cur >= prev ? '增加' : '减少';
    const entry = variance.indicators?.[row.key];
    const own = entry?.bySchool?.[school];
    // 过滤上年多选组合串（如“1.学生人数减少,2.其他”），只保留单项类别作建议。
    const commonReasons = (entry?.reasons?.[dir] || []).map((item) => item.text)
      .filter((text) => !text.includes(','));
    const reasons = [];
    if (own && own.dir === dir && own.reason) reasons.push(own.reason);
    for (const text of commonReasons) if (!reasons.includes(text)) reasons.push(text);
    suggestions.push({
      key: row.key,
      name: row.name,
      prev,
      cur,
      pct: pct == null ? null : Math.round(pct * 100) / 100,
      dir,
      reasons: reasons.slice(0, 3),
      note: own && own.dir === dir ? own.note || '' : '',
      ownLastYear: Boolean(own && own.dir === dir && own.reason),
    });
  }
  return suggestions;
}

/**
 * 生成可直接粘贴到上报平台的“校验情况说明 + 数据变动原因建议”纯文本。
 */
function explanationsText(unitName, validation, context = {}, varianceSuggestions = []) {
  const list = buildExplanations(validation, context);
  const lines = [`${unitName || ''} 经费年报校验情况说明`, ''];
  if (!list.length) {
    lines.push('本单位经费年报已通过全部已纳入校验的规则，无需填写校验情况说明。');
  } else {
    lines.push(`一、校验情况说明：本单位报表已通过全部强制校验；以下 ${list.length} 条为“提示”级（不要求修改数据，上报平台需逐条填写情况说明）：`, '');
    list.forEach((item, index) => {
      lines.push(`${index + 1}. 【${item.source} ${item.id}】${item.message}`);
      lines.push(`   情况说明：${item.explanation}${item.origin && item.origin !== '兜底' ? `（参考：${item.origin}）` : ''}`, '');
    });
  }
  if (varianceSuggestions.length) {
    lines.push('', `二、数据变动原因建议（平台“数据变动原因”表填写参考，本年数与上年经费年报对比超 ${Math.round(context.library?.variance?.threshold || 10)}% 的指标）：`, '');
    varianceSuggestions.forEach((item, index) => {
      const pctText = item.pct == null ? '上年为0' : `${item.pct > 0 ? '+' : ''}${item.pct.toFixed(2)}%`;
      lines.push(`${index + 1}. ${item.name}：上年 ${item.prev} → 本年 ${item.cur}（${item.dir} ${pctText}）`);
      lines.push(`   建议变化原因：${item.reasons.join('；') || '（库中无同方向参考，请按实际选择）'}${item.ownLastYear ? '（首项为上年本校填报）' : ''}`);
      if (item.note) lines.push(`   上年本校变化说明：${item.note}`);
      lines.push('');
    });
  }
  return lines.join('\r\n');
}

module.exports = { buildExplanations, explanationsText, explainRule, resolveExplanation, buildVarianceSuggestions };
