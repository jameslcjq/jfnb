// 角色判定纯逻辑（不依赖 electron，便于单测）。
// role 决定“谁在用”：operator=经办、school=学校；deploymentMode 决定“是否连接经办服务器”。
// 授权中心建议在 features 中签发：
//   { role: 'operator' | 'school', deployment_mode: 'managed' | 'standalone' }
// 旧授权没有 deployment_mode 时默认 managed，确保既有沭阳流程不变。
function resolveAppRole(status, roleOverride = '', deploymentModeOverride = '') {
  if (roleOverride === 'operator' || roleOverride === 'school') {
    const deploymentMode = roleOverride === 'operator' ? 'managed' : resolveDeploymentMode(status, deploymentModeOverride);
    return {
      role: roleOverride,
      deploymentMode,
      unitName: roleOverride === 'school' && deploymentMode === 'managed' ? String(status?.customer_name || '') : '',
    };
  }
  const features = (status && status.features) || {};
  const plan = String((status && status.plan) || '').toLowerCase();
  const isOperator = features.role === 'operator' || features.operator === true
    || plan.includes('operator') || plan.includes('经办');
  const role = isOperator ? 'operator' : 'school';
  const deploymentMode = role === 'operator' ? 'managed' : resolveDeploymentMode(status, deploymentModeOverride);
  return {
    role,
    deploymentMode,
    unitName: role === 'school' && deploymentMode === 'managed' ? String(status?.customer_name || '') : '',
  };
}

function resolveDeploymentMode(status, deploymentModeOverride = '') {
  if (deploymentModeOverride === 'managed' || deploymentModeOverride === 'standalone') return deploymentModeOverride;
  const features = (status && status.features) || {};
  const explicit = String(
    features.deployment_mode || features.deploymentMode || features.deployment || '',
  ).toLowerCase();
  if (explicit === 'standalone' || explicit === 'local' || explicit === 'single') return 'standalone';
  if (explicit === 'managed' || explicit === 'server') return 'managed';

  // 给较早期、已按套餐名称签发的通用授权一条兼容路径；新授权应明确使用 features.deployment_mode。
  const plan = String((status && status.plan) || '').toLowerCase();
  return plan.includes('standalone') || plan.includes('单机') ? 'standalone' : 'managed';
}

module.exports = { resolveAppRole, resolveDeploymentMode };
