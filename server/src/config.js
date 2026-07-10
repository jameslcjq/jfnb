const path = require('path');

try {
  require('dotenv').config();
} catch {
  // dotenv 未安装时忽略，直接读 process.env
}

const port = Number(process.env.PORT || 4000);
// 默认只绑回环，走 nginx 反代（README 示例即 proxy 到 127.0.0.1:4000）；
// 确需直接对外监听再显式设 HOST=0.0.0.0。
const host = String(process.env.HOST || '127.0.0.1');
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
const currentYear = new Date().getFullYear();
const collectionYear = Number(process.env.COLLECT_YEAR_FOR_TEST || currentYear - 1);

const config = {
  port,
  host,
  publicBaseUrl,
  apiToken: String(process.env.API_TOKEN || ''),
  adminToken: String(process.env.ADMIN_TOKEN || ''),
  dbPath: process.env.DB_PATH ? String(process.env.DB_PATH) : path.join(__dirname, '..', 'data', 'collect.db'),
  currentYear,
  collectionYear,
  defaultYear: collectionYear,
};

function warnMissing() {
  const warnings = [];
  if (!config.apiToken) warnings.push('API_TOKEN 未设置，拉取/推送接口将拒绝所有请求');
  if (!config.adminToken) warnings.push('ADMIN_TOKEN 未设置，管理看板无法登录');
  if (config.publicBaseUrl.startsWith('http://localhost')) warnings.push('PUBLIC_BASE_URL 仍是 localhost，学校将无法访问填表链接');
  return warnings;
}

module.exports = { config, warnMissing };
