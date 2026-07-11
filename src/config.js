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
  resolveDefaultFolder,
};
