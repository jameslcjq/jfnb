const { app, BrowserWindow, dialog, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { configureAppPaths, DATA_DIR } = require('./paths');

configureAppPaths(app);

const XLSX = require('@e965/xlsx');
const JSZip = require('jszip');
const { FolderWatcher, REQUIRED_TYPES } = require('./watcher');
const { generateReport, generatePrivateDraft, eduDataFromCollectControls, writeReport, resolveEduMergeGroups, splitComputedByStage } = require('./report-engine');
const database = require('./database');
const autoFill = require('./auto-fill');
const collectClient = require('./collect-client');
const { installDownloadInterception } = require('./download-intercept');
const { resolveAppRole } = require('./app-role');
const { validateFormalControls } = require('./formal-controls');
const { loadSchoolAttributes } = require('./school-attributes');
const logger = require('./logger');
const config = require('./config');
const license = require('./license');
const { sanitizeFileName, resolveInside, assertPathInsideAny, uniqueFilePath } = require('./path-safety');
const { normalizeSchoolName } = require('./name-normalize');

let mainWindow;
const watcher = new FolderWatcher();
let isGenerating = false;
let generatedPreviews = [];
const trustedOutputPaths = new Set();
let businessLicenseCache = { status: null, checkedAt: 0 };

const LICENSE_FREE_CHANNELS = new Set([
  'license-status',
  'license-check',
  'license-claim-trial',
  'license-save-key',
  'license-clear',
  'license-device-info',
  'license-export-machine-request',
  'license-import-offline',
]);

const GOV_WEBVIEW_PARTITION = 'persist:gov-platform';
const ALLOWED_WEBVIEW_HOST_SUFFIXES = ['moe.edu.cn'];
const REPORT_RULE_FILES = [
  { name: '自定义公式.xlsx', source: '自定义公式' },
  { name: '系统公式.xlsx', source: '系统公式' },
];
const SCHOOL_ATTRIBUTES_FILE = '学校属性.json';
// 由 scripts/build-explanation-library.js 从县下发《校验结果.xlsx》《数据变动原因说明.xlsx》提炼。
const EXPLANATION_LIBRARY_FILE = '说明库.json';

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
    heatingFeePerStudent: Number(regionRules.heatingFeePerStudent ?? 25),
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
    reportRuleFiles: getReportRuleFiles(),
    // 全局兜底参数；逐校的 xxlbdm/lsgxdm/dwdm/cxfldm/phx 由 schoolAttributes 按单位名合并覆盖。
    reportRuleContext: {
      dqdm: regionRules.regionCode || appConfig.regionCode || '',
      xxlbdm: regionRules.schoolCategoryCode || '',
      lsgxdm: regionRules.affiliationCode || '',
      dwdm: regionRules.unitCode || '',
      bbnd: String(getCollectYear()),
    },
    schoolAttributes: getSchoolAttributes(),
    explanationLibrary: getExplanationLibrary(),
  };
}

async function getBusinessLicenseStatus(force = false) {
  const now = Date.now();
  if (!force && businessLicenseCache.status && now - businessLicenseCache.checkedAt < 30000) {
    return businessLicenseCache.status;
  }
  const status = await license.ensureUsableLicense();
  businessLicenseCache = { status, checkedAt: now };
  return status;
}

function rememberLicenseStatus(status) {
  if (status?.valid) {
    const features = status.features || {};
    const runtimeRole = resolveAppRole(status);
    if (runtimeRole.deploymentMode === 'managed') {
      const current = config.loadConfig();
      const patch = {};
      const serverUrl = String(features.collect_server_url || features.collectServerUrl || '').trim();
      const token = String(features.collect_token || features.collectToken || '').trim();
      if (serverUrl || !current.collectServerUrl) patch.collectServerUrl = serverUrl || 'https://jyj.yunbg.vip/collect';
      if (token) patch.collectToken = token;
      if (Object.keys(patch).length) config.updateConfig(patch);
    }
  }
  businessLicenseCache = { status, checkedAt: Date.now() };
  return status;
}

async function getRuntimeAppRole() {
  const status = await getBusinessLicenseStatus();
  const appConfig = config.loadConfig();
  const allowLocalOverride = !app.isPackaged && process.env.GZNB_ALLOW_ROLE_OVERRIDE === '1';
  return resolveAppRole(
    status,
    allowLocalOverride ? appConfig.roleOverride : '',
    allowLocalOverride ? appConfig.deploymentModeOverride : '',
  );
}

// 完整版解锁：有可用的在线授权（有效且未过期未回拨）。
// 空/无效授权 = 免费版：预览隐藏“支出表”，且禁止导出 Excel 文件。
async function isFullVersionUnlocked() {
  try {
    return license.isLicenseUsableStatus(await getBusinessLicenseStatus());
  } catch {
    return false;
  }
}

async function ensureManagedDeployment() {
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.deploymentMode !== 'standalone') return null;
  return { ok: false, code: 'STANDALONE_OFFLINE', message: '单机学校版不连接经办服务器，相关数据仅保存在本机。' };
}

function unitNameForRole(runtimeRole, appConfig = config.loadConfig()) {
  if (runtimeRole.role !== 'school') return '';
  return runtimeRole.deploymentMode === 'standalone'
    ? String(appConfig.standaloneProfile?.unitName || '').trim()
    : String(runtimeRole.unitName || '').trim();
}

async function ensureUnitAccess(unitName) {
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return null;
  const expected = unitNameForRole(runtimeRole);
  if (!expected) return { ok: false, code: 'UNIT_NOT_CONFIGURED', message: '当前学校授权未配置单位名称' };
  if (normalizeSchoolName(unitName) !== normalizeSchoolName(expected)) {
    return { ok: false, code: 'UNIT_FORBIDDEN', message: `学校版只能处理本单位“${expected}”的数据` };
  }
  // 归一化会去掉括号，“X小学（分校）”与“X小学分校”被视为同一所。这里放行但留痕：
  // 万一县里真有两所只差括号的学校，日志能查到是哪一次放行把两校串到了一起。
  if (String(unitName || '').trim() !== String(expected).trim()) {
    logger.warn('单位名称非精确匹配，按归一化结果放行', { unitName, expected });
  }
  return null;
}

async function ensureOperatorRole() {
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role === 'operator') return null;
  return { ok: false, code: 'OPERATOR_REQUIRED', message: '此功能仅限经办版使用' };
}

async function reportAccessError(reportId) {
  const row = database.getAllReports().find((item) => Number(item.id) === Number(reportId));
  if (!row) return { ok: false, message: '报表不存在' };
  return ensureUnitAccess(row.unit_name);
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
    // 拦截政府平台导出的「上年经费年报（基表）」，复核后规范命名入库到监控目录
    installDownloadInterception(webContents.session, {
      getTargetDir: () => watcher.folder,
      logger,
      accept: async (unitName) => !(await ensureUnitAccess(unitName)),
      onDone: async (info) => {
        if (info.ok) {
          logger.info('已入库上年经费年报', { unitName: info.unitName, savedPath: info.savedPath });
          try { await watcher.scanAll(); } catch { /* ignore */ }
        } else {
          logger.warn('上年经费年报下载未入库', { reason: info.reason, originalName: info.originalName });
        }
        sendToRenderer('prev-report-captured', info);
      },
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

function ensureDefaultReportRules() {
  const targetDir = path.join(DATA_DIR, '校验规则');
  try { fs.mkdirSync(targetDir, { recursive: true }); } catch { return; }
  for (const rule of [...REPORT_RULE_FILES, { name: SCHOOL_ATTRIBUTES_FILE }, { name: EXPLANATION_LIBRARY_FILE }]) {
    const target = path.join(targetDir, rule.name);
    if (fs.existsSync(target)) continue;
    const candidates = [
      getResourcePath(path.join('校验规则', rule.name)),
      path.resolve(app.getAppPath(), 'rules', rule.name),
    ];
    const source = candidates.find((candidate) => fs.existsSync(candidate));
    if (!source) continue;
    try {
      fs.copyFileSync(source, target);
      logger.info('已初始化年报校验规则', { source, target });
    } catch (error) {
      logger.warn('初始化年报校验规则失败', { source, target, message: error.message });
    }
  }
}

function getReportRuleFiles() {
  return REPORT_RULE_FILES.map((rule) => {
    const candidates = [
      path.join(DATA_DIR, '校验规则', rule.name),
      getResourcePath(path.join('校验规则', rule.name)),
      path.resolve(app.getAppPath(), 'rules', rule.name),
    ];
    const rulePath = candidates.find((candidate) => fs.existsSync(candidate));
    return rulePath ? { path: rulePath, source: rule.source } : null;
  }).filter(Boolean);
}

function getSchoolAttributes() {
  const candidates = [
    path.join(DATA_DIR, '校验规则', SCHOOL_ATTRIBUTES_FILE),
    getResourcePath(path.join('校验规则', SCHOOL_ATTRIBUTES_FILE)),
    path.resolve(app.getAppPath(), 'rules', SCHOOL_ATTRIBUTES_FILE),
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  return filePath ? loadSchoolAttributes(filePath) : {};
}

// 建议原因说明库：文件缺失或损坏时返回 null，不影响报表生成（说明退回模板）。
function getExplanationLibrary() {
  const candidates = [
    path.join(DATA_DIR, '校验规则', EXPLANATION_LIBRARY_FILE),
    getResourcePath(path.join('校验规则', EXPLANATION_LIBRARY_FILE)),
    path.resolve(app.getAppPath(), 'rules', EXPLANATION_LIBRARY_FILE),
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    logger.warn('说明库读取失败，情况说明将使用内置模板', { filePath, message: error.message });
    return null;
  }
}

app.whenReady().then(() => {
  session.fromPartition(GOV_WEBVIEW_PARTITION).setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  ensureDefaultTemplate();
  ensureDefaultReportRules();
  database.initDatabase();
  createWindow();
  logger.info('应用启动完成');
  // 启动后尝试补传上次离线暂存的回传（不阻塞启动）
  setTimeout(() => { flushBackfillQueue().catch(() => {}); }, 4000);
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
      if (!LICENSE_FREE_CHANNELS.has(channel)) {
        const status = await getBusinessLicenseStatus();
        const runtimeRole = resolveAppRole(status);
        if (runtimeRole.deploymentMode !== 'standalone' && !license.isLicenseUsableStatus(status)) {
          return { ok: false, code: 'LICENSE_REQUIRED', message: license.describeLicenseStatus(status) };
        }
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
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[candidates.length - 1];
}

// 允许落盘 / 定位的输出根目录。写入（save-edited-report）与定位（reveal-output）
// 必须用同一套约束，否则渲染层可以拿任意路径调起资源管理器。
function getAllowedOutputRoots(appConfig = config.loadConfig()) {
  return [
    watcher.folder,
    appConfig.exportFolder,
    DATA_DIR,
    app.getPath('documents'),
  ].filter(Boolean);
}

function removeGeneratedWorkbookFiles(result) {
  const paths = new Set([
    result?.outputPath,
    ...(result?.stageReports || []).map((stage) => stage?.outputPath),
  ].filter(Boolean).map((filePath) => path.resolve(filePath)));
  for (const filePath of paths) {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (error) {
      logger.warn('免费版成品文件清理失败', { filePath, message: error.message });
    }
  }
  result.outputPath = '';
  for (const stage of result.stageReports || []) stage.outputPath = '';
  if (result.preview) {
    result.preview.outputPath = '';
    for (const stage of result.preview.stageReports || []) stage.outputPath = '';
  }
}

// ===== Watcher 事件转发 =====
watcher.on('watching', (data) => sendToRenderer('watcher-event', { event: 'watching', ...data }));
watcher.on('status', (data) => sendToRenderer('watcher-event', { event: 'status', ...data }));
watcher.on('log', (data) => sendToRenderer('watcher-event', { event: 'log', ...data }));
watcher.on('file-recognized', (data) => sendToRenderer('watcher-event', { event: 'file-recognized', ...data }));

watcher.on('ready', async (data) => {
  if (isGenerating) return;
  sendToRenderer('watcher-event', { event: 'all-ready', schools: data.schools });
  // 已按用户要求关闭自动生成，改为手动触发
  // await doBatchGenerate(data.schools);
});

// ===== 批量生成 =====
// 外层只负责状态收尾：不论正常结束还是中途抛错（归档目录被同名文件占位、导入盘掉线等），
// 都必须复位 isGenerating 并发出 generation-done。否则界面一直停在“生成中”，
// 之后每次生成都被“正在生成中，请稍后”挡掉，只能重启软件。
async function doBatchGenerate(schoolNames) {
  if (isGenerating) return;
  isGenerating = true;
  try {
    await runBatchGenerate(schoolNames);
  } catch (error) {
    logger.error('批量生成异常中止', error);
    // 让还挂在队列里的学校退出“生成中”；源文件保留，便于修正后重来
    for (const unitName of schoolNames) {
      try { watcher.markFailed(unitName); } catch { /* 收尾失败不影响提示 */ }
    }
    sendToRenderer('generation-done', {
      ok: false,
      total: schoolNames.length,
      success: 0,
      failed: schoolNames.length,
      message: `生成异常中止：${error.message || error}`,
    });
  } finally {
    isGenerating = false;
  }
}

async function runBatchGenerate(schoolNames) {
  const licenseStatus = await license.ensureUsableLicense();
  const runtimeRole = resolveAppRole(licenseStatus);
  // 免费版（无可用授权）可生成并预览，但不保留可导出的 .xlsx 文件。
  const unlocked = license.isLicenseUsableStatus(licenseStatus);
  if (runtimeRole.deploymentMode !== 'standalone' && !unlocked) {
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
    return;
  }

  const standaloneProfile = config.loadConfig().standaloneProfile || {};
  const standaloneUnitName = String(standaloneProfile.unitName || '').trim();

  for (const unitName of schoolNames) {
    watcher.markProcessing(unitName);
    const files = watcher.getSchoolFiles(unitName);

    sendToRenderer('generation-log', { message: `\n===== 处理：${unitName} =====`, type: 'log' });

    const onLog = (message, type) => {
      sendToRenderer('generation-log', { message: `[${unitName}] ${message}`, type });
    };

    let result;
    try {
      // 单机正式报表必须使用本机填写的人员/学生资料；联网模式继续使用在线采集资料。
      const eduOptions = getEduExtractOptions();
      const isStandaloneFormal = runtimeRole.role === 'school'
        && runtimeRole.deploymentMode === 'standalone'
        && config.loadConfig().workMode === 'formal';
      if (isStandaloneFormal && normalizeSchoolName(unitName) !== normalizeSchoolName(standaloneUnitName)) {
        throw new Error(`单机学校版只能生成本单位“${standaloneUnitName}”的报表`);
      }
      const collected = isStandaloneFormal ? null : database.getCollectedSubmission(unitName, getCollectYear());
      if (collected?.collectScope === 'mixed') {
        throw new Error('该合并组同时存在“完整采集”和“仅人员采集”，请先在采集看板统一整组范围后重新同步');
      }
      if (collected && isWaitingMembers(collected)) {
        throw new Error(`合并组成员未填齐（${collected.submittedMemberCount}/${collected.memberCount}），人员总数不完整，已阻止生成`);
      }
      const standaloneValidation = isStandaloneFormal
        ? validateFormalControls(standaloneProfile.formalControls || {})
        : null;
      if (standaloneValidation && !standaloneValidation.ok) {
        throw new Error(`本单位人员与学生资料不完整：${Object.values(standaloneValidation.errors)[0]}`);
      }
      const eduData = isStandaloneFormal
        ? eduDataFromCollectControls(standaloneValidation.controls)
        : (collected ? eduDataFromCollectControls(collected.controls) : null);
      if (!eduData) {
        if (isStandaloneFormal) {
          throw new Error('请先在“学校状态”页保存本单位年末人员与学生资料，再生成报表');
        }
        onLog('未同步到该校在线填报的人员数据，人员表年末数将沿用上年（请在采集系统标注该校并通知填报，然后同步）', 'warn');
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
          result.computed.__meta = {
            ...(result.computed.__meta || {}),
            generation: {
              appVersion: app.getVersion(),
              importFolder: watcher.folder,
              sourceFiles: Object.fromEntries(Object.entries(files).map(([type, filePath]) => [type, path.basename(filePath)])),
            },
          };
          const reportId = database.saveReport(result.unitName, result.computed, getCollectYear(), {
            bxlx: result.bxlx,
            schoolType: result.schoolType,
            levelData: result.levelData,
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

      if (unlocked) {
        // 归档
        const archiveDir = resolveInside(watcher.folder, sanitizeFileName(unitName));
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

        // 移动生成的年报到归档目录
        if (result.outputPath && fs.existsSync(result.outputPath)) {
          const dest = uniqueFilePath(archiveDir, path.basename(result.outputPath));
          try {
            fs.renameSync(result.outputPath, dest);
            result.outputPath = dest;
            if (result.preview) result.preview.outputPath = dest;
            trustedOutputPaths.add(path.resolve(dest));
          } catch { /* ignore */ }
        }
        for (const stage of result.stageReports || []) {
          if (stage.outputPath) trustedOutputPaths.add(path.resolve(stage.outputPath));
        }
      } else {
        // 免费版：删除刚写出的 .xlsx，不保留任何可导出的成品文件，仅保留预览与数据库记录。
        removeGeneratedWorkbookFiles(result);
        result.exportLocked = true;
        if (result.preview) result.preview.exportLocked = true;
        sendToRenderer('generation-log', {
          message: `[${unitName}] 免费版仅供预览：未导出 Excel 文件，激活完整版后可导出并查看支出表`,
          type: 'warn',
        });
      }

      watcher.markDone(unitName);
      results.push(result);

      if (result.preview) {
        generatedPreviews.push(result.preview);
        sendToRenderer('report-preview', result.preview);
      }
    } else {
      watcher.markFailed(unitName);
      results.push(result);
    }
  }

  sendToRenderer('generation-done', {
    ok: results.every((r) => r.ok),
    total: schoolNames.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    message: `完成 ${results.filter((r) => r.ok).length}/${schoolNames.length} 个学校`,
  });
}

// ===== IPC 处理：授权信息 =====
handleIpc('license-status', async () => {
  return rememberLicenseStatus(await license.getCachedLicenseStatus());
});

handleIpc('app-role', async () => {
  return getRuntimeAppRole();
});

handleIpc('license-check', async (_event, licenseKey) => {
  return rememberLicenseStatus(await license.verifyLicense(licenseKey));
});

handleIpc('license-claim-trial', async (_event, customerName, customerCode) => {
  return rememberLicenseStatus(await license.claimTrialLicense(customerName, customerCode));
});

handleIpc('license-save-key', async (_event, licenseKey) => {
  license.saveLicenseKey(licenseKey);
  return rememberLicenseStatus(await license.verifyLicense(licenseKey));
});

handleIpc('license-clear', async () => {
  config.updateConfig({ collectServerUrl: '', collectToken: '', collectYear: 0 });
  return rememberLicenseStatus(license.clearLicenseKey());
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
  return rememberLicenseStatus(await license.importOfflineLicenseText(raw));
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

handleIpc('open-watch-folder', async () => {
  const folder = watcher.folder || config.resolveDefaultFolder();
  try {
    const message = await shell.openPath(folder);
    return message ? { ok: false, message } : { ok: true, folder };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

handleIpc('stop-watching', () => {
  watcher.stop();
  return { ok: true };
});

handleIpc('get-status', async () => {
  const status = watcher.getStatus();
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return status;
  const unitName = unitNameForRole(runtimeRole);
  return {
    ...status,
    schools: status.schools.filter((school) => normalizeSchoolName(school.unitName) === normalizeSchoolName(unitName)),
  };
});

handleIpc('get-previews', async () => {
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return generatedPreviews;
  const unitName = unitNameForRole(runtimeRole);
  return generatedPreviews.filter((preview) => normalizeSchoolName(preview.unitName) === normalizeSchoolName(unitName));
});

handleIpc('generate-selected', async (_event, schoolNames) => {
  if (isGenerating) return { ok: false, message: '正在生成中，请稍后' };
  if (!Array.isArray(schoolNames) || schoolNames.length === 0) {
    return { ok: false, message: '请先选择要生成的学校' };
  }
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role === 'school') {
    const unitName = unitNameForRole(runtimeRole);
    if (!unitName) return { ok: false, message: '请先完成单机学校版首次设置' };
    if (schoolNames.some((name) => normalizeSchoolName(name) !== normalizeSchoolName(unitName))) {
      return { ok: false, message: `单机学校版只能生成本单位“${unitName}”的报表` };
    }
  }
  // 异步执行；doBatchGenerate 内部已有兜底，这里再挂一层，避免未捕获的 Promise 拒绝
  doBatchGenerate(schoolNames).catch((error) => logger.error('批量生成未捕获异常', error));
  return { ok: true };
});

// 再次读取五件套的实际内容，避免用户在勾选后替换、删除或放错源文件。
handleIpc('preflight-generate', async (_event, schoolNames) => {
  if (!Array.isArray(schoolNames) || schoolNames.length === 0) {
    return { ok: false, checks: [{ unitName: '', issues: ['请先选择要生成的学校'] }] };
  }
  const checks = [];
  for (const unitName of schoolNames) {
    const files = watcher.getSchoolFiles(unitName);
    const issues = [];
    for (const type of REQUIRED_TYPES) {
      const filePath = files[type];
      if (!filePath || !fs.existsSync(filePath)) {
        issues.push(`缺少${type}`);
        continue;
      }
      const detected = await watcher.analyzeFile(filePath);
      if (!detected || detected.type !== type) {
        issues.push(`${type}无法识别或文件内容不匹配`);
      } else if (normalizeSchoolName(detected.unitName) !== normalizeSchoolName(unitName)) {
        issues.push(`${type}的学校名称与当前学校不一致`);
      }
    }
    checks.push({ unitName, issues });
  }
  return { ok: checks.every((item) => item.issues.length === 0), checks };
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
  const { unitName, prevReportPath } = payload;
  let controls = payload.controls || {};
  if (!unitName) return { ok: false, message: '请选择学校' };
  const accessError = await ensureUnitAccess(unitName);
  if (accessError) return accessError;
  if (!prevReportPath || !fs.existsSync(prevReportPath)) {
    return { ok: false, message: '请选择有效的上年经费年报文件' };
  }
  const peopleValidation = validateFormalControls(controls);
  if (!peopleValidation.ok) {
    return { ok: false, message: Object.values(peopleValidation.errors)[0], errors: peopleValidation.errors };
  }
  controls = { ...controls, ...peopleValidation.controls };

  const layoutTemplatePath = getLayoutTemplatePath();
  if (!fs.existsSync(layoutTemplatePath)) {
    return { ok: false, message: '未找到版式模板文件：经费年报模板.xlsx' };
  }

  // 事业年报已弃用：年末人员/学生数取表单填写值
  const eduOptions = getEduExtractOptions();
  const eduData = eduDataFromCollectControls(controls);
  if (!eduData) {
    return { ok: false, message: '请填写年末教职工数和学生数（人员与学生栏）' };
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
    const reportId = database.saveReport(result.unitName, result.computed, getCollectYear(), {
      bxlx: result.bxlx,
      schoolType: result.schoolType,
      levelData: result.levelData,
    });
    result.reportId = reportId;
    // 免费版：删除刚写出的草稿 .xlsx，仅保留预览与数据库记录。
    if (!(await isFullVersionUnlocked())) {
      removeGeneratedWorkbookFiles(result);
      result.exportLocked = true;
      if (result.preview) result.preview.exportLocked = true;
    } else if (result.outputPath) {
      trustedOutputPaths.add(path.resolve(result.outputPath));
      for (const stage of result.stageReports || []) {
        if (stage.outputPath) trustedOutputPaths.add(path.resolve(stage.outputPath));
      }
    }
    generatedPreviews.push(result.preview);
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
  // 事业年报已弃用：名单只推送本地维护的合并组关系（年度全量名单由服务端脚本维护，
  // 独立学校由 admin 看板“标注采集”纳入，桌面端不再有权新增学校）。
  const options = getEduExtractOptions();
  const groups = resolveEduMergeGroups(options.mergeGroups);
  const schools = [];
  const seen = new Set();

  // 已撤销学校不进采集名单：否则永远无法提交，中心园会一直“等待成员”
  const ignoredClosed = new Set(
    (options.ignoredClosedSchools || []).map((n) => String(n || '').replace(/\s+/g, '').trim()).filter(Boolean)
  );

  const add = (unitName, mergeCenter, isCenter) => {
    const name = String(unitName || '').trim();
    if (!name || seen.has(name)) return;
    if (ignoredClosed.has(name.replace(/\s+/g, ''))) return;
    seen.add(name);
    schools.push({
      unitName: name,
      mergeCenter: mergeCenter || null,
      isCenter: !!isCenter,
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
    if (s.collectScope === 'mixed') state = 'scope-conflict';
    else if (s.collectScope === 'people' && waiting) state = 'formal-waiting-members';
    else if (s.collectScope === 'people') state = 'formal-people'; // 公办有报表：人员数已采集，报表在「学校状态」用五件套生成
    else if (s.stale) state = 'stale';                 // 已生成但之后又有新提交
    else if (s.generatedAt) state = 'generated';
    else if (waiting) state = 'waiting-members';  // 合并组成员未填齐
    else if (!hasPrev) state = 'missing-prev';
    else state = 'ready';
    return { ...s, hasPrev, waiting, state };
  });
}

// 年度契约：服务端以自身 collectionYear 为准。两端不一致时必须硬阻断，
// 否则整批数据会被静默记到错误年度。
function assertCollectYearMatch(localYear, serverYear, action) {
  if (Number(serverYear) !== Number(localYear)) {
    throw new Error(
      `${action}中止：服务器采集年度为 ${serverYear}，本机为 ${localYear}。` +
      '请检查两端时间/配置（config 的 collectYear 留 0 即自动取当前年−1）。'
    );
  }
}

handleIpc('collect-push-schools', async () => {
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return forbidden;
  const cfg = config.loadConfig();
  if (!cfg.collectServerUrl) return { ok: false, message: '请先在设置里填写采集服务器地址' };
  const year = getCollectYear();
  const schools = buildCollectSchoolList();
  if (schools.length === 0) return { ok: false, message: '没有可推送的学校，请先导入教育事业年报或配置合并组' };
  const result = await collectClient.pushSchools({
    serverUrl: cfg.collectServerUrl, token: cfg.collectToken, year, schools,
  });
  assertCollectYearMatch(year, result.year, '推送名单');
  logger.info('已推送采集名单', { year, count: result.count, deactivated: result.deactivated });
  return {
    ok: true, year, count: result.count,
    deactivated: result.deactivated || 0,
    schools: result.schools || [],
  };
});

handleIpc('collect-status', async () => {
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return forbidden;
  return { ok: true, year: getCollectYear(), status: buildCollectStatus(getCollectYear()) };
});

handleIpc('collect-sync', async () => {
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return forbidden;
  const cfg = config.loadConfig();
  if (!cfg.collectServerUrl) return { ok: false, message: '请先在设置里填写采集服务器地址' };
  const year = getCollectYear();
  const data = await collectClient.fetchSubmissions({
    serverUrl: cfg.collectServerUrl, token: cfg.collectToken, year, mode: 'merged',
  });
  assertCollectYearMatch(year, data.year, '同步');
  let saved = 0;
  const presentNames = [];
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
      collectScope: sub.collectScope,
      submittedAt: sub.submittedAt,
    });
    presentNames.push(sub.unitName);
    saved++;
  }
  // 全量快照对账：服务端重置/拆组/停用后，本地不残留旧聚合行
  const pruned = database.pruneCollectedSubmissions(year, presentNames);
  // 顺带补传离线暂存的回传
  const flush = await flushBackfillQueue().catch(() => ({ flushed: 0 }));
  logger.info('已同步采集数据', { year, saved, pruned, flushed: flush.flushed });
  return { ok: true, year, saved, pruned, backfillFlushed: flush.flushed, status: buildCollectStatus(year) };
});

// 单校向导：取该校线上数据（用于预填/锁定）。台账没有则联网拉一次本单位，
// 让联网学校版“打开软件即自动下载线上数据”，无需依赖经办才能跑的整体同步。
handleIpc('collect-get-one', async (_event, unitName) => {
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return forbidden;
  const accessError = await ensureUnitAccess(unitName);
  if (accessError) return accessError;
  const year = getCollectYear();
  let collected = database.getCollectedSubmission(unitName, year);
  if (!collected) {
    const cfg = config.loadConfig();
    if (cfg.collectServerUrl) {
      try {
        const data = await collectClient.fetchSubmissions({
          serverUrl: cfg.collectServerUrl, token: cfg.collectToken, year, mode: 'merged',
        });
        assertCollectYearMatch(year, data.year, '拉取');
        const sub = (data.submissions || []).find(
          (s) => normalizeSchoolName(s.unitName) === normalizeSchoolName(unitName),
        );
        if (sub) {
          database.upsertCollectedSubmission({
            unitName: sub.unitName, year, controls: sub.controls, version: sub.version,
            fillerName: sub.filler && sub.filler.name, fillerPhone: sub.filler && sub.filler.phone,
            mergeCenter: sub.mergeCenter, isCenter: sub.isCenter,
            sourceUnits: sub.sourceUnitNames || sub.sourceUnits,
            memberCount: sub.memberCount, submittedMemberCount: sub.submittedMemberCount,
            collectScope: sub.collectScope, submittedAt: sub.submittedAt,
          });
          collected = database.getCollectedSubmission(unitName, year);
        }
      } catch (error) {
        logger.warn('拉取本单位线上数据失败', { unitName, message: error.message });
      }
    }
  }
  return { ok: true, year, collected: collected || null };
});

// ===== 回传离线队列（网络异常时暂存，联网后自动补传） =====
function backfillQueuePath() {
  return path.join(app.getPath('userData'), 'backfill-queue.json');
}
function readBackfillQueue() {
  try { return JSON.parse(fs.readFileSync(backfillQueuePath(), 'utf8')) || []; } catch { return []; }
}
function writeBackfillQueue(list) {
  try { fs.writeFileSync(backfillQueuePath(), JSON.stringify(list || [], null, 2), 'utf8'); } catch (e) { logger.warn('写回传队列失败', { message: e.message }); }
}
function enqueueBackfill(item) {
  const list = readBackfillQueue();
  // 同单位同年度只保留最新一条待补传
  const filtered = list.filter((x) => !(x.unitName === item.unitName && x.year === item.year));
  filtered.push({ ...item, queuedAt: new Date().toISOString() });
  writeBackfillQueue(filtered);
}
function isNetworkError(error) {
  if (typeof error?.retryable === 'boolean') return error.retryable;
  if (error?.name === 'AbortError' || error?.name === 'TypeError') return true;
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']
    .includes(code);
}
async function flushBackfillQueue() {
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return { flushed: 0, remaining: readBackfillQueue().length };
  const cfg = config.loadConfig();
  if (!cfg.collectServerUrl) return { flushed: 0, remaining: readBackfillQueue().length };
  const list = readBackfillQueue();
  if (list.length === 0) return { flushed: 0, remaining: 0 };
  const remain = [];
  let flushed = 0;
  for (const item of list) {
    try {
      const data = await collectClient.backfillSubmissions({
        serverUrl: cfg.collectServerUrl, token: cfg.collectToken,
        submissions: [{ unitName: item.unitName, controls: item.controls, filler: item.filler }],
      });
      const r = (data.results || [])[0] || {};
      if (r.ok) { flushed++; } else { /* 业务失败：丢弃，不无限重试 */ logger.warn('队列补传被服务端拒绝', { unitName: item.unitName, message: r.message }); }
    } catch (error) {
      if (isNetworkError(error)) remain.push(item); // 仍离线，留队列
      else logger.warn('队列补传业务错误，丢弃', { unitName: item.unitName, message: error.message });
    }
  }
  writeBackfillQueue(remain);
  if (flushed > 0) logger.info('离线回传队列已补传', { flushed, remaining: remain.length });
  return { flushed, remaining: remain.length };
}

// 单校向导：本地填写的数据回传服务器（入同一台账，来源 desktop），并刷新本地台账
handleIpc('collect-backfill', async (_event, payload = {}) => {
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return forbidden;
  const cfg = config.loadConfig();
  if (!cfg.collectServerUrl) return { ok: false, message: '请先在设置里填写采集服务器地址' };
  const { unitName, controls, filler } = payload;
  if (!unitName || !controls) return { ok: false, message: '缺少单位或数据' };
  const accessError = await ensureUnitAccess(unitName);
  if (accessError) return accessError;
  const year = getCollectYear();

  let data;
  try {
    data = await collectClient.backfillSubmissions({
      serverUrl: cfg.collectServerUrl,
      token: cfg.collectToken,
      submissions: [{ unitName, controls, filler }],
    });
  } catch (error) {
    if (isNetworkError(error)) {
      enqueueBackfill({ unitName, year, controls, filler, collectScope: payload.collectScope || 'full' });
      logger.warn('回传失败已暂存，联网后自动补传', { unitName, message: error.message });
      return { ok: true, queued: true, message: '当前无法连接服务器，已暂存，联网后自动补传' };
    }
    return { ok: false, message: error.message };
  }

  const result = (data.results || [])[0] || {};
  if (!result.ok) return { ok: false, message: result.message || '回传失败' };

  // 本地台账即时反映该校提交（下次“同步”会以服务端汇总口径覆盖）
  database.upsertCollectedSubmission({
    unitName,
    year,
    controls,
    version: result.version,
    fillerName: filler && filler.name,
    fillerPhone: filler && filler.phone,
    collectScope: payload.collectScope || 'full',
    submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  logger.info('本地数据已回传服务器', { unitName, version: result.version });
  return { ok: true, version: result.version, status: buildCollectStatus(year) };
});

handleIpc('collect-batch-generate', async (_event, unitNames, options = {}) => {
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
  const forbidden = await ensureManagedDeployment();
  if (forbidden) return forbidden;
  if (!Array.isArray(unitNames) || unitNames.length === 0) return { ok: false, message: '请选择要生成的学校' };
  const force = !!(options && options.force);
  const year = getCollectYear();
  const layoutTemplatePath = getLayoutTemplatePath();
  if (!fs.existsSync(layoutTemplatePath)) {
    return { ok: false, message: '未找到版式模板文件：经费年报模板.xlsx' };
  }
  const fullVersionUnlocked = await isFullVersionUnlocked();
  const eduOptions = getEduExtractOptions();
  const results = [];

  for (const unitName of unitNames) {
    const onLog = (message, type) => sendToRenderer('generation-log', { message: `[${unitName}] ${message}`, type });
    const collected = database.getCollectedSubmission(unitName, year);
    if (!collected) { results.push({ unitName, ok: false, message: '无采集数据，请先同步' }); continue; }

    if (collected.collectScope === 'mixed') {
      results.push({ unitName, ok: false, message: '该合并组采集范围不一致，请在服务端看板统一整组范围后重新同步' });
      continue;
    }

    // 公办有报表单位只采集人员数，报表用五件套在「学校状态」页生成
    if (collected.collectScope === 'people') {
      results.push({ unitName, ok: false, message: '该单位为公办有报表（仅采集人员数），请在「学校状态」页用五件套生成，人员数会自动使用' });
      continue;
    }

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

    // 事业年报已弃用：年末人员/学生数取学校在线填报值
    const eduData = eduDataFromCollectControls(collected.controls);

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
        // 留痕：把生成时使用的采集快照固化进报表元数据（meta_json），
        // 之后同步覆盖采集行也不影响“这份报表用的是哪一版数据”的追溯
        result.computed.__meta = {
          ...(result.computed.__meta || {}),
          collectSnapshot: {
            version: collected.version,
            submittedAt: collected.submittedAt,
            filler: { name: collected.fillerName, phone: collected.fillerPhone },
            mergeCenter: collected.mergeCenter,
            sourceUnits: collected.sourceUnits,
            memberCount: collected.memberCount,
            submittedMemberCount: collected.submittedMemberCount,
            forced: force && isWaitingMembers(collected) ? true : undefined,
            controls: collected.controls,
            generatedAt: new Date().toISOString(),
          },
        };
        const reportId = database.saveReport(result.unitName, result.computed, year, {
          schoolType: '民办草稿', levelData: result.levelData,
        });
        database.markCollectedGenerated(unitName, year);
        if (fullVersionUnlocked) {
          if (result.outputPath) trustedOutputPaths.add(path.resolve(result.outputPath));
          for (const stage of result.stageReports || []) {
            if (stage.outputPath) trustedOutputPaths.add(path.resolve(stage.outputPath));
          }
        } else {
          removeGeneratedWorkbookFiles(result);
          result.exportLocked = true;
          if (result.preview) result.preview.exportLocked = true;
        }
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
  const { unitName, computed, outputPath, mode, sources, stageReports: existingStageReports = [] } = payload;
  if (!unitName) return { ok: false, message: '缺少学校名称' };
  if (!(await isFullVersionUnlocked())) {
    return { ok: false, message: '免费版不支持导出/保存修正，请激活完整版后再操作', exportLocked: true };
  }
  const accessError = await ensureUnitAccess(unitName);
  if (accessError) return accessError;
  if (!computed || typeof computed !== 'object') return { ok: false, message: '缺少报表数据' };

  const layoutTemplatePath = getLayoutTemplatePath();
  if (!fs.existsSync(layoutTemplatePath)) {
    return { ok: false, message: '未找到版式模板文件：经费年报模板.xlsx' };
  }

  const appConfig = config.loadConfig();
  const allowedOutputRoots = getAllowedOutputRoots(appConfig);
  const targetPath = outputPath && path.extname(outputPath)
    ? assertPathInsideAny([...allowedOutputRoots, trustedOutputPaths.has(path.resolve(outputPath)) ? path.dirname(outputPath) : null], outputPath)
    : resolveInside(watcher.folder || appConfig.exportFolder || app.getPath('documents'), `${sanitizeFileName(unitName)}经费年报_已修正.xlsx`);

  computed.__meta = {
    ...(computed.__meta || {}),
    mode: mode || 'edited',
    sources: sources || computed.__meta?.sources || {},
  };
  const ruleOptions = getEduExtractOptions();
  const validation = await writeReport(computed, unitName, targetPath, layoutTemplatePath, ruleOptions);
  const levels = Array.from(new Set((existingStageReports || []).map((stage) => String(stage?.level || '').trim()).filter(Boolean)));
  const rebuiltStages = splitComputedByStage(computed, levels);
  const updatedStageReports = [];
  const levelData = {};
  for (const stage of rebuiltStages) {
    const previous = existingStageReports.find((item) => item?.level === stage.level);
    const fallbackName = `${path.basename(targetPath, path.extname(targetPath))}_${stage.level}(${stage.code})${path.extname(targetPath) || '.xlsx'}`;
    const stagePath = previous?.outputPath
      ? assertPathInsideAny([...allowedOutputRoots, trustedOutputPaths.has(path.resolve(previous.outputPath)) ? path.dirname(previous.outputPath) : null], previous.outputPath)
      : resolveInside(path.dirname(targetPath), fallbackName);
    const stageValidation = await writeReport(stage.computed, unitName, stagePath, layoutTemplatePath, {
      ...ruleOptions,
      reportRuleContext: { ...(ruleOptions.reportRuleContext || {}), xxlbdm: stage.code },
      schoolAttributes: {},
    });
    trustedOutputPaths.add(path.resolve(stagePath));
    levelData[stage.level] = stage.computed;
    updatedStageReports.push({
      level: stage.level, code: stage.code, ratio: stage.ratio,
      outputPath: stagePath, validation: stageValidation,
    });
  }
  const reportId = database.saveReport(unitName, computed, getCollectYear(), {
    schoolType: mode === 'private-draft' ? '民办草稿' : undefined,
    levelData,
  });
  return { ok: true, outputPath: targetPath, reportId, validation, stageReports: updatedStageReports };
});

// ===== 合并规则概要（教育事业年报已弃用，独立园由服务端 admin 看板“标注采集”维护） =====
handleIpc('get-edu-merge-summary', async () => {
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
  const options = getEduExtractOptions();
  const groups = resolveEduMergeGroups(options.mergeGroups);
  const groupEntries = Object.entries(groups);
  const mergedMembers = new Set(groupEntries.flatMap(([, members]) => members || []));
  const centers = new Set(groupEntries.map(([center]) => center));
  return {
    groups,
    centers: [...centers],
    mergedMembers: [...mergedMembers],
    independentPrivateKindergartens: [],
  };
});

// ===== 数据库相关 IPC =====
handleIpc('db-get-reports', async () => {
  const rows = database.getAllReports();
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return rows;
  const unitName = unitNameForRole(runtimeRole);
  return rows.filter((row) => normalizeSchoolName(row.unit_name) === normalizeSchoolName(unitName));
});

handleIpc('db-get-report-data', async (_event, reportId) => {
  const accessError = await reportAccessError(reportId);
  if (accessError) return accessError;
  return database.getReportDataGrouped(reportId);
});

handleIpc('db-get-report-levels', async (_event, reportId) => {
  const accessError = await reportAccessError(reportId);
  if (accessError) return accessError;
  return database.getReportLevels(reportId);
});

handleIpc('db-get-report-data-by-level', async (_event, reportId, level) => {
  const accessError = await reportAccessError(reportId);
  if (accessError) return accessError;
  return database.getReportDataGrouped(reportId, level);
});

handleIpc('db-get-unfilled', async () => {
  const rows = database.getUnfilledReports();
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return rows;
  const unitName = unitNameForRole(runtimeRole);
  return rows.filter((row) => normalizeSchoolName(row.unit_name) === normalizeSchoolName(unitName));
});

handleIpc('db-mark-filled', async (_event, reportId) => {
  const accessError = await reportAccessError(reportId);
  if (accessError) return accessError;
  database.markFilled(reportId);
  return { ok: true };
});

handleIpc('db-delete-report', async (_event, reportId) => {
  const accessError = await reportAccessError(reportId);
  if (accessError) return accessError;
  database.deleteReport(reportId);
  return { ok: true };
});

// 删除一所学校的所有信息（数据库记录 + 已生成年报），并把源文件移回监控目录以便重新生成
handleIpc('delete-school', async (_event, unitName) => {
  if (!unitName) return { ok: false, message: '缺少学校名称' };
  const accessError = await ensureUnitAccess(unitName);
  if (accessError) return accessError;

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
handleIpc('accounts-load', async () => {
  const rows = autoFill.loadAccounts();
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return rows;
  const unitName = unitNameForRole(runtimeRole);
  return rows.filter((row) => normalizeSchoolName(row.unitName) === normalizeSchoolName(unitName));
});

handleIpc('accounts-upsert', async (_event, { unitName, username, password }) => {
  const accessError = await ensureUnitAccess(unitName);
  if (accessError) return accessError;
  return autoFill.upsertAccount(unitName, username, password);
});

handleIpc('accounts-delete', (_event, unitName) => {
  return ensureUnitAccess(unitName).then((accessError) => accessError || autoFill.deleteAccount(unitName));
});

// ===== 配置与日志 IPC =====
handleIpc('validate-formal-controls', (_event, controls) => {
  return validateFormalControls(controls);
});

handleIpc('config-load', async () => {
  const cfg = config.loadConfig();
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role !== 'school') return cfg;
  const rules = cfg.regionRules || {};
  return {
    ...cfg,
    collectServerUrl: runtimeRole.deploymentMode === 'managed' ? cfg.collectServerUrl : '',
    collectToken: runtimeRole.deploymentMode === 'managed' ? cfg.collectToken : '',
    collectYear: runtimeRole.deploymentMode === 'managed' ? cfg.collectYear : 0,
    roleOverride: '', deploymentModeOverride: '',
    regionRules: {
      regionName: rules.regionName || '',
      regionCode: rules.regionCode || '',
      heatingFeePerStudent: Number(rules.heatingFeePerStudent ?? 25),
      mergeGroups: {}, schoolAliases: {}, ignoredClosedSchools: [],
    },
    kindergartenMergeGroups: {},
  };
});

handleIpc('config-save', async (_event, patch) => {
  const safePatch = config.sanitizeConfigPatch(patch);
  const runtimeRole = await getRuntimeAppRole();
  if (runtimeRole.role === 'school') {
    const currentConfig = config.loadConfig();
    const currentProfile = currentConfig.standaloneProfile || {};
    const schoolLocked = runtimeRole.deploymentMode === 'standalone'
      && String(currentProfile.unitName || '').trim()
      && String(currentProfile.schoolStage || '').trim();
    if (schoolLocked && safePatch.standaloneProfile) {
      const incomingProfile = safePatch.standaloneProfile;
      const incomingName = String(incomingProfile.unitName ?? currentProfile.unitName).trim();
      const incomingStage = String(incomingProfile.schoolStage ?? currentProfile.schoolStage).trim();
      if (incomingName !== String(currentProfile.unitName).trim() || incomingStage !== String(currentProfile.schoolStage).trim()) {
        return { ok: false, message: '本单位名称和学校类型仅可在首次设置时确定，当前学校资料已锁定' };
      }
      // 人员资料保存时也以首次确定的学校类型为准，避免通过请求参数绕过锁定。
      safePatch.standaloneProfile = {
        ...incomingProfile,
        unitName: currentProfile.unitName,
        schoolStage: currentProfile.schoolStage,
        formalControls: incomingProfile.formalControls
          ? { ...incomingProfile.formalControls, schoolStage: currentProfile.schoolStage }
          : incomingProfile.formalControls,
        draftControls: incomingProfile.draftControls
          ? { ...incomingProfile.draftControls, schoolStage: currentProfile.schoolStage }
          : incomingProfile.draftControls,
      };
    }
    if (runtimeRole.deploymentMode !== 'managed') {
      delete safePatch.collectServerUrl;
      delete safePatch.collectToken;
      delete safePatch.collectYear;
    }
    delete safePatch.kindergartenMergeGroups;
    if (safePatch.regionRules && typeof safePatch.regionRules === 'object') {
      const currentRules = config.loadConfig().regionRules || {};
      safePatch.regionRules = {
        ...currentRules,
        regionName: String(safePatch.regionRules.regionName ?? currentRules.regionName ?? ''),
        regionCode: String(safePatch.regionRules.regionCode ?? currentRules.regionCode ?? ''),
        heatingFeePerStudent: Number(safePatch.regionRules.heatingFeePerStudent ?? currentRules.heatingFeePerStudent ?? 25),
      };
    }
  }
  const updated = config.updateConfig(safePatch);
  if (runtimeRole.role === 'school') {
    const rules = updated.regionRules || {};
    return { ok: true, data: {
      ...updated,
      collectServerUrl: runtimeRole.deploymentMode === 'managed' ? updated.collectServerUrl : '',
      collectToken: runtimeRole.deploymentMode === 'managed' ? updated.collectToken : '',
      collectYear: runtimeRole.deploymentMode === 'managed' ? updated.collectYear : 0,
      roleOverride: '', deploymentModeOverride: '',
      regionRules: {
        regionName: rules.regionName || '', regionCode: rules.regionCode || '',
        heatingFeePerStudent: Number(rules.heatingFeePerStudent ?? 25),
        mergeGroups: {}, schoolAliases: {}, ignoredClosedSchools: [],
      },
      kindergartenMergeGroups: {},
    } };
  }
  return { ok: true, data: updated };
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
    throw new Error('规则文件中的取暖费标准必须是非负数字');
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
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
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
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
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
  const roleError = await ensureOperatorRole();
  if (roleError) return roleError;
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

// 导出Excel：仅完整版可用；在文件管理器中定位已生成的成品文件。
handleIpc('reveal-output', async (_event, filePath) => {
  if (!(await isFullVersionUnlocked())) {
    return { ok: false, message: '免费版不支持导出，请激活完整版后再导出', exportLocked: true };
  }
  const resolved = filePath ? path.resolve(filePath) : '';
  if (!resolved || !fs.existsSync(resolved)) {
    return { ok: false, message: '没有可导出的文件，请先生成报表' };
  }
  // 只允许定位本软件写出的成品：渲染层传任意路径不应能调起资源管理器。
  if (!trustedOutputPaths.has(resolved)) {
    try {
      assertPathInsideAny(getAllowedOutputRoots(), resolved);
    } catch {
      return { ok: false, message: '该文件不在本软件的输出目录内，已拒绝定位' };
    }
  }
  shell.showItemInFolder(resolved);
  return { ok: true, outputPath: resolved };
});
