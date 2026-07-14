const fs = require('fs');

// 与 report-engine.normalizeSchoolName 保持一致：去空白、去中英文括号。
function normalizeSchoolName(name) {
  return String(name || '').replace(/\s+/g, '').replace(/[（）()]/g, '').trim();
}

const ATTRIBUTE_KEYS = ['dqdm', 'dwdm', 'xxlbdm', 'lsgxdm', 'cxfldm', 'phx'];

/**
 * 读取“学校属性.json”（由 scripts/build-school-attributes.js 从教财上报包提取），
 * 返回 归一化学校名 -> { dqdm, dwdm, xxlbdm, lsgxdm, cxfldm, phx } 的映射。
 * 文件缺失或损坏时返回空映射，不影响报表生成。
 */
function loadSchoolAttributes(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return {};
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    const map = {};
    for (const item of list) {
      const name = normalizeSchoolName(item && item.name);
      if (!name) continue;
      const attrs = {};
      for (const key of ATTRIBUTE_KEYS) {
        const value = item[key];
        if (value != null && String(value).trim() !== '') attrs[key] = String(value).trim();
      }
      if (Object.keys(attrs).length) map[name] = attrs;
    }
    return map;
  } catch {
    return {};
  }
}

module.exports = { loadSchoolAttributes, normalizeSchoolName, ATTRIBUTE_KEYS };
