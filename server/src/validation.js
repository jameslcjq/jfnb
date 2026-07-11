const { CONTROL_FIELDS } = require('./fields');

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function toBool(value) {
  return value === true || value === 1 || value === '1'
    || value === 'on' || value === 'true' || value === '是';
}

// 校验并归一化 controls（与桌面端 computePrivateDraft 入参一致）
function validateControls(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const errors = {};
  const controls = {};

  // 金额上限：千亿元。防止误输入超大数导致 JSON 溢出或汇总失真
  const MAX_AMOUNT = 100000000000;

  const checkAmount = (key, label, required, allowNegative = false) => {
    const n = toNumber(input[key]);
    if (n === null) {
      if (required) errors[key] = `${label}必填`;
      return required ? null : 0;
    }
    if (Number.isNaN(n)) { errors[key] = `${label}必须是数字`; return null; }
    if (!allowNegative && n < 0) { errors[key] = `${label}不能为负`; return null; }
    if (Math.abs(n) > MAX_AMOUNT) { errors[key] = `${label}超出合理范围`; return null; }
    // 金额统一保留两位小数（分），消除浮点尾差
    return Math.round(n * 100) / 100;
  };

  for (const f of CONTROL_FIELDS) {
    if (f.type === 'number') {
      const value = checkAmount(f.key, f.label, f.required, f.allowNegative);
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

function validateSubmission(raw) {
  const c = validateControls(raw);
  const m = validateMeta(raw);
  return {
    ok: c.ok && m.ok,
    errors: { ...c.errors, ...m.errors },
    controls: c.controls,
    meta: m.meta,
  };
}

module.exports = { validateControls, validateMeta, validateSubmission, toNumber, toBool };
