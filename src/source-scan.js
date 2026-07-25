/**
 * 源报表内容扫描原语（厂商无关）
 *
 * 设计前提：中科/博思/用友/久其都执行《政府会计制度》和《政府支出经济分类科目》，
 * 因此**科目编码和科目名称是全国统一的，只有 Excel 排版不同**。
 * 本模块只按内容定位，不出现任何固定行列号：
 *   - 列：按表头文字找（"期末余额""本年累计"…）
 *   - 行：按科目编码找（首选）或科目名称找（回退）
 *
 * 同时兼容单栏与多栏（左右分栏）打印版式：扫描时不限定列，
 * 全表找"编码单元格"，金额取该编码所在栏的金额列。
 */

const XLSX = require('@e965/xlsx');

/** 单元格取值（去空白） */
function cellText(sheet, r, c) {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell || cell.v == null) return '';
  return String(cell.v).trim();
}

function cellNumber(sheet, r, c) {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell || cell.v == null) return null;
  if (typeof cell.v === 'number') return cell.v;
  // 会计口径：括号表示负数；千分位逗号；空串按 null（区别于 0）
  const raw = String(cell.v).trim().replace(/,/g, '');
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw);
  const digits = raw.replace(/[()\-\s￥¥]/g, '');
  if (!/^\d*\.?\d+$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function sheetRange(sheet) {
  return XLSX.utils.decode_range(sheet['!ref'] || 'A1');
}

/** 归一化文本用于比较：去空白、全角括号转半角、去"其中：""小计"等修饰 */
function normalizeLabel(text) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/^[0-9一二三四五六七八九十]+[、.．]/, '')
    .replace(/^其中[:：]/, '')
    .replace(/[:：]$/, '');
}

/** 是否像科目编码：3-8 位纯数字（30101 / 160101 / 302） */
function isAccountCode(text) {
  return /^\d{3,8}$/.test(text);
}

/** 单元格是否为文本型（编码通常导出为文本；金额一定是数值型） */
function cellIsText(sheet, r, c) {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return false;
  return cell.t === 's' || typeof cell.v === 'string';
}

/**
 * 判定某格是否为"编码单元格"。
 *
 * ⚠️ 不能只看长得像不像编码：金额本身就是 3-8 位数字（如 40000、5100101），
 * 会被误判成编码，进而把真编码的金额列当成分栏边界切掉，取数变 0。
 * 因此要求二者之一：
 *   - 该格落在按表头识别出的编码列里，或
 *   - 该格是文本型（数值型金额被排除）
 */
function isCodeCell(sheet, r, c, codeCols) {
  const text = cellText(sheet, r, c);
  if (!isAccountCode(text)) return false;
  if (codeCols && codeCols.length) return codeCols.includes(c);
  return cellIsText(sheet, r, c);
}

/**
 * 在表头区域按关键词找列号。
 * @param sheet
 * @param keywords 关键词数组，按优先级排列；命中任一即返回该列
 * @param opts.searchRows 表头搜索行数上限（默认前 12 行）
 * @param opts.after 只在此列号之后查找（用于多栏版式定位右栏金额列）
 * @returns {{col:number,row:number,text:string}|null}
 */
function findColumnByHeader(sheet, keywords, opts = {}) {
  if (!sheet) return null;
  const range = sheetRange(sheet);
  const maxRow = Math.min(range.e.r, (opts.searchRows ?? 12) - 1 + range.s.r);
  const startCol = opts.after != null ? opts.after + 1 : range.s.c;
  for (const keyword of keywords) {
    const key = normalizeLabel(keyword);
    for (let r = range.s.r; r <= maxRow; r++) {
      for (let c = startCol; c <= range.e.c; c++) {
        const text = normalizeLabel(cellText(sheet, r, c));
        if (text && text.includes(key)) return { col: c, row: r, text };
      }
    }
  }
  return null;
}

/**
 * 扫描一张表里所有"编码 → 金额"对，兼容多栏版式。
 *
 * 算法：逐行逐列找编码单元格；找到后在**同一行、该编码右侧**取第一个数值单元格作为金额，
 * 但不越过下一个编码单元格（多栏版式的分栏边界）。
 * 若给出 valueHeaders，则优先用表头定位的金额列（同栏内最近的那一列）。
 *
 * @returns {{byCode:Object<string,number>, codeCells:Array}}
 */
function scanCodeValueMap(sheet, opts = {}) {
  const byCode = {};
  const codeCells = [];
  if (!sheet) return { byCode, codeCells };
  const range = sheetRange(sheet);

  // 先定位所有金额列与编码列（可能有多栏，故各自收集全部命中列）
  const collectCols = (headers) => {
    const cols = [];
    if (!Array.isArray(headers) || !headers.length) return cols;
    let after = null;
    for (;;) {
      const hit = findColumnByHeader(sheet, headers, { after, searchRows: opts.searchRows });
      if (!hit) break;
      cols.push(hit.col);
      after = hit.col;
    }
    return cols;
  };
  const valueCols = collectCols(opts.valueHeaders);
  // 编码列不能与金额列重叠（"科目编码"与"金额"表头措辞不同，重叠说明识别有误）
  const codeCols = collectCols(opts.codeHeaders).filter((c) => !valueCols.includes(c));

  for (let r = range.s.r; r <= range.e.r; r++) {
    // 该行所有编码单元格的列号，用于确定分栏边界
    const codeColsInRow = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (valueCols.includes(c)) continue; // 金额列永远不是编码列
      if (isCodeCell(sheet, r, c, codeCols)) codeColsInRow.push(c);
    }
    for (let i = 0; i < codeColsInRow.length; i++) {
      const codeCol = codeColsInRow[i];
      const code = cellText(sheet, r, codeCol);
      // 本栏右边界：下一个编码列，或表尾
      const boundary = i + 1 < codeColsInRow.length ? codeColsInRow[i + 1] - 1 : range.e.c;

      let value = null;
      // 优先：落在本栏区间内的、表头识别出的金额列
      const preferred = valueCols.filter((c) => c > codeCol && c <= boundary);
      for (const c of preferred) {
        const v = cellNumber(sheet, r, c);
        if (v != null) { value = v; break; }
      }
      // 回退：本栏区间内第一个数值单元格
      if (value == null) {
        for (let c = codeCol + 1; c <= boundary; c++) {
          const v = cellNumber(sheet, r, c);
          if (v != null) { value = v; break; }
        }
      }

      // 同一编码出现多次（分栏重复/明细汇总）时累加，避免丢数
      if (byCode[code] == null) byCode[code] = value ?? 0;
      else byCode[code] += value ?? 0;
      codeCells.push({ code, row: r, col: codeCol, value: value ?? 0 });
    }
  }
  return { byCode, codeCells };
}

/**
 * 扫描"项目名称 → 金额"对。用于源表不带编码列时的回退。
 * 名称列由表头关键词定位；未命中时取每行第一个"非数字文本"单元格。
 */
function scanNameValueMap(sheet, opts = {}) {
  const byName = {};
  if (!sheet) return { byName };
  const range = sheetRange(sheet);
  const nameHit = opts.nameHeaders
    ? findColumnByHeader(sheet, opts.nameHeaders, { searchRows: opts.searchRows })
    : null;
  const valueHit = opts.valueHeaders
    ? findColumnByHeader(sheet, opts.valueHeaders, { searchRows: opts.searchRows })
    : null;

  for (let r = range.s.r; r <= range.e.r; r++) {
    let nameCol = nameHit ? nameHit.col : null;
    if (nameCol == null) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const text = cellText(sheet, r, c);
        if (text && !isAccountCode(text) && cellNumber(sheet, r, c) == null) { nameCol = c; break; }
      }
    }
    if (nameCol == null) continue;
    const name = normalizeLabel(cellText(sheet, r, nameCol));
    if (!name) continue;

    let value = null;
    if (valueHit && valueHit.col > nameCol) value = cellNumber(sheet, r, valueHit.col);
    if (value == null) {
      for (let c = nameCol + 1; c <= range.e.c; c++) {
        const v = cellNumber(sheet, r, c);
        if (v != null) { value = v; break; }
      }
    }
    if (value == null) continue;
    if (byName[name] == null) byName[name] = value;
    else byName[name] += value;
  }
  return { byName };
}

/**
 * 按项目名称找行号（用于资产负债表/收入费用表这类"行次+名称"报表）。
 * labels 支持多个别名，按顺序尝试；返回首个命中行。
 */
function findRowByLabel(sheet, labels, opts = {}) {
  if (!sheet) return null;
  const range = sheetRange(sheet);
  const wanted = (Array.isArray(labels) ? labels : [labels]).map(normalizeLabel);
  const maxCol = opts.searchCols != null ? Math.min(range.e.c, range.s.c + opts.searchCols - 1) : range.e.c;
  for (const key of wanted) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= maxCol; c++) {
        if (normalizeLabel(cellText(sheet, r, c)) === key) return { row: r, col: c, label: key };
      }
    }
  }
  return null;
}

/**
 * 取某行在指定金额列（按表头定位）的数值。
 */
function valueAtLabel(sheet, labels, valueHeaders, opts = {}) {
  const hit = findRowByLabel(sheet, labels, opts);
  if (!hit) return null;
  const valueHit = valueHeaders ? findColumnByHeader(sheet, valueHeaders, opts) : null;
  if (valueHit && valueHit.col > hit.col) {
    const v = cellNumber(sheet, hit.row, valueHit.col);
    if (v != null) return v;
  }
  const range = sheetRange(sheet);
  for (let c = hit.col + 1; c <= range.e.c; c++) {
    const v = cellNumber(sheet, hit.row, c);
    if (v != null) return v;
  }
  return null;
}

/**
 * 学校单位名称的字面特征。用于在表头区域按内容找单位名，
 * 替代"固定单元格 A3/B3/A2"——各厂商表头行数不同，固定地址一换版式就取不到。
 */
const SCHOOL_NAME_TAIL = /(小学|中学|学校|幼儿园|中心校|职业技术学校|职业学校|中等专业学校|实验学校|完全小学|教学点)$/;

/**
 * 从表头区域按内容提取单位名称。
 *
 * 依次尝试：
 *   1. 形如"编制单位：××小学"的单元格（各厂商最常见的写法）
 *   2. 表头区域内以学校类后缀结尾的单元格
 *   3. 调用方给出的固定单元格（中科版式兜底）
 *
 * @param sheet
 * @param opts.searchRows 表头搜索行数（默认前 8 行）
 * @param opts.fallbackAddr 兜底单元格地址，如 'A3'
 * @returns {{name:string, via:'label'|'suffix'|'fallback'}|null}
 */
function findUnitName(sheet, opts = {}) {
  if (!sheet) return null;
  const range = sheetRange(sheet);
  const maxRow = Math.min(range.e.r, range.s.r + (opts.searchRows ?? 8) - 1);

  // 1) “编制单位：××”
  for (let r = range.s.r; r <= maxRow; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const text = cellText(sheet, r, c);
      const hit = /(?:编制单位|单位名称|单位)\s*[:：]\s*(\S.*)$/.exec(text);
      if (hit && hit[1].trim()) return { name: hit[1].trim(), via: 'label' };
      // “编制单位：”与名称分列的写法
      if (/^(?:编制单位|单位名称)\s*[:：]?$/.test(text)) {
        for (let n = c + 1; n <= range.e.c; n++) {
          const next = cellText(sheet, r, n);
          if (next) return { name: next, via: 'label' };
        }
      }
    }
  }

  // 2) 以学校类后缀结尾
  for (let r = range.s.r; r <= maxRow; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const text = cellText(sheet, r, c).replace(/\s+/g, '');
      if (text.length >= 3 && text.length <= 40 && SCHOOL_NAME_TAIL.test(text)) {
        return { name: text, via: 'suffix' };
      }
    }
  }

  // 3) 固定单元格兜底
  if (opts.fallbackAddr) {
    const cell = sheet[opts.fallbackAddr];
    if (cell && cell.v != null) {
      const name = String(cell.v).replace(/(?:编制单位|单位名称)\s*[:：]\s*/g, '').trim();
      if (name) return { name, via: 'fallback' };
    }
  }
  return null;
}

module.exports = {
  cellText,
  cellNumber,
  sheetRange,
  normalizeLabel,
  isAccountCode,
  cellIsText,
  isCodeCell,
  findColumnByHeader,
  scanCodeValueMap,
  scanNameValueMap,
  findRowByLabel,
  valueAtLabel,
  findUnitName,
  SCHOOL_NAME_TAIL,
};
