const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const XLSX = require('@e965/xlsx');
const logger = require('./logger');
const { sanitizeFileName, resolveInside } = require('./path-safety');

/**
 * 每个学校需要的5种源文件
 */
const REQUIRED_TYPES = ['资产负债表', '收入费用表', '经费支出明细表', '科目余额表', '上年经费年报'];

/**
 * 各文件类型中单位名称所在的单元格位置
 */
const UNIT_NAME_CELLS = {
  '资产负债表': { sheet: 0, addr: 'A3', clean: (v) => String(v).replace(/编制单位[:：]\s*/g, '').trim() },
  '收入费用表': { sheet: 0, addr: 'B3', clean: (v) => String(v).trim() },
  '经费支出明细表': { sheet: 0, addr: 'A2', clean: (v) => String(v).trim() },
  '科目余额表': { sheet: 0, addr: 'A3', clean: (v) => String(v).trim() },
  '上年经费年报': { sheet: 0, addr: 'B4', clean: (v) => String(v).trim() },
};

function uniqueArchivePath(dir, fileName) {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  let candidate = resolveInside(dir, fileName);
  let serial = 2;
  while (fs.existsSync(candidate)) {
    candidate = resolveInside(dir, `${stem}_${serial}${ext}`);
    serial++;
  }
  return candidate;
}

/**
 * 根据文件内容识别文件类型
 * @param {object} wb - XLSX workbook 对象
 * @returns {string|null} 文件类型
 */
function identifyByContent(wb) {
  const sheetNames = wb.SheetNames;
  const firstSheet = wb.Sheets[sheetNames[0]];
  if (!firstSheet) return null;

  const a1 = String(firstSheet['A1']?.v || '').trim();

  // 教育事业年报：跳过，不在监控文件夹中处理
  if (a1 === '学校代码') return null;

  // 科目余额表：A1 包含 "科目余额"
  if (a1.includes('科目余额')) return '科目余额表';

  // 资产负债表：A1 包含 "资产负债"
  if (a1.includes('资产负债')) return '资产负债表';

  // 收入费用表：A1 包含 "收入费用"
  if (a1.includes('收入费用')) return '收入费用表';

  // 经费支出明细表：A1 包含 "明细" 或 sheet名包含 "支出明细"
  if (a1.includes('明细') || sheetNames.some((n) => n.includes('支出明细'))) {
    return '经费支出明细表';
  }

  // 上年经费年报：多个sheet且sheet名包含 "中小学校" 前缀
  if (sheetNames.length >= 5 && sheetNames.some((n) => n.includes('中小学校'))) {
    return '上年经费年报';
  }

  // 未识别
  return null;
}

/**
 * 文件夹监控器 - 支持多学校批量处理
 */
class FolderWatcher extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.folder = '';
    /**
     * schools: { [unitName]: { '资产负债表': filePath, ... } }
     */
    this.schools = {};
    this.processingQueue = new Set();
    this.debounceTimer = null;
    this.scanLock = false;
  }

  /**
   * 分析一个文件：通过内容识别类型和所属学校
   */
  async analyzeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') return null;

    let wb;
    try {
      wb = XLSX.readFile(filePath);
    } catch (error) {
      logger.warn('Excel文件读取失败', { filePath, message: error.message });
      return null;
    }

    const type = identifyByContent(wb);
    if (!type) return null;

    // 教育事业年报是全局共享的
    if (type === '教育事业年报') {
      return { type, unitName: null, filePath };
    }

    // 读取单位名称
    const config = UNIT_NAME_CELLS[type];
    let unitName = null;
    if (config) {
      const sheet = wb.Sheets[wb.SheetNames[config.sheet]];
      if (sheet) {
        const cell = sheet[config.addr];
        if (cell && cell.v != null) {
          unitName = config.clean(cell.v);
        }
      }
    }

    return { type, unitName, filePath };
  }

  /**
   * 全量扫描文件夹
   */
  async scanAll() {
    if (this.scanLock) return;
    this.scanLock = true;

    try {
      this.schools = {};

      if (!this.folder || !fs.existsSync(this.folder)) {
        this.emit('status', this.getStatus());
        return;
      }

      const entries = fs.readdirSync(this.folder, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && /\.(xlsx|xls)$/i.test(e.name))
        .map((e) => path.join(this.folder, e.name));

      for (const filePath of files) {
        const result = await this.analyzeFile(filePath);
        if (!result) continue;

        if (!result.unitName) {
          this.emit('log', { message: `无法识别单位名称：${path.basename(filePath)}`, type: 'warn' });
          continue;
        }

        if (!this.schools[result.unitName]) {
          this.schools[result.unitName] = {};
        }
        this.schools[result.unitName][result.type] = filePath;
        this.emit('log', {
          message: `${result.unitName} - ${result.type}：${path.basename(filePath)}`,
          type: 'log',
        });
      }

      this.emit('status', this.getStatus());
      this.checkReady();
    } finally {
      this.scanLock = false;
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    const schoolList = Object.entries(this.schools).map(([unitName, files]) => {
      const fileStatus = REQUIRED_TYPES.map((type) => ({
        type,
        found: Boolean(files[type]),
        fileName: files[type] ? path.basename(files[type]) : '',
      }));
      const missing = fileStatus.filter((f) => !f.found).map((f) => f.type);
      const ready = missing.length === 0;
      const processing = this.processingQueue.has(unitName);
      return { unitName, files: fileStatus, missing, ready, processing };
    });

    return {
      folder: this.folder,
      schools: schoolList,
      totalSchools: schoolList.length,
      readySchools: schoolList.filter((s) => s.ready).length,
    };
  }

  /**
   * 检查是否有学校的文件齐全了
   */
  checkReady() {
    const readySchools = Object.entries(this.schools)
      .filter(([unitName, files]) => {
        if (this.processingQueue.has(unitName)) return false;
        return REQUIRED_TYPES.every((t) => files[t]);
      })
      .map(([unitName]) => unitName);

    if (readySchools.length > 0) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.emit('ready', { schools: readySchools });
      }, 2500);
    }
  }

  /**
   * 获取指定学校的文件路径
   */
  getSchoolFiles(unitName) {
    return this.schools[unitName] || {};
  }

  /**
   * 标记学校开始处理
   */
  markProcessing(unitName) {
    this.processingQueue.add(unitName);
    this.emit('status', this.getStatus());
  }

  /**
   * 标记学校处理完成，归档文件
   */
  markDone(unitName) {
    this.processingQueue.delete(unitName);

    // 归档源文件
    const files = this.schools[unitName];
    if (files) {
      const archiveDir = resolveInside(this.folder, sanitizeFileName(unitName));
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      for (const [, filePath] of Object.entries(files)) {
        if (fs.existsSync(filePath)) {
          const dest = uniqueArchivePath(archiveDir, path.basename(filePath));
          try { fs.renameSync(filePath, dest); } catch (error) { logger.warn('归档源文件失败', { filePath, dest, message: error.message }); }
        }
      }
      delete this.schools[unitName];
    }

    this.emit('status', this.getStatus());
  }

  /**
   * 开始监控
   */
  start(folder) {
    this.stop();
    this.folder = folder;
    this.schools = {};

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    // 先全量扫描
    this.scanAll();

    // 启动监控
    this.watcher = chokidar.watch(folder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      depth: 0,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
    });

    this.watcher.on('add', (filePath) => this.handleFileEvent(filePath, 'add'));
    this.watcher.on('change', (filePath) => this.handleFileEvent(filePath, 'change'));
    this.watcher.on('unlink', (filePath) => this.handleFileRemove(filePath));

    this.emit('watching', { folder });
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.schools = {};
    this.processingQueue.clear();
  }

  async handleFileEvent(filePath, eventType) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') return;

    // 等一下让文件完全写入
    await new Promise((r) => setTimeout(r, 500));

    const result = await this.analyzeFile(filePath);
    if (!result) return;

    if (!result.unitName) {
      this.emit('log', { message: `无法识别：${path.basename(filePath)}`, type: 'warn' });
      return;
    }

    if (!this.schools[result.unitName]) {
      this.schools[result.unitName] = {};
    }
    this.schools[result.unitName][result.type] = filePath;
    this.emit('log', {
      message: `${result.unitName} - ${result.type} 已${eventType === 'add' ? '导入' : '更新'}`,
      type: 'success',
    });
    this.emit('status', this.getStatus());
    this.checkReady();
  }

  handleFileRemove(filePath) {
    // 从学校中移除
    for (const [unitName, files] of Object.entries(this.schools)) {
      for (const [type, fp] of Object.entries(files)) {
        if (fp === filePath) {
          delete files[type];
          if (Object.keys(files).length === 0) delete this.schools[unitName];
          this.emit('log', { message: `${unitName} - ${type} 已移除`, type: 'warn' });
          this.emit('status', this.getStatus());
          return;
        }
      }
    }
  }
}

module.exports = { FolderWatcher, REQUIRED_TYPES, identifyByContent, UNIT_NAME_CELLS };
