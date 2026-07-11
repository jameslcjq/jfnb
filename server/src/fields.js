// 关键数字段定义 —— 表单渲染与校验的唯一来源。
// key 与桌面端 computePrivateDraft(controls) 的字段严格一一对应。

const CONTROL_SECTIONS = [
  { id: 'people', title: '年末人员情况', desc: '填采集年度 12 月底的实有人数' },
  { id: 'stageDetail', title: '年末学段明细', desc: '系统会按所选学校类别显示需要填报的学段' },
  { id: 'income', title: '收入', desc: '本年实际发生数，没有的填 0' },
  { id: 'expense', title: '支出关键数', desc: '按账面全年合计填写' },
  { id: 'optional', title: '其他情况', desc: '没有的保持“无”，不用填金额' },
];

// type: 'number' 金额；'toggle' 开关（可带 amounts 金额明细）
// integer: true 表示人数类字段（必须为整数，页面不显示“元”）
const CONTROL_FIELDS = [
  { key: 'staffCount', label: '年末在职教职工', section: 'people', type: 'number', required: true, integer: true, hint: '含学校年末在岗教职工' },
  { key: 'teacherCount', label: '其中：教学人员', section: 'people', type: 'number', required: true, integer: true, hint: '不高于年末在职教职工' },
  { key: 'externalLongTermStaffCount', label: '年末编制外长期聘用人员', section: 'people', type: 'number', required: true, integer: true, hint: '没有填 0' },
  { key: 'retiredStaffCount', label: '年末离退休人员', section: 'people', type: 'number', required: true, integer: true, hint: '没有填 0' },
  { key: 'studentCount', label: '年末学生数合计', section: 'people', type: 'number', required: true, integer: true, hint: '采集年度 12 月底全校/全园在校学生或在园幼儿总数' },

  { key: 'kindergartenStudentCount', label: '幼儿园：年末在园幼儿人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['kindergarten'] },
  { key: 'preschoolOneYearEndCount', label: '幼儿园：年末学前一年在园儿童人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['kindergarten'] },
  { key: 'nurseryEndCount', label: '幼儿园：年末托育幼儿人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['kindergarten'], hint: '没有填 0' },
  { key: 'primaryStudentCount', label: '小学部：年末学生数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['primary'] },
  { key: 'primaryInclusiveStudentCount', label: '小学部：年末随班就读学生人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['primary'], hint: '没有填 0' },
  { key: 'primaryBoardingStudentCount', label: '小学部：年末寄宿学生人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['primary'], hint: '没有填 0' },
  { key: 'juniorStudentCount', label: '初中部：年末学生数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['junior'] },
  { key: 'juniorInclusiveStudentCount', label: '初中部：年末随班就读学生人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['junior'], hint: '没有填 0' },
  { key: 'juniorBoardingStudentCount', label: '初中部：年末寄宿学生人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['junior'], hint: '没有填 0' },
  { key: 'seniorStudentCount', label: '高中部：年末学生数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['senior'] },
  { key: 'seniorInclusiveStudentCount', label: '高中部：年末随班就读学生人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['senior'], hint: '没有填 0' },
  { key: 'seniorBoardingStudentCount', label: '高中部：年末寄宿学生人数', section: 'stageDetail', type: 'number', required: true, integer: true, stageParts: ['senior'], hint: '没有填 0' },

  { key: 'tuitionIncome', label: '学费 / 保育教育费收入', section: 'income', type: 'number', required: true, hint: '本年实际收取的学费或保育教育费合计' },
  { key: 'fiscalSubsidy', label: '财政补助收入', section: 'income', type: 'number', required: true, hint: '各级财政拨入的补助，没有填 0' },
  { key: 'otherIncome', label: '其他收入', section: 'income', type: 'number', required: false, hint: '利息、房租等其他收入，没有填 0' },

  { key: 'wageTotal', label: '全年工资福利总额', section: 'expense', type: 'number', required: true, hint: '教职工工资、社保、公积金等合计' },
  { key: 'capitalExpense', label: '资本性支出', section: 'expense', type: 'number', required: true, hint: '购建房屋、大型设备等，没有填 0' },
  { key: 'netBalance', label: '本年收支结余', section: 'expense', type: 'number', required: false, allowNegative: true, hint: '今年攒下的钱填正数，亏空填负数，收支基本持平填 0' },
  { key: 'hasHeating', label: '是否有供暖费支出', section: 'expense', type: 'toggle' },

  { key: 'hasRent', label: '是否有房租 / 租赁费', section: 'optional', type: 'toggle', amounts: [{ key: 'rentExpense', label: '房租 / 租赁费金额' }] },
  { key: 'hasLoan', label: '是否有贷款利息支出', section: 'optional', type: 'toggle', amounts: [{ key: 'interestExpense', label: '贷款利息支出金额' }] },
  { key: 'hasSponsorInput', label: '是否有举办者投入', section: 'optional', type: 'toggle', amounts: [{ key: 'sponsorInput', label: '举办者投入金额' }] },
  { key: 'hasSponsorWithdraw', label: '是否有举办者抽回', section: 'optional', type: 'toggle', amounts: [{ key: 'sponsorWithdraw', label: '举办者抽回金额' }] },
  { key: 'hasDonation', label: '是否有捐赠收支', section: 'optional', type: 'toggle', amounts: [{ key: 'donationIncome', label: '捐赠收入' }, { key: 'donationExpense', label: '捐赠支出' }] },
];

const SCHOOL_STAGE_PARTS = Object.freeze({
  幼儿园: Object.freeze(['kindergarten']),
  普通小学: Object.freeze(['primary']),
  九年制学校: Object.freeze(['primary', 'junior']),
  完全中学: Object.freeze(['junior', 'senior']),
  十二年制学校: Object.freeze(['primary', 'junior', 'senior']),
});

function normalizeSchoolStage(stage) {
  const value = String(stage ?? '').trim();
  return Object.prototype.hasOwnProperty.call(SCHOOL_STAGE_PARTS, value) ? value : '';
}

function stagePartsForSchoolStage(stage) {
  const normalized = normalizeSchoolStage(stage);
  return normalized ? [...SCHOOL_STAGE_PARTS[normalized]] : [];
}

function fieldAppliesToStage(field, stage) {
  if (!field.stageParts || field.stageParts.length === 0) return true;
  const parts = new Set(stagePartsForSchoolStage(stage));
  return field.stageParts.some((part) => parts.has(part));
}

const META_FIELDS = [
  { key: 'filler_name', label: '填表人姓名', type: 'text', required: true },
  { key: 'filler_phone', label: '填表人手机号', type: 'tel', required: true },
  { key: 'note', label: '备注（可选）', type: 'textarea', required: false },
];

// 所有数值型 controls 字段（含 toggle 下的金额），供合并汇总/展示复用
function numericControlKeys() {
  const keys = [];
  for (const f of CONTROL_FIELDS) {
    if (f.type === 'number') keys.push(f.key);
    for (const amt of f.amounts || []) keys.push(amt.key);
  }
  return keys;
}

function toggleControlKeys() {
  return CONTROL_FIELDS.filter((f) => f.type === 'toggle').map((f) => f.key);
}

module.exports = {
  CONTROL_SECTIONS,
  CONTROL_FIELDS,
  META_FIELDS,
  normalizeSchoolStage,
  stagePartsForSchoolStage,
  fieldAppliesToStage,
  numericControlKeys,
  toggleControlKeys,
};
