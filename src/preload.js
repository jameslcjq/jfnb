const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reportApp', {
  authStatus: () => ipcRenderer.invoke('auth-status'),
  authLogin: (credentials) => ipcRenderer.invoke('auth-login', credentials),
  authLogout: () => ipcRenderer.invoke('auth-logout'),
  licenseStatus: () => ipcRenderer.invoke('license-status'),
  licenseCheck: (licenseKey) => ipcRenderer.invoke('license-check', licenseKey),
  licenseClaimTrial: (customerName, customerCode) => ipcRenderer.invoke('license-claim-trial', customerName, customerCode),
  licenseSaveKey: (licenseKey) => ipcRenderer.invoke('license-save-key', licenseKey),
  licenseDeviceInfo: () => ipcRenderer.invoke('license-device-info'),
  licenseExportMachineRequest: (licenseKey) => ipcRenderer.invoke('license-export-machine-request', licenseKey),
  licenseImportOffline: () => ipcRenderer.invoke('license-import-offline'),
  getDefaultFolder: () => ipcRenderer.invoke('get-default-folder'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startWatching: (folder) => ipcRenderer.invoke('start-watching', folder),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getPreviews: () => ipcRenderer.invoke('get-previews'),
  generateSelected: (schoolNames) => ipcRenderer.invoke('generate-selected', schoolNames),
  loadConfig: () => ipcRenderer.invoke('config-load'),
  saveConfig: (patch) => ipcRenderer.invoke('config-save', patch),
  importRulesConfig: () => ipcRenderer.invoke('rules-import'),
  exportRulesConfig: (regionRules) => ipcRenderer.invoke('rules-export', regionRules),
  importMergeRulesExcel: () => ipcRenderer.invoke('rules-import-merge-excel'),
  openLogFolder: () => ipcRenderer.invoke('open-log-folder'),

  // 教育事业年报
  importEduReport: () => ipcRenderer.invoke('import-edu-report'),
  getEduReport: () => ipcRenderer.invoke('get-edu-report'),
  getEduMergeSummary: () => ipcRenderer.invoke('get-edu-merge-summary'),
  selectPrivatePrevReport: () => ipcRenderer.invoke('select-private-prev-report'),
  generatePrivateDraft: (payload) => ipcRenderer.invoke('generate-private-draft', payload),
  saveEditedReport: (payload) => ipcRenderer.invoke('save-edited-report', payload),

  // 在线采集（民办/无报表/合并填报学校）
  collectPushSchools: () => ipcRenderer.invoke('collect-push-schools'),
  collectStatus: () => ipcRenderer.invoke('collect-status'),
  collectSync: () => ipcRenderer.invoke('collect-sync'),
  collectBatchGenerate: (unitNames, options) => ipcRenderer.invoke('collect-batch-generate', unitNames, options),

  // 数据库操作
  getReports: () => ipcRenderer.invoke('db-get-reports'),
  getReportData: (reportId) => ipcRenderer.invoke('db-get-report-data', reportId),
  getReportLevels: (reportId) => ipcRenderer.invoke('db-get-report-levels', reportId),
  getReportDataByLevel: (reportId, level) => ipcRenderer.invoke('db-get-report-data-by-level', reportId, level),
  getUnfilled: () => ipcRenderer.invoke('db-get-unfilled'),
  markFilled: (reportId) => ipcRenderer.invoke('db-mark-filled', reportId),
  deleteReport: (reportId) => ipcRenderer.invoke('db-delete-report', reportId),
  deleteSchool: (unitName) => ipcRenderer.invoke('delete-school', unitName),

  // 账号管理
  loadAccounts: () => ipcRenderer.invoke('accounts-load'),
  upsertAccount: (data) => ipcRenderer.invoke('accounts-upsert', data),
  deleteAccount: (unitName) => ipcRenderer.invoke('accounts-delete', unitName),

  // 验证码 OCR
  recognizeCaptcha: (imageBase64) => ipcRenderer.invoke('captcha-recognize', imageBase64),
  captchaDownloadAndRecognize: (data) => ipcRenderer.invoke('captcha-download-and-recognize', data),

  // 自动填报脚本
  getLoginScript: (data) => ipcRenderer.invoke('get-login-script', data),
  getCaptchaScript: () => ipcRenderer.invoke('get-captcha-script'),
  getSubmitScript: () => ipcRenderer.invoke('get-submit-script'),
  getCheckLoginScript: () => ipcRenderer.invoke('get-check-login-script'),

  // 事件监听
  onWatcherEvent: (callback) => ipcRenderer.on('watcher-event', (_event, payload) => callback(payload)),
  onGenerationStart: (callback) => ipcRenderer.on('generation-start', (_event, payload) => callback(payload)),
  onGenerationLog: (callback) => ipcRenderer.on('generation-log', (_event, payload) => callback(payload)),
  onGenerationDone: (callback) => ipcRenderer.on('generation-done', (_event, payload) => callback(payload)),
  onReportPreview: (callback) => ipcRenderer.on('report-preview', (_event, payload) => callback(payload)),
  onLicenseStatus: (callback) => ipcRenderer.on('license-status', (_event, payload) => callback(payload)),
});
