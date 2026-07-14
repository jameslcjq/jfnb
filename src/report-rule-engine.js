const fs = require('fs');
const XLSX = require('@e965/xlsx');
const { buildExplanations } = require('./rule-explanations');

const SUPPORTED_TABLES = {
  j2_1: { sheet: '人员情况表', codeColumn: 'I' },
  j2_2: { sheet: '收入情况表', codeColumn: 'I' },
  j2_3: { sheet: '支出情况表', codeColumn: 'E' },
  j2_4: { sheet: '费用情况表', codeColumn: 'E' },
  j2_5: { sheet: '债务情况表', codeColumn: 'C' },
  j2_6: { sheet: '资产价值量情况表', codeColumn: 'E' },
  j2_7: { sheet: '资产实物量情况表', codeColumn: 'I' },
};

// 基2-2附/基2-3附（非同级财政补助支出、项目支出明细等）。沭阳县公办中小学上报包
// 均不含独立附表文件、j2_2/j2_3 内也无附表字段，即附表为空；平台对空附表零错误。
// 引擎将附表字段解析为 0，使 480 条附表规则得到评估（而非跳过），确认空附表全过。
const APPENDIX_TABLES = new Set(['j2_2f', 'j2_3f']);

const CONTEXT_VARS = ['dqdm', 'xxlbdm', 'lsgxdm', 'dwdm', 'bbnd', 'cxfldm', 'phx'];
const CONTEXT_VAR_PATTERN = new RegExp(`\\b(${CONTEXT_VARS.join('|')})\\b`, 'g');

const FIELD_PATTERN = /\bj2_(\d+)(f)?_(\d+)_(\d+|all)\b/g;
const EPSILON = 0.01;

function cellNumber(value) {
  if (value == null || value === '--') return 0;
  if (typeof value === 'object' && value.v != null) return cellNumber(value.v);
  const result = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(result) ? result : 0;
}

function colToNumber(col) {
  let result = 0;
  for (const char of String(col || '').toUpperCase()) result = result * 26 + char.charCodeAt(0) - 64;
  return result;
}

function numberToCol(number) {
  let value = Number(number);
  let result = '';
  while (value > 0) {
    const rest = (value - 1) % 26;
    result = String.fromCharCode(65 + rest) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function normalizeCode(value) {
  const code = String(value == null ? '' : value).trim();
  if (!/^\d+$/.test(code)) return '';
  return String(Number(code)).padStart(2, '0');
}

function getCell(ws, addr) {
  return ws && ws[addr] ? ws[addr] : null;
}

function readRuleFile(filePath, source) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const workbook = XLSX.readFile(filePath, { cellFormula: false });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  const headerRow = rows.findIndex((row) => row.includes('公式'));
  if (headerRow < 0) return [];
  const header = rows[headerRow];
  const fields = Object.fromEntries(header.map((name, index) => [String(name).trim(), index]));
  const formulaIndex = fields.公式;
  if (formulaIndex == null) return [];

  return rows.slice(headerRow + 1)
    .filter((row) => String(row[formulaIndex] || '').trim())
    .map((row, index) => ({
      source,
      row: headerRow + index + 2,
      id: String(row[fields.公式编号] || `${source}-${index + 1}`).trim(),
      base: String(row[fields.基表] || '').trim(),
      formula: String(row[formulaIndex] || '').trim(),
      message: String(row[fields.校验信息] || '').trim(),
      severity: String(row[fields.类型] || '提示').trim() || '提示',
    }));
}

function buildSheetIndex(workbook, tableName, definition) {
  const ws = workbook.Sheets[definition.sheet];
  if (!ws || !ws['!ref']) return null;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const codeColNumber = colToNumber(definition.codeColumn) - 1;
  const rowByCode = new Map();
  let headerRow = -1;

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const code = String(getCell(ws, XLSX.utils.encode_cell({ r: row, c: codeColNumber }))?.v || '').trim();
    if (code === '丙') headerRow = row;
    const normalized = normalizeCode(code);
    if (normalized) rowByCode.set(normalized, row);
  }
  if (headerRow < 0) return null;

  const columnByPosition = new Map();
  for (let col = codeColNumber + 1; col <= range.e.c; col += 1) {
    const header = getCell(ws, XLSX.utils.encode_cell({ r: headerRow, c: col }));
    const position = Number(header?.v);
    if (Number.isInteger(position) && position > 0) columnByPosition.set(position, col);
  }
  return { tableName, ws, rowByCode, columnByPosition };
}

function buildWorkbookIndex(workbook) {
  const index = {};
  for (const [tableName, definition] of Object.entries(SUPPORTED_TABLES)) {
    const sheetIndex = buildSheetIndex(workbook, tableName, definition);
    if (sheetIndex) index[tableName] = sheetIndex;
  }
  return index;
}

function parseField(token) {
  const match = /^j2_(\d+)(f)?_(\d+)_(\d+|all)$/.exec(String(token || ''));
  if (!match) return null;
  return {
    tableName: `j2_${match[1]}${match[2] || ''}`,
    code: String(Number(match[3])).padStart(2, '0'),
    position: match[4] === 'all' ? 'all' : Number(match[4]),
  };
}

function getField(workbookIndex, token) {
  const parsed = parseField(token);
  if (!parsed) return null;
  // 空附表：无对应 sheet 时附表字段（含 _all 汇总）一律取 0。
  if (APPENDIX_TABLES.has(parsed.tableName) && !SUPPORTED_TABLES[parsed.tableName]) return 0;
  if (!SUPPORTED_TABLES[parsed.tableName]) return null;
  const sheet = workbookIndex[parsed.tableName];
  const row = sheet?.rowByCode.get(parsed.code);
  if (row == null) return null;
  if (parsed.position === 'all') {
    return [...sheet.columnByPosition.values()]
      .reduce((sum, col) => sum + cellNumber(getCell(sheet.ws, XLSX.utils.encode_cell({ r: row, c: col }))), 0);
  }
  const col = sheet.columnByPosition.get(parsed.position);
  if (col == null) return null;
  return cellNumber(getCell(sheet.ws, XLSX.utils.encode_cell({ r: row, c: col })));
}

function setField(workbookIndex, token, value) {
  const parsed = parseField(token);
  if (!parsed || parsed.position === 'all' || !SUPPORTED_TABLES[parsed.tableName]) return false;
  const sheet = workbookIndex[parsed.tableName];
  const row = sheet?.rowByCode.get(parsed.code);
  const col = sheet?.columnByPosition.get(parsed.position);
  if (row == null || col == null || !Number.isFinite(value)) return false;
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = getCell(sheet.ws, addr) || {};
  // 金额按分取整，避免浮点尾差写入正式报表。
  cell.v = Math.round(value * 100) / 100;
  cell.t = 'n';
  delete cell.f;
  sheet.ws[addr] = cell;
  return true;
}

function fieldTokens(expression) {
  return [...new Set(String(expression || '').match(FIELD_PATTERN) || [])];
}

function replaceExpressionFields(expression, workbookIndex) {
  let unresolved = false;
  const code = String(expression || '').replace(FIELD_PATTERN, (token) => {
    const value = getField(workbookIndex, token);
    if (value == null) {
      unresolved = true;
      return '0';
    }
    return `(${value})`;
  });
  return { code, unresolved };
}

function isSafeExpression(code) {
  const withoutStrings = String(code || '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '');
  if (!/^[\dA-Za-z_+\-*/().,<>=!&|\s]*$/.test(withoutStrings)) return false;
  const identifiers = withoutStrings.match(/\b[A-Za-z_]\w*\b/g) || [];
  return identifiers.every((identifier) => ['subs', 'compare', 'max', 'min', 'true', 'false'].includes(identifier));
}

function evaluateExpression(expression, workbookIndex, ruleContext) {
  const { code: withFields, unresolved } = replaceExpressionFields(expression, workbookIndex);
  if (unresolved) return { ok: false, reason: '字段未映射' };
  const contextValues = {};
  for (const name of CONTEXT_VARS) contextValues[name] = String(ruleContext[name] || '');
  for (const [name, value] of Object.entries(contextValues)) {
    if (new RegExp(`\\b${name}\\b`).test(withFields) && !value) {
      return { ok: false, reason: '条件参数缺失' };
    }
  }
  const withContext = withFields.replace(CONTEXT_VAR_PATTERN, (name) => JSON.stringify(contextValues[name]));
  if (!isSafeExpression(withContext)) return { ok: false, reason: '公式语法未支持' };
  const subs = (value, start, length) => String(value == null ? '' : value).slice(Number(start) - 1, Number(start) - 1 + Number(length));
  const compare = (value, ...candidates) => candidates.map(String).includes(String(value)) ? '1' : '0';
  try {
    const value = Function('subs', 'compare', 'max', 'min', `"use strict"; return (${withContext});`)(subs, compare, Math.max, Math.min);
    return { ok: true, value };
  } catch {
    return { ok: false, reason: '公式计算失败' };
  }
}

function splitIfFormula(formula) {
  const match = /^\s*if\s+([\s\S]+?)\s+then\s+([\s\S]+?)\s*$/i.exec(String(formula || ''));
  return match ? { condition: match[1].trim(), assertion: match[2].trim() } : { condition: '', assertion: String(formula || '').trim() };
}

function splitComparator(assertion) {
  // 顶层出现 &&/|| 的复合断言必须整体交给 evaluatePredicate 处理：
  // 若在此处截断为“首个比较符”，右操作数会带上剩余逻辑串，
  // 自动平衡会把布尔结果强转为 0/1 写进金额单元格。
  if (splitTopLevelLogical(assertion, '&&') || splitTopLevelLogical(assertion, '||')) return null;
  let level = 0;
  let quote = '';
  for (let index = 0; index < assertion.length; index += 1) {
    const char = assertion[index];
    if (quote) {
      if (char === quote && assertion[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') { level += 1; continue; }
    if (char === ')') { level -= 1; continue; }
    if (level !== 0) continue;
    for (const operator of ['==', '!=', '>=', '<=', '>', '<']) {
      if (assertion.slice(index, index + operator.length) === operator) {
        return { left: assertion.slice(0, index).trim(), operator, right: assertion.slice(index + operator.length).trim() };
      }
    }
  }
  return null;
}

function stripOuterParentheses(expression) {
  let text = String(expression || '').trim();
  while (text.startsWith('(') && text.endsWith(')')) {
    let level = 0;
    let quote = '';
    let enclosesAll = true;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        if (char === quote && text[index - 1] !== '\\') quote = '';
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '(') level += 1;
      if (char === ')') level -= 1;
      if (level === 0 && index < text.length - 1) { enclosesAll = false; break; }
    }
    if (!enclosesAll) break;
    text = text.slice(1, -1).trim();
  }
  return text;
}

function splitTopLevelLogical(expression, operator) {
  const parts = [];
  let level = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (quote) {
      if (char === quote && expression[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') { level += 1; continue; }
    if (char === ')') { level -= 1; continue; }
    if (level === 0 && expression.slice(index, index + operator.length) === operator) {
      parts.push(expression.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }
  if (!parts.length) return null;
  parts.push(expression.slice(start).trim());
  return parts;
}

function comparePredicateValues(left, operator, right) {
  if (typeof left === 'number' && typeof right === 'number') {
    // 与自动平衡阈值 EPSILON 一致：分以内的差额视为相等，
    // 避免出现“判为不等却又不足以触发调平”的死区。
    const tolerance = EPSILON;
    if (operator === '==') return Math.abs(left - right) <= tolerance;
    if (operator === '!=') return Math.abs(left - right) > tolerance;
    if (operator === '>=') return left >= right - tolerance;
    if (operator === '<=') return left <= right + tolerance;
    if (operator === '>') return left > right;
    if (operator === '<') return left < right;
  }
  if (operator === '==') return left === right;
  if (operator === '!=') return left !== right;
  if (operator === '>=') return left >= right;
  if (operator === '<=') return left <= right;
  if (operator === '>') return left > right;
  if (operator === '<') return left < right;
  return false;
}

function evaluatePredicate(expression, workbookIndex, ruleContext) {
  const text = stripOuterParentheses(expression);
  const orParts = splitTopLevelLogical(text, '||');
  if (orParts) {
    const values = orParts.map((part) => evaluatePredicate(part, workbookIndex, ruleContext));
    const error = values.find((value) => !value.ok);
    return error || { ok: true, value: values.some((value) => value.value) };
  }
  const andParts = splitTopLevelLogical(text, '&&');
  if (andParts) {
    const values = andParts.map((part) => evaluatePredicate(part, workbookIndex, ruleContext));
    const error = values.find((value) => !value.ok);
    return error || { ok: true, value: values.every((value) => value.value) };
  }
  const comparison = splitComparator(text);
  if (!comparison) {
    const value = evaluateExpression(text, workbookIndex, ruleContext);
    return value.ok ? { ok: true, value: Boolean(value.value) } : value;
  }
  const left = evaluateExpression(comparison.left, workbookIndex, ruleContext);
  const right = evaluateExpression(comparison.right, workbookIndex, ruleContext);
  if (!left.ok || !right.ok) return { ok: false, reason: left.reason || right.reason };
  return { ok: true, value: comparePredicateValues(left.value, comparison.operator, right.value) };
}

function evaluateScalarRule(rule, workbookIndex, ruleContext) {
  const parts = splitIfFormula(rule.formula);
  if (parts.condition) {
    const condition = evaluatePredicate(parts.condition, workbookIndex, ruleContext);
    if (!condition.ok) return { status: 'skipped', reason: condition.reason, parts };
    if (!condition.value) return { status: 'not-applicable', parts };
  }
  const comparison = splitComparator(parts.assertion);
  const assertion = evaluatePredicate(parts.assertion, workbookIndex, ruleContext);
  if (!assertion.ok) return { status: 'skipped', reason: assertion.reason, parts, comparison };
  let leftValue;
  let rightValue;
  if (comparison) {
    const left = evaluateExpression(comparison.left, workbookIndex, ruleContext);
    const right = evaluateExpression(comparison.right, workbookIndex, ruleContext);
    if (left.ok && right.ok) {
      leftValue = left.value;
      rightValue = right.value;
    }
  }
  return {
    status: Boolean(assertion.value) ? 'passed' : 'failed',
    parts,
    comparison,
    leftValue,
    rightValue,
  };
}

function expandRule(rule, workbookIndex) {
  const allTokens = fieldTokens(rule.formula).filter((token) => parseField(token)?.position === 'all');
  if (!allTokens.length) return [rule];
  let positions = null;
  for (const token of allTokens) {
    const parsed = parseField(token);
    const available = new Set(workbookIndex[parsed.tableName]?.columnByPosition.keys() || []);
    positions = positions == null ? available : new Set([...positions].filter((position) => available.has(position)));
  }
  return [...(positions || [])].sort((a, b) => a - b).map((position) => ({
    ...rule,
    formula: rule.formula.replace(FIELD_PATTERN, (token) => {
      const parsed = parseField(token);
      if (parsed?.position !== 'all') return token;
      return `${parsed.tableName}_${parsed.code}_${String(position).padStart(2, '0')}`;
    }),
    expandedPosition: position,
  }));
}

function evaluateRule(rule, workbookIndex, ruleContext) {
  const variants = expandRule(rule, workbookIndex);
  if (!variants.length) return { status: 'skipped', reason: '字段未映射' };
  const results = variants.map((variant) => ({
    variant,
    result: evaluateScalarRule(variant, workbookIndex, ruleContext),
  }));
  const failed = results.filter((item) => item.result.status === 'failed');
  if (failed.length) {
    return {
      ...failed[0].result,
      formula: failed[0].variant.formula,
      failedPositions: failed.map((item) => item.variant.expandedPosition).filter(Boolean),
    };
  }
  const passed = results.find((item) => item.result.status === 'passed');
  if (passed) return { ...passed.result, formula: passed.variant.formula };
  const skipped = results.find((item) => item.result.status === 'skipped');
  if (skipped) return skipped.result;
  return { status: 'not-applicable' };
}

function singleField(expression) {
  const text = String(expression || '').trim().replace(/^\((.*)\)$/, '$1').trim();
  return /^j2_[1-7]_(?:\d+)_(?:\d+)$/.test(text) ? text : '';
}

function isSafeDerivedField(token) {
  const parsed = parseField(token);
  return parsed && parsed.position !== 'all' && SUPPORTED_TABLES[parsed.tableName];
}

function tryAutoBalance(result, workbookIndex, rule) {
  // 只有强制级公式才要求数据必须一致，提示级未过仅需上报说明，不改数。
  if (rule.severity !== '强制') return null;
  if (result.status !== 'failed' || result.comparison?.operator !== '==') return null;
  const { left, right } = result.comparison;
  const leftTarget = singleField(left);
  const rightTarget = singleField(right);
  const target = isSafeDerivedField(leftTarget) && fieldTokens(right).length >= 2 ? leftTarget
    : isSafeDerivedField(rightTarget) && fieldTokens(left).length >= 2 ? rightTarget
      : '';
  const sourceExpression = target === leftTarget ? right : left;
  if (!target || !fieldTokens(sourceExpression).length) return null;
  const targetTable = parseField(target).tableName;
  if (fieldTokens(sourceExpression).some((token) => parseField(token)?.tableName !== targetTable)) return null;
  const source = evaluateExpression(sourceExpression, workbookIndex, {});
  if (!source.ok || !Number.isFinite(Number(source.value))) return null;
  const before = getField(workbookIndex, target);
  const after = Math.round(Number(source.value) * 100) / 100;
  if (before == null || Math.abs(before - after) <= EPSILON || !setField(workbookIndex, target, after)) return null;
  return { ruleId: rule.id, source: rule.source, target, before, after, message: rule.message };
}

function syncComputedFromWorkbook(computed, workbook) {
  const sheetMap = Object.values(SUPPORTED_TABLES).reduce((result, item) => ({ ...result, [item.sheet]: item.sheet }), {});
  for (const [sheetName, computedName] of Object.entries(sheetMap)) {
    const data = computed[computedName];
    const ws = workbook.Sheets[sheetName];
    if (!data || !ws) continue;
    for (const key of Object.keys(data)) {
      if (!/^[A-Z]+\d+$/.test(key) || !ws[key]) continue;
      data[key] = cellNumber(ws[key]);
    }
  }
}

function isSupportedRule(rule) {
  const tokens = fieldTokens(rule.formula);
  if (!tokens.length) return false;
  return tokens.every((token) => {
    const parsed = parseField(token);
    return parsed && (Boolean(SUPPORTED_TABLES[parsed.tableName]) || APPENDIX_TABLES.has(parsed.tableName));
  });
}

function applyReportRules({ workbook, computed, ruleFiles = [], ruleContext = {}, explanationContext = {} }) {
  const rules = ruleFiles.flatMap(({ path, source }) => readRuleFile(path, source));
  const result = {
    enabled: rules.length > 0,
    loaded: rules.length,
    checked: 0,
    passed: 0,
    adjusted: [],
    failed: [],
    skipped: { unsupported: 0, condition: 0, syntax: 0 },
    sources: [...new Set(ruleFiles.filter((item) => item.path && fs.existsSync(item.path)).map((item) => item.source))],
  };
  if (!rules.length) return result;

  const workbookIndex = buildWorkbookIndex(workbook);
  const supported = rules.filter(isSupportedRule);
  result.skipped.unsupported = rules.length - supported.length;

  const evaluateAllStatuses = () => supported.map((rule) => evaluateRule(rule, workbookIndex, ruleContext).status);
  const statusesBeforeBalance = evaluateAllStatuses();

  // 只对强制级等式做自动平衡：目标是由同表两个及以上明细推导出的单一汇总字段。
  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;
    for (const rule of supported) {
      for (const variant of expandRule(rule, workbookIndex)) {
        const evaluated = evaluateScalarRule(variant, workbookIndex, ruleContext);
        const adjustment = tryAutoBalance(evaluated, workbookIndex, variant);
        if (adjustment) {
          result.adjusted.push(adjustment);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // 护栏：调平若把原本通过的强制规则改成失败（明细缺项而总数本对的场景），整体回滚。
  if (result.adjusted.length) {
    const statusesAfterBalance = evaluateAllStatuses();
    const regressed = supported.filter((rule, index) => rule.severity === '强制'
      && statusesBeforeBalance[index] !== 'failed'
      && statusesAfterBalance[index] === 'failed');
    if (regressed.length) {
      for (const adjustment of [...result.adjusted].reverse()) {
        setField(workbookIndex, adjustment.target, adjustment.before);
      }
      result.balanceReverted = {
        count: result.adjusted.length,
        brokenRules: regressed.map((rule) => `${rule.source} ${rule.id}`),
      };
      result.adjusted = [];
    }
  }

  for (const rule of supported) {
    const evaluated = evaluateRule(rule, workbookIndex, ruleContext);
    if (evaluated.status === 'passed') {
      result.checked += 1;
      result.passed += 1;
      continue;
    }
    if (evaluated.status === 'not-applicable') continue;
    if (evaluated.status === 'skipped') {
      result.skipped[['字段未映射', '条件参数缺失'].includes(evaluated.reason) ? 'condition' : 'syntax'] += 1;
      continue;
    }
    result.checked += 1;
    result.failed.push({
      id: rule.id,
      source: rule.source,
      severity: rule.severity === '强制' ? '强制' : '提示',
      message: rule.message || rule.formula,
      formula: rule.formula,
      failedPositions: evaluated.failedPositions || [],
      leftValue: evaluated.leftValue,
      rightValue: evaluated.rightValue,
    });
  }

  syncComputedFromWorkbook(computed, workbook);
  // 强制级排在前面：只有强制未过才需要修改数据，提示未过仅需上报时填写说明。
  result.failed.sort((a, b) => (a.severity === '强制' ? 0 : 1) - (b.severity === '强制' ? 0 : 1));
  const forcedFailed = result.failed.filter((item) => item.severity === '强制').length;
  const hintFailed = result.failed.length - forcedFailed;
  result.summary = `已校验 ${result.checked} 条，通过 ${result.passed} 条，自动平衡 ${result.adjusted.length} 项；`
    + `强制未过 ${forcedFailed} 条（须修改数据），提示未过 ${hintFailed} 条（无须改数，上报时填写说明即可）。`;
  // 为提示级未过项生成可直接上报的情况说明（优先本校上年实际填报，见 rule-explanations）。
  result.explanations = buildExplanations(result, {
    ...explanationContext,
    xxlbdm: explanationContext.xxlbdm || ruleContext.xxlbdm || '',
  });
  return result;
}

function validationWarnings(validation) {
  if (!validation?.enabled) return [];
  const messages = [validation.summary];
  const forced = validation.failed.filter((item) => item.severity === '强制');
  const hints = validation.failed.filter((item) => item.severity !== '强制');
  for (const item of forced.slice(0, 12)) {
    messages.push(`强制校验未通过，须修改数据（${item.source} ${item.id}）：${item.message}`);
  }
  if (forced.length > 12) messages.push(`其余 ${forced.length - 12} 条强制未过规则请在“经费年报”预览中复核。`);
  for (const item of hints.slice(0, Math.max(0, 6 - Math.min(forced.length, 6)))) {
    messages.push(`提示校验未通过，无须改数、备好说明（${item.source} ${item.id}）：${item.message}`);
  }
  if (hints.length) messages.push(`共 ${hints.length} 条提示级未过：提示级不要求修改数据，上报平台对应条目填写情况说明即可。`);
  if (validation.balanceReverted) {
    messages.push(`自动平衡已回滚 ${validation.balanceReverted.count} 项：调整会导致 ${validation.balanceReverted.brokenRules.slice(0, 3).join('、')} 等强制规则由通过转为失败，请人工核对总数与明细。`);
  }
  if (validation.skipped.condition > 0) {
    messages.push(`因缺少学校属性（学校类别/隶属关系/单位代码/城乡分类等）跳过 ${validation.skipped.condition} 条规则，请检查“学校属性”数据是否包含本单位。`);
  }
  if (validation.skipped.unsupported > 0) messages.push(`附表及非中小学表等 ${validation.skipped.unsupported} 条规则暂未纳入本轮校验。`);
  return messages;
}

module.exports = {
  applyReportRules,
  validationWarnings,
  readRuleFile,
};
