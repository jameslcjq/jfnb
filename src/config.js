const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { DATA_DIR, ensureDataDir } = require('./paths');

const DEFAULT_CONFIG = {
  watchFolder: DATA_DIR,
  exportFolder: DATA_DIR,
  layoutTemplatePath: '',
  // formal = 有正式财务报表；draft = 无正式财务报表，生成草稿
  workMode: '',
  // 单机学校版首次设置。只有授权 deployment_mode=standalone 时使用，
  // 不作为联网学校或经办版的单位资料来源。
  standaloneProfile: {
    unitName: '',
    formalControls: {},
  },
  regionRules: {
    regionName: '沭阳县',
    regionCode: '321322',
    heatingFeePerStudent: 25,
    // mergeGroups: { "中心校/中心园名称": ["中心校/中心园名称", "并入学校名称"] }
    // 若某中心校/中心园设置为 null，则表示移除内置合并规则。
    mergeGroups: {},
    // schoolAliases: { "导入/文件中的别名": "教育事业年报中的标准名称" }
    schoolAliases: {},
    // 合并成员中已撤销、无需提示缺失的学校名称
    ignoredClosedSchools: [],
  },
  // 旧版兼容：新配置统一放入 regionRules.mergeGroups。
  kindergartenMergeGroups: {},
  autoStartWatch: true,
  webLoginUrl: 'https://jyjjxx.moe.edu.cn/JYJF1/login/login_toIndex',
  // 在线关键数采集服务端（民办/无报表/合并填报学校）
  collectServerUrl: '',   // 例：https://jyj.yunbg.vip/collect
  collectToken: '',       // 与服务端 API_TOKEN 一致
  collectYear: 0,         // 0 = 自动取“当前年份 − 1”（经费年报为上年度数据，与服务端一致）
  // 授权角色：operator=经办版，school=学校版。部署形态：managed=连接经办服务器，
  // standalone=纯本地学校版。旧授权默认 managed，保持已有流程不变。
  // 本地 override 仅在未打包开发环境且显式设置 GZNB_ALLOW_ROLE_OVERRIDE=1 时生效；
  // 正式授权必须在 features 中签发 role / deployment_mode。
  roleOverride: '',
  deploymentModeOverride: '',
};

function getConfigPath() {
  ensureDataDir();
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return mergeConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    regionRules: {
      ...DEFAULT_CONFIG.regionRules,
      ...(config.regionRules || {}),
    },
    standaloneProfile: {
      ...DEFAULT_CONFIG.standaloneProfile,
      ...(config.standaloneProfile || {}),
      formalControls: {
        ...(DEFAULT_CONFIG.standaloneProfile.formalControls || {}),
        ...(config.standaloneProfile?.formalControls || {}),
      },
    },
  };
}

function saveConfig(nextConfig) {
  const config = mergeConfig(nextConfig);
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

function updateConfig(patch) {
  return saveConfig({ ...loadConfig(), ...patch });
}

// 渲染进程只能修改业务设置。角色/部署 override 属于开发诊断能力，
// 不能通过普通 IPC 写入，否则会绕过签名授权中的权限声明。
const EDITABLE_CONFIG_KEYS = new Set([
  'watchFolder', 'exportFolder', 'layoutTemplatePath', 'workMode', 'standaloneProfile',
  'regionRules', 'kindergartenMergeGroups', 'autoStartWatch', 'webLoginUrl',
  'collectServerUrl', 'collectToken', 'collectYear',
]);

function sanitizeConfigPatch(patch = {}) {
  const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (EDITABLE_CONFIG_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function resolveDefaultFolder() {
  const config = loadConfig();
  if (config.watchFolder && fs.existsSync(config.watchFolder)) return config.watchFolder;

  ensureDataDir();
  if (fs.existsSync(DATA_DIR)) return DATA_DIR;

  const fallback = path.resolve(app.getAppPath(), '..', '陇集');
  return fallback;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfigPath,
  loadConfig,
  saveConfig,
  updateConfig,
  sanitizeConfigPatch,
  resolveDefaultFolder,
};
