const { app, BrowserWindow, dialog, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { configureAppPaths, DATA_DIR } = require('./paths');

configureAppPaths(app);

const XLSX = require('@e965/xlsx');
const JSZip = require('jszip');
const { FolderWatcher } = require('./watcher');
const { generateReport, generatePrivateDraft, extractEduData, extractEduDataFromRows, writeReport, resolveEduMergeGroups } = require('./report-engine');
const database = require('./database');
const autoFill = require('./auto-fill');
const collectClient = require('./collect-client');
const logger = require('./logger');
const config = require('./config');
const auth = require('./auth');
const license = require('./license');
const { sanitizeFileName, resolveInside, assertPathInsideAny } = require('./path-safety');

let mainWindow;
const watcher = new FolderWatcher();
let isGenerating = false;
let generatedPreviews = [];
const trustedOutputPaths = new Set();

const AUTH_FREE_CHANNELS = new Set([
  'auth-status',
  'auth-login',
  'auth-logout',
]);

const LICENSE_FREE_CHANNELS = new Set([
  ...AUTH_FREE_CHANNELS,
  'license-status',
  'license-check',
  'license-claim-trial',
  'license-save-key',
  'license-device-info',
  'license-export-machine-request',
  'license-import-offline',
]);

// 教育事业年报数据（导入后常驻内存）
let eduReportData = null; // { filePath, rows: [...] }  原始表格数据供UI展示
let eduReportPath = null; // 文件路径，用于 extractEduData
const GOV_WEBVIEW_PARTITION = 'persist:gov-platform';
const ALLOWED_WEBVIEW_HOST_SUFFIXES = ['moe.edu.cn'];

function isAllowedGovWebUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    return url.protocol === 'https:'
      && ALLOWED_WEBVIEW_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function getEduExtractOptions() {
  const appConfig = config.loadConfig();
  const regionRules = appConfig.regionRules || {};
  return {
    regionRules,
    heatingFeePerStudent: Number(regionRules.heatingFeePerStudent || 25),
    mergeGroups: {
      ...(appConfig.kindergartenMergeGroups || {}),
      ...(regionRules.mergeGroups || {}),
    },
    kindergartenMergeGroups: {
      ...(appConfig.kindergartenMergeGroups || {}),
      ...(regionRules.mergeGroups || {}),
    },
    schoolAliases: regionRules.schoolAliases || {},
    ignoredClosedSchools: regionRules.ignoredClosedSchools || [],
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 680,
    title: '经费年报生成工具',
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isAllowedGovWebUrl(params.src)) {
      event.preventDefault();
      logger.warn('已阻止非白名单 webview 地址', { src: params.src });
      return;
    }
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.partition = GOV_WEBVIEW_PARTITION;
  });
  mainWindow.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    webContents.on('will-navigate', (event, url) => {
      if (!isAllowedGovWebUrl(url)) {
        event.preventDefault();
        logger.warn('已阻止 webview 跳转到非白名单地址', { url });
      }
    });
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (!app.isPackaged && process.env.GZNB_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }
}

function getResourcePath(name) {
  return process.resourcesPath
    ? path.join(process.resourcesPath, name)
    : path.resolve(app.getAppPath(), '..', name);
}

function ensureDefaultTemplate() {
  const target = path.join(DATA_DIR, '经费年报模板.xlsx');
  if (fs.existsSync(target)) return;

  const candidates = [
    getResourcePath('经费年报模板.xlsx'),
    path.resolve(app.getAppPath(), '..', '经费年报模板.xlsx'),
    path.resolve(app.getAppPath(), '..', '陇集', '经费年报模板.xlsx'),
  ];
  const source = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (source) {
    try {
      fs.copyFileSync(source, target);
      logger.info('已初始化数据目录模板', { source, target });
    } catch (error) {
      logger.warn('初始化数据目录模板失败', { source, target, message: error.message });
    }
  }
}

app.whenReady().then(() => {
  session.fromPartition(GOV_WEBVIEW_PARTITION).setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  ensureDefaultTemplate();
  database.initDatabase();
  try {
    const savedEdu = database.loadEduReport();
    if (savedEdu && savedEdu.filePath && fs.existsSync(savedEdu.filePath)) {
      eduReportPath = savedEdu.filePath;
      eduReportData = savedEdu;
      logger.info('已加载上次导入的教育事业年报', { filePath: savedEdu.filePath });
    }
  } catch (error) {
    logger.warn('加载教育事业年报缓存失败', error);
  }
  createWindow();
  logger.info('应用启动完成');
});

app.on('window-all-closed', () => {
  watcher.stop();
  logger.info('应用退出，停止监控并关闭数据库');
  database.closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!AUTH_FREE_CHANNELS.has(channel) && !auth.isLoggedIn()) {
        return { ok: false, code: 'AUTH_REQUIRED', message: '请先登录' };
      }
      return await handler(event, ...args);
    } catch (error) {
      logger.error(`IPC处理失败：${channel}`, error);
      return { ok: false, message: error.message || '操作失败，请查看日志' };
    }
  });
}

function getLayoutTemplatePath() {
  const appConfig = config.loadConfig();
  const candidates = [
    appConfig.layoutTemplatePath,
    watcher.folder ? path.join(watcher.folder, '经费年报模板.xlsx') : '',
    path.join(DATA_DIR, '经费年报模板.xlsx'),
    getResourcePath('经费年报模板.xlsx'),
    path.resolve(app.getAppPath(), '..', '陇集', '经费年报模板.xlsx'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[candidates.length - 1];
}

// ===== Watcher 事件转发 =====
watcher.on('watching', (data) => sendToRenderer('watcher-event', { event: 'watching', ...data }));
watcher.on('status', (data) => sendToRenderer('watcher-event', { event: 'status', ...data }));
watcher.on('log', (data) => sendToRenderer('watcher-event', { event: 'log', ...data }));

watcher.on('ready', async (data) => {
  if (isGenerating) return;
  sendToRenderer('watcher-event', { event: 'all-ready', schools: data.schools });
  // 已按用户要求关闭自动生成，改为手动触发
  // await doBatchGenerate(data.schools);
});

// ===== 批量生成 =====
async function doBatchGenerate(schoolNames) {
  if (isGenerating) return;

  let licenseStatus = await license.ensureUsableLicense();
  if (!license.isLicenseUsableStatus(licenseStatus) && schoolNames[0]) {
    licenseStatus = await license.claimTrialLicense(schoolNames[0]);
    sendToRenderer('license-status', licenseStatus);
  }
  if (!license.isLicenseUsableStatus(licenseStatus)) {
    sendToRenderer('license-status', licenseStatus);
    sendToRenderer('generation-done', {
      ok: false,
      total: schoolNames.length,
      success: 0,
      failed: schoolNames.length,
      message: license.describeLicenseStatus(licenseStatus),
    });
    return;
  }

  // 检查教育事业年报是否已导入
  if (!eduReportPath) {
    sendToRenderer('generation-done', {
      ok: false,
      total: schoolNames.length,
      success: 0,
      failed: schoolNames.length,
      message: '请先在"教育事业年报"标签页导入教育事业年报文件，否则无法生成经费年报',
    });
    return;
  }

  isGenerating = true;
  sendToRenderer('generation-start', { schools: schoolNames });

  const results = [];

  // 版式模板：优先使用当前监控目录中的经费年报模板.xlsx
  const layoutTemplatePath = getLayoutTemplatePath();

  if (!fs.existsSync(layoutTemplatePath)) {
    sendToRenderer('generation-done', {
      ok: false,
      total: schoolNames.length,
      success: 0,
      failed: schoolNames.length,
      message: '未找到版式模板文件：经费年报模板.xlsx',
    });
    isGenerating = false;
    return;
  }

  for (const unitName of schoolNames) {
    watcher.markProcessing(unitName);
    const files = watcher.getSchoolFiles(unitName);

    sendToRenderer('generation-log', { message: `\n===== 处理：${unitName} =====`, type: 'log' });

    const onLog = (message, type) => {
      sendToRenderer('generation-log', { message: `[${unitName}] ${message}`, type });
    };

    let result;
    try {
      // 从教育事业年报中提取该学校数据
      const eduOptions = getEduExtractOptions();
      let eduData = null;
      if (eduReportPath) {
        eduData = extractEduDataFromRows(eduReportData?.rows, unitName, eduOptions)
          || extractEduData(eduReportPath, unitName, eduOptions);
      }

      const outputDir = watcher.folder;
      result = await generateReport(files, eduData, outputDir, layoutTemplatePath, onLog, eduOptions);
    } catch (error) {
      logger.error(`生成失败：${unitName}`, error);
      result = { ok: false, unitName, message: error.message };
    }

    if (result.ok) {
      // 存入数据库
      if (result.computed) {
        try {
          const reportId = database.saveReport(result.unitName, result.computed, new Date().getFullYear(), {
            bxlx: result.bxlx,
            schoolType: result.schoolType,
          });
          sendToRenderer('generation-log', {
            message: `[${unitName}] 数据已存入数据库 (ID: ${reportId})${result.schoolType ? `，学校类型：${result.schoolType}` : ''}`,
            type: 'success',
          });
        } catch (dbErr) {
          sendToRenderer('generation-log', {
            message: `[${unitName}] 数据库存储失败：${dbErr.message}`,
            type: 'warn',
          });
        }
      }

      // 归档
      const archiveDir = resolveInside(watcher.folder, sanitizeFileName(unitName));
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

      // 移动生成的年报到归档目录
      if (result.outputPath && fs.existsSync(result.outputPath)) {
        const dest = resolveInside(archiveDir, path.basename(result.outputPath));
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        try {
          fs.renameSync(result.outputPath, dest);
          result.outputPath = dest;
          if (result.preview) result.preview.outputPath = dest;
          trustedOutputPaths.add(path.resolve(dest));
        } catch { /* ignore */ }
      }

      watcher.markDone(unitName);
      results.push(result);

      if (result.preview) {
        generatedPreviews.push(result.preview);
        sendToRenderer('report-preview', result.preview);
      }
    } else {
      watcher.processingQueue && watcher.processingQueue.delete(unitName);
      results.push(result);
    }
  }

  isGenerating = false;
  sendToRenderer('generation-done', {
    ok: results.every((r) => r.ok),
    total: schoolNames.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    message: `完成 ${results.filter((r) => r.ok).length}/${schoolNames.length} 个学校`,
  });
}

// ===== IPC 处理 =====
handleIpc('auth-status', () => {
  return auth.getStatus();
});

handleIpc('auth-login', (_event, credentials = {}) => {
  const result = auth.login(credentials.username, credentials.password);
  if (result.ok) logger.info('用户登录成功', { username: result.user.username });
  else logger.warn('用户登录失败', { username: credentials.username });
  return result;
});

handleIpc('auth-logout', () => {
  watcher.stop();
  auth.logout();
  logger.info('用户已退出登录');
  return { ok: true };
});

// ===== 授权信息 IPC =====
handleIpc('license-status', async () => {
  return license.getCachedLicenseStatus();
});

handleIpc('license-check', async (_event, licenseKey) => {
  return license.verifyLicense(licenseKey);
});

handleIpc('license-claim-trial', async (_event, customerName, customerCode) => {
  return license.claimTrialLicense(customerName, customerCode);
});

handleIpc('license-save-key', async (_event, licenseKey) => {
  license.saveLicenseKey(licenseKey);
  return license.verifyLicense(licenseKey);
});

handleIpc('license-device-info', async () => {
  return license.getLicenseDeviceInfo();
});

handleIpc('license-export-machine-request', async (_event, licenseKey) => {
  const request = await license.exportMachineRequest(licenseKey);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出机器码申请文件',
    defaultPath: path.join(app.getPath('documents'), `经费年报授权申请-${request.device_id.slice(0, 8)}.json`),
    filters: [{ name: '授权申请文件', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, JSON.stringify(request, null, 2), 'utf8');
  return { ok: true, filePath: result.filePath, request };
});

handleIpc('license-import-offline', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入离线授权文件',
    filters: [
      { name: '离线授权文件', extensions: ['lic', 'json'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const raw = fs.readFileSync(result.filePaths[0], 'utf8');
  return license.importOfflineLicenseText(raw);
});

handleIpc('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择监控文件夹',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

handleIpc('get-default-folder', () => {
  return config.resolveDefaultFolder();
});

handleIpc('start-watching', (_event, folder) => {
  if (!folder || !fs.existsSync(folder)) {
    return { ok: false, message: '文件夹不存在' };
  }
  generatedPreviews = [];
  config.updateConfig({ watchFolder: folder });
  logger.info('开始监控文件夹', { folder });
  watcher.start(folder);
  return { ok: true };
});

handleIpc('stop-watching', () => {
  watcher.stop();
  return { ok: true };
});

handleIpc('get-status', () => {
  return watcher.getStatus();
});

handleIpc('get-previews', () => {
  return generatedPreviews;
});

handleIpc('generate-selected', async (_event, schoolNames) => {
  if (isGenerating) return { ok: false, message: '正在生成中，请稍后' };
  if (!Array.isArray(schoolNames) || schoolNames.length === 0) {
    return { ok: false, message: '请先选择要生成的学校' };
  }
  doBatchGenerate(schoolNames); // 异步执行
  return { ok: true };
});

// ===== 民办学校草稿生成 =====
handleIpc('select-private-prev-report', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择上年经费年报',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

handleIpc('generate-private-draft', async (_event, payload = {}) => {
  const { unitName, prevReportPath, controls } = payload;
  if (!unitName) return { ok: false, message: '请选择学校' };
  if (!prevReportPath || !fs.existsSync(prevReportPath)) {
    return { ok: false, message: '请选择有效的上年经费年报文件' };
  }
  if (!eduReportPath) {
    return { ok: false, message: '请先导入教育事业年报，用于提取年末学生和教职工数' };
  }

  const layoutTemplatePath = getLayoutTemplatePath();
  if (!fs.existsSync(layoutTemplatePath)) {
    return { ok: false, message: '未找到版式模板文件：经费年报模板.xlsx' };
  }

  const eduOptions = getEduExtractOptions();
  const eduData = extractEduDataFromRows(eduReportData?.rows, unitName, eduOptions)
    || extractEduData(eduReportPath, unitName, eduOptions);
  if (!eduData) {
    return { ok: false, message: `教育事业年报中未找到学校：${unitName}` };
  }

  const outputDir = watcher.folder || path.dirname(prevReportPath);
  const onLog = (message, type) => {
    sendToRenderer('generation-log', { message: `[${unitName}] ${message}`, type });
  };

  const result = await generatePrivateDraft({
    unitName,
    prevReportPath,
    eduData,
    controls,
    outputDir,
    layoutTemplatePath,
    onLog,
    ruleOptions: getEduExtractOptions(),
  });

  if (result.ok && result.computed) {
    const reportId = database.saveReport(result.unitName, result.computed, new Date().getFullYear(), {
      bxlx: result.bxlx,
      schoolType: result.schoolType,
    });
    result.reportId = reportId;
    generatedPreviews.push(result.preview);
    if (result.outputPath) trustedOutputPaths.add(path.resolve(result.outputPath));
    logger.info('民办草稿已生成并保存', { unitName, reportId, outputPath: result.outputPath });
  }

  return result;
});

// ===== 在线采集（民办/无报表/合并填报学校） =====
// 采集年度 = 当前年 − 1（经费年报是年度工作：2026 年做 2025 年度报表、采集 2025 数据），
// 与服务端 collectionYear 保持一致，避免年度错位拉不到数据。
function getCollectYear() {
  const cfg = config.loadConfig();
  return Number(cfg.collectYear) || (new Date().getFullYear() - 1);
}

// 生成待采集名单：合并组（中心园+成员）+ 独立民办园
function buildCollectSchoolList() {
  const options = getEduExtractOptions();
  const groups = resolveEduMergeGroups(options.mergeGroups);
  const schools = [];
  const seen = new Set();

  // 教职工数取自教育事业年报，随名单推送，供填表页做工资合理性提示
  const staffByName = new Map();
  if (eduReportData && Array.isArray(eduReportData.rows)) {
    for (const row of eduReportData.rows) {
      const name = String(row['学校名称'] || '').replace(/\s+/g, '').trim();
      const count = Number(row['教职工数']);
      if (name && Number.isFinite(count) && count > 0) staffByName.set(name, Math.round(count));
    }
  }

  const add = (unitName, mergeCenter, isCenter) => {
    const name = String(unitName || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    schools.push({
      unitName: name,
      mergeCenter: mergeCenter || null,
      isCenter: !!isCenter,
      staffCount: staffByName.get(name.replace(/\s+/g, '')) ?? null,
    });
  };

  for (const [center, members] of Object.entries(groups)) {
    if (members === null) continue;
    add(center, center, true);
    for (const member of members) {
      if (String(member).trim() === String(center).trim()) continue;
      add(member, center, false);
    }
  }

  const mergedMembers = new Set(Object.values(groups).flat().filter(Boolean).map((n) => String(n).trim()));
  if (eduReportData && Array.isArray(eduReportData.rows)) {
    for (const row of eduReportData.rows) {
      const name = row['学校名称'];
      if (!name) continue;
      const isKindergarten = String(row.bxlx || row['bxlx'] || '') === '111';
      if (isKindergarten && isPrivateEduRow(row) && !mergedMembers.has(String(name).trim())) add(name, null, false);
    }
  }
  return schools;
}

function isWaitingMembers(s) {
  return s.memberCount != null && s.submittedMemberCount != null
    && s.submittedMemberCount < s.memberCount;
}

// 汇总各采集单位的可生成状态
function buildCollectStatus(year) {
  const subs = database.listCollectedSubmissions(year);
  return subs.map((s) => {
    const files = watcher.getSchoolFiles(s.unitName);
    const hasPrev = !!(files && files['上年经费年报']);
    const waiting = isWaitingMembers(s);
    let state;
    if (s.stale) state = 'stale';                 // 已生成但之后又有新提交
    else if (s.generatedAt) state = 'generated';
    else if (waiting) state = 'waiting-members';  // 合并组成员未填齐
    else if (!hasPrev) state = 'missing-prev';
    else state = 'ready';
    return { ...s, hasPrev, waiting, state };
  });
}

handleIpc('collect-push-schools', async () => {
  const cfg = config.loadConfig();
  if (!cfg.collectServerUrl) return { ok: false, message: '请先在设置里填写采集服务器地址' };
  const year = getCollectYear();
  const schools = buildCollectSchoolList();
  if (schools.length === 0) return { ok: false, message: '没有可推送的学校，请先导入教育事业年报或配置合并组' };
  const result = await collectClient.pushSchools({
    serverUrl: cfg.collectServerUrl, token: cfg.collectToken, year, schools,
  });
  logger.info('已推送采集名单', { year, count: result.count });
  return { ok: true, year, count: result.count, schools: result.schools || [] };
});

handleIpc('collect-status', () => {
  return { ok: true, year: getCollectYear(), status: buildCollectStatus(getCollectYear()) };
});

handleIpc('collect-sync', async () => {
  const cfg = config.loadConfig();
  if (!cfg.collectServerUrl) return { ok: false, message: '请先在设置里填写采集服务器地址' };
  const year = getCollectYear();
  const data = await collectClient.fetchSubmissions({
    serverUrl: cfg.collectServerUrl, token: cfg.collectToken, year, mode: 'merged',
  });
  let saved = 0;
  for (const sub of data.submissions || []) {
    database.upsertCollectedSubmission({
      unitName: sub.unitName,
      year,
      controls: sub.controls,
      version: sub.version,
      fillerName: sub.filler && sub.filler.name,
      fillerPhone: sub.filler && sub.filler.phone,
      mergeCenter: sub.mergeCenter,
      isCenter: sub.isCenter,
      sourceUnits: sub.sourceUnitNames || sub.sourceUnits,
      memberCount: sub.memberCount,
      submittedMemberCount: sub.submittedMemberCount,
      submittedAt: sub.submittedAt,
    });
    saved++;
  }
  logger.info('已同步采集数据', { year, saved });
  return { ok: true, year, saved, status: buildCollectStatus(year) };
});

handleIpc('collect-batch-generate', async (_event, unitNames, options = {}) => {
  if (!Array.isArray(unitNames) || unitNames.length === 0) return { ok: false, message: '请选择要生成的学校' };
  const force = !!(options && options.force);
  const year = getCollectYear();
  const layoutTemplatePath = getLayoutTemplatePath();
  if (!fs.existsSync(layoutTemplatePath)) {
    return { ok: false, message: '未找到版式模板文件：经费年报模板.xlsx' };
  }
  const eduOptions = getEduExtractOptions();
  const results = [];

  for (const unitName of unitNames) {
    const onLog = (message, type) => sendToRenderer('generation-log', { message: `[${unitName}] ${message}`, type });
    const collected = database.getCollectedSubmission(unitName, year);
    if (!collected) { results.push({ unitName, ok: false, message: '无采集数据，请先同步' }); continue; }

    // 合并组成员未填齐时默认不生成，避免用残缺数据出草稿（可传 force 强制）
    if (!force && isWaitingMembers(collected)) {
      results.push({ unitName, ok: false, message: `合并组成员未填齐（${collected.submittedMemberCount}/${collected.memberCount}），已跳过；如需强制生成请勾选“忽略未填成员”` });
      continue;
    }

    const files = watcher.getSchoolFiles(unitName);
    const prevReportPath = files && files['上年经费年报'];
    if (!prevReportPath || !fs.existsSync(prevReportPath)) {
      results.push({ unitName, ok: false, message: '缺少上年经费年报，请放入监控目录后重试' });
      continue;
    }

    let eduData = null;
    if (eduReportPath) {
      eduData = extractEduDataFromRows(eduReportData?.rows, unitName, eduOptions)
        || extractEduData(eduReportPath, unitName, eduOptions);
    }

    try {
      const result = await generatePrivateDraft({
        unitName,
        prevReportPath,
        eduData,
        controls: collected.controls,
        outputDir: watcher.folder || path.dirname(prevReportPath),
        layoutTemplatePath,
        onLog,
        ruleOptions: eduOptions,
      });
      if (result.ok && result.computed) {
        const reportId = database.saveReport(result.unitName, result.computed, year, { schoolType: '民办草稿' });
        database.markCollectedGenerated(unitName, year);
        if (result.outputPath) trustedOutputPaths.add(path.resolve(result.outputPath));
        if (result.preview) { generatedPreviews.push(result.preview); sendToRenderer('report-preview', result.preview); }
        results.push({ unitName, ok: true, reportId, outputPath: result.outputPath });
      } else {
        results.push({ unitName, ok: false, message: result.message || '生成失败' });
      }
    } catch (error) {
      logger.error('采集批量生成失败', { unitName, message: error.message });
      results.push({ unitName, ok: false, message: error.message });
    }
  }

  return {
    ok: true,
    year,
    results,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    status: buildCollectStatus(year),
  };
});

handleIpc('save-edited-report', async (_event, payload = {}) => {
  const { unitName, computed, outputPath, mode, sources } = payload;
  if (!unitName) return { ok: false, message: '缺少学校名称' };
  if (!computed || typeof computed !== 'object') return { ok: false, message: '缺少报表数据' };

  const layoutTemplatePath = getLayoutTemplatePath();
  if (!fs.existsSync(layoutTemplatePath)) {
    return { ok: false, message: '未找到版式模板文件：经费年报模板.xlsx' };
  }

  const appConfig = config.loadConfig();
  const allowedOutputRoots = [
    watcher.folder,
    appConfig.exportFolder,
    DATA_DIR,
    app.getPath('documents'),
  ];
  const targetPath = outputPath && path.extname(outputPath)
    ? assertPathInsideAny([...allowedOutputRoots, trustedOutputPaths.has(path.resolve(outputPath)) ? path.dirname(outputPath) : null], outputPath)
    : resolveInside(watcher.folder || appConfig.exportFolder || app.getPath('documents'), `${sanitizeFileName(unitName)}经费年报_已修正.xlsx`);

  computed.__meta = {
    ...(computed.__meta || {}),
    mode: mode || 'edited',
    sources: sources || computed.__meta?.sources || {},
  };
  await writeReport(computed, unitName, targetPath, layoutTemplatePath);
  const reportId = database.saveReport(unitName, computed, new Date().getFullYear(), {
    schoolType: mode === 'private-draft' ? '民办草稿' : undefined,
  });
  return { ok: true, outputPath: targetPath, reportId };
});

// ===== 教育事业年报管理 =====
handleIpc('import-edu-report', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入教育事业年报',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  try {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error('文件为空');

    // 验证是教育事业年报（A1 = "学校代码"）
    const a1 = sheet['A1']?.v;
    if (a1 !== '学校代码') {
      throw new Error('该文件不是教育事业年报（A1单元格应为"学校代码"）');
    }

    // 读取表头和数据
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const headers = [];
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      headers.push(sheet[addr]?.v || `Col${c + 1}`);
    }

    const rows = [];
    for (let r = 1; r <= range.e.r; r++) {
      // 跳过第3行（序号行）
      const firstCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (firstCell == null || String(firstCell).trim() === '') continue;
      // 跳过纯数字序号行
      const secondCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
      if (secondCell != null && /^\d+$/.test(String(secondCell).trim()) && Number(secondCell) < 100) continue;

      const row = {};
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        row[headers[c]] = sheet[addr]?.v ?? null;
      }
      if (row['学校名称']) rows.push(row);
    }

    eduReportPath = filePath;
    eduReportData = { filePath, fileName: path.basename(filePath), headers, rows };
    database.saveEduReport(eduReportData.fileName, filePath, headers, rows);
    logger.info('教育事业年报已导入并保存', { filePath, rows: rows.length });

    return { ok: true, data: eduReportData };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

handleIpc('get-edu-report', () => {
  return eduReportData;
});

function isPrivateEduRow(row = {}) {
  const fields = [
    row['隶属关系名称'],
    row['办别'],
    row['学校办别'],
    row['办学性质'],
    row['学校性质'],
  ].map((value) => String(value || ''));
  return fields.some((value) => value.includes('民办'));
}

handleIpc('get-edu-merge-summary', () => {
  const options = getEduExtractOptions();
  const groups = resolveEduMergeGroups(options.mergeGroups);
  const groupEntries = Object.entries(groups);
  const mergedMembers = new Set(groupEntries.flatMap(([, members]) => members || []));
  const centers = new Set(groupEntries.map(([center]) => center));
  const independentPrivateKindergartens = [];
  if (eduReportData && Array.isArray(eduReportData.rows)) {
    for (const row of eduReportData.rows) {
      const name = row['学校名称'];
      if (!name) continue;
      const isKindergarten = String(row.bxlx || row['bxlx'] || '') === '111';
      const isPrivate = isPrivateEduRow(row);
      if (isKindergarten && isPrivate && !mergedMembers.has(name)) independentPrivateKindergartens.push(name);
    }
  }
  return {
    groups,
    centers: [...centers],
    mergedMembers: [...mergedMembers],
    independentPrivateKindergartens,
  };
});

// ===== 数据库相关 IPC =====
handleIpc('db-get-reports', () => {
  return database.getAllReports();
});

handleIpc('db-get-report-data', (_event, reportId) => {
  return database.getReportDataGrouped(reportId);
});

handleIpc('db-get-report-levels', (_event, reportId) => {
  return database.getReportLevels(reportId);
});

handleIpc('db-get-report-data-by-level', (_event, reportId, level) => {
  return database.getReportDataGrouped(reportId, level);
});

handleIpc('db-get-unfilled', () => {
  return database.getUnfilledReports();
});

handleIpc('db-mark-filled', (_event, reportId) => {
  database.markFilled(reportId);
  return { ok: true };
});

handleIpc('db-delete-report', (_event, reportId) => {
  database.deleteReport(reportId);
  return { ok: true };
});

// 删除一所学校的所有信息（数据库记录 + 已生成年报），并把源文件移回监控目录以便重新生成
handleIpc('delete-school', async (_event, unitName) => {
  if (!unitName) return { ok: false, message: '缺少学校名称' };

  // 1) 删数据库记录（同名可能多条，全删）
  try {
    const reports = database.getAllReports().filter((r) => r.unit_name === unitName);
    for (const r of reports) database.deleteReport(r.id);
  } catch (err) {
    logger.warn('删除数据库记录失败', { unitName, message: err.message });
  }

  // 2) 处理归档子目录中的文件
  const watchFolder = watcher.folder;
  if (watchFolder) {
  const archiveDir = resolveInside(watchFolder, sanitizeFileName(unitName));
    if (fs.existsSync(archiveDir)) {
      try {
        const entries = fs.readdirSync(archiveDir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isFile()) continue;
          if (ent.name.startsWith('~$')) {
            try { fs.unlinkSync(resolveInside(archiveDir, ent.name)); } catch { /* ignore */ }
            continue;
          }
          if (!/\.(xlsx|xls)$/i.test(ent.name)) continue;
          const src = resolveInside(archiveDir, ent.name);
          // 已生成的年报文件直接删除，其它源文件移回上一级供 watcher 重新识别
          if (ent.name.includes('经费年报') && !ent.name.includes('上年')) {
            try { fs.unlinkSync(src); } catch { /* ignore */ }
          } else {
            const dest = resolveInside(watchFolder, ent.name);
            if (fs.existsSync(dest)) {
              try { fs.unlinkSync(src); } catch { /* ignore */ }
            } else {
              try { fs.renameSync(src, dest); } catch (err) {
                logger.warn('移回源文件失败', { src, dest, message: err.message });
              }
            }
          }
        }
        const remaining = fs.readdirSync(archiveDir);
        if (remaining.length === 0) {
          try { fs.rmdirSync(archiveDir); } catch { /* ignore */ }
        }
      } catch (err) {
        logger.warn('处理归档目录失败', { archiveDir, message: err.message });
      }
    }
  }

  // 3) 让 watcher 重新扫描以识别移回的源文件
  try { await watcher.scanAll(); } catch { /* ignore */ }

  return { ok: true };
});

// ===== 账号管理 IPC =====
handleIpc('accounts-load', () => {
  return autoFill.loadAccounts();
});

handleIpc('accounts-upsert', async (_event, { unitName, username, password }) => {
  const accounts = autoFill.upsertAccount(unitName, username, password);
  if (unitName) {
    const status = await license.claimTrialLicense(unitName);
    sendToRenderer('license-status', status);
  }
  return accounts;
});

handleIpc('accounts-delete', (_event, unitName) => {
  return autoFill.deleteAccount(unitName);
});

// ===== 验证码 OCR IPC =====
handleIpc('captcha-recognize', async (_event, imageBase64) => {
  try {
    const result = await autoFill.recognizeCaptcha(imageBase64);
    return { ok: true, text: result };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

// 下载验证码图片并 OCR（一步到位，绕过 CORS）
handleIpc('captcha-download-and-recognize', async (_event, { captchaUrl, cookie }) => {
  try {
    const imageBuffer = await autoFill.downloadCaptchaImage(captchaUrl, cookie);
    if (!imageBuffer || imageBuffer.length < 100) {
      return { ok: false, message: `图片下载异常(${imageBuffer ? imageBuffer.length : 0}字节)` };
    }
    const text = await autoFill.recognizeCaptcha(imageBuffer);
    return { ok: true, text };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

// ===== 自动填报脚本获取 IPC =====
handleIpc('get-login-script', (_event, { username, password, captcha }) => {
  return autoFill.getLoginScript(username, password, captcha);
});

handleIpc('get-captcha-script', () => {
  return autoFill.getCaptchaImageScript();
});

handleIpc('get-submit-script', () => {
  return autoFill.getSubmitLoginScript();
});

handleIpc('get-check-login-script', () => {
  return autoFill.getCheckLoginStatusScript();
});


// ===== 配置与日志 IPC =====
handleIpc('config-load', () => {
  return config.loadConfig();
});

handleIpc('config-save', (_event, patch) => {
  return { ok: true, data: config.updateConfig(patch || {}) };
});

function normalizeImportedRegionRules(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const regionRules = payload.regionRules && typeof payload.regionRules === 'object'
    ? payload.regionRules
    : payload;
  if (!regionRules || typeof regionRules !== 'object' || Array.isArray(regionRules)) {
    throw new Error('规则文件格式不正确');
  }
  const normalized = {
    regionName: String(regionRules.regionName || ''),
    regionCode: String(regionRules.regionCode || ''),
    heatingFeePerStudent: Number(regionRules.heatingFeePerStudent ?? 25),
    mergeGroups: regionRules.mergeGroups || {},
    schoolAliases: regionRules.schoolAliases || {},
    ignoredClosedSchools: regionRules.ignoredClosedSchools || [],
  };
  if (Number.isNaN(normalized.heatingFeePerStudent) || normalized.heatingFeePerStudent < 0) {
    throw new Error('规则文件中的取暖费单价必须是非负数字');
  }
  const badMerge = Object.entries(normalized.mergeGroups).find(([, members]) => members !== null && !Array.isArray(members));
  if (badMerge) throw new Error(`规则文件中的合并关系“${badMerge[0]}”必须是数组或 null`);
  const badAlias = Object.entries(normalized.schoolAliases).find(([, standardName]) => typeof standardName !== 'string');
  if (badAlias) throw new Error(`规则文件中的学校别名“${badAlias[0]}”必须对应字符串`);
  if (!Array.isArray(normalized.ignoredClosedSchools)) throw new Error('规则文件中的撤销/忽略学校必须是数组');
  return normalized;
}

function parseMergeGroupsFromWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const groups = {};
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell || '').trim() === '学校名称'));
    if (headerIndex < 0) continue;
    const header = rows[headerIndex].map((cell) => String(cell || '').trim());
    const nameCol = header.findIndex((cell) => cell === '学校名称');
    if (nameCol < 0) continue;

    let currentCenter = '';
    for (let r = headerIndex + 1; r < rows.length; r++) {
      const rawName = rows[r][nameCol];
      if (rawName == null || String(rawName).trim() === '') continue;
      const text = String(rawName);
      const name = text.trim();
      if (!name || name === '学校名称') continue;
      const isIndented = /^\s+/.test(text);
      if (!isIndented) {
        currentCenter = name;
        if (!groups[currentCenter]) groups[currentCenter] = [currentCenter];
      } else if (currentCenter) {
        groups[currentCenter].push(name);
      }
    }
  }

  for (const [center, members] of Object.entries(groups)) {
    groups[center] = Array.from(new Set([center, ...members])).filter(Boolean);
    if (groups[center].length <= 1) delete groups[center];
  }
  return groups;
}

handleIpc('rules-export', async (_event, regionRules) => {
  const normalized = normalizeImportedRegionRules(regionRules || config.loadConfig().regionRules || {});
  const safeRegion = sanitizeFileName(normalized.regionName || normalized.regionCode || '地区', '地区');
  const defaultPath = path.join(app.getPath('documents'), `${safeRegion}经费年报规则备份.zip`);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出地区规则备份包',
    defaultPath,
    filters: [{ name: '规则备份包', extensions: ['zip'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const packageData = {
    schema: 'expense-annual-report-region-rules',
    version: 1,
    exportedAt: new Date().toISOString(),
    regionRules: normalized,
  };
  const zip = new JSZip();
  zip.file('region-rules.json', JSON.stringify(packageData, null, 2));
  zip.file('README.txt', [
    '经费年报地区规则备份包',
    '',
    '此文件由系统导出，用于备份或迁移地区规则配置。',
    '不需要手工修改。请在系统“规则配置”页面使用“导入规则”恢复。',
    '',
    `地区：${normalized.regionName || ''}`,
    `代码：${normalized.regionCode || ''}`,
    `导出时间：${packageData.exportedAt}`,
  ].join('\r\n'));
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(result.filePath, buffer);
  return { ok: true, filePath: result.filePath };
});

handleIpc('rules-import-merge-excel', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '从Excel导入合并学校关系',
    defaultPath: watcher.folder || app.getPath('documents'),
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const importedGroups = {};
  for (const filePath of result.filePaths) {
    const groups = parseMergeGroupsFromWorkbook(filePath);
    for (const [center, members] of Object.entries(groups)) {
      importedGroups[center] = Array.from(new Set([...(importedGroups[center] || []), ...members]));
    }
  }
  if (Object.keys(importedGroups).length === 0) {
    return { ok: false, message: '未从所选Excel中识别到合并学校关系。请确认表格包含“学校名称”列，且成员学校在中心校下方缩进显示。' };
  }

  const appConfig = config.loadConfig();
  const regionRules = {
    ...(appConfig.regionRules || {}),
    mergeGroups: {
      ...(appConfig.regionRules?.mergeGroups || {}),
      ...importedGroups,
    },
  };
  const updated = config.updateConfig({ regionRules, kindergartenMergeGroups: {} });
  return {
    ok: true,
    fileCount: result.filePaths.length,
    groups: importedGroups,
    data: updated.regionRules,
  };
});

handleIpc('rules-import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入地区规则',
    filters: [
      { name: '规则备份包', extensions: ['zip'] },
      { name: '旧版规则 JSON', extensions: ['json'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  let raw;
  if (path.extname(filePath).toLowerCase() === '.zip') {
    const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
    const entry = zip.file('region-rules.json');
    if (!entry) throw new Error('规则备份包中缺少 region-rules.json');
    raw = JSON.parse(await entry.async('string'));
  } else {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  const regionRules = normalizeImportedRegionRules(raw);
  const updated = config.updateConfig({ regionRules, kindergartenMergeGroups: {} });
  return { ok: true, filePath, data: updated.regionRules };
});

handleIpc('open-log-folder', async () => {
  await shell.openPath(logger.getLogDir());
  return { ok: true };
});
