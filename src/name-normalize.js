/**
 * 学校名归一化 —— 全项目唯一实现。
 *
 * 学校名是 watcher、数据库、授权单位校验、学校属性表、说明库之间的唯一连接键。
 * 此前有 5 处各自实现、且分成「只去空白」和「去空白+去括号」两套语义，
 * 同一所学校在不同环节可能一处匹配得上、另一处匹配不上。这里统一为一套。
 *
 * 规则：去掉所有空白字符，去掉中英文圆括号（保留括号内文字）。
 * 例：'沭阳县X小学（分校）' → '沭阳县X小学分校'
 */
function normalizeSchoolName(name) {
  return String(name || '').replace(/\s+/g, '').replace(/[（）()]/g, '').trim();
}

module.exports = { normalizeSchoolName };
