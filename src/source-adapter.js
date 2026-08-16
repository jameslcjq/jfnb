/**
 * 源报表适配层：把不同财务软件导出的 Excel 归一化成引擎可认的语义数据源。
 *
 * ┌──────────┐   ┌─────────────────┐   ┌──────────────┐
 * │ 各厂商 xlsx│ → │ NormalizedSource │ → │ computeReport │
 * └──────────┘   └─────────────────┘   └──────────────┘
 *
 * 取数不再依赖固定行列，而是按《政府支出经济分类科目》编码 / 科目名称定位。
 *
 * ⚠️ 关键安全约定 —— 为什么中科仍以固定地址为准：
 *   中科的固定地址映射是本项目唯一经过真实账套验证的基准（历史上已生成过大量
 *   通过审核的年报）。编码映射中有相当一部分是按标准科目序列**推断**的，尚无
 *   真实样本印证（见 source-map.js 的 confidence 字段）。因此：
 *     - 厂商识别为中科时：固定地址取数为准，编码/名称扫描并行执行做**交叉校验**，
 *       两者不一致只记 warning，不改数 → 保证行为与重构前逐位一致。
 *     - 厂商未识别（博思/用友/久其等）时：走编码 → 名称扫描；
 *       confidence 为 'unknown' 的取数点无法定位，取 0 并明确告警。
 *   交叉校验的作用：第一份真实中科文件跑过去，就能免费验证编码映射对不对，
 *   核对无误后把 confidence 改成 'high'，即可让该点对所有厂商生效。
 */

const XLSX = require('@e965/xlsx');
const scan = require('./source-scan');
const map = require('./source-map');

const VENDOR = {
  ZHONGKE: '中科',
  UNKNOWN: '未识别',
};

/**
 * 识别厂商。
 *
 * 现状说明：只有中科的版式有确凿依据（本项目长期使用）。博思/用友/久其尚无样本，
 * 无法写出可靠特征，故一律归为"未识别"并走纯内容解析路径。
 * 拿到样本后在此处补特征即可，其余代码不用动。
 *
 * @param {object} workbooks WB 包装器集合
 * @param {string} [override] 用户在界面上手工指定的厂商
 */
function detectVendor(workbooks, override) {
  if (override && Object.values(VENDOR).includes(override)) return override;

  const expDetail = workbooks?.经费支出明细表;
  if (!expDetail) return VENDOR.UNKNOWN;

  // 中科特征：明细表按月分 sheet（'1月份'），且 301/302 合计落在 D5/D19。
  const sheet = expDetail.findSheet('1月份') || expDetail.findSheet('支出明细表') || expDetail.getSheet(0);
  if (!sheet) return VENDOR.UNKNOWN;
  // 真实中科导出既有“1月份”，也有“1月份 支出明细表”；后者不能被误判成未知厂商。
  const hasMonthlySheet = (expDetail.sheetNames || []).some((n) => /^\d+月份(?:\s*支出明细表)?$/.test(String(n).trim()));
  const d5 = sheet.D5 && sheet.D5.v != null;
  const d19 = sheet.D19 && sheet.D19.v != null;
  if (hasMonthlySheet && (d5 || d19)) return VENDOR.ZHONGKE;

  return VENDOR.UNKNOWN;
}

function num(value) {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 归一化数据源。引擎只通过它的访问器取数，不再直接接触 sheet。
 */
class NormalizedSource {
  constructor(workbooks, opts = {}) {
    this.workbooks = workbooks;
    this.vendor = detectVendor(workbooks, opts.vendor);
    /**
     * 取数问题分两级，不能混在一起——混在一起会让真问题被误报淹没：
     *
     * warnings（阻断级）：必然造成数据丢失或失真，必须人工确认
     *   - semanticsUnknown  该取数点语义未定，任何厂商都取不到（真丢数）
     *   - criticalAbsent    段合计（301/302）取不到，会连带整段倒挤失真
     *   - statementAbsent   法定报表的行次找不到（该行必然存在，找不到=解析失败）
     *   - parseFailed       整张表没扫出任何科目编码（结构性解析失败）
     *   - crossCheckMismatch 编码扫描与已验证的固定单元格不一致
     *
     * notes（信息级）：取 0 本来就是正确的，不该报警
     *   - codeAbsent        表解析正常，只是该单位本年确实没有这个科目的支出
     */
    this.warnings = [];
    this.notes = [];
    /** 取数溯源：key → { value, via, code, addr, crossCheck, reason } */
    this.trace = {};
    this._buildExpenseDetail();
    this._buildAccountBalance();
    this._buildStatements();
  }

  get isZhongke() { return this.vendor === VENDOR.ZHONGKE; }

  _warn(message) {
    if (!this.warnings.includes(message)) this.warnings.push(message);
  }

  _note(message) {
    if (!this.notes.includes(message)) this.notes.push(message);
  }

  _buildExpenseDetail() {
    const wb = this.workbooks.经费支出明细表;
    this.expSheet = wb
      ? (wb.findSheet('1月份') || wb.findSheet('支出明细表') || wb.getSheet(0))
      : null;
    const scanned = scan.scanCodeValueMap(this.expSheet, {
      valueHeaders: map.EXPENSE_VALUE_HEADERS,
      codeHeaders: map.CODE_HEADERS,
    });
    this.expByCode = scanned.byCode;
    this.expCodeCells = scanned.codeCells;
    this.expByName = scan.scanNameValueMap(this.expSheet, {
      nameHeaders: map.EXPENSE_NAME_HEADERS,
      valueHeaders: map.EXPENSE_VALUE_HEADERS,
    }).byName;
    // 一个科目都没扫出来，说明不是"该单位没这些支出"，而是这张表没解析成功
    this.expParsed = Object.keys(this.expByCode).length > 0;
  }

  _buildAccountBalance() {
    const wb = this.workbooks.科目余额表;
    const sheet = wb ? (wb.findSheet('第一页') || wb.getSheet(0)) : null;
    this.accSheet = sheet;
    // 期末余额列按表头识别（原实现硬编码 K 列）
    this.accByCode = scan.scanCodeValueMap(sheet, {
      valueHeaders: map.ACCOUNT_BALANCE.valueHeaders,
      codeHeaders: map.CODE_HEADERS,
    }).byCode;
    this.accParsed = Object.keys(this.accByCode).length > 0;
  }

  _buildStatements() {
    const bsWb = this.workbooks.资产负债表;
    this.bsSheet = bsWb ? (bsWb.findSheet('第1页') || bsWb.getSheet(0)) : null;
    const ieWb = this.workbooks.收入费用表;
    this.ieSheet = ieWb ? (ieWb.findSheet('第1页') || ieWb.getSheet(0)) : null;
  }

  /**
   * 经费支出明细表取数。
   * @param {string} key source-map 中的取数点 key
   */
  exp(key) {
    const entry = map.EXPENSE_BY_KEY.get(key);
    if (!entry) throw new Error(`source-map 未声明取数点：${key}`);
    return this._resolve(entry, this.expSheet, {
      byCode: this.expByCode,
      byName: map.NAME_AMBIGUOUS_KEYS.has(key) ? null : this.expByName,
      label: '经费支出明细表',
      parsed: this.expParsed,
    });
  }

  /** 科目余额表按会计科目编码取期末余额 */
  acc(code) {
    const value = this.accByCode[code];
    if (value == null) {
      // 中科走已验证路径，缺科目沿用原行为（取 0，不报警）
      let reason = 'codeAbsent';
      if (!this.isZhongke) {
        if (!this.accParsed) {
          reason = 'parseFailed';
          this._warn(`科目余额表未能解析出任何科目编码，固定资产等取数全部失效（科目 ${code} 等取 0）。`
            + `请确认表头是否含"科目编码"与"期末余额"字样。`);
        } else {
          // 学校没有某类固定资产是常态（如无图书、无在建），取 0 正确
          this._note(`科目余额表无科目 ${code}，按该单位无此类资产取 0。`);
        }
      }
      this.trace[`acc.${code}`] = { value: 0, via: 'missing', code, reason };
      return 0;
    }
    this.trace[`acc.${code}`] = { value: num(value), via: 'code', code };
    return num(value);
  }

  /** 资产负债表取数 */
  balance(key) {
    const entry = map.BALANCE_BY_KEY.get(key);
    if (!entry) throw new Error(`source-map 未声明取数点：${key}`);
    return this._resolveStatement(entry, this.bsSheet, '资产负债表');
  }

  /** 收入费用表取数 */
  income(key) {
    const entry = map.INCOME_BY_KEY.get(key);
    if (!entry) throw new Error(`source-map 未声明取数点：${key}`);
    return this._resolveStatement(entry, this.ieSheet, '收入费用表');
  }

  /**
   * 明细表取数核心：按 confidence 与厂商决定以谁为准。
   */
  _resolve(entry, sheet, ctx) {
    const fixed = entry.zhongke ? scan.cellNumber(sheet, ...addrToRC(entry.zhongke)) : null;
    let scanned = null;
    let via = null;
    if (entry.code && ctx.byCode && ctx.byCode[entry.code] != null) {
      scanned = num(ctx.byCode[entry.code]);
      via = 'code';
    } else if (entry.names && entry.names.length && ctx.byName) {
      for (const name of entry.names) {
        const hit = ctx.byName[scan.normalizeLabel(name)];
        if (hit != null) { scanned = num(hit); via = 'name'; break; }
      }
    }

    if (this.isZhongke) {
      // 中科：固定地址为准（唯一经真实账套验证的基准），扫描结果仅交叉校验。
      const value = num(fixed);
      let crossCheck = 'n/a';
      if (scanned != null) {
        crossCheck = Math.abs(scanned - value) < 0.005 ? 'match' : 'mismatch';
        if (crossCheck === 'mismatch') {
          this._warn(`${ctx.label} ${entry.key}：固定单元格 ${entry.zhongke} 取到 ${value}，`
            + `按科目${via === 'code' ? `编码 ${entry.code}` : '名称'}扫描取到 ${scanned}，`
            + `已按固定单元格取数。请核对 source-map.js 中该点的编码映射。`);
        }
      }
      this.trace[entry.key] = { value, via: 'fixed', addr: entry.zhongke, crossCheck, scanned };
      return value;
    }

    // 非中科：只能靠内容定位
    if (scanned != null && entry.confidence !== 'unknown') {
      this.trace[entry.key] = { value: scanned, via, code: entry.code };
      return scanned;
    }

    const subject = entry.code ? `编码 ${entry.code}` : `名称「${entry.names[0] || ''}」`;
    let reason;
    if (entry.confidence === 'unknown') {
      reason = 'semanticsUnknown';
      this._warn(`${ctx.label} ${entry.key}：该取数点的科目语义尚未确定（confidence=unknown），`
        + `${this.vendor} 版式下无法按内容定位，已取 0，这笔金额会丢失。`
        + `需要真实样本核对后补充编码映射。`);
    } else if (!ctx.parsed) {
      reason = 'parseFailed';
      this._warn(`${ctx.label} 未能解析出任何科目编码，整张表取数失效（${entry.key} 等全部取 0）。`
        + `请确认该文件是否为科目编码制的支出明细表，或表头是否含"科目编码"字样。`);
    } else if (entry.critical) {
      reason = 'criticalAbsent';
      this._warn(`${ctx.label} ${entry.key}：找不到段合计科目${subject}。`
        + `段合计是倒挤办公费等项目的控制数，缺失会导致整段金额失真，已取 0。`);
    } else {
      // 表解析正常，只是这个科目本年没有发生额——取 0 是正确的，不该报警
      reason = 'codeAbsent';
      this._note(`${ctx.label} ${entry.key}：源表无科目${subject}，按该单位本年无此项支出取 0。`);
    }
    this.trace[entry.key] = { value: 0, via: 'missing', code: entry.code, reason };
    return 0;
  }

  /**
   * 收入费用表 / 资产负债表取数：行次名称定位（法定报表，各厂商项目名一致）。
   */
  _resolveStatement(entry, sheet, label) {
    const fixed = entry.zhongke ? scan.cellNumber(sheet, ...addrToRC(entry.zhongke)) : null;
    let scanned = null;
    if (entry.names && entry.names.length) {
      const hit = scan.valueAtLabel(sheet, entry.names, map.STATEMENT_VALUE_HEADERS, { searchCols: 4 });
      if (hit != null) scanned = num(hit);
    }

    if (this.isZhongke) {
      const value = num(fixed);
      let crossCheck = 'n/a';
      if (scanned != null) {
        crossCheck = Math.abs(scanned - value) < 0.005 ? 'match' : 'mismatch';
        if (crossCheck === 'mismatch') {
          this._warn(`${label} ${entry.key}：固定单元格 ${entry.zhongke} 取到 ${value}，`
            + `按行次名称「${entry.names[0]}」扫描取到 ${scanned}，已按固定单元格取数。`);
        }
      }
      this.trace[entry.key] = { value, via: 'fixed', addr: entry.zhongke, crossCheck, scanned };
      return value;
    }

    if (scanned != null && entry.confidence !== 'unknown') {
      this.trace[entry.key] = { value: scanned, via: 'name' };
      return scanned;
    }
    // 资产负债表/收入费用表是法定报表，行次必然存在（金额可以为 0，但行不会没有）。
    // 因此"找不到行"一律是解析失败，不能当成"该单位没这项"。
    let reason;
    if (entry.confidence === 'unknown') {
      reason = 'semanticsUnknown';
      this._warn(`${label} ${entry.key}：该取数点语义未确定，${this.vendor} 版式下无法定位，`
        + `已取 0，这笔金额会丢失。`);
    } else {
      reason = 'statementAbsent';
      this._warn(`${label} 找不到行次「${entry.names[0] || ''}」，已取 0。`
        + `该行是法定报表项目、必然存在，取不到说明表头或行次名称未被识别，请核对文件。`);
    }
    this.trace[entry.key] = { value: 0, via: 'missing', reason };
    return 0;
  }

  /**
   * 解析质量报告，供界面展示与人工复核。
   */
  report() {
    const entries = Object.entries(this.trace);
    const mismatches = entries.filter(([, t]) => t.crossCheck === 'mismatch');
    const missing = entries.filter(([, t]) => t.via === 'missing');
    const byReason = (reason) => missing.filter(([, t]) => t.reason === reason).map(([k]) => k);

    // 阻断级：必然丢数或失真，须人工确认。信息级：取 0 本来就是对的。
    const blocking = [
      ...byReason('semanticsUnknown'),
      ...byReason('criticalAbsent'),
      ...byReason('statementAbsent'),
      ...byReason('parseFailed'),
    ];
    const benign = byReason('codeAbsent');

    return {
      vendor: this.vendor,
      total: entries.length,
      byCode: entries.filter(([, t]) => t.via === 'code').length,
      byName: entries.filter(([, t]) => t.via === 'name').length,
      byFixedAddress: entries.filter(([, t]) => t.via === 'fixed').length,
      missing: missing.map(([k]) => k),
      /** 必须人工确认的取数点（会丢数/失真） */
      blocking,
      /** 源表确实没有该科目、取 0 正确的取数点（不需要处理） */
      benign,
      missingByReason: {
        semanticsUnknown: byReason('semanticsUnknown'),
        criticalAbsent: byReason('criticalAbsent'),
        statementAbsent: byReason('statementAbsent'),
        parseFailed: byReason('parseFailed'),
        codeAbsent: benign,
      },
      crossCheckMismatches: mismatches.map(([k, t]) => ({ key: k, fixed: t.value, scanned: t.scanned })),
      confidence: map.confidenceSummary(),
      /** 阻断级提示，已并入 computeReport 的 warnings */
      warnings: this.warnings.slice(),
      /** 信息级提示，不进 warnings，只留在溯源报告里备查 */
      notes: this.notes.slice(),
    };
  }
}

/** 'D19' → [row, col]（0 基），供 scan.cellNumber 使用 */
function addrToRC(addr) {
  const { r, c } = XLSX.utils.decode_cell(addr);
  return [r, c];
}

function createSource(workbooks, opts = {}) {
  return new NormalizedSource(workbooks, opts);
}

module.exports = { NormalizedSource, createSource, detectVendor, VENDOR };
