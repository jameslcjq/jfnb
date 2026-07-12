const STAGE_PARTS = Object.freeze({
  幼儿园: ['kindergarten'],
  普通小学: ['primary'],
  初级中学: ['junior'],
  高级中学: ['senior'],
  九年制学校: ['primary', 'junior'],
  完全中学: ['junior', 'senior'],
  十二年制学校: ['primary', 'junior', 'senior'],
});

const PART_FIELDS = Object.freeze({
  kindergarten: {
    total: 'kindergartenStudentCount',
    items: ['preschoolOneYearEndCount', 'nurseryEndCount'],
  },
  primary: {
    total: 'primaryStudentCount',
    items: ['primaryInclusiveStudentCount', 'primaryBoardingStudentCount'],
  },
  junior: {
    total: 'juniorStudentCount',
    items: ['juniorInclusiveStudentCount', 'juniorBoardingStudentCount'],
  },
  senior: {
    total: 'seniorStudentCount',
    items: ['seniorInclusiveStudentCount', 'seniorBoardingStudentCount'],
  },
});

const LABELS = Object.freeze({
  staffCount: '年末教职工数', teacherCount: '其中专任教师',
  externalLongTermStaffCount: '年末编制外长期聘用人员', retiredStaffCount: '年末离退休人员',
  studentCount: '年末学生总数', kindergartenStudentCount: '幼儿园人数',
  preschoolOneYearEndCount: '学前一年人数', nurseryEndCount: '托育幼儿人数',
  primaryStudentCount: '小学人数', primaryInclusiveStudentCount: '小学随班就读人数',
  primaryBoardingStudentCount: '小学寄宿人数', juniorStudentCount: '初中人数',
  juniorInclusiveStudentCount: '初中随班就读人数', juniorBoardingStudentCount: '初中寄宿人数',
  seniorStudentCount: '高中人数', seniorInclusiveStudentCount: '高中随班就读人数',
  seniorBoardingStudentCount: '高中寄宿人数',
});

function validateFormalControls(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const schoolStage = String(source.schoolStage || source.stage || '').trim();
  const parts = STAGE_PARTS[schoolStage];
  const errors = {};
  const controls = { schoolStage };

  if (!parts) errors.schoolStage = '请选择有效的学校类型';

  const readInteger = (key, required = true) => {
    const raw = source[key];
    if (raw === '' || raw == null) {
      if (required) errors[key] = `${LABELS[key] || key}必填，没有请填 0`;
      return null;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      errors[key] = `${LABELS[key] || key}必须是大于或等于 0 的整数`;
      return null;
    }
    controls[key] = value;
    return value;
  };

  const staff = readInteger('staffCount');
  const teacher = source.teacherCount === '' || source.teacherCount == null
    ? staff
    : readInteger('teacherCount');
  if (teacher != null) controls.teacherCount = teacher;
  readInteger('externalLongTermStaffCount');
  readInteger('retiredStaffCount');
  const total = readInteger('studentCount');

  const applicable = new Set(parts || []);
  let detailTotal = 0;
  for (const [part, fields] of Object.entries(PART_FIELDS)) {
    if (!applicable.has(part)) {
      controls[fields.total] = 0;
      for (const key of fields.items) controls[key] = 0;
      continue;
    }
    const partTotal = readInteger(fields.total);
    if (partTotal != null) detailTotal += partTotal;
    for (const key of fields.items) {
      const value = readInteger(key);
      if (value != null && partTotal != null && value > partTotal) {
        errors[key] = `${LABELS[key]}不能大于${LABELS[fields.total]}`;
      }
    }
  }

  if (staff != null && teacher != null && teacher > staff) {
    errors.teacherCount = '专任教师不能大于年末教职工数';
  }
  if (total != null && parts && parts.every((part) => Number.isInteger(controls[PART_FIELDS[part].total]))
      && detailTotal !== total) {
    errors.studentCount = `年末学生总数必须等于各适用学段之和（当前明细合计 ${detailTotal}）`;
  }

  return { ok: Object.keys(errors).length === 0, errors, controls };
}

module.exports = { validateFormalControls, STAGE_PARTS, PART_FIELDS };
