const clearLogBtn = document.querySelector('#clearLogBtn');
const openLogFolderBtn = document.querySelector('#openLogFolderBtn');
const logBox = document.querySelector('#logBox');
const summaryText = document.querySelector('#summaryText');
const overallStatus = document.querySelector('#overallStatus');
const workModeOverlay = document.querySelector('#workModeOverlay');
const workModeDialogTitle = document.querySelector('#workModeDialogTitle');
const workModeDialogDescription = document.querySelector('#workModeDialogDescription');
const standaloneSetupFields = document.querySelector('#standaloneSetupFields');
const standaloneUnitName = document.querySelector('#standaloneUnitName');
const standaloneSetupSchoolStage = document.querySelector('#standaloneSetupSchoolStage');
const standaloneHeatingFee = document.querySelector('#standaloneHeatingFee');
const confirmInitialSetupBtn = document.querySelector('#confirmInitialSetupBtn');
const currentWorkModeText = document.querySelector('#currentWorkModeText');
const changeWorkModeBtn = document.querySelector('#changeWorkModeBtn');
const settingsCenterBtn = document.querySelector('#settingsCenterBtn');
const appShell = document.querySelector('#appShell');
const settingsRoleHint = document.querySelector('#settingsRoleHint');
const settingsUnitName = document.querySelector('#settingsUnitName');
const settingsSchoolStage = document.querySelector('#settingsSchoolStage');
const settingsWorkMode = document.querySelector('#settingsWorkMode');
const settingsBasicSaveBtn = document.querySelector('#settingsBasicSaveBtn');
const settingsSchoolLockHint = document.querySelector('#settingsSchoolLockHint');
const settingsCollectSection = document.querySelector('#settingsCollectSection');
const settingsOperatorRules = document.querySelector('#settingsOperatorRules');
const appPromptOverlay = document.querySelector('#appPromptOverlay');
const appPromptForm = document.querySelector('#appPromptForm');
const appPromptTitle = document.querySelector('#appPromptTitle');
const appPromptMessage = document.querySelector('#appPromptMessage');
const appPromptInputLabel = document.querySelector('#appPromptInputLabel');
const appPromptInput = document.querySelector('#appPromptInput');
const appPromptConfirmField = document.querySelector('#appPromptConfirmField');
const appPromptConfirmLabel = document.querySelector('#appPromptConfirmLabel');
const appPromptConfirmInput = document.querySelector('#appPromptConfirmInput');
const appPromptError = document.querySelector('#appPromptError');
const appPromptCancelBtn = document.querySelector('#appPromptCancelBtn');
const licenseStatusBadge = document.querySelector('#licenseStatusBadge');
const licenseStatusText = document.querySelector('#licenseStatusText');
const licenseMessage = document.querySelector('#licenseMessage');
const licenseKeyInput = document.querySelector('#licenseKeyInput');
const licenseSaveBtn = document.querySelector('#licenseSaveBtn');
const licenseRefreshBtn = document.querySelector('#licenseRefreshBtn');
const licenseExportMachineBtn = document.querySelector('#licenseExportMachineBtn');
const licenseImportOfflineBtn = document.querySelector('#licenseImportOfflineBtn');
const licenseCopyDeviceBtn = document.querySelector('#licenseCopyDeviceBtn');
const licenseProductKey = document.querySelector('#licenseProductKey');
const licenseCustomerName = document.querySelector('#licenseCustomerName');
const licenseExpiresAt = document.querySelector('#licenseExpiresAt');
const licensePlan = document.querySelector('#licensePlan');
const licenseSeats = document.querySelector('#licenseSeats');
const licenseSource = document.querySelector('#licenseSource');
const licenseCheckedAt = document.querySelector('#licenseCheckedAt');
const licenseServerUrl = document.querySelector('#licenseServerUrl');
const licenseDeviceId = document.querySelector('#licenseDeviceId');
const schoolList = document.querySelector('#schoolList');
const watchFolderPath = document.querySelector('#watchFolderPath');
const openWatchFolderBtn = document.querySelector('#openWatchFolderBtn');
const copyWatchFolderBtn = document.querySelector('#copyWatchFolderBtn');
const importFeedback = document.querySelector('#importFeedback');
// const previewArea = document.querySelector('#previewArea'); // 已删除
// const previewCount = document.querySelector('#previewCount'); // 已删除
const eduInfo = document.querySelector('#eduInfo');
const generateSelectedBtn = document.querySelector('#generateSelectedBtn');
const standaloneFormalPanel = document.querySelector('#standaloneFormalPanel');
const saveStandaloneFormalBtn = document.querySelector('#saveStandaloneFormalBtn');
const standaloneSchoolStage = document.querySelector('#standaloneSchoolStage');
const standaloneStudentDetailsSection = document.querySelector('#standaloneStudentDetailsSection');
const standaloneAccommodationSection = document.querySelector('#standaloneAccommodationSection');
const standaloneStageHint = document.querySelector('#standaloneStageHint');
const privateSchoolSelect = document.querySelector('#privateSchoolSelect');
const privateRefreshSchoolsBtn = document.querySelector('#privateRefreshSchoolsBtn');
const privatePrevPath = document.querySelector('#privatePrevPath');
const privateSelectPrevBtn = document.querySelector('#privateSelectPrevBtn');
const privateWarnings = document.querySelector('#privateWarnings');
const privateGenerateEditBtn = document.querySelector('#privateGenerateEditBtn');
const privateGeneratePreviewBtn = document.querySelector('#privateGeneratePreviewBtn');
const privateBackfillBtn = document.querySelector('#privateBackfillBtn');
const privateSchoolStage = document.querySelector('#privateSchoolStage');
const privateHasRent = document.querySelector('#privateHasRent');
const privateHasLoan = document.querySelector('#privateHasLoan');
const privateHasSponsorInput = document.querySelector('#privateHasSponsorInput');
const privateHasSponsorWithdraw = document.querySelector('#privateHasSponsorWithdraw');
const privateHasDonation = document.querySelector('#privateHasDonation');
const privateHasHeating = document.querySelector('#privateHasHeating');
const privateHasBigPurchase = document.querySelector('#privateHasBigPurchase');
const privateRentGroup = document.querySelector('#privateRentGroup');
const privateInterestGroup = document.querySelector('#privateInterestGroup');
const privateSponsorGroup = document.querySelector('#privateSponsorGroup');
const privateSponsorWithdrawGroup = document.querySelector('#privateSponsorWithdrawGroup');
const privateDonationIncomeGroup = document.querySelector('#privateDonationIncomeGroup');
const privateDonationExpenseGroup = document.querySelector('#privateDonationExpenseGroup');
const privateCapitalGroup = document.querySelector('#privateCapitalGroup');
const rulesHeatingFee = document.querySelector('#rulesHeatingFee');
const rulesMergeGroups = document.querySelector('#rulesMergeGroups');
const rulesSchoolAliases = document.querySelector('#rulesSchoolAliases');
const rulesIgnoredClosedSchools = document.querySelector('#rulesIgnoredClosedSchools');
const rulesWarnings = document.querySelector('#rulesWarnings');
const rulesImportBtn = document.querySelector('#rulesImportBtn');
const rulesExportBtn = document.querySelector('#rulesExportBtn');
const rulesReloadBtn = document.querySelector('#rulesReloadBtn');
const rulesSaveBtn = document.querySelector('#rulesSaveBtn');
const rulesImportMergeExcelBtn = document.querySelector('#rulesImportMergeExcelBtn');
const rulesLoadEffectiveMergeBtn = document.querySelector('#rulesLoadEffectiveMergeBtn');
const rulesAddMergeGroupBtn = document.querySelector('#rulesAddMergeGroupBtn');
const rulesRemoveMergeGroupBtn = document.querySelector('#rulesRemoveMergeGroupBtn');
const rulesAddMergeMemberBtn = document.querySelector('#rulesAddMergeMemberBtn');
const rulesRemoveMergeMemberBtn = document.querySelector('#rulesRemoveMergeMemberBtn');
const rulesMergeGroupList = document.querySelector('#rulesMergeGroupList');
const rulesMergeCenterSelect = document.querySelector('#rulesMergeCenterSelect');
const rulesMergeSearch = document.querySelector('#rulesMergeSearch');
const rulesMergeMemberList = document.querySelector('#rulesMergeMemberList');
const privateInputs = {
  tuitionIncome: document.querySelector('#privateTuitionIncome'),
  fiscalSubsidy: document.querySelector('#privateFiscalSubsidy'),
  wageTotal: document.querySelector('#privateWageTotal'),
  capitalExpense: document.querySelector('#privateCapitalExpense'),
  rentExpense: document.querySelector('#privateRentExpense'),
  interestExpense: document.querySelector('#privateInterestExpense'),
  sponsorInput: document.querySelector('#privateSponsorInput'),
  sponsorWithdraw: document.querySelector('#privateSponsorWithdraw'),
  donationIncome: document.querySelector('#privateDonationIncome'),
  donationExpense: document.querySelector('#privateDonationExpense'),
  otherIncome: document.querySelector('#privateOtherIncome'),
  netBalance: document.querySelector('#privateNetBalance'),
  staffCount: document.querySelector('#privateStaffCount'),
  teacherCount: document.querySelector('#privateTeacherCount'),
  studentCount: document.querySelector('#privateStudentCount'),
  externalLongTermStaffCount: document.querySelector('#privateExternalStaffCount'),
  retiredStaffCount: document.querySelector('#privateRetiredStaffCount'),
  kindergartenStudentCount: document.querySelector('#privateKindergartenStudentCount'),
  primaryStudentCount: document.querySelector('#privatePrimaryStudentCount'),
  juniorStudentCount: document.querySelector('#privateJuniorStudentCount'),
  seniorStudentCount: document.querySelector('#privateSeniorStudentCount'),
  preschoolOneYearEndCount: document.querySelector('#privatePreschoolOneYearEndCount'),
  nurseryEndCount: document.querySelector('#privateNurseryEndCount'),
  primaryInclusiveStudentCount: document.querySelector('#privatePrimaryInclusiveStudentCount'),
  primaryBoardingStudentCount: document.querySelector('#privatePrimaryBoardingStudentCount'),
  juniorInclusiveStudentCount: document.querySelector('#privateJuniorInclusiveStudentCount'),
  juniorBoardingStudentCount: document.querySelector('#privateJuniorBoardingStudentCount'),
  seniorInclusiveStudentCount: document.querySelector('#privateSeniorInclusiveStudentCount'),
  seniorBoardingStudentCount: document.querySelector('#privateSeniorBoardingStudentCount'),
};

const standaloneFormalInputs = {
  staffCount: document.querySelector('#standaloneStaffCount'),
  teacherCount: document.querySelector('#standaloneTeacherCount'),
  externalLongTermStaffCount: document.querySelector('#standaloneExternalStaffCount'),
  retiredStaffCount: document.querySelector('#standaloneRetiredStaffCount'),
  studentCount: document.querySelector('#standaloneStudentCount'),
  kindergartenStudentCount: document.querySelector('#standaloneKindergartenStudentCount'),
  primaryStudentCount: document.querySelector('#standalonePrimaryStudentCount'),
  juniorStudentCount: document.querySelector('#standaloneJuniorStudentCount'),
  seniorStudentCount: document.querySelector('#standaloneSeniorStudentCount'),
  preschoolOneYearEndCount: document.querySelector('#standalonePreschoolOneYearEndCount'),
  nurseryEndCount: document.querySelector('#standaloneNurseryEndCount'),
  primaryInclusiveStudentCount: document.querySelector('#standalonePrimaryInclusiveStudentCount'),
  juniorInclusiveStudentCount: document.querySelector('#standaloneJuniorInclusiveStudentCount'),
  seniorInclusiveStudentCount: document.querySelector('#standaloneSeniorInclusiveStudentCount'),
  primaryBoardingStudentCount: document.querySelector('#standalonePrimaryBoardingStudentCount'),
  juniorBoardingStudentCount: document.querySelector('#standaloneJuniorBoardingStudentCount'),
  seniorBoardingStudentCount: document.querySelector('#standaloneSeniorBoardingStudentCount'),
};

const REQUIRED_TYPES = ['资产负债表', '收入费用表', '经费支出明细表', '科目余额表', '上年经费年报'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

let isWatching = false;
let previews = [];
let rulesMergeState = {};
let rulesSelectedCenter = '';
let rulesEduRows = [];
let rulesMergeMemberMode = 'members';
let rulesCheckedMembers = new Set();
let rulesCheckedCandidates = new Set();
let currentWorkMode = '';
let appBootstrapped = false;
let appRole = 'operator';   // 'operator'=经办版全功能 | 'school'=学校版只处理本单位
let appDeploymentMode = 'managed';
let appUnitName = '';       // 联网学校版取授权单位名；单机版取本地首次设置
let appConfig = {};
let licenseState = { valid: false, reason: 'missing_product_or_license' };
let readySchoolNames = [];
let selectedInitialWorkMode = '';
let legacyRegionMetadata = { regionName: '', regionCode: '' };

const WORK_MODE_LABELS = {
  formal: '有正式财务报表',
  draft: '无报表生成草稿',
};

const WORK_MODE_TABS = {
  formal: ['schools', 'collect', 'settings', 'preview', 'web', 'log'],
  draft: ['private', 'collect', 'settings', 'preview', 'web', 'log'],
};

const WORK_MODE_DEFAULT_TAB = {
  formal: 'schools',
  draft: 'private',
};

const STANDALONE_STAGE_PARTS = {
  幼儿园: ['kindergarten'],
  普通小学: ['primary'],
  初级中学: ['junior'],
  高级中学: ['senior'],
  九年制学校: ['primary', 'junior'],
  完全中学: ['junior', 'senior'],
  十二年制学校: ['primary', 'junior', 'senior'],
};

function licenseIsValid(status = licenseState) {
  return Boolean(status && status.valid);
}

function licenseAllowsBusiness(status = licenseState) {
  // 空授权是受支持的单机学校版，不再锁住业务功能。
  return true;
}

function isStandaloneSchool() {
  return appRole === 'school' && appDeploymentMode === 'standalone';
}

function getStandaloneProfile() {
  return appConfig?.standaloneProfile || {};
}

function standaloneSetupComplete() {
  const profile = getStandaloneProfile();
  return Boolean(String(profile.unitName || '').trim() && String(profile.schoolStage || '').trim());
}

function formatLicenseReason(status = {}) {
  if (status.valid) return '已授权';
  const map = {
    missing_product_or_license: '单机学校版',
    not_found: '授权码无效',
    expired: '授权已过期',
    disabled: '授权已停用',
    seat_limit: '电脑数量已满',
    device_disabled: '当前电脑已停用',
    product_disabled: '产品授权服务已停用',
    device_mismatch: '离线授权不属于本机',
    license_mismatch: '离线授权异常',
    network_error: '授权中心不可用',
    clock_rollback: '本机时间异常',
    offline_invalid: '离线授权无效',
    offline_key_missing: '缺少离线授权公钥',
  };
  return map[status.reason] || '未授权';
}

function formatLicenseMessage(status = {}) {
  if (status.valid) {
    const suffix = status.expires_at ? `，有效期至 ${status.expires_at}` : '';
    return `授权有效${suffix}。`;
  }
  if (status.message) return status.message;
  const map = {
    missing_product_or_license: '未填写授权中心密码，当前使用单机学校版。',
    not_found: '授权码无效，请联系管理员确认授权码。',
    expired: '授权已到期，请联系管理员续费后重新校验。',
    disabled: '该授权已停用，请联系管理员。',
    seat_limit: '该授权已达到电脑数量上限，请联系管理员在授权中心停用旧电脑或增加席位。',
    device_disabled: '当前电脑授权已被停用，请联系管理员。',
    product_disabled: '产品授权服务已停用。',
    device_mismatch: '该离线授权文件绑定的是其它电脑，请导出本机机器码后重新生成。',
    license_mismatch: '离线授权文件异常，请从授权中心重新生成后导入。',
    network_error: '无法连接授权中心，且本地没有可用的短期离线授权。',
    clock_rollback: '检测到本机时间异常，请校准系统时间并联网校验。',
    offline_invalid: '离线授权文件格式或签名无效，请重新从授权中心导出。',
    offline_key_missing: '客户端缺少离线授权公钥，请先完成一次在线授权，或把 license_public_key.pem 放到软件目录。',
  };
  return map[status.reason] || '授权无效，请重新校验。';
}

function formatLicenseSource(status = {}) {
  if (status.source === 'online') return '在线授权';
  if (status.source === 'offline') return '离线授权文件';
  if (status.cached) return '短期离线缓存';
  return '未校验';
}

function formatLicensePlan(plan) {
  if (plan === 'trial') return '试用版';
  if (plan === 'yearly') return '年度订阅';
  return plan || '未设置';
}

function formatDateTime(value) {
  if (!value) return '未校验';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return String(value);
  return time.toLocaleString('zh-CN', { hour12: false });
}

function setLicenseBusy(busy) {
  for (const button of [licenseSaveBtn, licenseRefreshBtn, licenseExportMachineBtn, licenseImportOfflineBtn]) {
    if (button) button.disabled = busy;
  }
}

function renderLicensePanel(status = {}) {
  licenseState = status || {};
  const valid = licenseIsValid(licenseState);
  const reasonText = formatLicenseReason(licenseState);

  if (licenseStatusBadge) {
    const standalone = !valid && licenseState.reason === 'missing_product_or_license';
    licenseStatusBadge.textContent = valid ? '已授权' : reasonText;
    licenseStatusBadge.className = `license-badge ${valid ? 'license-badge-ok' : (standalone ? 'license-badge-pending' : 'license-badge-error')}`;
  }
  if (licenseStatusText) licenseStatusText.textContent = valid ? '授权有效' : reasonText;
  if (licenseMessage) licenseMessage.textContent = formatLicenseMessage(licenseState);
  if (licenseProductKey) licenseProductKey.textContent = licenseState.product_key || 'fund-annual-report';
  if (licenseCustomerName) licenseCustomerName.textContent = licenseState.customer_name || '未设置';
  if (licenseExpiresAt) licenseExpiresAt.textContent = licenseState.expires_at || '未设置';
  if (licensePlan) licensePlan.textContent = formatLicensePlan(licenseState.plan);
  if (licenseSeats) {
    licenseSeats.textContent = licenseState.seats
      ? `${licenseState.used_seats || 0} / ${licenseState.seats}`
      : '未设置';
  }
  if (licenseSource) licenseSource.textContent = formatLicenseSource(licenseState);
  if (licenseCheckedAt) licenseCheckedAt.textContent = formatDateTime(licenseState.checkedAt);
  if (licenseServerUrl) licenseServerUrl.textContent = 'https://jyj.yunbg.vip';
  if (licenseDeviceId) licenseDeviceId.textContent = licenseState.device_id || '正在读取...';
  if (licenseKeyInput && !licenseKeyInput.value && licenseState.license_key) {
    licenseKeyInput.value = licenseState.license_key;
  }
}

function applyLicenseUiState(status = licenseState) {
  applyWorkMode(currentWorkMode || '');
  updateTableNavLocks();
  rerenderActiveTableIfNeeded();
}

async function refreshLicensePanel(options = {}) {
  const force = Boolean(options.force);
  setLicenseBusy(true);
  try {
    let status = await window.reportApp.licenseStatus();
    const key = licenseKeyInput?.value?.trim() || status?.license_key || '';
    if (force && key) {
      status = await window.reportApp.licenseCheck(key);
    }
    renderLicensePanel(status);
    if (!options.skipUiState) applyLicenseUiState(status);
    return status;
  } catch (error) {
    const status = { valid: false, reason: 'network_error', message: error.message || '授权状态读取失败' };
    renderLicensePanel(status);
    if (!options.skipUiState) applyLicenseUiState(status);
    return status;
  } finally {
    setLicenseBusy(false);
  }
}

async function claimTrialForUnitName(unitName, options = {}) {
  // 空授权明确保持单机学校版，不再因为导入文件或账号自动申请试用并改变形态。
  return false;
}

async function findSavedTrialUnitName() {
  try {
    const accounts = await window.reportApp.loadAccounts();
    const account = Array.isArray(accounts) ? accounts.find((item) => item?.unitName) : null;
    if (account?.unitName) return account.unitName;
  } catch { /* ignore */ }

  try {
    const reports = await window.reportApp.getReports();
    const report = Array.isArray(reports) ? reports.find((item) => item?.unit_name) : null;
    if (report?.unit_name) return report.unit_name;
  } catch { /* ignore */ }

  return '';
}

async function claimTrialFromSavedUnit() {
  if (licenseIsValid()) return false;
  const unitName = await findSavedTrialUnitName();
  if (!unitName) return false;
  return claimTrialForUnitName(unitName, { silent: true });
}

async function unlockLicensedBusiness() {
  applyLicenseUiState(licenseState);
  if (licenseAllowsBusiness()) {
    if (appBootstrapped) window.location.reload();
    else await bootstrapApp();
  }
}

let activePrompt = null;

function closeAppPrompt(value = null) {
  if (!activePrompt) return;
  const { resolve } = activePrompt;
  activePrompt = null;
  if (appPromptOverlay) appPromptOverlay.hidden = true;
  if (appPromptForm) appPromptForm.reset();
  if (appPromptError) {
    appPromptError.textContent = '';
    appPromptError.hidden = true;
  }
  resolve(value);
}

function showTextPrompt({
  title = '请输入', message = '', label = '输入内容', defaultValue = '', inputType = 'text',
  requireConfirm = false, confirmLabel = '再次输入', minLength = 0,
} = {}) {
  if (!appPromptOverlay || !appPromptForm || !appPromptInput) return Promise.resolve(null);
  if (activePrompt) closeAppPrompt(null);
  appPromptTitle.textContent = title;
  appPromptMessage.textContent = message;
  appPromptInputLabel.textContent = label;
  appPromptInput.type = inputType;
  appPromptInput.autocomplete = inputType === 'password' ? 'new-password' : 'off';
  appPromptInput.value = defaultValue;
  appPromptConfirmField.hidden = !requireConfirm;
  appPromptConfirmLabel.textContent = confirmLabel;
  appPromptConfirmInput.type = inputType;
  appPromptConfirmInput.value = '';
  appPromptError.textContent = '';
  appPromptError.hidden = true;
  appPromptOverlay.hidden = false;
  window.setTimeout(() => {
    appPromptInput.focus();
    if (defaultValue) appPromptInput.select();
  }, 0);
  return new Promise((resolve) => {
    activePrompt = { resolve, requireConfirm, minLength };
  });
}

if (appPromptForm) {
  appPromptForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!activePrompt) return;
    const value = appPromptInput.value;
    let error = '';
    if (value.length < activePrompt.minLength) error = `输入内容至少需要 ${activePrompt.minLength} 位`;
    else if (activePrompt.requireConfirm && value !== appPromptConfirmInput.value) error = '两次输入的内容不一致';
    if (error) {
      appPromptError.textContent = error;
      appPromptError.hidden = false;
      return;
    }
    closeAppPrompt(value);
  });
}
if (appPromptCancelBtn) appPromptCancelBtn.addEventListener('click', () => closeAppPrompt(null));

async function showApp() {
  await refreshLicensePanel({ force: true, skipUiState: true });
  await bootstrapApp();
  if (appShell) appShell.hidden = false;
}

if (licenseKeyInput) {
  licenseKeyInput.addEventListener('input', () => {
    const start = licenseKeyInput.selectionStart;
    const end = licenseKeyInput.selectionEnd;
    licenseKeyInput.value = licenseKeyInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    licenseKeyInput.setSelectionRange(start, end);
  });
}

if (licenseRefreshBtn) {
  licenseRefreshBtn.addEventListener('click', async () => {
    const status = await refreshLicensePanel({ force: true });
    if (licenseIsValid(status)) {
      addLog('授权校验通过', 'success');
      await unlockLicensedBusiness();
    } else {
      addLog(`授权校验未通过：${formatLicenseMessage(status)}`, 'warn');
    }
  });
}

if (licenseSaveBtn) {
  licenseSaveBtn.addEventListener('click', async () => {
    const licenseKey = licenseKeyInput?.value?.trim() || '';
    if (!licenseKey) {
      setLicenseBusy(true);
      try {
        const status = await window.reportApp.licenseClear();
        renderLicensePanel(status);
        addLog('已切换为单机学校版', 'success');
        await unlockLicensedBusiness();
      } finally {
        setLicenseBusy(false);
      }
      return;
    }
    setLicenseBusy(true);
    try {
      const status = await window.reportApp.licenseSaveKey(licenseKey);
      renderLicensePanel(status);
      applyLicenseUiState(status);
      if (licenseIsValid(status)) {
        addLog('授权保存并校验通过', 'success');
        await unlockLicensedBusiness();
      } else {
        addLog(`授权校验未通过：${formatLicenseMessage(status)}`, 'warn');
      }
    } catch (error) {
      const status = { valid: false, reason: 'network_error', message: error.message || '授权保存失败' };
      renderLicensePanel(status);
      applyLicenseUiState(status);
      addLog(`授权保存失败：${formatLicenseMessage(status)}`, 'error');
    } finally {
      setLicenseBusy(false);
    }
  });
}

if (licenseExportMachineBtn) {
  licenseExportMachineBtn.addEventListener('click', async () => {
    setLicenseBusy(true);
    try {
      const result = await window.reportApp.licenseExportMachineRequest(licenseKeyInput?.value?.trim() || '');
      if (result?.ok) {
        if (licenseDeviceId && result.request?.device_id) {
          licenseDeviceId.textContent = result.request.device_id;
        }
        addLog(`机器码申请文件已导出：${result.filePath}`, 'success');
      }
    } catch (error) {
      addLog(`导出机器码失败：${error.message}`, 'error');
    } finally {
      setLicenseBusy(false);
    }
  });
}

if (licenseImportOfflineBtn) {
  licenseImportOfflineBtn.addEventListener('click', async () => {
    setLicenseBusy(true);
    try {
      const status = await window.reportApp.licenseImportOffline();
      if (!status) return;
      renderLicensePanel(status);
      applyLicenseUiState(status);
      if (licenseIsValid(status)) {
        addLog('离线授权导入成功', 'success');
        await unlockLicensedBusiness();
      } else {
        addLog(`离线授权导入失败：${formatLicenseMessage(status)}`, 'warn');
      }
    } catch (error) {
      addLog(`离线授权导入异常：${error.message}`, 'error');
    } finally {
      setLicenseBusy(false);
    }
  });
}

if (licenseCopyDeviceBtn) {
  licenseCopyDeviceBtn.addEventListener('click', async () => {
    const text = licenseDeviceId?.textContent || '';
    if (!text || text.includes('读取')) return;
    try {
      await navigator.clipboard.writeText(text);
      addLog('机器码已复制', 'success');
    } catch {
      addLog('机器码复制失败，请手动选择复制', 'warn');
    }
  });
}

if (window.reportApp?.onLicenseStatus) {
  window.reportApp.onLicenseStatus((status) => {
    renderLicensePanel(status);
    applyLicenseUiState(status);
  });
}

function tabIdFromName(tabName) {
  return `#tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
}

function activateTab(tabName) {
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const tabPanel = document.querySelector(tabIdFromName(tabName));
  if (!tabPanel || (tabBtn && (tabBtn.hidden || tabBtn.disabled))) return false;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  if (tabBtn) tabBtn.classList.add('active');
  tabPanel.classList.add('active');
  if (settingsCenterBtn) {
    const settingsActive = tabName === 'settings';
    settingsCenterBtn.classList.toggle('active', settingsActive);
    settingsCenterBtn.setAttribute('aria-expanded', String(settingsActive));
  }
  if (tabName === 'settings') {
    refreshLicensePanel();
    refreshSettingsCenter();
  }
  if (tabName === 'private') populatePrivateSchools();
  if (tabName === 'collect') initCollectPanel();
  return true;
}

async function refreshSettingsCenter() {
  const schoolLocked = isStandaloneSchool() && standaloneSetupComplete();
  if (settingsRoleHint) {
    settingsRoleHint.textContent = isStandaloneSchool()
      ? '当前形态：单机学校版。未连接授权中心，所有资料只保存在本机。'
      : (appRole === 'operator'
        ? '当前形态：经办版。身份由授权中心确定，可使用全部学校及集中采集功能。'
        : `当前形态：联网学校版。授权单位：${appUnitName || '未设置'}；本地填报完成后自动回传。`);
  }
  if (settingsUnitName) {
    settingsUnitName.value = isStandaloneSchool() ? (getStandaloneProfile().unitName || '') : (appUnitName || '');
    settingsUnitName.disabled = !isStandaloneSchool() || schoolLocked;
  }
  if (settingsSchoolStage) {
    settingsSchoolStage.value = getStandaloneProfile().schoolStage || '';
    settingsSchoolStage.disabled = !isStandaloneSchool() || schoolLocked;
  }
  if (settingsSchoolLockHint) settingsSchoolLockHint.hidden = !schoolLocked;
  if (settingsBasicSaveBtn) settingsBasicSaveBtn.textContent = schoolLocked ? '保存填报模式' : '保存基础设置';
  if (settingsWorkMode) settingsWorkMode.value = currentWorkMode || 'formal';
  if (settingsCollectSection) settingsCollectSection.hidden = isStandaloneSchool();
  if (settingsOperatorRules) settingsOperatorRules.hidden = appRole === 'school';
  await loadRulesConfig(appRole === 'operator');
  if (!isStandaloneSchool()) await loadCollectConfig();
}

if (settingsBasicSaveBtn) {
  settingsBasicSaveBtn.addEventListener('click', async () => {
    const mode = settingsWorkMode?.value || 'formal';
    const patch = {
      workMode: mode,
      regionRules: {
        ...(appConfig?.regionRules || {}),
        heatingFeePerStudent: Number(rulesHeatingFee?.value || 0),
      },
    };
    if (isStandaloneSchool()) {
      const unitName = settingsUnitName?.value?.trim() || '';
      const schoolStage = settingsSchoolStage?.value || '';
      if (!unitName) { addLog('请填写本单位名称', 'warn'); settingsUnitName?.focus(); return; }
      if (!schoolStage) { addLog('请选择学校类型', 'warn'); settingsSchoolStage?.focus(); return; }
      patch.standaloneProfile = {
        ...getStandaloneProfile(),
        unitName,
        schoolStage,
        formalControls: { ...(getStandaloneProfile().formalControls || {}), schoolStage },
        draftControls: { ...(getStandaloneProfile().draftControls || {}), schoolStage },
      };
    }
    const result = await window.reportApp.saveConfig(patch);
    if (result?.ok === false) { addLog(`保存基础设置失败：${result.message}`, 'error'); return; }
    appConfig = result?.data || { ...appConfig, ...patch };
    currentWorkMode = mode;
    if (isStandaloneSchool()) appUnitName = String(appConfig?.standaloneProfile?.unitName || '').trim();
    applyWorkMode(mode, { keepOverlayHidden: true });
    await refreshSettingsCenter();
    addLog('设置中心基础设置已保存', 'success');
  });
}

function applyStandaloneSetupFields() {
  const standalone = isStandaloneSchool();
  if (standaloneSetupFields) standaloneSetupFields.hidden = !standalone;
  if (!standalone) return;
  const profile = getStandaloneProfile();
  const schoolLocked = standaloneSetupComplete();
  const rules = appConfig?.regionRules || {};
  if (standaloneUnitName) standaloneUnitName.value = profile.unitName || '';
  if (standaloneSetupSchoolStage) standaloneSetupSchoolStage.value = profile.schoolStage || '';
  if (standaloneUnitName) standaloneUnitName.disabled = schoolLocked;
  if (standaloneSetupSchoolStage) standaloneSetupSchoolStage.disabled = schoolLocked;
  if (standaloneHeatingFee) standaloneHeatingFee.value = rules.heatingFeePerStudent ?? 25;
  if (workModeDialogTitle) workModeDialogTitle.textContent = schoolLocked ? '本机学校已设置' : '首次使用设置向导';
  if (workModeDialogDescription) {
    workModeDialogDescription.textContent = schoolLocked
      ? '本单位名称和学校类型已锁定；可在设置中心调整填报模式和其他运行设置。'
      : '请设置本单位名称和学校类型，再选择有无正式财务报表。';
  }
}

function applyStandaloneFormalPanel() {
  const show = isStandaloneSchool() && currentWorkMode === 'formal';
  if (standaloneFormalPanel) standaloneFormalPanel.hidden = !show;
  if (!show) return;
  const controls = getStandaloneProfile().formalControls || {};
  if (standaloneSchoolStage) {
    standaloneSchoolStage.value = getStandaloneProfile().schoolStage || controls.schoolStage || '';
    standaloneSchoolStage.disabled = standaloneSetupComplete();
  }
  applyStandaloneStageVisibility();
  for (const [key, input] of Object.entries(standaloneFormalInputs)) {
    if (input) input.value = controls[key] ?? '';
  }
}

function applyStandaloneStageVisibility() {
  const stage = getStandaloneProfile().schoolStage || standaloneSchoolStage?.value || '';
  const parts = new Set(STANDALONE_STAGE_PARTS[stage] || []);
  document.querySelectorAll('[data-stage-parts]').forEach((field) => {
    const fieldParts = String(field.dataset.stageParts || '').split(',').filter(Boolean);
    const show = fieldParts.some((part) => parts.has(part));
    field.classList.toggle('hidden', !show);
    field.hidden = !show;
    field.querySelectorAll('input, select, textarea').forEach((input) => { input.disabled = !show; });
  });
  if (standaloneStudentDetailsSection) standaloneStudentDetailsSection.hidden = parts.size === 0;
  if (standaloneAccommodationSection) {
    standaloneAccommodationSection.hidden = !['primary', 'junior', 'senior'].some((part) => parts.has(part));
  }
  if (standaloneStageHint) {
    standaloneStageHint.textContent = parts.size
      ? `当前学校类型：${stage}。请填写下方显示的学段明细；没有的填 0。`
      : '请先完成学校类型设置。';
  }
}

// 顶部显示当前角色与部署形态。
function applyAppRoleIndicator() {
  const pill = document.querySelector('.mode-pill');
  if (isStandaloneSchool()) {
    if (currentWorkModeText) currentWorkModeText.textContent = `单机学校版 · ${appUnitName || '待设置单位'}`;
    if (pill) pill.setAttribute('title', '单机学校版：不连接经办服务器，数据只保存在本机');
    if (changeWorkModeBtn) changeWorkModeBtn.hidden = false;
  } else if (appRole === 'school') {
    if (currentWorkModeText) currentWorkModeText.textContent = `联网学校版 · ${appUnitName || '本授权单位'}`;
    if (pill) pill.setAttribute('title', '联网学校版：仅处理本授权单位');
    if (changeWorkModeBtn) changeWorkModeBtn.hidden = false;
  } else if (currentWorkModeText) {
    // 经办版由 applyWorkMode 显示填报类型
  }
}

function applyWorkMode(mode, options = {}) {
  currentWorkMode = mode || '';
  const canUseBusiness = licenseAllowsBusiness();
  const baseTabs = currentWorkMode ? (WORK_MODE_TABS[currentWorkMode] || []) : ['settings'];
  const visibleTabs = new Set(canUseBusiness ? baseTabs : ['settings']);
  // 学校版隐藏经办专属的集中采集页；设置中心始终保留。
  if (appRole === 'school') visibleTabs.delete('collect');
  if (currentWorkModeText) {
    currentWorkModeText.textContent = appRole === 'school'
      ? `${isStandaloneSchool() ? '单机学校版' : '联网学校版'} · ${appUnitName || '本单位'}`
      : (WORK_MODE_LABELS[currentWorkMode] || '未设置');
  }
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.hidden = !visibleTabs.has(btn.dataset.tab);
    btn.disabled = false;
  });
  document.querySelectorAll('.tab-content').forEach((section) => {
    const tabName = section.id.replace(/^tab/, '').replace(/^[A-Z]/, s => s.toLowerCase());
    if (!visibleTabs.has(tabName)) section.classList.remove('active');
  });
  applyStandaloneSetupFields();
  applyStandaloneFormalPanel();
  if (privateBackfillBtn) privateBackfillBtn.hidden = appRole === 'school';
  if (privateRefreshSchoolsBtn) privateRefreshSchoolsBtn.hidden = appRole === 'school';
  if (workModeOverlay) {
    workModeOverlay.hidden = !canUseBusiness || (Boolean(currentWorkMode) && (!isStandaloneSchool() || standaloneSetupComplete())) || options.keepOverlayHidden;
  }
  const activePanel = document.querySelector('.tab-content.active');
  const activeTabName = activePanel?.id.replace(/^tab/, '').replace(/^[A-Z]/, s => s.toLowerCase()) || '';
  if (!activePanel || !visibleTabs.has(activeTabName)) {
    activateTab(canUseBusiness ? (WORK_MODE_DEFAULT_TAB[currentWorkMode] || [...visibleTabs][0] || '') : 'settings');
  }
}

async function setWorkMode(mode) {
  if (!WORK_MODE_LABELS[mode]) return;
  if (isStandaloneSchool() && currentWorkMode && currentWorkMode !== mode) {
    const profile = getStandaloneProfile();
    const hasFormalData = Object.keys(profile.formalControls || {}).length > 0;
    const hasDraftData = Object.keys(profile.draftControls || {}).length > 0 || Boolean(profile.draftPrevReportPath);
    if ((hasFormalData || hasDraftData) && !window.confirm(
      `将从“${WORK_MODE_LABELS[currentWorkMode]}”切换到“${WORK_MODE_LABELS[mode]}”。\n\n已有本地资料不会删除，但不会参与新模式的报表生成；之后切回原模式仍可继续使用。是否继续？`,
    )) return;
  }
  let patch = { workMode: mode };
  if (isStandaloneSchool()) {
    const unitName = standaloneUnitName?.value?.trim() || '';
    const schoolStage = standaloneSetupSchoolStage?.value || '';
    const heatingFee = Number(standaloneHeatingFee?.value || 0);
    if (!unitName) {
      addLog('请先填写本单位名称', 'warn');
      standaloneUnitName?.focus();
      return;
    }
    if (!schoolStage) {
      addLog('请先选择学校类型', 'warn');
      standaloneSetupSchoolStage?.focus();
      return;
    }
    if (Number.isNaN(heatingFee) || heatingFee < 0) {
      addLog('取暖费标准必须是大于或等于 0 的数字', 'warn');
      standaloneHeatingFee?.focus();
      return;
    }
    patch = {
      workMode: mode,
      standaloneProfile: {
        ...getStandaloneProfile(),
        unitName,
        schoolStage,
        formalControls: { ...(getStandaloneProfile().formalControls || {}), schoolStage },
        draftControls: { ...(getStandaloneProfile().draftControls || {}), schoolStage },
      },
      regionRules: {
        ...(appConfig?.regionRules || {}),
        heatingFeePerStudent: heatingFee,
      },
    };
  }
  const result = await window.reportApp.saveConfig(patch);
  if (result?.ok === false) {
    addLog(`保存填报类型失败：${result.message}`, 'error');
    return;
  }
  appConfig = result?.data || { ...appConfig, ...patch };
  if (isStandaloneSchool()) appUnitName = String(getStandaloneProfile().unitName || '').trim();
  applyWorkMode(mode, { keepOverlayHidden: true });
  if (workModeOverlay) workModeOverlay.hidden = true;
  activateTab(WORK_MODE_DEFAULT_TAB[mode]);
  addLog(`已切换填报类型：${WORK_MODE_LABELS[mode]}`, 'success');
}

// ===== 标签切换 =====
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab);
  });
});

function selectInitialWorkMode(mode) {
  if (!WORK_MODE_LABELS[mode]) return;
  selectedInitialWorkMode = mode;
  document.querySelectorAll('[data-work-mode]').forEach((btn) => {
    const selected = btn.dataset.workMode === mode;
    btn.classList.toggle('selected', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
  if (confirmInitialSetupBtn) confirmInitialSetupBtn.disabled = false;
}

document.querySelectorAll('[data-work-mode]').forEach((btn) => {
  btn.addEventListener('click', () => selectInitialWorkMode(btn.dataset.workMode));
});

if (confirmInitialSetupBtn) {
  confirmInitialSetupBtn.addEventListener('click', () => setWorkMode(selectedInitialWorkMode));
}

if (changeWorkModeBtn) {
  changeWorkModeBtn.addEventListener('click', () => {
    activateTab('settings');
  });
}

if (settingsCenterBtn) {
  settingsCenterBtn.addEventListener('click', () => activateTab('settings'));
}

// ===== 报表目录切换 =====
const tableNav = document.querySelector('#tableNav');
const currentTableName = document.querySelector('#currentTableName');
const spreadsheetContainer = document.querySelector('#spreadsheetContainer');
const previewSchoolSelect = document.querySelector('#previewSchoolSelect');
const deleteSchoolBtn = document.querySelector('#deleteSchoolBtn');
const exportExcelBtn = document.querySelector('#exportExcelBtn');

// ===== 免费/完整版功能闸 =====
// 核心报表（付费后才显示/导出）。改这里即可调整锁定的表。
const LOCKED_TABLES = new Set(['支出表']);
// 完整版解锁 = 有有效在线授权。空/无效授权 = 免费版。
function isFullVersionUnlocked() {
  return licenseIsValid(licenseState);
}
// 引导用户去授权中心激活。
function goActivate(featureName) {
  addLog(`「${featureName}」是完整版功能，激活后可用。已为你打开授权中心。`, 'warn');
  activateTab('settings');
  if (licenseKeyInput) {
    try { licenseKeyInput.focus(); } catch { /* ignore */ }
  }
}
// 根据授权状态给左侧目录里的核心表加/去锁标记。
function updateTableNavLocks() {
  if (!tableNav) return;
  const unlocked = isFullVersionUnlocked();
  tableNav.querySelectorAll('li[data-table]').forEach((li) => {
    const locked = LOCKED_TABLES.has(li.dataset.table) && !unlocked;
    li.classList.toggle('table-nav-locked', locked);
    if (locked) li.setAttribute('title', '完整版功能，激活后查看');
    else li.removeAttribute('title');
  });
}
// 授权状态变化后，若正在看某张表则重绘（锁定表在解锁前后切换占位/实表）。
function rerenderActiveTableIfNeeded() {
  if (typeof currentPreviewData === 'undefined' || !currentPreviewData || !currentPreviewData.computed) return;
  const activeLi = tableNav?.querySelector('li.active');
  if (activeLi) renderTableContent(activeLi.dataset.table);
}

if (deleteSchoolBtn) {
  deleteSchoolBtn.addEventListener('click', async () => {
    const name = previewSchoolSelect.value;
    if (!name) {
      addLog('请先在选择器里选择学校', 'warn');
      return;
    }
    const ok = window.confirm(
      `确认删除「${name}」的所有信息？\n\n` +
      `将会：\n` +
      `1. 删除数据库中该学校的报表记录\n` +
      `2. 删除已归档的生成年报\n` +
      `3. 把源文件移回监控目录，等待重新生成`
    );
    if (!ok) return;
    deleteSchoolBtn.disabled = true;
    try {
      const result = await window.reportApp.deleteSchool(name);
      if (result && result.ok) {
        const idx = previews.findIndex(p => p.unitName === name);
        if (idx >= 0) previews.splice(idx, 1);
        currentPreviewData = null;
        updateSchoolSelector();
        previewSchoolSelect.value = '';
        spreadsheetContainer.innerHTML = '<div class="empty-spreadsheet-hint"><p>已删除，请回到"学校状态"重新生成</p></div>';
        const status = await window.reportApp.getStatus();
        renderStatus(status);
        addLog(`已删除「${name}」，源文件已移回监控目录，可重新生成`, 'success');
      } else {
        addLog(`删除失败：${result && result.message || '未知错误'}`, 'error');
      }
    } catch (err) {
      addLog(`删除异常：${err.message}`, 'error');
    } finally {
      deleteSchoolBtn.disabled = false;
    }
  });
}

let currentPreviewData = null; // 存储当前预览学校的完整数据

if (tableNav) {
  tableNav.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      tableNav.querySelectorAll('li').forEach((item) => item.classList.remove('active'));
      li.classList.add('active');
      const tableName = li.dataset.table;
      currentTableName.textContent = tableName;
      renderTableContent(tableName);
    });
  });
}

// ===== 工具函数 =====
function setStatus(text, kind = 'idle') {
  overallStatus.textContent = text;
  overallStatus.className = `status-pill status-${kind}`;
}

function addLog(message, type = 'log') {
  const row = document.createElement('div');
  row.className = `log-row log-${type}`;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  row.textContent = `[${time}] ${message}`;
  logBox.appendChild(row);
  logBox.scrollTop = logBox.scrollHeight;
}

function setImportFeedback(message, kind = '') {
  if (!importFeedback) return;
  importFeedback.textContent = message;
  importFeedback.className = `import-feedback${kind ? ` is-${kind}` : ''}`;
}

function renderStatus(status) {
  if (status?.folder && watchFolderPath) watchFolderPath.textContent = status.folder;
  // 学校列表
  schoolList.innerHTML = '';
  const watcherSchools = (status && status.schools) ? status.schools.slice() : [];

  // 把数据库里已生成、但监控目录看不到的学校（文件已归档）补进列表
  const watcherNames = new Set(watcherSchools.map(s => s.unitName));
  for (const p of previews) {
    if (!watcherNames.has(p.unitName)) {
      watcherSchools.push({
        unitName: p.unitName,
        ready: false,
        processing: false,
        missing: [],
        files: REQUIRED_TYPES.map(t => ({ type: t, found: false })),
        archived: true,
      });
    }
  }

  // 单机版严格只显示本机设置的一个单位，避免误把同一目录中其他学校的文件纳入生成。
  if (isStandaloneSchool() && appUnitName) {
    const normalizedUnit = appUnitName.trim();
    const ownSchool = watcherSchools.filter((school) => school.unitName === normalizedUnit);
    watcherSchools.splice(0, watcherSchools.length, ...ownSchool);
  }

  readySchoolNames = watcherSchools
    .filter((school) => school.ready && !previews.some((preview) => preview.unitName === school.unitName))
    .map((school) => school.unitName);

  if (watcherSchools.length === 0) {
    schoolList.innerHTML = isStandaloneSchool() && appUnitName
      ? `<div class="empty-hint">暂未检测到“${escapeHtml(appUnitName)}”的五件套文件，请确认文件中的学校名称与首次设置一致。</div>`
      : '<div class="empty-hint">暂未检测到学校文件，请放入Excel文件...</div>';
    summaryText.textContent = isStandaloneSchool() ? '等待本单位文件导入' : '等待文件导入';
    return;
  }

  let generatedCount = 0;
  for (const school of watcherSchools) {
    const isGenerated = previews.some(p => p.unitName === school.unitName);
    if (isGenerated) generatedCount++;

    const card = document.createElement('div');
    card.className = `school-card ${isGenerated ? 'school-done' : ''} ${school.ready ? 'school-ready' : ''} ${school.processing ? 'school-processing' : ''}`;

    const header = document.createElement('div');
    header.className = 'school-card-header';

    const name = document.createElement('strong');
    name.textContent = school.unitName;

    // 多学段标签
    const matchedPreview = previews.find(p => p.unitName === school.unitName);
    if (matchedPreview && matchedPreview.schoolType) {
      const typeTag = document.createElement('span');
      typeTag.className = `school-type-tag${matchedPreview.levels && matchedPreview.levels.length > 1 ? ' multi' : ''}`;
      typeTag.textContent = matchedPreview.schoolType;
      name.appendChild(typeTag);
    }

    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex';
    leftGroup.style.gap = '10px';
    leftGroup.style.alignItems = 'center';

    leftGroup.appendChild(name);

    const badge = document.createElement('span');
    if (isGenerated) {
      badge.className = 'school-badge badge-done';
      badge.textContent = '已生成';
    } else if (school.processing) {
      badge.className = 'school-badge badge-pending';
      badge.textContent = '生成中';
    } else if (school.ready) {
      badge.className = 'school-badge badge-ready';
      badge.textContent = '就绪';
    } else {
      badge.className = 'school-badge badge-pending';
      badge.textContent = `缺${school.missing.length}项`;
    }

    header.append(leftGroup, badge);
    card.appendChild(header);

    const fileGrid = document.createElement('div');
    fileGrid.className = 'school-files';
    for (const f of school.files) {
      const tag = document.createElement('span');
      tag.className = `file-tag ${f.found ? 'tag-ok' : 'tag-miss'}`;
      tag.textContent = f.type.replace('经费支出明细表', '支出明细');
      tag.title = f.found ? f.fileName : '未检测到';
      fileGrid.appendChild(tag);
    }
    card.appendChild(fileGrid);

    const foundCount = school.files.filter((file) => file.found).length;
    const checkDetail = document.createElement('p');
    checkDetail.className = `school-check-detail ${school.ready || school.archived ? 'is-ready' : ''}`;
    checkDetail.textContent = school.archived
      ? '已生成；本次源文件已归档，可在“经费年报”中查看或删除后重做。'
      : school.ready
      ? '五件套已齐全，可直接生成。'
      : `已识别 ${foundCount}/5，缺少：${school.missing.join('、') || '待检测'}`;
    card.appendChild(checkDetail);
    schoolList.appendChild(card);
  }

  const totalShown = watcherSchools.length;
  const readyCount = readySchoolNames.length;
  summaryText.textContent = `共 ${totalShown} 所，${generatedCount} 已生成，${readyCount} 可生成`;
}

function buildStandaloneFormalControls() {
  const controls = { schoolStage: standaloneSchoolStage?.value || '' };
  for (const [key, input] of Object.entries(standaloneFormalInputs)) {
    const raw = input?.value;
    // 未填专任教师时由引擎默认等于教职工数；不能保存为 0。
    if (key === 'teacherCount' && (raw === '' || raw == null)) continue;
    controls[key] = raw === '' || raw == null ? null : Number(raw);
  }
  return controls;
}

async function saveStandaloneFormalControls() {
  if (!isStandaloneSchool()) return;
  const controls = buildStandaloneFormalControls();
  const validation = await window.reportApp.validateFormalControls(controls);
  if (!validation?.ok) {
    addLog(Object.values(validation?.errors || {})[0] || '人员与学生资料校验失败', 'warn');
    return false;
  }
  const result = await window.reportApp.saveConfig({
    standaloneProfile: {
      ...getStandaloneProfile(),
      schoolStage: validation.controls.schoolStage,
      formalControls: validation.controls,
    },
  });
  if (result?.ok === false) {
    addLog(`保存人员与学生资料失败：${result.message || ''}`, 'error');
    return false;
  }
  appConfig = result?.data || {
    ...appConfig,
    standaloneProfile: {
      ...getStandaloneProfile(),
      schoolStage: validation.controls.schoolStage,
      formalControls: validation.controls,
    },
  };
  addLog('已保存本单位年末人员与学生资料', 'success');
  return true;
}

function renderPreview(preview) {
  const existingIndex = previews.findIndex(p => p.unitName === preview.unitName);
  if (existingIndex >= 0) previews[existingIndex] = preview;
  else previews.push(preview);

  // 更新学校下拉选择器
  updateSchoolSelector();

  // 选中刚生成的学校
  currentPreviewData = preview;
  previewSchoolSelect.value = preview.unitName;

  // 默认显示第一个选中的表
  const activeLi = tableNav.querySelector('li.active');
  renderTableContent(activeLi ? activeLi.dataset.table : '人员情况表');
}

function updateSchoolSelector() {
  const currentVal = previewSchoolSelect.value;
  previewSchoolSelect.innerHTML = '<option value="">-- 请选择学校 --</option>';
  for (const p of previews) {
    const opt = document.createElement('option');
    opt.value = p.unitName;
    opt.textContent = p.unitName;
    previewSchoolSelect.appendChild(opt);
  }
  if (currentVal) previewSchoolSelect.value = currentVal;
}

// 学校选择器切换事件
previewSchoolSelect.addEventListener('change', () => {
  const name = previewSchoolSelect.value;
  if (!name) {
    currentPreviewData = null;
    spreadsheetContainer.innerHTML = '<div class="empty-spreadsheet-hint"><p>请选择学校查看报表</p></div>';
    return;
  }
  const found = previews.find(p => p.unitName === name);
  if (found) {
    currentPreviewData = found;
    const activeLi = tableNav.querySelector('li.active');
    renderTableContent(activeLi ? activeLi.dataset.table : '人员情况表');
  }
});

// 导出Excel：免费版禁止导出；完整版在文件管理器中定位已生成的成品。
if (exportExcelBtn) {
  exportExcelBtn.addEventListener('click', async () => {
    if (!isFullVersionUnlocked()) {
      goActivate('导出Excel');
      return;
    }
    const out = currentPreviewData?.outputPath;
    if (!out) {
      addLog('没有可导出的文件，请先生成报表', 'warn');
      return;
    }
    const result = await window.reportApp.revealOutput(out);
    if (result?.ok === false) addLog(result.message || '导出失败', 'warn');
    else addLog('已在文件管理器中定位导出的 Excel', 'success');
  });
}

// ===== 政府年报表格定义 (匹配全国教育经费统计年报系统) =====
const GOV_TABLE_DEFS = {
  '人员情况表': {
    tableNo: 'jz_1',
    fullTitle: '人员情况表',
    hasUnit: true,
    dataCols: 1,
    headerHTML: `
      <tr><th class="gov-th-label">指标名称</th><th class="gov-th-unit">计量单位</th><th class="gov-th-code">代码</th><th class="gov-th-val">数量</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th></tr>
    `,
    getRows: (c) => {
      const p = c.人员情况表 || {};
      const v = (k) => p[k] || 0;
      return [
        { label: '机构数', code: '01', unit: '个', vals: [0] },
        { label: '年初在职教职工', code: '02', unit: '人', vals: [v('J12')] },
        { label: '  其中：教学人员', code: '03', unit: '人', vals: [v('J13')] },
        { label: '年末在职教职工', code: '04', unit: '人', vals: [v('J14')] },
        { label: '  其中：教学人员', code: '05', unit: '人', vals: [v('J15')] },
        { label: '年末编制外长期聘用人员', code: '06', unit: '人', vals: [v('J16')] },
        { label: '年末离退休人员', code: '07', unit: '人', vals: [v('J17')] },
        { label: '年初学生数', code: '08', unit: '人', vals: [v('J18')] },
        { label: '  其中：高中学生人数', code: '09', unit: '人', vals: [v('J19')] },
        { label: '        初中学生人数', code: '10', unit: '人', vals: [v('J20')] },
        { label: '        小学学生人数', code: '11', unit: '人', vals: [v('J21')] },
        { label: '年初学生数中随班就读学生人数', code: '12', unit: '人', vals: [v('J22')] },
        { label: '  其中：高中学生人数', code: '13', unit: '人', vals: [v('J23')] },
        { label: '        初中学生人数', code: '14', unit: '人', vals: [v('J24')] },
        { label: '        小学学生人数', code: '15', unit: '人', vals: [v('J25')] },
        { label: '年初学生数中寄宿学生人数', code: '16', unit: '人', vals: [v('J26')] },
        { label: '  其中：高中学生人数', code: '17', unit: '人', vals: [v('J27')] },
        { label: '        初中学生人数', code: '18', unit: '人', vals: [v('J28')] },
        { label: '        小学学生人数', code: '19', unit: '人', vals: [v('J29')] },
        { label: '年末学生数', code: '20', unit: '人', vals: [v('J30')] },
        { label: '  其中：高中学生人数', code: '21', unit: '人', vals: [v('J31')] },
        { label: '        初中学生人数', code: '22', unit: '人', vals: [v('J32')] },
        { label: '        小学学生人数', code: '23', unit: '人', vals: [v('J33')] },
        { label: '年末学生数中随班就读学生人数', code: '24', unit: '人', vals: [v('J34')] },
        { label: '  其中：高中学生人数', code: '25', unit: '人', vals: [v('J35')] },
        { label: '        初中学生人数', code: '26', unit: '人', vals: [v('J36')] },
        { label: '        小学学生人数', code: '27', unit: '人', vals: [v('J37')] },
        { label: '年末学生数中寄宿学生人数', code: '28', unit: '人', vals: [v('J38')] },
        { label: '  其中：高中学生人数', code: '29', unit: '人', vals: [v('J39')] },
        { label: '        初中学生人数', code: '30', unit: '人', vals: [v('J40')] },
        { label: '        小学学生人数', code: '31', unit: '人', vals: [v('J41')] },
        { label: '附1：非全日制学历学生人数', code: '32', unit: '人', vals: [0] },
        { label: '附2：短期培训人数', code: '33', unit: '人', vals: [0] },
        { label: '附3：年初学前一年在园儿童人数', code: '34', unit: '人', vals: [v('J44')] },
        { label: '附4：年末学前一年在园儿童人数', code: '35', unit: '人', vals: [v('J45')] },
        { label: '附5：年初托育幼儿人数', code: '36', unit: '人', vals: [v('J46')] },
        { label: '附6：年末托育幼儿人数', code: '37', unit: '人', vals: [v('J47')] },
      ];
    },
  },
  '收入表': {
    tableNo: 'jz_2',
    fullTitle: '收入情况表',
    hasUnit: true,
    dataCols: 1,
    headerHTML: `
      <tr><th class="gov-th-label">指标名称</th><th class="gov-th-unit">计量单位</th><th class="gov-th-code">代码</th><th class="gov-th-val">本年收入</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th></tr>
    `,
    getRows: (c) => {
      const i = c.收入情况表 || {};
      const v = (k) => i[k] || 0;
      return [
        { label: '合计', code: '01', unit: '元', vals: [v('J11') || (v('J12') + v('J26') + v('J36') + v('J43'))], isTotal: true },
        { label: '一、一般公共预算安排的教育经费', code: '02', unit: '元', vals: [v('J12') || v('J14')] },
        { label: '  (一)一般公共预算教育经费', code: '03', unit: '元', vals: [v('J13') || v('J14')] },
        { label: '    1.教育事业费', code: '04', unit: '元', vals: [v('J14')] },
        { label: '    2.基本建设经费', code: '05', unit: '元', vals: [0] },
        { label: '    3.教育费附加', code: '06', unit: '元', vals: [0] },
        { label: '  (二)一般公共预算科学技术经费', code: '07', unit: '元', vals: [0] },
        { label: '  (三)一般公共预算社会保障和就业经费', code: '08', unit: '元', vals: [0] },
        { label: '  (四)一般公共预算卫生健康经费', code: '09', unit: '元', vals: [0] },
        { label: '  (五)一般公共预算住房保障经费', code: '10', unit: '元', vals: [0] },
        { label: '  (六)其他一般公共预算安排的教育经费', code: '11', unit: '元', vals: [0] },
        { label: '二、政府性基金预算安排的教育经费', code: '12', unit: '元', vals: [0] },
        { label: '  其中：彩票公益金', code: '13', unit: '元', vals: [0] },
        { label: '  地方政府专项债务收入安排的教育经费', code: '14', unit: '元', vals: [0] },
        { label: '  超长期特别国债安排的教育经费', code: '15', unit: '元', vals: [0] },
        { label: '三、事业预算收入', code: '16', unit: '元', vals: [v('J26')] },
        { label: '  其中：学费/保育教育费', code: '17', unit: '元', vals: [v('J27') || v('J26')] },
        { label: '  其中：托育幼儿保育费', code: '18', unit: '元', vals: [0] },
        { label: '  住宿费', code: '19', unit: '元', vals: [0] },
        { label: '四、上级补助预算收入', code: '20', unit: '元', vals: [0] },
        { label: '五、附属单位上缴预算收入', code: '21', unit: '元', vals: [0] },
        { label: '六、经营预算收入', code: '22', unit: '元', vals: [0] },
        { label: '七、债务预算收入', code: '23', unit: '元', vals: [0] },
        { label: '八、非同级财政拨款预算收入', code: '24', unit: '元', vals: [0] },
        { label: '九、投资预算收益', code: '25', unit: '元', vals: [0] },
        { label: '十、其他预算收入', code: '26', unit: '元', vals: [v('J36')] },
        { label: '  其中：利息预算收入', code: '27', unit: '元', vals: [0] },
        { label: '  捐赠预算收入', code: '28', unit: '元', vals: [0] },
        { label: '  租金预算收入', code: '29', unit: '元', vals: [0] },
        { label: '  食堂净预算收入', code: '30', unit: '元', vals: [0] },
        { label: '  课后服务费收入', code: '31', unit: '元', vals: [v('J41')] },
        { label: '十一、国有及国有控股企业拨款', code: '32', unit: '元', vals: [0] },
        { label: '十二、民办学校中举办者投入', code: '33', unit: '元', vals: [v('J43')] },
        { label: '附1.一般公共预算安排的基本建设总经费', code: '34', unit: '元', vals: [0] },
        { label: '附2.地方政府一般债务收入安排的教育经费', code: '35', unit: '元', vals: [0] },
        { label: '附3.本年实际收取学费/保育教育费', code: '36', unit: '元', vals: [v('J27') || v('J26')] },
        { label: '  其中：托育幼儿保育费', code: '37', unit: '元', vals: [0] },
        { label: '  民办学前一年在园儿童保育教育费', code: '38', unit: '元', vals: [0] },
        { label: '附4.学前一年在园儿童保育教育费免除金额', code: '39', unit: '元', vals: [0] },
        { label: '附5.本年实际收取住宿费', code: '40', unit: '元', vals: [0] },
        { label: '附6.本年上缴国库款', code: '41', unit: '元', vals: [0] },
        { label: '  其中：公办幼儿园保教(育)费', code: '42', unit: '元', vals: [0] },
        { label: '  公办幼儿园住宿费', code: '43', unit: '元', vals: [0] },
        { label: '附7.本年实际接受捐赠收入', code: '44', unit: '元', vals: [0] },
        { label: '附8.财政补助收入中安排的公用经费', code: '45', unit: '元', vals: [v('J55')] },
        { label: '附9.财政补助收入中安排的随班就读学生的经费', code: '46', unit: '元', vals: [v('J56')] },
        { label: '附10.财政补助收入中安排的寄宿生公用经费', code: '47', unit: '元', vals: [v('J57')] },
        { label: '附11.财政补助收入中安排的取暖经费', code: '48', unit: '元', vals: [v('J58')] },
        { label: '附12.教育基金会本年捐赠收入', code: '49', unit: '元', vals: [0] },
        { label: '附13.教育基金会本年慈善活动经费', code: '50', unit: '元', vals: [0] },
        { label: '  其中：转入学校', code: '51', unit: '元', vals: [0] },
      ];
    },
  },
  '支出表': {
    tableNo: 'jz_3',
    fullTitle: '支出情况表',
    hasUnit: true,
    dataCols: 8,
    headerHTML: `
      <tr><th rowspan="4" class="gov-th-label">指标名称</th><th rowspan="4" class="gov-th-unit">计量单位</th><th rowspan="4" class="gov-th-code">代码</th><th rowspan="4" class="gov-th-val">总支出</th><th colspan="7">其中：财政补助支出</th></tr>
      <tr><th rowspan="3" class="gov-th-val">小计</th><th colspan="3">1.一般公共预算安排的教育经费支出</th><th colspan="3">2.政府性基金预算安排的教育经费支出</th></tr>
      <tr><th rowspan="2" class="gov-th-val">小计</th><th colspan="2">其中：一般公共预算教育支出</th><th rowspan="2" class="gov-th-val">小计</th><th rowspan="2" class="gov-th-val">其中：地方政府<br>专项债务收入</th><th rowspan="2" class="gov-th-val">其中：超长期<br>特别国债</th></tr>
      <tr><th class="gov-th-val">小计</th><th class="gov-th-val">其中：教育事业费<br>和基本建设支出</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
    `,
    getRows: (c) => {
      const e = c.支出情况表 || {};
      const v = (k) => e[k] || 0;
      const z8 = [0,0,0,0,0,0,0,0];
      const r8 = (k) => {
        const row = String(k).replace(/^[A-Z]+/, '');
        const fiscal = v(`J${row}`);
        const total = e[`F${row}`] != null ? v(`F${row}`) : fiscal;
        return [total, fiscal, fiscal, fiscal, fiscal, 0, 0, 0];
      };
      const r8tf = (totalKey, fiscalKey) => {
        const total = v(totalKey);
        const fiscal = v(fiscalKey);
        return [total, fiscal, fiscal, fiscal, fiscal, 0, 0, 0];
      };
      const u = '元';
      return [
        { label: '合计', code: '01', unit: u, vals: r8tf('F14', 'J14'), isTotal: true },
        { label: '一、事业性经费支出', code: '02', unit: u, vals: r8tf('F15', 'J15'), isTotal: true },
        { label: '（一）工资福利支出', code: '03', unit: u, vals: r8tf('F16', 'J16'), isTotal: true },
        { label: '  1.基本工资', code: '04', unit: u, vals: [v('F17'), v('J17'), v('J17'), v('J17'), v('J17'), 0, 0, 0] },
        { label: '  2.津贴补贴', code: '05', unit: u, vals: r8('J18') },
        { label: '    其中：乡村教师补助', code: '06', unit: u, vals: r8('J19') },
        { label: '  3.奖金', code: '07', unit: u, vals: r8('J20') },
        { label: '  4.伙食补助费', code: '08', unit: u, vals: r8('J21') },
        { label: '  5.绩效工资', code: '09', unit: u, vals: r8('J22') },
        { label: '  6.机关事业单位基本养老保险缴费', code: '10', unit: u, vals: r8('J23') },
        { label: '  7.职业年金缴费', code: '11', unit: u, vals: r8('J24') },
        { label: '  8.职工基本医疗保险缴费', code: '12', unit: u, vals: r8('J25') },
        { label: '  9.公务员医疗补助缴费', code: '13', unit: u, vals: r8('J26') },
        { label: '  10.其他社会保障缴费', code: '14', unit: u, vals: r8('J27') },
        { label: '  11.住房公积金', code: '15', unit: u, vals: r8('J28') },
        { label: '  12.医疗费', code: '16', unit: u, vals: r8('J29') },
        { label: '  13.其他工资福利支出', code: '17', unit: u, vals: r8tf('F30', 'J30') },
        { label: '    其中：外聘教职工工资福利支出', code: '18', unit: u, vals: r8('J31') },
        { label: '（二）对个人和家庭的补助支出', code: '19', unit: u, vals: r8('J32'), isTotal: true },
        { label: '  1.离休费', code: '20', unit: u, vals: r8('J33') },
        { label: '  2.退休费', code: '21', unit: u, vals: r8('J34') },
        { label: '  3.退职（役）费', code: '22', unit: u, vals: r8('J35') },
        { label: '  4.抚恤金', code: '23', unit: u, vals: r8('J36') },
        { label: '  5.生活补助', code: '24', unit: u, vals: r8('J37') },
        { label: '  6.救济费', code: '25', unit: u, vals: r8('J38') },
        { label: '  7.医疗费补助', code: '26', unit: u, vals: r8('J39') },
        { label: '  8.奖助学金', code: '27', unit: u, vals: r8('J40') },
        { label: '    其中：助学金', code: '28', unit: u, vals: r8('J41') },
        { label: '    奖学金', code: '29', unit: u, vals: z8 },
        { label: '    学生伙食补助', code: '30', unit: u, vals: z8 },
        { label: '    免费教科书', code: '31', unit: u, vals: z8 },
        { label: '  9.奖励金', code: '32', unit: u, vals: r8('J45') },
        { label: '  10.其他对个人和家庭的补助', code: '33', unit: u, vals: r8('J46') },
        { label: '（三）商品和服务支出', code: '34', unit: u, vals: r8('J47'), isTotal: true },
        { label: '  1.办公费', code: '35', unit: u, vals: r8('J48') },
        { label: '  2.印刷费', code: '36', unit: u, vals: r8('J49') },
        { label: '  3.手续费', code: '37', unit: u, vals: r8('J50') },
        { label: '  4.水费', code: '38', unit: u, vals: r8('J51') },
        { label: '  5.电费', code: '39', unit: u, vals: r8('J52') },
        { label: '  6.邮电费', code: '40', unit: u, vals: r8('J53') },
        { label: '  7.取暖费', code: '41', unit: u, vals: r8('J54') },
        { label: '  8.物业管理费', code: '42', unit: u, vals: r8('J55') },
        { label: '  9.差旅费', code: '43', unit: u, vals: r8('J56') },
        { label: '  10.因公出国（境）费用', code: '44', unit: u, vals: r8('J57') },
        { label: '  11.维修（护）费', code: '45', unit: u, vals: r8('J58') },
        { label: '  12.租赁费', code: '46', unit: u, vals: r8('J59') },
        { label: '  13.会议费', code: '47', unit: u, vals: r8('J60') },
        { label: '  14.培训费', code: '48', unit: u, vals: r8('J61') },
        { label: '  15.公务接待费', code: '49', unit: u, vals: r8('J62') },
        { label: '  16.专用材料费', code: '50', unit: u, vals: r8('J63') },
        { label: '  17.专用燃料费', code: '51', unit: u, vals: r8('J64') },
        { label: '  18.劳务费', code: '52', unit: u, vals: r8('J65') },
        { label: '  19.委托业务费', code: '53', unit: u, vals: r8('J66') },
        { label: '  20.工会经费', code: '54', unit: u, vals: r8('J67') },
        { label: '  21.福利费', code: '55', unit: u, vals: r8('J68') },
        { label: '  22.公务用车运行维护费', code: '56', unit: u, vals: r8('J69') },
        { label: '  23.其他交通费用', code: '57', unit: u, vals: r8('J70') },
        { label: '    其中：校车运营费', code: '58', unit: u, vals: z8 },
        { label: '  24.税金及附加费用', code: '59', unit: u, vals: r8('J72') },
        { label: '  25.其他商品和服务支出', code: '60', unit: u, vals: r8('J73') },
        { label: '    校方责任险', code: '61', unit: u, vals: r8('J74') },
        { label: '    转拨给其他单位的经费', code: '62', unit: u, vals: r8('J75') },
        { label: '（四）资本性支出', code: '63', unit: u, vals: r8('J76'), isTotal: true },
        { label: '  1.房屋建筑物购建', code: '64', unit: u, vals: r8('J77') },
        { label: '  2.办公设备购置', code: '65', unit: u, vals: r8('J78') },
        { label: '  3.专用设备购置', code: '66', unit: u, vals: r8('J79') },
        { label: '  4.大型修缮', code: '67', unit: u, vals: r8('J80') },
        { label: '  5.信息网络及软件购置更新', code: '68', unit: u, vals: r8('J81') },
        { label: '  6.公务用车购置', code: '69', unit: u, vals: r8('J82') },
        { label: '  7.其他交通工具购置', code: '70', unit: u, vals: z8 },
        { label: '  8.文物和陈列品购置', code: '71', unit: u, vals: z8 },
        { label: '  9.无形资产购置', code: '72', unit: u, vals: z8 },
        { label: '  10.其他资本性支出', code: '73', unit: u, vals: r8('J87') },
        { label: '    其中：图书购置', code: '74', unit: u, vals: z8 },
        { label: '（五）资本性支出（基本建设）', code: '75', unit: u, vals: z8 },
        { label: '二、经营支出', code: '76', unit: u, vals: z8 },
        { label: '三、上缴上级支出', code: '77', unit: u, vals: z8 },
        { label: '四、对附属单位补助支出', code: '78', unit: u, vals: z8 },
        { label: '五、投资支出', code: '79', unit: u, vals: z8 },
        { label: '六、债务还本支出', code: '80', unit: u, vals: z8 },
        { label: '七、其他支出', code: '81', unit: u, vals: r8('J94') },
        { label: '  其中：利息支出', code: '82', unit: u, vals: r8('J95') },
        { label: '  捐赠支出', code: '83', unit: u, vals: r8('J96') },
        { label: '年末预算结转结余', code: '84', unit: u, vals: z8 },
        { label: '附：事业性经费支出中的项目支出', code: '85', unit: u, vals: r8('J98'), isTotal: true },
        { label: '  1.工资福利支出', code: '86', unit: u, vals: r8('J99') },
        { label: '  2.对个人和家庭的补助支出', code: '87', unit: u, vals: r8('J100') },
        { label: '  3.商品和服务支出', code: '88', unit: u, vals: r8('J101') },
        { label: '  4.资本性支出', code: '89', unit: u, vals: r8('J102') },
        { label: '    （1）房屋建筑物购建', code: '90', unit: u, vals: r8('J103') },
        { label: '    （2）办公设备购置', code: '91', unit: u, vals: r8('J104') },
        { label: '    （3）专用设备购置', code: '92', unit: u, vals: r8('J105') },
        { label: '    （4）大型修缮', code: '93', unit: u, vals: r8('J106') },
        { label: '    （5）信息网络及软件购置更新', code: '94', unit: u, vals: z8 },
        { label: '    （6）公务用车购置', code: '95', unit: u, vals: z8 },
        { label: '    （7）其他交通工具购置', code: '96', unit: u, vals: z8 },
        { label: '    （8）文物和陈列品购置', code: '97', unit: u, vals: z8 },
        { label: '    （9）无形资产购置', code: '98', unit: u, vals: z8 },
        { label: '    （10）其他资本性支出', code: '99', unit: u, vals: z8 },
        { label: '      其中：图书购置', code: '100', unit: u, vals: z8 },
        { label: '  5.资本性支出（基本建设）', code: '101', unit: u, vals: z8 },
        { label: '附2：地方政府一般债务收入安排的教育经费支出', code: '102', unit: u, vals: z8 },
      ];
    },
  },
  '费用表': {
    tableNo: 'jz_4',
    fullTitle: '费用情况表',
    hasUnit: true,
    dataCols: 10,
    headerHTML: `
      <tr><th rowspan="2" class="gov-th-label">指标名称</th><th rowspan="2" class="gov-th-unit">计量单位</th><th rowspan="2" class="gov-th-code">代码</th><th rowspan="2" class="gov-th-val">合计</th><th colspan="2">工资福利费用</th><th colspan="3">对个人和家庭的补助费用</th><th rowspan="2" class="gov-th-val">商品和<br>服务费用</th><th rowspan="2" class="gov-th-val">固定资产<br>折旧费用</th><th rowspan="2" class="gov-th-val">无形资产<br>摊销费用</th><th rowspan="2" class="gov-th-val">计提专用<br>基金</th></tr>
      <tr><th class="gov-th-val">小计</th><th class="gov-th-val">其中：外聘<br>教职工</th><th class="gov-th-val">小计</th><th class="gov-th-val">其中：<br>离退休费</th><th class="gov-th-val">其中：<br>奖助学金</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th></tr>
    `,
    getRows: (c) => {
      const f = c.费用情况表 || {};
      const v = (k) => f[k] || 0;
      const u = '元';
      const z10 = [0,0,0,0,0,0,0,0,0,0];
      const total = v('F12') || (v('F13') + v('F14') + v('F16'));
      return [
        { label: '本年费用合计', code: '01', unit: u, vals: [total, v('G13') + v('G14'), v('H13') + v('H14'), v('I13') + v('I14'), v('J13') + v('J14'), v('K13') + v('K14'), v('L13') + v('L14'), v('M13') + v('M14'), v('N13') + v('N14'), v('O13') + v('O14')], isTotal: true },
        { label: '一、业务活动费用', code: '02', unit: u, vals: [v('F13'), v('G13'), v('H13'), v('I13'), v('J13'), v('K13'), v('L13'), v('M13'), v('N13'), v('O13')] },
        { label: '二、单位管理费用', code: '03', unit: u, vals: [v('F14'), v('G14'), v('H14'), v('I14'), v('J14'), v('K14'), v('L14'), v('M14'), v('N14'), v('O14')] },
        { label: '三、经营费用', code: '04', unit: u, vals: z10 },
        { label: '四、资产处置费用', code: '05', unit: u, vals: [v('F17'), 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { label: '五、上缴上级费用', code: '06', unit: u, vals: z10 },
        { label: '六、对附属单位补助费用', code: '07', unit: u, vals: z10 },
        { label: '七、所得税费用', code: '08', unit: u, vals: z10 },
        { label: '八、其他费用', code: '09', unit: u, vals: z10 },
      ];
    },
  },
  '债务表': {
    tableNo: 'jz_5',
    fullTitle: '债务情况表',
    hasUnit: true,
    dataCols: 2,
    headerHTML: `
      <tr><th class="gov-th-label">指标名称</th><th class="gov-th-unit">计量单位</th><th class="gov-th-code">代码</th><th class="gov-th-val">合计</th><th class="gov-th-val">其中：本年<br>新增债务余额</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th><th>2</th></tr>
    `,
    getRows: () => [
      { label: '一、债务资金来源', code: '01', unit: '元', vals: [0, 0], isTotal: true },
      { label: '  1.国外金融机构贷款（不含世行贷款）', code: '02', unit: '元', vals: [0, 0] },
      { label: '  2.国内金融机构贷款', code: '03', unit: '元', vals: [0, 0] },
      { label: '  3.欠施工单位工程款', code: '04', unit: '元', vals: [0, 0] },
      { label: '  4.借（欠）个人款', code: '05', unit: '元', vals: [0, 0] },
      { label: '  5.借（欠）其他单位款', code: '06', unit: '元', vals: [0, 0] },
      { label: '  6.其他', code: '07', unit: '元', vals: [0, 0] },
      { label: '二、债务资金用途', code: '08', unit: '元', vals: [0, 0], isTotal: true },
      { label: '  1.房屋建筑物购建和大型修缮', code: '09', unit: '元', vals: [0, 0] },
      { label: '  2.土地征用费', code: '10', unit: '元', vals: [0, 0] },
      { label: '  3.设备购置', code: '11', unit: '元', vals: [0, 0] },
      { label: '  4.其他支出', code: '12', unit: '元', vals: [0, 0] },
    ],
  },
  '价值量表': {
    tableNo: 'jz_6',
    fullTitle: '资产价值量情况表',
    hasUnit: true,
    dataCols: 8,
    headerHTML: `
      <tr><th rowspan="2" class="gov-th-label">指标名称</th><th rowspan="2" class="gov-th-unit">计量单位</th><th rowspan="2" class="gov-th-code">代码</th><th rowspan="2" class="gov-th-val">年初数</th><th colspan="5">年末数</th><th rowspan="2" class="gov-th-val">本年账面<br>增加数</th><th rowspan="2" class="gov-th-val">本年处置<br>资产值</th></tr>
      <tr><th class="gov-th-val">合计</th><th class="gov-th-val">自用</th><th class="gov-th-val">闲置</th><th class="gov-th-val">出租出借</th><th class="gov-th-val">其他</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
    `,
    getRows: (c) => {
      const a = c.资产价值量情况表 || {};
      const v = (k) => a[k] || 0;
      const u = '元';
      const r = (label, code, row) => ({
        label, code, unit: u,
        vals: [v(`F${row}`), v(`G${row}`), v(`H${row}`), v(`I${row}`), v(`J${row}`), v(`K${row}`), v(`L${row}`), v(`M${row}`)],
      });
      return [
        { ...r('一、资产合计', '01', 12), isTotal: true },
        r('（一）流动资产', '02', 13),
        r('（二）长期投资', '03', 14),
        r('（三）固定资产净值', '04', 15),
        r('  1.固定资产原值', '05', 16),
        r('    ①房屋和构筑物', '06', 17),
        r('    ②设备', '07', 18),
        r('    ③文物和陈列品', '08', 19),
        r('    ④图书和档案', '09', 20),
        r('    ⑤家具和用具', '10', 21),
        r('    ⑥特种动植物', '11', 22),
        r('  2.减：固定资产累计折旧', '12', 23),
        r('    ①房屋和构筑物', '13', 24),
        r('    ②设备', '14', 25),
        r('    ③家具和用具', '15', 26),
        r('（四）在建工程', '16', 27),
        r('  其中：已投入使用未转固在建工程', '17', 28),
        r('（五）无形资产净值', '18', 29),
        r('  1.无形资产原值', '19', 30),
        r('    其中：土地使用权原值', '20', 31),
        r('  2.减：无形资产累计摊销', '21', 32),
        r('    其中：土地使用权累计摊销', '22', 33),
        r('（六）其他资产', '23', 34),
        r('二、减：负债合计', '24', 35),
        { ...r('三、净资产合计', '25', 36), isTotal: true },
      ];
    },
  },
  '实物量表': {
    tableNo: 'jz_7',
    fullTitle: '资产实物量情况表',
    hasUnit: true,
    dataCols: 1,
    headerHTML: `
      <tr><th class="gov-th-label">指标名称</th><th class="gov-th-unit">计量单位</th><th class="gov-th-code">代码</th><th class="gov-th-val">年末数量</th></tr>
      <tr class="gov-index-row"><th>甲</th><th>乙</th><th>丙</th><th>1</th></tr>
    `,
    getRows: (c) => {
      const ph = c.资产实物量情况表 || {};
      const v = (k) => ph[k] || 0;
      return [
        { label: '土地及土地使用权面积', code: '01', unit: '平方米', vals: [v('J11')] },
        { label: '  其中：运动场地面积', code: '02', unit: '平方米', vals: [v('J12')] },
        { label: '  校园外学校拥有的农场、林地等土地面积', code: '03', unit: '平方米', vals: [v('J13')] },
        { label: '校园足球场个数', code: '04', unit: '个', vals: [v('J14')] },
        { label: '年末房屋建筑面积', code: '05', unit: '平方米', vals: [v('J15')] },
        { label: '  1.产权房屋建筑面积', code: '06', unit: '平方米', vals: [v('J16')] },
        { label: '  2.非产权独立使用房屋建筑面积', code: '07', unit: '平方米', vals: [v('J17')] },
        { label: '    其中：从外校租借来的房屋建筑面积', code: '08', unit: '平方米', vals: [v('J18')] },
        { label: '年末教学及辅助用房建筑面积', code: '09', unit: '平方米', vals: [v('J19')] },
        { label: '  1.产权房屋建筑面积', code: '10', unit: '平方米', vals: [v('J20')] },
        { label: '  2.非产权独立使用房屋建筑面积', code: '11', unit: '平方米', vals: [v('J21')] },
        { label: '年末危房面积', code: '12', unit: '平方米', vals: [v('J22')] },
        { label: '  其中：D级危房面积', code: '13', unit: '平方米', vals: [v('J23')] },
        { label: '年末取暖面积', code: '14', unit: '平方米', vals: [v('J24')] },
        { label: '网络多媒体教室间数', code: '15', unit: '间', vals: [v('J25')] },
        { label: '图书', code: '16', unit: '册', vals: [v('J26')] },
        { label: '数字终端数', code: '17', unit: '台', vals: [v('J27')] },
        { label: '  其中：学生终端数', code: '18', unit: '台', vals: [v('J28')] },
        { label: '车辆', code: '19', unit: '辆', vals: [v('J29')] },
        { label: '专利', code: '20', unit: '项', vals: [v('J30')] },
      ];
    },
  },
};

function formatGovValue(v) {
  if (v === null || v === undefined) return '';
  const num = v || 0;
  if (typeof num === 'number') {
    return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return num;
}

const SOURCE_LABELS = {
  manual: '手填',
  estimated: '估算',
  derived: '派生',
  previous: '上年带入',
};

const SOURCE_CLASS = {
  manual: 'manual',
  estimated: 'estimated',
  derived: 'derived',
  previous: 'previous',
};

function collectPreviewWarnings(preview) {
  const warnings = [...(preview?.warnings || [])];
  const c = preview?.computed || {};
  const income = c.收入情况表 || {};
  const expense = c.支出情况表 || {};
  const incomeTotal = income.J11 || 0;
  const expenseTotal = expense.F14 != null ? expense.F14 : (expense.J14 || 0);
  if (Math.abs(incomeTotal - expenseTotal) > 1) {
    warnings.push(`收支不平：收入合计 ${formatGovValue(incomeTotal)}，支出合计 ${formatGovValue(expenseTotal)}。`);
  }
  const goodsTotal = expense.F47 != null ? expense.F47 : (expense.J47 || 0);
  const otherGoods = expense.F73 != null ? expense.F73 : (expense.J73 || 0);
  const base = Math.max(0, goodsTotal - (expense.F58 || expense.J58 || 0) - (expense.F62 || expense.J62 || 0) - otherGoods);
  if (base > 0 && otherGoods / base > 0.1501) {
    warnings.push('其他商品和服务支出占扣除维修（护）费、公务接待费及其他商品服务支出后的商品服务支出比例超过15%。');
  }
  return [...new Set(warnings)];
}

function renderPreviewPanels(wrapper, tableName) {
  const warnings = collectPreviewWarnings(currentPreviewData);
  if (warnings.length > 0) {
    const notice = document.createElement('div');
    notice.className = 'preview-notice warn';
    notice.innerHTML = `<div class="preview-notice-title">提示项</div><ul>${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    wrapper.appendChild(notice);
  }

  const validation = currentPreviewData?.validation || currentPreviewData?.computed?.__meta?.validation;
  if (validation?.enabled) {
    const panel = document.createElement('div');
    panel.className = `preview-notice rule-validation${validation.failed?.length ? ' warn' : ' success'}`;
    const adjustments = validation.adjusted || [];
    const failed = validation.failed || [];
    const details = [
      `已校验 ${validation.checked || 0} 条，通过 ${validation.passed || 0} 条。`,
      adjustments.length ? `已自动平衡 ${adjustments.length} 项。` : '',
      failed.length ? `仍有 ${failed.length} 条需要复核。` : '当前已校验规则均通过。',
    ].filter(Boolean);
    const failures = failed.slice(0, 8).map((item) => `<li>${escapeHtml(`${item.severity}校验：${item.message}`)}</li>`).join('');
    panel.innerHTML = `<div class="preview-notice-title">生成后规则校验</div><div>${escapeHtml(details.join(' '))}</div>${failures ? `<ul>${failures}</ul>` : ''}`;
    wrapper.appendChild(panel);
  }

  const sources = currentPreviewData?.sources || currentPreviewData?.computed?.__meta?.sources || {};
  const sheetSources = Object.values(sources).flatMap(sheet => Object.entries(sheet || {}));
  if (sheetSources.length > 0) {
    const panel = document.createElement('div');
    panel.className = 'source-panel';
    const chips = sheetSources.slice(0, 14).map(([addr, info]) => {
      const cls = SOURCE_CLASS[info.source] || 'estimated';
      const label = SOURCE_LABELS[info.source] || info.source || '来源';
      return `<span class="source-chip ${escapeHtml(cls)}" title="${escapeHtml(info.method || '')}">${escapeHtml(addr)} ${escapeHtml(label)}</span>`;
    }).join('');
    panel.innerHTML = `<div class="source-panel-title">来源标记</div><div class="source-chip-row">${chips}</div>`;
    wrapper.appendChild(panel);
  }

  if (currentPreviewData?.mode === 'private-draft' && ['收入表', '支出表'].includes(tableName)) {
    wrapper.appendChild(buildQuickEditPanel(tableName));
  }
}

const QUICK_EDIT_FIELDS = {
  '收入表': [
    ['收入情况表', 'J26', '学费/保育教育费'],
    ['收入情况表', 'J14', '财政补助'],
    ['收入情况表', 'J36', '其他收入'],
    ['收入情况表', 'J43', '举办者投入'],
    ['收入情况表', 'J58', '取暖经费'],
  ],
  '支出表': [
    ['支出情况表', 'F16', '工资福利总额'],
    ['支出情况表', 'F48', '办公费'],
    ['支出情况表', 'F54', '取暖费'],
    ['支出情况表', 'F59', '租赁费'],
    ['支出情况表', 'F73', '其他商品服务'],
    ['支出情况表', 'F76', '资本性支出'],
    ['支出情况表', 'F94', '其他支出'],
    ['支出情况表', 'F95', '利息支出'],
    ['支出情况表', 'F96', '捐赠支出'],
    ['支出情况表', 'F97', '举办者抽回'],
  ],
};

function setComputedValue(computed, sheetName, addr, value) {
  if (!computed[sheetName]) computed[sheetName] = {};
  computed[sheetName][addr] = value;
  if (!currentPreviewData.sources) currentPreviewData.sources = {};
  if (!currentPreviewData.sources[sheetName]) currentPreviewData.sources[sheetName] = {};
  currentPreviewData.sources[sheetName][addr] = {
    source: 'manual',
    method: '用户在经费年报中手工修正',
    confidence: 'confirmed',
  };
  recalcPreviewTotals(computed);
}

function recalcPreviewTotals(computed) {
  const income = computed.收入情况表 || {};
  income.J12 = income.J14 || income.J12 || 0;
  income.J13 = income.J14 || income.J13 || 0;
  income.J55 = Math.max(0, (income.J14 || 0) - (income.J56 || 0) - (income.J57 || 0) - (income.J58 || 0));
  income.J11 = (income.J12 || 0) + (income.J26 || 0) + (income.J36 || 0) + (income.J43 || 0);

  const expense = computed.支出情况表 || {};
  const goodsRows = [48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,72,73,74,75];
  expense.F47 = goodsRows.reduce((sum, row) => sum + (expense[`F${row}`] || expense[`J${row}`] || 0), 0);
  expense.F94 = Math.max(expense.F94 || 0, (expense.F95 || 0) + (expense.F96 || 0) + (expense.F97 || 0));
  expense.F15 = (expense.F16 || 0) + (expense.F32 || 0) + (expense.F47 || 0) + (expense.F76 || 0) + (expense.F88 || 0);
  expense.F14 = expense.F15 + (expense.F94 || 0);

  const fee = computed.费用情况表 || {};
  fee.G13 = expense.F16 || 0;
  fee.L13 = expense.F47 || 0;
  fee.F13 = (fee.G13 || 0) + (fee.I13 || 0) + (fee.L13 || 0) + (fee.M13 || 0);
  fee.F12 = (fee.F13 || 0) + (fee.F14 || 0) + (fee.F16 || 0);
}

function buildQuickEditPanel(tableName) {
  const panel = document.createElement('div');
  panel.className = 'quick-edit-panel';
  panel.innerHTML = '<div class="quick-edit-title">快速修正</div>';
  const grid = document.createElement('div');
  grid.className = 'quick-edit-grid';
  const fields = QUICK_EDIT_FIELDS[tableName] || [];
  const computed = currentPreviewData.computed;
  for (const [sheetName, addr, label] of fields) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.value = computed?.[sheetName]?.[addr] ?? 0;
    input.dataset.sheet = sheetName;
    input.dataset.addr = addr;
    input.addEventListener('change', () => {
      if (!window.confirm(`修改“${label}”会把该格改为手填，并断开原自动联动。是否继续？`)) {
        input.value = computed?.[sheetName]?.[addr] ?? 0;
        return;
      }
      setComputedValue(computed, sheetName, addr, Number(input.value || 0));
      renderTableContent(tableName);
    });
    const labelEl = document.createElement('label');
    labelEl.textContent = `${label}（${addr}）`;
    labelEl.appendChild(input);
    grid.appendChild(labelEl);
  }
  panel.appendChild(grid);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'primary btn-sm';
  saveBtn.textContent = '保存修正到Excel';
  saveBtn.addEventListener('click', saveEditedPreview);
  panel.appendChild(saveBtn);
  return panel;
}

async function saveEditedPreview() {
  if (!currentPreviewData?.computed) return;
  if (!window.reportApp?.saveEditedReport) {
    addLog('当前版本不支持保存修正', 'error');
    return;
  }
  const result = await window.reportApp.saveEditedReport({
    unitName: currentPreviewData.unitName,
    computed: currentPreviewData.computed,
    sources: currentPreviewData.sources || {},
    mode: currentPreviewData.mode || 'edited',
    outputPath: currentPreviewData.outputPath || '',
  });
  if (result?.ok === false) {
    addLog(`保存修正失败：${result.message}`, 'error');
    return;
  }
  currentPreviewData.outputPath = result.outputPath;
  if (result.validation) {
    currentPreviewData.validation = result.validation;
    currentPreviewData.computed.__meta = {
      ...(currentPreviewData.computed.__meta || {}),
      validation: result.validation,
    };
  }
  addLog(`修正已保存：${result.outputPath}`, 'success');
  renderTableContent(tableNav.querySelector('li.active')?.dataset.table || '人员情况表');
}

function renderTableContent(tableName) {
  if (!currentPreviewData || !currentPreviewData.computed) {
    spreadsheetContainer.innerHTML = '<div class="empty-spreadsheet-hint"><p>请在"学校状态"或"数据库记录"中点击查看，即可在此处预览年报表格</p></div>';
    return;
  }

  const def = GOV_TABLE_DEFS[tableName];
  if (!def) {
    spreadsheetContainer.innerHTML = `<div class="empty-spreadsheet-hint"><p>暂无 "${escapeHtml(tableName)}" 的配置</p></div>`;
    return;
  }

  // 免费版：核心报表隐藏，显示解锁占位。
  if (LOCKED_TABLES.has(tableName) && !isFullVersionUnlocked()) {
    spreadsheetContainer.innerHTML = `
      <div class="locked-report-placeholder">
        <div class="locked-report-icon">🔒</div>
        <h3>「${escapeHtml(tableName)}」为完整版功能</h3>
        <p>免费版可查看和复制其它报表，激活完整版后可查看本表并导出 Excel。</p>
        <button type="button" id="lockedReportActivateBtn" class="primary btn-sm">前往激活</button>
      </div>`;
    const btn = document.querySelector('#lockedReportActivateBtn');
    if (btn) btn.addEventListener('click', () => goActivate(tableName));
    return;
  }

  const computed = currentPreviewData.computed;
  const unitName = currentPreviewData.unitName || '';

  spreadsheetContainer.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'gov-table-wrapper';

  renderPreviewPanels(wrapper, tableName);

  const meta = document.createElement('div');
  meta.className = 'gov-table-meta';
  meta.innerHTML = `
    <div class="gov-meta-left"><span class="gov-meta-no">表号：${escapeHtml(def.tableNo)}</span></div>
    <div class="gov-meta-center"><span class="gov-meta-title">${escapeHtml(def.fullTitle)}</span></div>
    <div class="gov-meta-right"><span>单位名称：${escapeHtml(unitName)}</span><span>金额单位：元</span></div>
  `;
  wrapper.appendChild(meta);

  const table = document.createElement('table');
  table.className = 'gov-report-table';

  const thead = document.createElement('thead');
  thead.innerHTML = def.headerHTML;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const rows = def.getRows(computed);
  const dataCols = def.dataCols || 1;
  const hasUnit = def.hasUnit !== false;
  const totalCols = 1 + (hasUnit ? 1 : 0) + 1 + dataCols;

  for (const row of rows) {
    const tr = document.createElement('tr');

    if (row.section) {
      tr.className = 'gov-section-row';
      const td = document.createElement('td');
      td.colSpan = totalCols;
      td.textContent = row.label;
      tr.appendChild(td);
    } else {
      if (row.isTotal) tr.className = 'gov-total-row';

      const tdLabel = document.createElement('td');
      tdLabel.className = 'gov-cell-label';
      tdLabel.textContent = row.label;
      tr.appendChild(tdLabel);

      if (hasUnit) {
        const tdUnit = document.createElement('td');
        tdUnit.className = 'gov-cell-unit';
        tdUnit.textContent = row.unit || '元';
        tr.appendChild(tdUnit);
      }

      const tdCode = document.createElement('td');
      tdCode.className = 'gov-cell-code';
      tdCode.textContent = row.code || '';
      tr.appendChild(tdCode);

      const vals = row.vals || [];
      for (let i = 0; i < dataCols; i++) {
        const td = document.createElement('td');
        td.className = 'gov-cell-value';
        td.textContent = formatGovValue(vals[i]);
        tr.appendChild(td);
      }
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);
  spreadsheetContainer.appendChild(wrapper);
}

function setWatchingUI(watching) {
  isWatching = watching;
  if (watching) setStatus('监控中', 'ok');
  else setStatus('未监控', 'idle');
}

clearLogBtn.addEventListener('click', () => { logBox.innerHTML = ''; });

if (openWatchFolderBtn) {
  openWatchFolderBtn.addEventListener('click', async () => {
    const result = await window.reportApp.openWatchFolder();
    if (result?.ok) addLog(`已打开导入文件夹：${result.folder}`, 'success');
    else addLog(`打开导入文件夹失败：${result?.message || '未知错误'}`, 'error');
  });
}

if (copyWatchFolderBtn) {
  copyWatchFolderBtn.addEventListener('click', async () => {
    const folder = watchFolderPath?.textContent?.trim() || '';
    try {
      await navigator.clipboard.writeText(folder);
      setImportFeedback('导入路径已复制，可直接粘贴到资源管理器。', 'success');
    } catch {
      setImportFeedback(`请手动复制路径：${folder}`, 'warning');
    }
  });
}

if (openLogFolderBtn) {
  openLogFolderBtn.addEventListener('click', async () => {
    const result = await window.reportApp.openLogFolder();
    if (!result || result.ok !== false) addLog('已打开日志目录', 'success');
    else addLog(`打开日志目录失败：${result.message}`, 'error');
  });
}

generateSelectedBtn.addEventListener('click', async () => {
  const selected = readySchoolNames.slice();
  if (selected.length === 0) {
    addLog('暂无五件套齐全、可生成的学校', 'warn');
    return;
  }

  const preflight = await window.reportApp.preflightGenerate(selected);
  if (!preflight?.ok) {
    for (const item of preflight?.checks || []) {
      if (item.issues?.length) addLog(`[${item.unitName}] 生成前检查：${item.issues.join('；')}`, 'warn');
    }
    setImportFeedback('生成前检查未通过，请按提示补齐或更换源文件。', 'warning');
    return;
  }

  if (isStandaloneSchool() && currentWorkMode === 'formal') {
    const saved = await saveStandaloneFormalControls();
    if (!saved) return;
  }

  await claimTrialForUnitName(selected[0], { silent: true });
  const result = await window.reportApp.generateSelected(selected);
  if (result.ok) {
    addLog(`已提交生成请求：${selected.length} 所学校`, 'log');
  } else {
    addLog(`提交失败：${result.message}`, 'error');
  }
});

if (saveStandaloneFormalBtn) saveStandaloneFormalBtn.addEventListener('click', saveStandaloneFormalControls);

// ===== 网报平台：账号管理 + 自动登录 =====
const govWebview = document.querySelector('#govWebview');
const webBack = document.querySelector('#webBack');
const webForward = document.querySelector('#webForward');
const webReload = document.querySelector('#webReload');
const webUrl = document.querySelector('#webUrl');
const loginStatus = document.querySelector('#loginStatus');
const accountList = document.querySelector('#accountList');
const accountForm = document.querySelector('#accountForm');
const addAccountBtn = document.querySelector('#addAccountBtn');
const saveAccountBtn = document.querySelector('#saveAccountBtn');
const cancelAccountBtn = document.querySelector('#cancelAccountBtn');
const accUnitName = document.querySelector('#accUnitName');
const accUsername = document.querySelector('#accUsername');
const accPassword = document.querySelector('#accPassword');

if (govWebview) {
  // 浏览器导航
  webBack.addEventListener('click', () => govWebview.canGoBack() && govWebview.goBack());
  webForward.addEventListener('click', () => govWebview.canGoForward() && govWebview.goForward());
  webReload.addEventListener('click', () => govWebview.reload());

  // 跟踪 URL 变化
  govWebview.addEventListener('did-navigate', (e) => {
    webUrl.value = e.url;
    updateLoginStatusFromUrl(e.url);
  });
  govWebview.addEventListener('did-navigate-in-page', (e) => {
    webUrl.value = e.url;
  });

  // 账号管理 UI
  async function renderAccountList() {
    const accounts = await window.reportApp.loadAccounts();
    accountList.innerHTML = '';
    if (accounts.length === 0) {
      accountList.innerHTML = '<div style="padding: 20px; text-align: center; color: #8a96a8; font-size: 12px;">点击 "+ 添加" 录入学校账号</div>';
      return;
    }
    for (const acc of accounts) {
      const item = document.createElement('div');
      item.className = 'account-item';
      item.innerHTML = `
        <div class="account-item-info">
          <div class="account-item-name">${escapeHtml(acc.unitName)}</div>
          <div class="account-item-user">${escapeHtml(acc.username)}</div>
        </div>
        <div class="account-item-actions">
          <button class="ghost btn-sm btn-login-account" data-action="login">登录</button>
          <button class="ghost btn-sm" data-action="delete" style="color:#8f2f33;">删</button>
        </div>
      `;
      // 登录按钮
      item.querySelector('[data-action="login"]').addEventListener('click', (e) => {
        e.stopPropagation();
        doAutoLogin(acc);
      });
      // 删除按钮
      item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.reportApp.deleteAccount(acc.unitName);
        renderAccountList();
        addLog(`已删除账号：${acc.unitName}`, 'warn');
      });
      accountList.appendChild(item);
    }
  }

  addAccountBtn.addEventListener('click', () => {
    accUnitName.value = '';
    accUsername.value = '';
    accPassword.value = '';
    accountForm.style.display = 'flex';
    accUnitName.focus();
  });

  cancelAccountBtn.addEventListener('click', () => {
    accountForm.style.display = 'none';
  });

  saveAccountBtn.addEventListener('click', async () => {
    const unitName = accUnitName.value.trim();
    const username = accUsername.value.trim();
    const password = accPassword.value.trim();
    if (!unitName || !username || !password) {
      addLog('请填写完整的学校名称、用户名和密码', 'warn');
      return;
    }
    await window.reportApp.upsertAccount({ unitName, username, password });
    accountForm.style.display = 'none';
    renderAccountList();
    await claimTrialForUnitName(unitName, { silent: true });
    addLog(`已保存账号：${unitName}`, 'success');
  });

  // 自动登录流程
  async function doAutoLogin(account, retryCount = 0) {
    const MAX_RETRY = 3;
    setLoginStatus('logging-in', `正在登录: ${account.unitName}...`);
    addLog(`[自动登录] 开始登录 ${account.unitName} (用户: ${account.username})`, 'log');

    try {
      // Step 1: 确保在登录页
      const currentUrl = govWebview.getURL ? govWebview.getURL() : (webUrl.value || '');
      addLog(`[自动登录] 当前URL: ${currentUrl}`, 'log');

      if (!currentUrl.includes('login')) {
        addLog('[自动登录] 正在导航到登录页...', 'log');
        govWebview.src = 'https://jyjjxx.moe.edu.cn/JYJF1/login/login_toIndex';
        await waitForWebviewReady(govWebview, 8000);
        addLog('[自动登录] 登录页已加载', 'log');
      }

      // Step 2: 等待页面完全渲染（验证码图片需要时间加载）
      await sleep(2000);

      // Step 3: 截取页面上"当前显示"的验证码图片。
      // 重要：不要再单独请求验证码 URL。该网站访问 getVerifyCode 可能会刷新 Session 中的验证码，
      // 导致 OCR 识别到的是新图，而页面输入框对应的还是旧图。
      addLog('[自动登录] 获取页面当前显示的验证码图片...', 'log');

      const captchaData = await captureCurrentCaptcha(govWebview);

      let captchaText = '';
      if (captchaData && captchaData.ok && captchaData.dataUrl) {
        addLog(`[自动登录] 已获取当前页面验证码图片(${captchaData.width}x${captchaData.height}，方式：${captchaData.method || 'unknown'})`, 'log');
        if (captchaData.src) {
          addLog(`[自动登录] 页面验证码来源: ${captchaData.src}`, 'log');
        }

        addLog('[自动登录] 正在识别当前页面验证码...', 'log');
        const ocrResult = await window.reportApp.recognizeCaptcha(captchaData.dataUrl);

        if (ocrResult.ok && ocrResult.text) {
          captchaText = ocrResult.text;
          addLog(`[自动登录] 验证码识别结果: "${captchaText}"`, 'success');
        } else {
          addLog(`[自动登录] 验证码OCR失败: ${ocrResult.message || '空'}`, 'warn');
        }
      } else {
        addLog(`[自动登录] 未能获取页面验证码：${captchaData ? captchaData.message : '未知原因'}`, 'error');
      }

      // 验证码自动获取失败时，改为人工输入兜底。
      // 不再空验证码反复提交，避免连续失败或触发限制。
      if (!captchaText) {
        captchaText = await askManualCaptcha(account.unitName);
        if (!captchaText) {
          setLoginStatus('login-error', '验证码未输入');
          addLog('[自动登录] ❌ 已停止登录：没有识别到验证码，也没有手动输入验证码，未提交空验证码。', 'error');
          return;
        }
        addLog(`[自动登录] 已使用手动输入验证码: "${captchaText}"`, 'warn');
      }

      // Step 4: 填写登录表单（拆分为多个简单调用）
      addLog('[自动登录] 填写用户名和密码...', 'log');

      // 4a: 先诊断页面上有哪些 input
      try {
        const inputInfo = await govWebview.executeJavaScript(
          'var r=[];var a=document.querySelectorAll("input");for(var i=0;i<a.length;i++){r.push(a[i].type+":"+(a[i].name||a[i].id||"?"));}r.join(",")'
        );
        addLog('[自动登录] 页面inputs: ' + inputInfo, 'log');
      } catch (e) {
        addLog('[自动登录] 诊断inputs失败: ' + e.message, 'warn');
      }

      // 4b: 填写用户名
      const usernameJson = JSON.stringify(account.username || '');
      try {
        const uResult = await govWebview.executeJavaScript(`
          var u=document.querySelector("#userName")||document.querySelector("input[name=userName]")||document.querySelector("input[name=username]")||document.querySelector("#username");
          if(u){u.value=${usernameJson};u.focus();"ok:user"}else{"fail:no-user"}
        `);
        addLog('[自动登录] 用户名填写: ' + uResult, 'log');
      } catch (e) {
        addLog('[自动登录] 用户名填写异常: ' + e.message, 'error');
      }

      // 4c: 填写密码
      const passwordJson = JSON.stringify(account.password || '');
      try {
        const pResult = await govWebview.executeJavaScript(`
          var p=document.querySelector("#password")||document.querySelector("input[name=password]")||document.querySelector("input[type=password]");
          if(p){p.value=${passwordJson};p.focus();"ok:pass"}else{"fail:no-pass"}
        `);
        addLog('[自动登录] 密码填写: ' + pResult, 'log');
      } catch (e) {
        addLog('[自动登录] 密码填写异常: ' + e.message, 'error');
      }

      // 4d: 填写验证码
      if (captchaText) {
        const captchaJson = JSON.stringify(captchaText);
        try {
          const cResult = await govWebview.executeJavaScript(`
            (function(){
              var value = ${captchaJson};
              var selectors = [
                '#code', '#captcha', '#validateCode', '#validatecode', '#verifyCode', '#verifycode',
                'input[name="code"]', 'input[name="captcha"]', 'input[name="validateCode"]',
                'input[name="validatecode"]', 'input[name="verifyCode"]', 'input[name="verifycode"]',
                'input[id="code"]', 'input[id="captcha"]', 'input[id="validateCode"]',
                'input[id="validatecode"]', 'input[id="verifyCode"]', 'input[id="verifycode"]'
              ];
              var c = null;
              for (var i = 0; i < selectors.length && !c; i++) {
                c = document.querySelector(selectors[i]);
              }
              if (!c) {
                var inputs = Array.prototype.slice.call(document.querySelectorAll('input'));
                c = inputs.find(function(inp){
                  var key = ((inp.name || '') + ' ' + (inp.id || '') + ' ' + (inp.placeholder || '') + ' ' + (inp.className || '')).toLowerCase();
                  return key.indexOf('verify') !== -1 || key.indexOf('captcha') !== -1 || key.indexOf('validate') !== -1 || key.indexOf('验证码') !== -1;
                }) || null;
              }
              if (!c) {
                return 'fail:no-captcha';
              }
              c.focus();
              var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(c), 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
              if (desc && desc.set) {
                desc.set.call(c, value);
              } else {
                c.value = value;
              }
              c.setAttribute('value', value);
              ['input','change','keyup','blur'].forEach(function(type){
                c.dispatchEvent(new Event(type, { bubbles: true }));
              });
              return 'ok:captcha:' + (c.name || c.id || c.placeholder || '?') + '=' + c.value;
            })()
          `);
          addLog('[自动登录] 验证码填写: ' + cResult, 'log');
        } catch (e) {
          addLog('[自动登录] 验证码填写异常: ' + e.message, 'error');
        }
      }

      // Step 5: 点击登录按钮
      await sleep(500);
      addLog('[自动登录] 提交登录...', 'log');
      try {
        const submitMsg = await govWebview.executeJavaScript(`
          (function(){
            var btn = document.querySelector('#loginBtn') ||
                      document.querySelector('button[type="submit"]') ||
                      document.querySelector('input[type="submit"]') ||
                      document.querySelector('.login-btn') ||
                      document.querySelector('.btn-login') ||
                      document.querySelector('button.btn-primary') ||
                      document.querySelector('.loginBtn');
            if (!btn) {
              var allBtns = [];
              document.querySelectorAll('button, input[type="submit"], a').forEach(function(b) {
                var t = (b.textContent || b.value || '').trim();
                if (t) allBtns.push(t.substring(0, 15));
              });
              return '未找到登录按钮。按钮: ' + allBtns.join(', ');
            }
            btn.click();
            return '已点击: ' + (btn.textContent || btn.value || '').trim();
          })()
        `);
        addLog(`[自动登录] 提交结果: ${submitMsg}`, 'log');
      } catch (subErr) {
        addLog(`[自动登录] 提交异常: ${subErr.message}`, 'error');
        throw subErr;
      }

      // Step 6: 等待页面响应后检查结果
      await sleep(3000);
      let loginResult;
      try {
        const checkRaw = await govWebview.executeJavaScript(`
          (function(){
            var url = window.location.href;
            var isLogin = url.indexOf('login') !== -1;
            var errEl = document.querySelector('.error-msg') ||
                        document.querySelector('.alert-danger') ||
                        document.querySelector('.login-error') ||
                        document.querySelector('.layui-layer-content');
            return JSON.stringify({
              url: url,
              isLoginPage: isLogin,
              hasError: !!errEl,
              errorText: errEl ? errEl.textContent.trim().substring(0, 100) : ''
            });
          })()
        `);
        loginResult = typeof checkRaw === 'string' ? JSON.parse(checkRaw) : checkRaw;
      } catch (chkErr) {
        addLog(`[自动登录] 检查异常: ${chkErr.message}`, 'warn');
        const currentUrl = (typeof govWebview.getURL === 'function') ? govWebview.getURL() : '';
        addLog(`[自动登录] 当前webview地址: ${currentUrl || '无法获取'}`, 'warn');
        if (currentUrl && currentUrl.indexOf('login') === -1) {
          setLoginStatus('logged-in', `已登录: ${account.unitName}`);
          addLog(`[自动登录] ✅ ${account.unitName} 登录成功！`, 'success');
        } else if (retryCount < MAX_RETRY) {
          addLog(`[自动登录] 登录状态检查失败，且仍可能停留在登录页，第 ${retryCount + 1}/${MAX_RETRY} 次重试...`, 'warn');
          govWebview.reload();
          await sleep(1500);
          return doAutoLogin(account, retryCount + 1);
        } else {
          setLoginStatus('error', '登录失败');
          addLog(`[自动登录] ❌ ${account.unitName} 登录失败：无法确认登录成功`, 'error');
        }
        return;
      }

      addLog(`[自动登录] 当前页面URL: ${loginResult.url}`, 'log');

      if (!loginResult.isLoginPage) {
        setLoginStatus('logged-in', `已登录: ${account.unitName}`);
        addLog(`[自动登录] ✅ ${account.unitName} 登录成功！`, 'success');
      } else if (retryCount < MAX_RETRY) {
        const reason = loginResult.hasError ? loginResult.errorText : '验证码可能有误';
        addLog(`[自动登录] 登录未成功(${reason})，第 ${retryCount + 1}/${MAX_RETRY} 次重试...`, 'warn');
        // 刷新页面重新来
        govWebview.src = 'https://jyjjxx.moe.edu.cn/JYJF1/login/login_toIndex';
        await waitForWebviewReady(govWebview, 8000);
        return doAutoLogin(account, retryCount + 1);
      } else {
        setLoginStatus('login-error', '登录失败(已重试3次)');
        addLog(`[自动登录] ❌ ${account.unitName} 登录失败，已重试 ${MAX_RETRY} 次`, 'error');
      }
    } catch (error) {
      addLog(`[自动登录] 异常详情: ${error.message}`, 'error');
      addLog(`[自动登录] 异常堆栈: ${error.stack || '无'}`, 'error');
      setLoginStatus('login-error', '登录异常');
    }
  }


  async function askManualCaptcha(unitName) {
    const title = unitName ? `【${unitName}】` : '';
    const value = await showTextPrompt({
      title: '手动输入验证码',
      message: `${title}自动识别验证码失败。\n请查看右侧网页当前显示的验证码；取消则停止本次登录。`,
      label: '验证码',
    });
    if (value === null) return '';
    return String(value).trim().replace(/\s+/g, '');
  }

  async function captureCurrentCaptcha(wv) {
    // 方案A：在页面内部把验证码 img 画到 canvas。速度快，但如果图片跨域/页面限制，可能失败。
    try {
      const rawCaptcha = await wv.executeJavaScript(`
        (function(){
          try {
            var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
            var img = imgs.find(function(i){
              var s = (i.currentSrc || i.src || i.getAttribute('src') || '').toLowerCase();
              var k = ((i.id || '') + ' ' + (i.name || '') + ' ' + (i.alt || '') + ' ' + (i.title || '') + ' ' + (i.className || '')).toLowerCase();
              return s.indexOf('verifycode') !== -1 || s.indexOf('verify') !== -1 || s.indexOf('captcha') !== -1 || s.indexOf('kaptcha') !== -1 ||
                     k.indexOf('verify') !== -1 || k.indexOf('captcha') !== -1 || k.indexOf('验证码') !== -1;
            });
            if (!img) {
              return JSON.stringify({ ok: false, message: '未找到验证码图片', step: 'dom-canvas' });
            }
            if (!img.complete || img.naturalWidth === 0) {
              return JSON.stringify({ ok: false, message: '验证码图片尚未加载完成', step: 'dom-canvas' });
            }
            var w = img.naturalWidth || img.width || 80;
            var h = img.naturalHeight || img.height || 30;
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            return JSON.stringify({ ok: true, method: 'dom-canvas', dataUrl: canvas.toDataURL('image/png'), src: img.currentSrc || img.src || img.getAttribute('src') || '', width: w, height: h });
          } catch (e) {
            return JSON.stringify({ ok: false, message: e.message || String(e), step: 'dom-canvas' });
          }
        })()
      `);
      const data = typeof rawCaptcha === 'string' ? JSON.parse(rawCaptcha) : rawCaptcha;
      if (data && data.ok) return data;
      addLog(`[自动登录] 页面内取验证码失败: ${data && data.message ? data.message : '未知原因'}，尝试 Electron 截图裁剪`, 'warn');
    } catch (e) {
      addLog(`[自动登录] 页面内取验证码异常: ${e.message}，尝试 Electron 截图裁剪`, 'warn');
    }

    // 方案B：只用页面脚本拿验证码图片的位置，然后用 Electron webview.capturePage 截图该区域。
    // 这比重新下载验证码 URL 安全，不会刷新服务器 Session 里的验证码。
    try {
      const rawRect = await wv.executeJavaScript(`
        (function(){
          try {
            var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
            var img = imgs.find(function(i){
              var s = (i.currentSrc || i.src || i.getAttribute('src') || '').toLowerCase();
              var k = ((i.id || '') + ' ' + (i.name || '') + ' ' + (i.alt || '') + ' ' + (i.title || '') + ' ' + (i.className || '')).toLowerCase();
              return s.indexOf('verifycode') !== -1 || s.indexOf('verify') !== -1 || s.indexOf('captcha') !== -1 || s.indexOf('kaptcha') !== -1 ||
                     k.indexOf('verify') !== -1 || k.indexOf('captcha') !== -1 || k.indexOf('验证码') !== -1;
            });
            if (!img) return JSON.stringify({ ok: false, message: '未找到验证码图片', step: 'rect' });
            var r = img.getBoundingClientRect();
            if (!r || r.width < 10 || r.height < 10) return JSON.stringify({ ok: false, message: '验证码图片尺寸异常', step: 'rect' });
            return JSON.stringify({
              ok: true,
              x: Math.max(0, Math.floor(r.left)),
              y: Math.max(0, Math.floor(r.top)),
              width: Math.ceil(r.width),
              height: Math.ceil(r.height),
              src: img.currentSrc || img.src || img.getAttribute('src') || ''
            });
          } catch (e) {
            return JSON.stringify({ ok: false, message: e.message || String(e), step: 'rect' });
          }
        })()
      `);
      const rect = typeof rawRect === 'string' ? JSON.parse(rawRect) : rawRect;
      if (!rect || !rect.ok) {
        return { ok: false, message: rect && rect.message ? rect.message : '未获取到验证码位置' };
      }
      if (typeof wv.capturePage !== 'function') {
        return { ok: false, message: '当前 Electron webview 不支持 capturePage' };
      }
      const image = await wv.capturePage({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      if (!image || typeof image.toDataURL !== 'function') {
        return { ok: false, message: 'capturePage 未返回可用图片' };
      }
      return {
        ok: true,
        method: 'webview-capturePage',
        dataUrl: image.toDataURL(),
        width: rect.width,
        height: rect.height,
        src: rect.src || ''
      };
    } catch (e) {
      return { ok: false, message: `Electron 截图裁剪异常: ${e.message}` };
    }
  }

  function setLoginStatus(className, text) {
    loginStatus.className = `login-status ${className}`;
    loginStatus.textContent = text;
  }

  function updateLoginStatusFromUrl(url) {
    if (url.includes('login')) {
      setLoginStatus('', '未登录');
    }
  }

  // 切换到网报平台 tab 时加载账号列表
  document.querySelector('[data-tab="web"]').addEventListener('click', renderAccountList);
}

// 工具函数
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForWebviewReady(wv, timeout = 8000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      addLog('[等待] webview 加载超时，继续执行', 'warn');
      resolve();
    }, timeout);

    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };

    // 监听 dom-ready（首选）和 did-finish-load（备选）
    wv.addEventListener('dom-ready', onReady, { once: true });
    wv.addEventListener('did-finish-load', onReady, { once: true });
  });
}

// ===== 事件监听 =====
window.reportApp.onWatcherEvent((payload) => {
  switch (payload.event) {
    case 'status': renderStatus(payload); break;
    case 'log': addLog(payload.message, payload.type); break;
    case 'file-recognized':
      setImportFeedback(`已识别：${payload.unitName} · ${payload.type}（${payload.fileName}）`, 'success');
      break;
    case 'all-ready':
      addLog(`文件齐全：${payload.schools.join('、')}，可手动生成。`, 'success');
      setImportFeedback(`五件套已齐全：${payload.schools.join('、')}，可勾选后生成。`, 'success');
      setStatus('文件就绪', 'ok');
      if (payload.schools?.[0]) void claimTrialForUnitName(payload.schools[0], { silent: true });
      break;
  }
});

window.reportApp.onGenerationStart((payload) => {
  setStatus('批量生成中', 'busy');
  addLog(`开始批量生成（${payload.schools.length} 所学校）...`);
});

window.reportApp.onGenerationLog((payload) => {
  addLog(payload.message, payload.type);
});

window.reportApp.onGenerationDone((payload) => {
  if (payload.ok) {
    setStatus('全部完成', 'ok');
    addLog(`${payload.message}`, 'success');
  } else {
    setStatus('部分失败', 'error');
    addLog(`${payload.message}`, 'warn');
  }

  // 刷新状态
  window.reportApp.getStatus().then(renderStatus);

  setTimeout(() => {
    if (isWatching) setStatus('监控中', 'ok');
  }, 5000);

  // 切换到预览tab
  if (previews.length > 0) {
    document.querySelector('[data-tab="preview"]').click();
  }
});

window.reportApp.onReportPreview((preview) => {
  renderPreview(preview);
});

// ===== 数据库标签页 =====
const dbRecords = document.querySelector('#dbRecords');
const dbDetail = document.querySelector('#dbDetail');
const dbDetailTitle = document.querySelector('#dbDetailTitle');
const dbDetailContent = document.querySelector('#dbDetailContent');
const refreshDbBtn = document.querySelector('#refreshDbBtn');
const closeDetailBtn = document.querySelector('#closeDetailBtn');

function describeReportSource(metaJson) {
  try {
    const sourceFiles = JSON.parse(metaJson || '{}')?.generation?.sourceFiles || {};
    const names = Object.values(sourceFiles).filter(Boolean);
    return names.length ? names.join('、') : '未记录';
  } catch {
    return '未记录';
  }
}

async function loadDbRecords() {
  const reports = await window.reportApp.getReports();
  dbRecords.innerHTML = '';

  if (!reports || reports.length === 0) {
    dbRecords.innerHTML = '<div class="empty-hint">暂无生成记录</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'db-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>单位名称</th>
        <th>年份</th>
        <th>生成时间</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  for (const r of reports) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.id)}</td>
      <td><strong>${escapeHtml(r.unit_name)}</strong><small class="db-source" title="${escapeHtml(describeReportSource(r.meta_json))}">来源：${escapeHtml(describeReportSource(r.meta_json))}</small></td>
      <td>${escapeHtml(r.year)}</td>
      <td>${escapeHtml(r.generated_at)}</td>
      <td><span class="fill-badge ${r.filled ? 'filled' : 'unfilled'}">${r.filled ? '已填报' : '待填报'}</span></td>
      <td>
        <button class="ghost btn-sm" data-action="view" data-id="${escapeHtml(r.id)}" data-name="${escapeHtml(r.unit_name)}">查看</button>
        <button class="ghost btn-sm" data-action="delete" data-id="${escapeHtml(r.id)}">删除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  dbRecords.appendChild(table);

  // 绑定按钮事件
  dbRecords.querySelectorAll('[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', () => showReportDetail(btn.dataset.id, btn.dataset.name));
  });
  dbRecords.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await window.reportApp.deleteReport(Number(btn.dataset.id));
      loadDbRecords();
    });
  });
}

async function showReportDetail(reportId, unitName) {
  const rid = Number(reportId);
  const data = await window.reportApp.getReportData(rid);

  const computed = {};
  for (const [sheetName, rows] of Object.entries(data)) {
    const sheet = {};
    for (const row of rows) {
      if (!row.level) sheet[row.cell_addr] = row.value;
    }
    if (Object.keys(sheet).length > 0) computed[sheetName] = sheet;
  }

  // 兼容旧数据：如果 computed 为空（没有 level 字段），回退到全量数据
  if (Object.keys(computed).length === 0) {
    for (const [sheetName, rows] of Object.entries(data)) {
      const sheet = {};
      for (const row of rows) sheet[row.cell_addr] = row.value;
      computed[sheetName] = sheet;
    }
  }

  const previewObj = { unitName, computed };

  currentPreviewData = previewObj;

  if (!previews.find(p => p.unitName === unitName)) {
    previews.push(previewObj);
    updateSchoolSelector();
  } else {
    const idx = previews.findIndex(p => p.unitName === unitName);
    if (idx >= 0) previews[idx] = previewObj;
  }
  previewSchoolSelect.value = unitName;

  document.querySelector('[data-tab="preview"]').click();
  const activeLi = tableNav.querySelector('li.active');
  renderTableContent(activeLi ? activeLi.dataset.table : '人员情况表');
}

if (refreshDbBtn) refreshDbBtn.addEventListener('click', loadDbRecords);
if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => { dbDetail.style.display = 'none'; });

// 切换到数据库tab时自动刷新（数据库标签已隐藏，可能没有该按钮）
const dbTabBtn = document.querySelector('[data-tab="database"]');
if (dbTabBtn) dbTabBtn.addEventListener('click', loadDbRecords);

// ===== 民办草稿向导 =====
function privateInputValue(key) {
  const el = privateInputs[key];
  if (!el) return 0;
  const raw = String(el.value || '').trim();
  return raw === '' ? null : Number(raw);
}

function setPrivateWarnings(messages) {
  if (!privateWarnings) return;
  const list = (messages || []).filter(Boolean);
  privateWarnings.hidden = list.length === 0;
  privateWarnings.innerHTML = '';
  for (const msg of list) {
    const row = document.createElement('div');
    row.textContent = msg;
    privateWarnings.appendChild(row);
  }
}

async function loadPrivateMergeConfig() {
  return loadRulesConfig();
}

async function savePrivateMergeConfig() {
  return saveRulesConfig();
}

function setRulesWarnings(messages) {
  if (!rulesWarnings) return;
  const list = (messages || []).filter(Boolean);
  rulesWarnings.hidden = list.length === 0;
  rulesWarnings.innerHTML = '';
  for (const msg of list) {
    const row = document.createElement('div');
    row.textContent = msg;
    rulesWarnings.appendChild(row);
  }
}

function parseJsonTextarea(el, fallback, label) {
  const raw = String(el?.value || '').trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label}不是有效 JSON：${error.message}`);
  }
}

function validateRuleObjects(regionRules) {
  const mergeGroups = regionRules.mergeGroups || {};
  const badMerge = Object.entries(mergeGroups).find(([, members]) => members !== null && !Array.isArray(members));
  if (badMerge) throw new Error(`合并关系“${badMerge[0]}”必须是数组或 null`);
  const aliases = regionRules.schoolAliases || {};
  const badAlias = Object.entries(aliases).find(([, standard]) => typeof standard !== 'string');
  if (badAlias) throw new Error(`学校别名“${badAlias[0]}”的标准名称必须是字符串`);
  if (!Array.isArray(regionRules.ignoredClosedSchools)) throw new Error('撤销/忽略学校必须是数组');
}

async function getEffectiveMergeGroups() {
  if (!window.reportApp?.getEduMergeSummary) return {};
  const summary = await window.reportApp.getEduMergeSummary();
  return summary?.groups || {};
}

function schoolNameOf(row) {
  return row?.['学校名称'] || '';
}

async function loadRulesEduRows() {
  // 教育事业年报已弃用：合并组候选学校请通过高级 JSON 编辑维护
  rulesEduRows = [];
}

function setRulesMergeState(groups) {
  rulesMergeState = {};
  rulesMergeMemberMode = 'members';
  rulesCheckedMembers.clear();
  rulesCheckedCandidates.clear();
  for (const [center, members] of Object.entries(groups || {})) {
    rulesMergeState[center] = members === null ? null : Array.from(new Set([center, ...(members || [])]));
  }
  if (!rulesSelectedCenter || !(rulesSelectedCenter in rulesMergeState)) {
    rulesSelectedCenter = Object.keys(rulesMergeState)[0] || '';
  }
  syncMergeJsonFromState();
  renderRulesMergeManager();
}

function syncMergeJsonFromState() {
  if (rulesMergeGroups) rulesMergeGroups.value = JSON.stringify(rulesMergeState, null, 2);
}

function syncMergeStateFromJson() {
  const parsed = parseJsonTextarea(rulesMergeGroups, {}, '学校合并关系');
  validateRuleObjects({
    mergeGroups: parsed,
    schoolAliases: parseJsonTextarea(rulesSchoolAliases, {}, '学校别名'),
    ignoredClosedSchools: parseJsonTextarea(rulesIgnoredClosedSchools, [], '撤销/忽略学校'),
  });
  setRulesMergeState(parsed);
}

function allRuleSchoolNames() {
  const names = new Set(rulesEduRows.map(schoolNameOf).filter(Boolean));
  for (const [center, members] of Object.entries(rulesMergeState || {})) {
    if (center) names.add(center);
    if (Array.isArray(members)) for (const member of members) names.add(member);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function renderRulesMergeManager() {
  if (!rulesMergeGroupList || !rulesMergeCenterSelect || !rulesMergeMemberList) return;
  const centers = Object.keys(rulesMergeState || {}).sort((a, b) => a.localeCompare(b, 'zh-CN'));

  rulesMergeGroupList.innerHTML = '';
  if (centers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'merge-empty';
    empty.textContent = '暂无合并组，点击“添加合并组”创建。';
    rulesMergeGroupList.appendChild(empty);
  }
  for (const center of centers) {
    const members = rulesMergeState[center];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `merge-group-item${center === rulesSelectedCenter ? ' active' : ''}`;
    btn.innerHTML = `<strong>${escapeHtml(center)}</strong><span>${members === null ? '已取消内置合并' : `${members.length} 所学校`}</span>`;
    btn.addEventListener('click', () => {
      rulesSelectedCenter = center;
      rulesMergeMemberMode = 'members';
      rulesCheckedMembers.clear();
      rulesCheckedCandidates.clear();
      if (rulesMergeSearch) rulesMergeSearch.value = '';
      renderRulesMergeManager();
    });
    rulesMergeGroupList.appendChild(btn);
  }

  const schoolNames = allRuleSchoolNames();
  rulesMergeCenterSelect.innerHTML = '';
  for (const name of schoolNames) rulesMergeCenterSelect.appendChild(new Option(name, name));
  if (rulesSelectedCenter && !schoolNames.includes(rulesSelectedCenter)) {
    rulesMergeCenterSelect.appendChild(new Option(rulesSelectedCenter, rulesSelectedCenter));
  }
  rulesMergeCenterSelect.value = rulesSelectedCenter || '';

  renderMergeMemberList();
}

function renderMergeMemberList() {
  if (!rulesMergeMemberList) return;
  const query = String(rulesMergeSearch?.value || '').trim();
  const center = rulesSelectedCenter;
  const selectedMembers = new Set(Array.isArray(rulesMergeState[center]) ? rulesMergeState[center] : []);
  const sourceNames = rulesMergeMemberMode === 'add'
    ? allRuleSchoolNames().filter(name => !selectedMembers.has(name))
    : [...selectedMembers];
  const schoolNames = sourceNames.filter(name => !query || name.includes(query)).sort((a, b) => a.localeCompare(b, 'zh-CN'));

  rulesMergeMemberList.innerHTML = '';
  if (rulesMergeSearch) {
    rulesMergeSearch.placeholder = rulesMergeMemberMode === 'add' ? '搜索可添加学校' : '搜索当前合并成员';
  }
  if (rulesAddMergeMemberBtn) rulesAddMergeMemberBtn.textContent = rulesMergeMemberMode === 'add' ? '确认添加' : '添加学校';
  if (rulesRemoveMergeMemberBtn) rulesRemoveMergeMemberBtn.textContent = rulesMergeMemberMode === 'add' ? '取消添加' : '删除所选';
  if (!center) {
    rulesMergeMemberList.innerHTML = '<div class="merge-empty">请先选择或添加中心校/中心园。</div>';
    return;
  }
  if (rulesMergeState[center] === null) {
    rulesMergeMemberList.innerHTML = '<div class="merge-empty">当前中心校/中心园已设置为分开填报。</div>';
    return;
  }
  if (schoolNames.length === 0) {
    rulesMergeMemberList.innerHTML = `<div class="merge-empty">${rulesMergeMemberMode === 'add' ? '没有可添加学校。' : '当前合并组暂无成员。'}</div>`;
    return;
  }
  for (const name of schoolNames) {
    const label = document.createElement('label');
    label.className = 'merge-member-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = rulesMergeMemberMode === 'add' ? rulesCheckedCandidates.has(name) : rulesCheckedMembers.has(name);
    checkbox.disabled = rulesMergeMemberMode === 'members' && name === center;
    checkbox.addEventListener('change', () => {
      const bucket = rulesMergeMemberMode === 'add' ? rulesCheckedCandidates : rulesCheckedMembers;
      if (checkbox.checked) bucket.add(name);
      else bucket.delete(name);
    });
    const text = document.createElement('span');
    text.textContent = name;
    label.appendChild(checkbox);
    label.appendChild(text);
    rulesMergeMemberList.appendChild(label);
  }
}

function addSelectedMergeMembers() {
  if (!rulesSelectedCenter) return;
  if (rulesMergeMemberMode !== 'add') {
    rulesMergeMemberMode = 'add';
    rulesCheckedCandidates.clear();
    if (rulesMergeSearch) rulesMergeSearch.value = '';
    renderMergeMemberList();
    return;
  }
  if (rulesCheckedCandidates.size === 0) {
    rulesMergeMemberMode = 'members';
    renderMergeMemberList();
    return;
  }
  const current = new Set(Array.isArray(rulesMergeState[rulesSelectedCenter]) ? rulesMergeState[rulesSelectedCenter] : [rulesSelectedCenter]);
  for (const name of rulesCheckedCandidates) current.add(name);
  current.add(rulesSelectedCenter);
  rulesMergeState[rulesSelectedCenter] = [...current].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  rulesMergeMemberMode = 'members';
  rulesCheckedCandidates.clear();
  syncMergeJsonFromState();
  renderRulesMergeManager();
}

function removeSelectedMergeMembers() {
  if (!rulesSelectedCenter) return;
  if (rulesMergeMemberMode === 'add') {
    rulesMergeMemberMode = 'members';
    rulesCheckedCandidates.clear();
    if (rulesMergeSearch) rulesMergeSearch.value = '';
    renderMergeMemberList();
    return;
  }
  if (rulesCheckedMembers.size === 0) return;
  const current = new Set(Array.isArray(rulesMergeState[rulesSelectedCenter]) ? rulesMergeState[rulesSelectedCenter] : [rulesSelectedCenter]);
  for (const name of rulesCheckedMembers) {
    if (name !== rulesSelectedCenter) current.delete(name);
  }
  current.add(rulesSelectedCenter);
  rulesMergeState[rulesSelectedCenter] = [...current].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  rulesCheckedMembers.clear();
  syncMergeJsonFromState();
  renderRulesMergeManager();
}

async function addRulesMergeGroup() {
  const candidate = rulesMergeCenterSelect?.value || allRuleSchoolNames()[0] || '';
  const name = await showTextPrompt({
    title: '新增合并组',
    message: '请输入中心校或中心园名称。',
    label: '中心单位名称',
    defaultValue: candidate,
  });
  if (!name) return;
  rulesSelectedCenter = name.trim();
  rulesMergeMemberMode = 'members';
  rulesCheckedMembers.clear();
  rulesCheckedCandidates.clear();
  rulesMergeState[rulesSelectedCenter] = Array.from(new Set([rulesSelectedCenter, ...(rulesMergeState[rulesSelectedCenter] || [])]));
  syncMergeJsonFromState();
  renderRulesMergeManager();
}

function removeRulesMergeGroup() {
  if (!rulesSelectedCenter) return;
  if (!window.confirm(`确认让“${rulesSelectedCenter}”分开填报？保存后该中心校/中心园不再合并成员学校。`)) return;
  rulesMergeState[rulesSelectedCenter] = null;
  rulesCheckedMembers.clear();
  rulesCheckedCandidates.clear();
  syncMergeJsonFromState();
  renderRulesMergeManager();
}

async function loadRulesConfig(useEffectiveMerge = true) {
  if (!window.reportApp?.loadConfig) return;
  await loadRulesEduRows();
  const cfg = await window.reportApp.loadConfig();
  const regionRules = cfg?.regionRules || {};
  legacyRegionMetadata = {
    regionName: regionRules.regionName || '',
    regionCode: regionRules.regionCode || '',
  };
  if (rulesHeatingFee) rulesHeatingFee.value = regionRules.heatingFeePerStudent ?? 25;
  const mergeGroups = useEffectiveMerge ? await getEffectiveMergeGroups() : (regionRules.mergeGroups || cfg?.kindergartenMergeGroups || {});
  setRulesMergeState(mergeGroups);
  if (rulesSchoolAliases) rulesSchoolAliases.value = JSON.stringify(regionRules.schoolAliases || {}, null, 2);
  if (rulesIgnoredClosedSchools) rulesIgnoredClosedSchools.value = JSON.stringify(regionRules.ignoredClosedSchools || [], null, 2);
  setRulesWarnings([]);
}

async function saveRulesConfig() {
  if (!window.reportApp?.saveConfig) return;
  try {
    const regionRules = collectRulesFromForm();
    const result = await window.reportApp.saveConfig({ regionRules, kindergartenMergeGroups: {} });
    if (result?.ok === false) throw new Error(result.message || '保存规则失败');
    setRulesWarnings(['规则已保存，后续生成会按新配置执行。']);
    addLog('地区规则配置已保存', 'success');
    populatePrivateSchools();
  } catch (error) {
    setRulesWarnings([error.message]);
    addLog(`地区规则配置保存失败：${error.message}`, 'error');
  }
}

function collectRulesFromForm() {
  if (document.activeElement === rulesMergeGroups) syncMergeStateFromJson();
  const regionRules = {
    ...legacyRegionMetadata,
    heatingFeePerStudent: Number(rulesHeatingFee?.value || 0),
    mergeGroups: rulesMergeState || {},
    schoolAliases: parseJsonTextarea(rulesSchoolAliases, {}, '学校别名'),
    ignoredClosedSchools: parseJsonTextarea(rulesIgnoredClosedSchools, [], '撤销/忽略学校'),
  };
  if (Number.isNaN(regionRules.heatingFeePerStudent) || regionRules.heatingFeePerStudent < 0) {
    throw new Error('取暖费标准必须是非负数字');
  }
  validateRuleObjects(regionRules);
  return regionRules;
}

async function exportRulesConfig() {
  if (!window.reportApp?.exportRulesConfig) return;
  try {
    const regionRules = collectRulesFromForm();
    const result = await window.reportApp.exportRulesConfig(regionRules);
    if (!result || result.ok === false) {
      throw new Error(result?.message || '导出规则失败');
    }
    setRulesWarnings([`规则备份包已导出：${result.filePath}`]);
    addLog(`地区规则备份包已导出：${result.filePath}`, 'success');
  } catch (error) {
    setRulesWarnings([error.message]);
    addLog(`地区规则备份包导出失败：${error.message}`, 'error');
  }
}

async function importRulesConfig() {
  if (!window.reportApp?.importRulesConfig) return;
  const result = await window.reportApp.importRulesConfig();
  if (!result) return;
  if (result.ok === false) {
    setRulesWarnings([result.message || '导入规则失败']);
    addLog(`地区规则导入失败：${result.message || '未知错误'}`, 'error');
    return;
  }
  await loadRulesConfig();
  setRulesWarnings([`规则备份包已导入：${result.filePath}`]);
  addLog(`地区规则已导入：${result.filePath}`, 'success');
  populatePrivateSchools();
}

async function importMergeRulesExcel() {
  if (!window.reportApp?.importMergeRulesExcel) return;
  const result = await window.reportApp.importMergeRulesExcel();
  if (!result) return;
  if (result.ok === false) {
    setRulesWarnings([result.message || '导入合并关系失败']);
    addLog(`合并关系导入失败：${result.message || '未知错误'}`, 'error');
    return;
  }
  await loadRulesConfig(true);
  const count = Object.keys(result.groups || {}).length;
  setRulesWarnings([`已从 ${result.fileCount || 0} 个Excel导入 ${count} 个合并组，规则已保存。`]);
  addLog(`已从Excel导入合并关系：${count} 个合并组`, 'success');
  populatePrivateSchools();
}

async function populatePrivateSchools() {
  if (!privateSchoolSelect) return;
  const current = privateSchoolSelect.value;
  privateSchoolSelect.innerHTML = '';
  // 单机学校版：锁定为首次设置的本单位，不读取在线采集台账。
  if (isStandaloneSchool()) {
    const unit = appUnitName || '本单位';
    const opt = new Option(unit, unit, true, true);
    privateSchoolSelect.appendChild(opt);
    privateSchoolSelect.value = unit;
    privateSchoolSelect.disabled = true;
    onPrivateSchoolSelected();
    return;
  }
  // 联网学校版：锁定为本授权单位，不能选别的学校
  if (appRole === 'school') {
    const unit = appUnitName || '本单位';
    const opt = new Option(unit, unit, true, true);
    privateSchoolSelect.appendChild(opt);
    privateSchoolSelect.value = unit;
    privateSchoolSelect.disabled = true;
    onPrivateSchoolSelected();
    return;
  }
  privateSchoolSelect.disabled = false;
  // 教育事业年报已弃用：学校列表来自在线采集台账（已同步的无报表单位）
  let rows = [];
  try {
    const res = await window.reportApp.collectStatus();
    rows = (res?.status || []).filter((r) => r.collectScope !== 'people');
  } catch { rows = []; }
  if (rows.length === 0) {
    privateSchoolSelect.appendChild(new Option('请先在「在线采集」页同步数据', ''));
    return;
  }
  privateSchoolSelect.appendChild(new Option('请选择学校', ''));
  const names = rows.map((r) => r.unitName).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
  for (const name of names) privateSchoolSelect.appendChild(new Option(name, name));
  if (current && names.includes(current)) privateSchoolSelect.value = current;
}

function updatePrivateConditionalFields() {
  if (privateRentGroup) privateRentGroup.hidden = !privateHasRent?.checked;
  if (privateInterestGroup) privateInterestGroup.hidden = !privateHasLoan?.checked;
  if (privateSponsorGroup) privateSponsorGroup.hidden = !privateHasSponsorInput?.checked;
  if (privateSponsorWithdrawGroup) privateSponsorWithdrawGroup.hidden = !privateHasSponsorWithdraw?.checked;
  if (privateDonationIncomeGroup) privateDonationIncomeGroup.hidden = !privateHasDonation?.checked;
  if (privateDonationExpenseGroup) privateDonationExpenseGroup.hidden = !privateHasDonation?.checked;
  if (privateCapitalGroup) privateCapitalGroup.classList.toggle('field-disabled', !privateHasBigPurchase?.checked);
  if (privateInputs.capitalExpense) {
    privateInputs.capitalExpense.disabled = !privateHasBigPurchase?.checked;
    if (!privateHasBigPurchase?.checked) privateInputs.capitalExpense.value = '0';
  }
}

// 从表单读取 controls（不校验上年年报，供生成与回传共用）
function buildPrivateControls() {
  return {
    schoolStage: privateSchoolStage?.value || '',
    hasRent: Boolean(privateHasRent?.checked),
    hasLoan: Boolean(privateHasLoan?.checked),
    hasSponsorInput: Boolean(privateHasSponsorInput?.checked),
    hasSponsorWithdraw: Boolean(privateHasSponsorWithdraw?.checked),
    hasDonation: Boolean(privateHasDonation?.checked),
    hasHeating: Boolean(privateHasHeating?.checked),
    tuitionIncome: privateInputValue('tuitionIncome'),
    fiscalSubsidy: privateInputValue('fiscalSubsidy'),
    wageTotal: privateInputValue('wageTotal'),
    capitalExpense: privateHasBigPurchase?.checked ? privateInputValue('capitalExpense') : 0,
    rentExpense: privateInputValue('rentExpense') || 0,
    interestExpense: privateInputValue('interestExpense') || 0,
    sponsorInput: privateInputValue('sponsorInput') || 0,
    sponsorWithdraw: privateInputValue('sponsorWithdraw') || 0,
    donationIncome: privateInputValue('donationIncome') || 0,
    donationExpense: privateInputValue('donationExpense') || 0,
    otherIncome: privateInputValue('otherIncome') || 0,
    netBalance: privateInputValue('netBalance') || 0,
    staffCount: privateInputValue('staffCount'),
    teacherCount: privateInputValue('teacherCount'),
    studentCount: privateInputValue('studentCount'),
    externalLongTermStaffCount: privateInputValue('externalLongTermStaffCount'),
    retiredStaffCount: privateInputValue('retiredStaffCount'),
    kindergartenStudentCount: privateInputValue('kindergartenStudentCount'),
    primaryStudentCount: privateInputValue('primaryStudentCount'),
    juniorStudentCount: privateInputValue('juniorStudentCount'),
    seniorStudentCount: privateInputValue('seniorStudentCount'),
    preschoolOneYearEndCount: privateInputValue('preschoolOneYearEndCount'),
    nurseryEndCount: privateInputValue('nurseryEndCount'),
    primaryInclusiveStudentCount: privateInputValue('primaryInclusiveStudentCount'),
    primaryBoardingStudentCount: privateInputValue('primaryBoardingStudentCount'),
    juniorInclusiveStudentCount: privateInputValue('juniorInclusiveStudentCount'),
    juniorBoardingStudentCount: privateInputValue('juniorBoardingStudentCount'),
    seniorInclusiveStudentCount: privateInputValue('seniorInclusiveStudentCount'),
    seniorBoardingStudentCount: privateInputValue('seniorBoardingStudentCount'),
  };
}

// 用线上台账 controls 预填表单（供选校后自动预填）
function applyControlsToPrivateForm(controls) {
  if (!controls) return;
  const setToggle = (el, on) => { if (el) el.checked = !!on; };
  setToggle(privateHasRent, controls.hasRent);
  setToggle(privateHasLoan, controls.hasLoan);
  setToggle(privateHasSponsorInput, controls.hasSponsorInput);
  setToggle(privateHasSponsorWithdraw, controls.hasSponsorWithdraw);
  setToggle(privateHasDonation, controls.hasDonation);
  setToggle(privateHasHeating, controls.hasHeating);
  if (privateSchoolStage && controls.schoolStage) privateSchoolStage.value = controls.schoolStage;
  if (privateHasBigPurchase) privateHasBigPurchase.checked = Number(controls.capitalExpense) > 0;
  for (const [key, el] of Object.entries(privateInputs)) {
    if (el && controls[key] != null) el.value = controls[key];
  }
  updatePrivateConditionalFields();
}

function collectPrivateDraftPayload() {
  const required = [
    ['staffCount', '年末教职工数'],
    ['studentCount', '年末学生数'],
    ['tuitionIncome', '学费/保育教育费'],
    ['fiscalSubsidy', '财政补助'],
    ['wageTotal', '工资福利总额'],
  ];
  if (privateHasBigPurchase?.checked) required.push(['capitalExpense', '资本性支出']);
  if (privateHasRent?.checked) required.push(['rentExpense', '房租/租赁费']);
  if (privateHasLoan?.checked) required.push(['interestExpense', '利息支出']);
  if (privateHasSponsorInput?.checked) required.push(['sponsorInput', '举办者投入']);
  if (privateHasSponsorWithdraw?.checked) required.push(['sponsorWithdraw', '举办者抽回']);
  if (privateHasDonation?.checked) {
    required.push(['donationIncome', '捐赠收入']);
    required.push(['donationExpense', '捐赠支出']);
  }

  const missing = [];
  const controls = buildPrivateControls();
  for (const [key, label] of required) {
    if (controls[key] == null || Number.isNaN(controls[key])) missing.push(label);
  }
  if (!privateSchoolSelect?.value) missing.push('学校');
  if (!privatePrevPath?.value) missing.push('上年经费年报');
  if (missing.length > 0) {
    throw new Error(`请补齐：${missing.join('、')}`);
  }

  return {
    unitName: privateSchoolSelect.value,
    prevReportPath: privatePrevPath.value,
    controls,
  };
}

// 选校后：从线上台账拉该校数据预填 + 提示
async function onPrivateSchoolSelected() {
  const unitName = privateSchoolSelect?.value;
  if (!unitName) { setPrivateWarnings([]); return; }
  if (isStandaloneSchool()) {
    const profile = getStandaloneProfile();
    applyControlsToPrivateForm({ schoolStage: profile.schoolStage || '', ...(profile.draftControls || {}) });
    if (privatePrevPath && profile.draftPrevReportPath) privatePrevPath.value = profile.draftPrevReportPath;
    setPrivateWarnings(['单机学校版：草稿数据只保存在本机，不会回传经办服务器。']);
    return;
  }
  try {
    const res = await window.reportApp.collectGetOne(unitName);
    const collected = res?.collected;
    if (collected && collected.controls && Object.keys(collected.controls).length) {
      applyControlsToPrivateForm(collected.controls);
      setPrivateWarnings([`已从线上采集数据预填（第 ${collected.version || 1} 版，填表人：${collected.fillerName || '—'}）。核对修改后生成时会自动回传服务器。`]);
    } else {
      setPrivateWarnings(['线上暂无该校数据，请在下方本地填写；生成时会自动回传服务器。']);
    }
  } catch (e) {
    addLog('拉取线上数据失败：' + e.message, 'warn');
  }
}

// 本地填写的数据回传服务器
async function backfillPrivateToServer() {
  if (isStandaloneSchool()) {
    addLog('单机学校版不连接经办服务器', 'warn');
    return;
  }
  const unitName = privateSchoolSelect?.value;
  if (!unitName) { addLog('请先选择学校', 'warn'); return; }
  const controls = buildPrivateControls();
  if (controls.staffCount == null || controls.studentCount == null) {
    addLog('请至少填写年末教职工数和学生数再回传', 'warn'); return;
  }
  addLog(`正在回传 ${unitName} 的数据到服务器...`, 'log');
  const res = await window.reportApp.collectBackfill({ unitName, controls });
  if (!res?.ok) { addLog(`回传失败：${res?.message || ''}`, 'error'); return; }
  addLog(`已回传（第 ${res.version} 版），线上台账已更新`, 'success');
}

async function runPrivateDraft(mode) {
  setPrivateWarnings([]);
  let payload;
  try {
    payload = collectPrivateDraftPayload();
  } catch (error) {
    setPrivateWarnings([error.message]);
    addLog(error.message, 'warn');
    return;
  }

  const peopleValidation = await window.reportApp.validateFormalControls(payload.controls);
  if (!peopleValidation?.ok) {
    const message = Object.values(peopleValidation?.errors || {})[0] || '人员与学生资料校验失败';
    setPrivateWarnings([message]);
    addLog(message, 'warn');
    return;
  }
  payload.controls = { ...payload.controls, ...peopleValidation.controls };

  if (appRole === 'school' && !isStandaloneSchool()) {
    addLog(`正在自动回传 ${payload.unitName} 的填报数据...`, 'log');
    const backfill = await window.reportApp.collectBackfill({
      unitName: payload.unitName,
      controls: payload.controls,
      collectScope: 'full',
    });
    if (!backfill?.ok) {
      const message = `自动回传失败：${backfill?.message || '未知错误'}`;
      setPrivateWarnings([message]);
      addLog(message, 'error');
      return;
    }
    addLog(backfill.queued
      ? '服务器暂时不可用，填报数据已暂存，将在联网后自动补传'
      : `填报数据已自动回传服务器（第 ${backfill.version} 版）`, 'success');
  }

  if (isStandaloneSchool()) {
    const saved = await window.reportApp.saveConfig({
      standaloneProfile: {
        ...getStandaloneProfile(),
        schoolStage: payload.controls.schoolStage,
        draftControls: payload.controls,
        draftPrevReportPath: payload.prevReportPath,
      },
    });
    if (saved?.ok === false) {
      setPrivateWarnings([`保存本机草稿资料失败：${saved.message || ''}`]);
      return;
    }
    appConfig = saved?.data || appConfig;
  }

  const buttons = [privateGenerateEditBtn, privateGeneratePreviewBtn].filter(Boolean);
  buttons.forEach(btn => { btn.disabled = true; });
  try {
    addLog(`开始生成民办草稿：${payload.unitName}`);
    const result = await window.reportApp.generatePrivateDraft(payload);
    if (!result || result.ok === false) {
      const message = result && result.message ? result.message : '民办草稿生成失败';
      setPrivateWarnings([message]);
      addLog(message, 'error');
      return;
    }

    renderPreview(result.preview);
    if (result.warnings && result.warnings.length) setPrivateWarnings(result.warnings);
    addLog(`民办草稿已生成：${result.outputPath}`, 'success');
    if (mode === 'preview') {
      addLog('已进入打印稿预览，提交前请处理提示项。', result.warnings?.length ? 'warn' : 'success');
    }
    document.querySelector('[data-tab="preview"]').click();
  } finally {
    buttons.forEach(btn => { btn.disabled = false; });
  }
}

if (privateRefreshSchoolsBtn) privateRefreshSchoolsBtn.addEventListener('click', populatePrivateSchools);
if (privateSelectPrevBtn) {
  privateSelectPrevBtn.addEventListener('click', async () => {
    const filePath = await window.reportApp.selectPrivatePrevReport();
    if (filePath && privatePrevPath) privatePrevPath.value = filePath;
  });
}
for (const checkbox of [privateHasRent, privateHasLoan, privateHasSponsorInput, privateHasSponsorWithdraw, privateHasDonation, privateHasHeating, privateHasBigPurchase]) {
  if (checkbox) checkbox.addEventListener('change', updatePrivateConditionalFields);
}
if (privateSchoolSelect) privateSchoolSelect.addEventListener('change', onPrivateSchoolSelected);
if (privateBackfillBtn) privateBackfillBtn.addEventListener('click', backfillPrivateToServer);
if (privateGenerateEditBtn) privateGenerateEditBtn.addEventListener('click', () => runPrivateDraft('edit'));
if (privateGeneratePreviewBtn) privateGeneratePreviewBtn.addEventListener('click', () => runPrivateDraft('preview'));

// 政府平台导出的上年经费年报被拦截入库后：若与当前所选学校匹配，自动填入路径
if (window.reportApp.onPrevReportCaptured) {
  window.reportApp.onPrevReportCaptured((info) => {
    if (info?.ok) {
      addLog(`已入库上年经费年报：${info.unitName}`, 'success');
      const selected = privateSchoolSelect?.value || '';
      const norm = (s) => String(s || '').replace(/\s+/g, '');
      if (info.savedPath && selected && norm(selected) === norm(info.unitName) && privatePrevPath) {
        privatePrevPath.value = info.savedPath;
        addLog('已自动填入当前学校的上年经费年报路径', 'success');
      }
    } else {
      addLog(`上年经费年报未入库：${info?.reason || '未知原因'}`, 'warn');
    }
  });
}
if (rulesImportBtn) rulesImportBtn.addEventListener('click', importRulesConfig);
if (rulesExportBtn) rulesExportBtn.addEventListener('click', exportRulesConfig);
if (rulesReloadBtn) rulesReloadBtn.addEventListener('click', () => loadRulesConfig(true));
if (rulesSaveBtn) rulesSaveBtn.addEventListener('click', saveRulesConfig);
if (rulesImportMergeExcelBtn) rulesImportMergeExcelBtn.addEventListener('click', importMergeRulesExcel);
if (rulesLoadEffectiveMergeBtn) rulesLoadEffectiveMergeBtn.addEventListener('click', () => loadRulesConfig(true));
if (rulesAddMergeGroupBtn) rulesAddMergeGroupBtn.addEventListener('click', addRulesMergeGroup);
if (rulesRemoveMergeGroupBtn) rulesRemoveMergeGroupBtn.addEventListener('click', removeRulesMergeGroup);
if (rulesAddMergeMemberBtn) rulesAddMergeMemberBtn.addEventListener('click', addSelectedMergeMembers);
if (rulesRemoveMergeMemberBtn) rulesRemoveMergeMemberBtn.addEventListener('click', removeSelectedMergeMembers);
if (rulesMergeCenterSelect) {
  rulesMergeCenterSelect.addEventListener('change', () => {
    const oldCenter = rulesSelectedCenter;
    const newCenter = rulesMergeCenterSelect.value;
    if (!newCenter || oldCenter === newCenter) return;
    const members = rulesMergeState[oldCenter];
    if (oldCenter && oldCenter in rulesMergeState) delete rulesMergeState[oldCenter];
    rulesSelectedCenter = newCenter;
    rulesMergeMemberMode = 'members';
    rulesCheckedMembers.clear();
    rulesCheckedCandidates.clear();
    rulesMergeState[newCenter] = members === null ? null : Array.from(new Set([newCenter, ...(members || [])]));
    syncMergeJsonFromState();
    renderRulesMergeManager();
  });
}
if (rulesMergeSearch) rulesMergeSearch.addEventListener('input', renderMergeMemberList);
if (rulesMergeGroups) rulesMergeGroups.addEventListener('change', syncMergeStateFromJson);
updatePrivateConditionalFields();

// ===== 教育事业年报导入和展示 =====
// ===== 在线采集 =====
const collectServerUrlInput = document.querySelector('#collectServerUrl');
const collectTokenInput = document.querySelector('#collectToken');
const collectYearHint = document.querySelector('#collectYearHint');
const collectListEl = document.querySelector('#collectList');
const collectSummaryEl = document.querySelector('#collectSummary');
const collectSelectAll = document.querySelector('#collectSelectAll');
const collectForceInput = document.querySelector('#collectForce');

let collectStatusRows = [];
let collectInited = false;

// 状态 → 标签/徽章样式/是否可勾选生成（与 main.js buildCollectStatus 对齐）
const COLLECT_STATE_META = {
  ready: { label: '可生成', badge: 'badge-ready', selectable: true },
  stale: { label: '数据已更新·建议重生成', badge: 'badge-pending', selectable: true },
  'waiting-members': { label: '等待成员填齐', badge: 'badge-wait', selectable: false },
  'missing-prev': { label: '缺上年经费年报', badge: 'badge-muted', selectable: false },
  generated: { label: '已生成', badge: 'badge-done', selectable: false },
  // 公办有报表：只采集人员数，报表在「学校状态」页用五件套生成
  'formal-people': { label: '公办·人员已采集', badge: 'badge-done', selectable: false },
};

function collectDataYear() {
  return new Date().getFullYear() - 1;
}

async function initCollectPanel() {
  try {
    const cfg = await window.reportApp.loadConfig();
    if (collectServerUrlInput) collectServerUrlInput.value = cfg?.collectServerUrl || '';
    if (collectTokenInput) collectTokenInput.value = cfg?.collectToken || '';
    const year = Number(cfg?.collectYear) || collectDataYear();
    if (collectYearHint) collectYearHint.textContent = `采集年度：${year} 年度（当前年 − 1，自动，与服务器一致）`;
  } catch (e) {
    addLog('读取采集设置失败：' + e.message, 'error');
  }
  collectInited = true;
  await refreshCollectStatus();
}

async function saveCollectConfig() {
  const patch = {
    collectServerUrl: (collectServerUrlInput?.value || '').trim(),
    collectToken: (collectTokenInput?.value || '').trim(),
  };
  const res = await window.reportApp.saveConfig(patch);
  if (res?.ok === false) { addLog(`保存采集设置失败：${res.message}`, 'error'); return; }
  addLog('采集设置已保存', 'success');
}

async function refreshCollectStatus() {
  try {
    const res = await window.reportApp.collectStatus();
    if (!res?.ok) { addLog(`获取采集状态失败：${res?.message || ''}`, 'error'); return; }
    collectStatusRows = res.status || [];
    renderCollectStatus();
  } catch (e) {
    addLog('获取采集状态异常：' + e.message, 'error');
  }
}

function renderCollectStatus() {
  if (!collectListEl) return;
  if (collectStatusRows.length === 0) {
    collectListEl.innerHTML = '<div class="empty-hint">暂无采集数据。先「推送名单」把统一填报链接发给学校，学校填好后点「同步数据」。</div>';
    if (collectSummaryEl) collectSummaryEl.textContent = '';
    return;
  }
  const counts = {};
  for (const r of collectStatusRows) counts[r.state] = (counts[r.state] || 0) + 1;
  if (collectSummaryEl) {
    const parts = Object.entries(COLLECT_STATE_META)
      .filter(([k]) => counts[k])
      .map(([k, m]) => `${m.label} ${counts[k]}`);
    collectSummaryEl.textContent = `共 ${collectStatusRows.length} 个单位：${parts.join(' · ')}`;
  }
  const force = !!(collectForceInput && collectForceInput.checked);
  collectListEl.innerHTML = collectStatusRows.map((r) => {
    const meta = COLLECT_STATE_META[r.state] || { label: r.state, badge: 'badge-muted', selectable: false };
    // 勾选“忽略未填成员”后，等待成员的合并组解禁可选（主进程仍以 force 参数二次校验）
    const selectable = meta.selectable || (force && r.state === 'waiting-members');
    const memberInfo = (r.memberCount != null)
      ? `合并组成员 ${r.submittedMemberCount || 0}/${r.memberCount}`
      : '独立填报';
    const filler = r.fillerName
      ? `${escapeHtml(r.fillerName)}${r.fillerPhone ? ' ' + escapeHtml(r.fillerPhone) : ''}`
      : '—';
    const checkbox = selectable
      ? `<input type="checkbox" class="collect-cb" data-unit="${escapeHtml(r.unitName)}" />`
      : '<input type="checkbox" disabled />';
    const rowAction = r.state === 'formal-people'
      ? '<span class="muted">学校状态页生成</span>'
      : (selectable
        ? `<button type="button" class="ghost btn-sm collect-gen-btn" data-unit="${escapeHtml(r.unitName)}">生成</button>`
        : '');
    return `<div class="collect-row">
      <label class="collect-pick">${checkbox}</label>
      <div class="collect-name">
        <strong>${escapeHtml(r.unitName)}</strong>
        <span class="muted">${r.isCenter ? '合并中心园 · ' : ''}${memberInfo}</span>
      </div>
      <div class="collect-meta">
        <span>v${r.version ?? '-'}</span>
        <span>${escapeHtml(r.submittedAt || '未提交')}</span>
        <span>填表人：${filler}</span>
      </div>
      <span class="school-badge ${meta.badge}">${meta.label}</span>
      <span class="collect-row-action">${rowAction}</span>
    </div>`;
  }).join('');
  if (collectSelectAll) collectSelectAll.checked = false;
}

async function collectPush() {
  const cfg = await window.reportApp.loadConfig();
  if (!cfg?.collectServerUrl) { addLog('请先填写并保存采集服务器地址', 'warn'); return; }
  addLog('正在推送名单到采集服务器...', 'log');
  const res = await window.reportApp.collectPushSchools();
  if (!res?.ok) { addLog(`推送名单失败：${res?.message || ''}`, 'error'); return; }
  addLog(`已推送 ${res.count} 所学校名单`, 'success');
  const url = res.schools?.[0]?.url;
  if (url) addLog(`统一填报链接：${url}（群发给学校，进入后各自选择本校填写）`, 'log');
}

async function collectSync() {
  const cfg = await window.reportApp.loadConfig();
  if (!cfg?.collectServerUrl) { addLog('请先填写并保存采集服务器地址', 'warn'); return; }
  addLog('正在同步采集数据...', 'log');
  const res = await window.reportApp.collectSync();
  if (!res?.ok) { addLog(`同步失败：${res?.message || ''}`, 'error'); return; }
  addLog(`同步完成：更新 ${res.saved} 个单位的最新提交`, 'success');
  collectStatusRows = res.status || [];
  renderCollectStatus();
}

// 逐校 / 批量共用的生成入口
async function runCollectGenerate(units) {
  if (!units || units.length === 0) { addLog('请先勾选要生成的学校', 'warn'); return; }
  const force = !!(collectForceInput && collectForceInput.checked);
  addLog(`开始生成 ${units.length} 所学校的草稿...`, 'log');
  const res = await window.reportApp.collectBatchGenerate(units, { force });
  if (!res?.ok) { addLog(`生成失败：${res?.message || ''}`, 'error'); return; }
  addLog(`生成完成：成功 ${res.success}，失败 ${res.failed}`, res.failed ? 'warn' : 'success');
  for (const r of res.results || []) {
    if (!r.ok) addLog(`[${r.unitName}] ${r.message}`, 'warn');
  }
  collectStatusRows = res.status || [];
  renderCollectStatus();
  // 生成的草稿已入库并推送预览，刷新学校选择器方便切到「报表预览」查看
  try { updateSchoolSelector(); } catch { /* ignore */ }
}

async function collectGenerate() {
  const units = [...document.querySelectorAll('.collect-cb:checked')].map((cb) => cb.dataset.unit);
  await runCollectGenerate(units);
}

document.querySelector('#collectSaveCfgBtn')?.addEventListener('click', saveCollectConfig);
document.querySelector('#collectPushBtn')?.addEventListener('click', collectPush);
document.querySelector('#collectSyncBtn')?.addEventListener('click', collectSync);
document.querySelector('#collectRefreshBtn')?.addEventListener('click', refreshCollectStatus);
document.querySelector('#collectGenerateBtn')?.addEventListener('click', collectGenerate);
collectSelectAll?.addEventListener('change', () => {
  document.querySelectorAll('.collect-cb').forEach((cb) => { cb.checked = collectSelectAll.checked; });
});
// 切换“忽略未填成员”时重绘列表，解禁/收回等待成员行的勾选
collectForceInput?.addEventListener('change', () => renderCollectStatus());
// 逐校生成：行内「生成」按钮（事件委托，列表重绘不掉监听）
collectListEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('.collect-gen-btn');
  if (btn && btn.dataset.unit) runCollectGenerate([btn.dataset.unit]);
});

// ===== 初始化 =====
async function bootstrapApp() {
  if (appBootstrapped) return;
  appBootstrapped = true;
  addLog('应用初始化...');

  // 先读取本地配置，再判定授权角色与部署形态。单机学校版的单位名来自本地首次设置。
  try {
    appConfig = await window.reportApp.loadConfig();
  } catch (e) {
    addLog('读取本地配置失败：' + e.message, 'error');
    appConfig = {};
  }

  try {
    const r = await window.reportApp.getAppRole();
    appRole = r?.role === 'school' ? 'school' : 'operator';
    appDeploymentMode = r?.deploymentMode === 'standalone' ? 'standalone' : 'managed';
    appUnitName = isStandaloneSchool()
      ? String(appConfig?.standaloneProfile?.unitName || '').trim()
      : String(r?.unitName || '');
    applyAppRoleIndicator();
  } catch { appRole = 'operator'; appDeploymentMode = 'managed'; appUnitName = ''; }

  if (appRole === 'operator') await loadPrivateMergeConfig();
  else setRulesMergeState({});

  try {
    applyWorkMode(appConfig?.workMode || '');
  } catch (e) {
    addLog('读取填报类型失败：' + e.message, 'error');
    applyWorkMode('');
  }

  // 1) 先加载数据库报表（让 previews 提前就绪，方便后续 renderStatus 合并已生成学校）
  try {
    const reports = await window.reportApp.getReports();
    addLog('数据库报表数量：' + (reports ? reports.length : 0));
    if (reports && reports.length > 0) {
      for (const rpt of reports) {
        if (!previews.find(p => p.unitName === rpt.unit_name)) {
          try {
            const data = await window.reportApp.getReportData(Number(rpt.id));
            const computed = {};
            for (const [sheetName, rows] of Object.entries(data || {})) {
              const sheet = {};
              for (const row of rows) {
                sheet[row.cell_addr] = row.value;
              }
              computed[sheetName] = sheet;
            }
            previews.push({ unitName: rpt.unit_name, computed });
          } catch (err) {
            addLog(`加载 ${rpt.unit_name} 报表数据失败：${err.message}`, 'error');
          }
        }
      }
      updateSchoolSelector();
      addLog('已加载 ' + previews.length + ' 所学校到选择器');
    }
  } catch (e) {
    addLog('读取数据库失败：' + e.message, 'error');
  }

  if (!licenseIsValid() && previews[0]?.unitName) {
    await claimTrialForUnitName(previews[0].unitName, { silent: true });
  }

  // 2) 启动文件夹监控
  try {
    const defaultFolder = await window.reportApp.getDefaultFolder();
    addLog('默认监控文件夹：' + (defaultFolder || '（空）'));
    if (defaultFolder) {
      const result = await window.reportApp.startWatching(defaultFolder);
      if (result && result.ok) {
        setWatchingUI(true);
        addLog('自动监控已启动：' + defaultFolder, 'success');
      } else {
        addLog('自动监控启动失败：' + (result && result.message || '未知错误'), 'error');
      }
    } else {
      addLog('未找到默认监控文件夹', 'warn');
    }
  } catch (e) {
    addLog('启动监控异常：' + e.message, 'error');
  }

  // 3) 拉一次最新状态（合并已生成学校 + 监控目录中的学校）
  try {
    const status = await window.reportApp.getStatus();
    renderStatus(status);
  } catch (e) {
    addLog('获取状态失败：' + e.message, 'error');
  }

  // 4) 根据授权状态标注核心报表锁定情况。
  updateTableNavLocks();
}

showApp().catch((error) => {
  if (appShell) appShell.hidden = false;
  addLog(`应用启动失败：${error.message || error}`, 'error');
});
