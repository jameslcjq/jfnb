// 拦截政府网报平台下载的「上年经费年报（基表）」Excel，落到监控目录并规范命名入库。
// 移植自 E:\工资报账 的 will-download 拦截；沿用其教训：只拦截+入库，不注入自动下载脚本
//（仿造导出请求要抓页面单位/地区码，页面一变就导出空模板）。
const fs = require('fs');
const XLSX = require('@e965/xlsx');
const { identifyByContent, UNIT_NAME_CELLS } = require('./watcher');
const { sanitizeFileName, resolveInside } = require('./path-safety');

const GOV_HOST = 'jyjjxx.moe.edu.cn';

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

// 是否为「上年经费年报/基表」下载：按来源域名 + 文件名特征识别（含 blob: 链接）
function isEducationFundingReportDownload(url, filename) {
  if (!/\.(xls|xlsx)$/i.test(filename)) return false;
  const name = normalizeName(filename);
  if (/^blob:/i.test(url) && /上年经费年报|基表/.test(name)) return true;

  let host = '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'blob:') {
      try { host = new URL(parsed.pathname).hostname.toLowerCase(); } catch { host = ''; }
    } else {
      host = parsed.hostname.toLowerCase();
    }
  } catch {
    return false;
  }
  if (host !== GOV_HOST) return false;
  return /excelFileDownload/i.test(url) || /基表|年报|经费/.test(name);
}

// 落盘后按内容复核：能否作为上年经费年报识别、单位名是否正常（空模板/导错页要丢弃）
function inspectPrevReport(filePath) {
  let wb;
  try {
    wb = XLSX.readFile(filePath);
  } catch {
    return { ok: false, reason: '文件无法按 Excel 打开，可能下载到的是登录页或报错网页' };
  }
  if (identifyByContent(wb) !== '上年经费年报') {
    return { ok: false, reason: '内容未识别为上年经费年报基表，请确认导出的是基表 Excel' };
  }
  const cfg = UNIT_NAME_CELLS['上年经费年报'];
  const sheet = wb.Sheets[wb.SheetNames[cfg.sheet]];
  const cell = sheet ? sheet[cfg.addr] : null;
  const unitName = cell && cell.v != null ? cfg.clean(cell.v) : '';
  if (!unitName || /[+{}'"`]/.test(unitName)) {
    return {
      ok: false,
      unitName,
      reason: `基表单位名称异常（${unitName || '为空'}），像是空模板，请进入具体基表页面后重新下载`,
    };
  }
  return { ok: true, unitName };
}

function uniquePath(dir, fileName) {
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  let target = resolveInside(dir, fileName);
  let serial = 1;
  while (fs.existsSync(target)) {
    serial += 1;
    target = resolveInside(dir, `${stem}_${serial}${ext}`);
  }
  return target;
}

const hookedSessions = new WeakSet();

/**
 * 给 webview 的 session 挂 will-download 拦截。
 * @param {Electron.Session} targetSession
 * @param {object} opts
 *   getTargetDir(): 返回入库目录（监控目录），为空则放行走默认另存为
 *   onDone(info): 下载/复核完成回调 { ok, state, reason, unitName, originalName, savedPath }
 *   logger, accept(unitName): 可选，按授权单位过滤（返回 false 则丢弃入库）
 */
function installDownloadInterception(targetSession, opts = {}) {
  if (!targetSession || hookedSessions.has(targetSession)) return;
  hookedSessions.add(targetSession);
  const { getTargetDir, onDone, logger, accept } = opts;

  targetSession.on('will-download', (_event, item) => {
    try {
      const url = item.getURL();
      const filename = item.getFilename() || 'download.bin';
      if (!isEducationFundingReportDownload(url, filename)) return; // 非基表，走默认下载

      const dir = typeof getTargetDir === 'function' ? getTargetDir() : null;
      if (!dir) { logger?.warn?.('无入库目录，基表下载走默认行为'); return; }
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }

      // setSavePath 必须同步调用，否则 Electron 会先弹另存为对话框
      const safe = sanitizeFileName(filename);
      const tmpName = /\.(xls|xlsx)$/i.test(safe) ? safe : `${safe}.xlsx`;
      const tmpPath = uniquePath(dir, tmpName);
      item.setSavePath(tmpPath);

      item.once('done', async (_e, state) => {
        let ok = state === 'completed';
        let reason = '';
        let unitName = '';
        let savedPath = tmpPath;
        if (ok) {
          const check = inspectPrevReport(tmpPath);
          ok = check.ok;
          reason = check.reason || '';
          unitName = check.unitName || '';
          if (ok && typeof accept === 'function') {
            try {
              if (!(await accept(unitName))) {
                ok = false;
                reason = `基表单位「${unitName}」不属于当前授权范围，已舍弃`;
              }
            } catch {
              ok = false;
              reason = '无法校验基表单位授权范围，已舍弃';
            }
          }
          if (ok) {
            const desired = `上年经费年报_${sanitizeFileName(unitName)}.xlsx`;
            try {
              const target = uniquePath(dir, desired);
              fs.renameSync(tmpPath, target);
              savedPath = target;
            } catch (error) {
              logger?.warn?.('基表重命名失败，保留原名', { message: error.message });
            }
          } else {
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
          }
        } else {
          reason = `下载状态：${state}`;
        }
        if (typeof onDone === 'function') {
          onDone({ ok, state, reason, unitName, originalName: filename, savedPath: ok ? savedPath : null });
        }
      });
    } catch (error) {
      logger?.warn?.('基表下载拦截异常', { message: error.message });
    }
  });
}

module.exports = {
  isEducationFundingReportDownload,
  inspectPrevReport,
  installDownloadInterception,
};
