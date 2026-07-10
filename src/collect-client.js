// 与在线采集服务端通信的客户端（供主进程 IPC 调用）。
// 纯函数 + 可注入 fetch，便于脱离 Electron 单元测试。
// 接口契约见 server/README.md。

function normalizeBase(url) {
  return String(url || '').replace(/\/+$/, '');
}

function authHeaders(token, withJson) {
  const headers = { Authorization: `Bearer ${token}` };
  if (withJson) headers['Content-Type'] = 'application/json';
  return headers;
}

function requireConfig(base, token) {
  if (!base) throw new Error('未配置采集服务器地址');
  if (!token) throw new Error('未配置采集接口令牌');
}

async function readJson(res) {
  try { return await res.json(); } catch { return {}; }
}

// 推送名单（幂等）。schools: [{ unitName, mergeCenter?, isCenter?, contact? }]
async function pushSchools({ serverUrl, token, year, schools }, fetchImpl = fetch) {
  const base = normalizeBase(serverUrl);
  requireConfig(base, token);
  if (!Array.isArray(schools) || schools.length === 0) throw new Error('名单为空');
  const res = await fetchImpl(`${base}/api/v1/schools/sync`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ year, schools }),
  });
  const data = await readJson(res);
  if (!res.ok || data.ok === false) throw new Error(data.message || `推送名单失败（HTTP ${res.status}）`);
  return data;
}

// 拉取每校最新提交。mode: 'merged'（默认，合并组已汇总为中心园）| 'raw'（原始明细）
async function fetchSubmissions({ serverUrl, token, year, since, mode = 'merged' }, fetchImpl = fetch) {
  const base = normalizeBase(serverUrl);
  requireConfig(base, token);
  const params = new URLSearchParams({ year: String(year), mode });
  if (since) params.set('since', since);
  const res = await fetchImpl(`${base}/api/v1/submissions?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(token, false),
  });
  const data = await readJson(res);
  if (!res.ok || data.ok === false) throw new Error(data.message || `拉取提交失败（HTTP ${res.status}）`);
  return data;
}

module.exports = { pushSchools, fetchSubmissions, normalizeBase };
