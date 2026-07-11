// 角色判定纯逻辑（不依赖 electron，便于单测）。
// 经办版=全功能；学校版=只处理本授权单位。
// 判定：roleOverride 优先；否则按授权 features.role=operator / features.operator=true /
// plan 含 operator 或 “经办” → 经办版，其余为学校版。学校版单位名取授权 customer_name。
function resolveAppRole(status, roleOverride = '') {
  if (roleOverride === 'operator' || roleOverride === 'school') {
    return { role: roleOverride, unitName: roleOverride === 'school' ? String(status?.customer_name || '') : '' };
  }
  const features = (status && status.features) || {};
  const plan = String((status && status.plan) || '').toLowerCase();
  const isOperator = features.role === 'operator' || features.operator === true
    || plan.includes('operator') || plan.includes('经办');
  const role = isOperator ? 'operator' : 'school';
  return { role, unitName: role === 'school' ? String(status?.customer_name || '') : '' };
}

module.exports = { resolveAppRole };
