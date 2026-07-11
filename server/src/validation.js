const {
  CONTROL_FIELDS,
  fieldAppliesToStage,
  normalizeSchoolStage,
  stagePartsForSchoolStage,
} = require('./fields');

const STAGE_COUNT_FIELDS = Object.freeze({
  kindergarten: 'kindergartenStudentCount',
  primary: 'primaryStudentCount',
  junior: 'juniorStudentCount',
  senior: 'seniorStudentCount',
});

const STAGE_SUBITEM_FIELDS = Object.freeze({
  kindergarten: Object.freeze(['preschoolOneYearEndCount', 'nurseryEndCount']),
  primary: Object.freeze(['primaryInclusiveStudentCount', 'primaryBoardingStudentCount']),
  junior: Object.freeze(['juniorInclusiveStudentCount', 'juniorBoardingStudentCount']),
  senior: Object.freeze(['seniorInclusiveStudentCount', 'seniorBoardingStudentCount']),
});

const CONTROL_LABELS = new Map(CONTROL_FIELDS.map((field) => [field.key, field.label]));

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function toBool(value) {
  return value === true || value === 1 || value === '1'
    || value === 'on' || value === 'true' || value === '是';
}

// 仅人员采集范围（公办有报表校）需要校验/保留的分区；财务数走五件套不采集
const PEOPLE_SECTIONS = new Set(['people', 'stageDetail']);

// 校验并归一化 controls（与桌面端 computePrivateDraft 入参一致）
// context.scope: 'full'（默认，全部字段）| 'people'（仅人员与学段明细，财务字段置 0 且不校验）
function validateControls(raw, context = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const errors = {};
  const controls = {};
  const scope = context && context.scope === 'people' ? 'people' : 'full';
  const hasStageContext = !!context && typeof context === 'object'
    && Object.prototype.hasOwnProperty.call(context, 'stage');
  const stage = hasStageContext ? normalizeSchoolStage(context.stage) : '';

  // 表单路由始终显式传入学校学段；未知/空学段必须阻止真实数据入库。
  // 不带 stage 属性的调用保留为纯 controls 校验模式，兼容内部单元测试与复用代码。
  if (hasStageContext) {
    if (stage) controls.schoolStage = stage;
    else errors.schoolStage = '学校学段未配置或不受支持，请联系管理员维护学校学段后再填报';
  }

  // 金额上限：千亿元。防止误输入超大数导致 JSON 溢出或汇总失真
  const MAX_AMOUNT = 100000000000;

  const checkAmount = (key, label, required, allowNegative = false, integer = false) => {
    const n = toNumber(input[key]);
    if (n === null) {
      if (required) errors[key] = `${label}必填`;
      return required ? null : 0;
    }
    if (Number.isNaN(n)) { errors[key] = `${label}必须是数字`; return null; }
    if (!allowNegative && n < 0) { errors[key] = `${label}不能为负`; return null; }
    if (Math.abs(n) > MAX_AMOUNT) { errors[key] = `${label}超出合理范围`; return null; }
    if (integer) {
      if (!Number.isInteger(n)) { errors[key] = `${label}必须是整数`; return null; }
      return n;
    }
    // 金额统一保留两位小数（分），消除浮点尾差
    return Math.round(n * 100) / 100;
  };

  for (const f of CONTROL_FIELDS) {
    const skippedByScope = scope === 'people' && !PEOPLE_SECTIONS.has(f.section);
    if (skippedByScope || !fieldAppliesToStage(f, stage)) {
      if (f.type === 'number') controls[f.key] = 0;
      if (f.type === 'toggle') {
        controls[f.key] = false;
        for (const amt of f.amounts || []) controls[amt.key] = 0;
      }
      continue;
    }
    if (f.type === 'number') {
      const value = checkAmount(f.key, f.label, f.required, f.allowNegative, f.integer);
      if (value !== null) controls[f.key] = value;
    } else if (f.type === 'toggle') {
      const on = toBool(input[f.key]);
      controls[f.key] = on;
      for (const amt of f.amounts || []) {
        if (on) {
          const value = checkAmount(amt.key, amt.label, true);
          if (value !== null) controls[amt.key] = value;
        } else {
          controls[amt.key] = 0;
        }
      }
    }
  }

  const setError = (key, message) => {
    if (!errors[key]) errors[key] = message;
  };

  if (Number.isFinite(controls.teacherCount) && Number.isFinite(controls.staffCount)
      && controls.teacherCount > controls.staffCount) {
    setError('teacherCount', '教学人员不能大于年末在职教职工');
  }

  if (stage) {
    const stageParts = stagePartsForSchoolStage(stage);
    const stageCountKeys = stageParts.map((part) => STAGE_COUNT_FIELDS[part]);
    const hasCompleteStageCounts = stageCountKeys.every((key) => Number.isFinite(controls[key]));
    if (hasCompleteStageCounts && Number.isFinite(controls.studentCount)) {
      const detailTotal = stageCountKeys.reduce((total, key) => total + controls[key], 0);
      if (detailTotal !== controls.studentCount) {
        setError('studentCount', `年末学生数合计必须等于各适用学段学生数之和（当前明细合计 ${detailTotal}）`);
      }
    }

    for (const part of stageParts) {
      const totalKey = STAGE_COUNT_FIELDS[part];
      const stageTotal = controls[totalKey];
      if (!Number.isFinite(stageTotal)) continue;
      for (const itemKey of STAGE_SUBITEM_FIELDS[part]) {
        const itemValue = controls[itemKey];
        if (Number.isFinite(itemValue) && itemValue > stageTotal) {
          setError(itemKey, `${CONTROL_LABELS.get(itemKey)}不能大于${CONTROL_LABELS.get(totalKey)}`);
        }
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, controls };
}

function validateMeta(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const errors = {};
  const meta = {};

  const name = String(input.filler_name || '').trim();
  if (!name) errors.filler_name = '填表人姓名必填';
  else meta.filler_name = name.slice(0, 50);

  const phone = String(input.filler_phone || '').trim();
  if (!/^1\d{10}$/.test(phone)) errors.filler_phone = '请输入 11 位手机号';
  else meta.filler_phone = phone;

  meta.note = String(input.note || '').trim().slice(0, 500);

  return { ok: Object.keys(errors).length === 0, errors, meta };
}

function validateSubmission(raw, context = {}) {
  const c = validateControls(raw, context);
  const m = validateMeta(raw);
  return {
    ok: c.ok && m.ok,
    errors: { ...c.errors, ...m.errors },
    controls: c.controls,
    meta: m.meta,
  };
}

module.exports = { validateControls, validateMeta, validateSubmission, toNumber, toBool };
