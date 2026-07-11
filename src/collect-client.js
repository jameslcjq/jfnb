// 与在线采集服务端通信的客户端（供主进程 IPC 调用）。
// 纯函数 + 可注入 fetch，便于脱离 Electron 单元测试。
// 接口契约见 server/README.md。

function normalizeBase(url) {
  return String(url || '').replace(/\/+$/, '');
}

// 本机/回环地址允许 http（开发联调），其余一律要求 https，
// 防止令牌和学校财务数据被同网段明文窃听。
function isLoopbackHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

function requireConfig(base, token) {
  if (!base) throw new Error('未配置采集服务器地址');
  if (!token) throw new Error('未配置采集接口令牌');
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`采集服务器地址格式不正确：${base}`);
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackHost(url.hostname))) {
    throw new Error('采集服务器地址必须使用 https（仅本机 localhost/127.0.0.1 测试时允许 http）');
  }
}

function authHeaders(token, withJson) {
  const headers = { Authorization: `Bearer ${token}` };
  if (withJson) headers['Content-Type'] = 'application/json';
  return headers;
}

// 严格解析响应：非 JSON（如反向代理错误页）直接报错，绝不吞成“成功 0 条”
async function readJsonStrict(res, action) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${action}失败：服务器响应不是有效数据（HTTP ${res.status}），可能是地址错误或代理故障。响应开头：${String(text).slice(0, 80)}`);
  }
  if (!res.ok || data.ok !== true) {
    throw new Error(data.message || `${action}失败（HTTP ${res.status}）`);
  }
  return data;
}

// 推送名单（幂等增量更新）。完整年度名单由服务端本地脚本维护；
// 桌面端只掌握其导入范围内的学校，不能把局部名单当作年度快照。
// schools: [{ unitName, mergeCenter?, isCenter?, contact?, staffCount? }]
async function pushSchools({ serverUrl, token, year, schools }, fetchImpl = fetch) {
  const base = normalizeBase(serverUrl);
  requireConfig(base, token);
  if (!Array.isArray(schools) || schools.length === 0) throw new Error('名单为空');
  const res = await fetchImpl(`${base}/api/v1/schools/sync`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ year, schools }),
  });
  const data = await readJsonStrict(res, '推送名单');
  if (!Array.isArray(data.schools)) throw new Error('推送名单失败：服务器响应缺少学校列表');
  return data;
}

// 拉取每校最新提交。mode: 'merged'（默认，合并组已汇总为中心园）| 'raw'（原始明细）。
// 增量可传 sinceId（上次响应的 cursor）。
async function fetchSubmissions({ serverUrl, token, year, since, sinceId, mode = 'merged' }, fetchImpl = fetch) {
  const base = normalizeBase(serverUrl);
  requireConfig(base, token);
  const params = new URLSearchParams({ year: String(year), mode });
  if (since) params.set('since', since);
  if (sinceId) params.set('sinceId', String(sinceId));
  const res = await fetchImpl(`${base}/api/v1/submissions?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(token, false),
  });
  const data = await readJsonStrict(res, '拉取提交');
  if (!Array.isArray(data.submissions)) throw new Error('拉取提交失败：服务器响应缺少提交列表');
  return data;
}

// 回传提交（桌面代填/本地填的数据入服务器台账，来源 desktop）。
// items: [{ unitName, controls, filler:{name,phone}, note }]
async function backfillSubmissions({ serverUrl, token, submissions }, fetchImpl = fetch) {
  const base = normalizeBase(serverUrl);
  requireConfig(base, token);
  const items = Array.isArray(submissions) ? submissions : [];
  if (items.length === 0) throw new Error('没有要回传的数据');
  const res = await fetchImpl(`${base}/api/v1/submissions`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ submissions: items }),
  });
  const data = await readJsonStrict(res, '回传数据');
  if (!Array.isArray(data.results)) throw new Error('回传数据失败：服务器响应缺少结果列表');
  return data;
}

module.exports = { pushSchools, fetchSubmissions, backfillSubmissions, normalizeBase };
