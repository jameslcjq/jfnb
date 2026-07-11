const express = require('express');
const db = require('../db');
const render = require('../render');
const { requireApiToken } = require('../auth');
const { validateSubmission } = require('../validation');
const { config } = require('../config');

const router = express.Router();

// 桌面端推送名单（幂等增量更新）。完整年度名单由服务器本地脚本维护；
// API 只能更新快照中已存在且启用的学校，不能新增、复活或停用学校。
router.post('/api/v1/schools/sync', requireApiToken, (req, res) => {
  const body = req.body || {};
  // 采集年度一律以服务端为准（当前年 − 1），忽略客户端传入的 year，避免年度错位产生孤儿名单
  const year = config.collectionYear;
  let result;
  try {
    result = db.syncSchools({
      year,
      schools: body.schools,
      snapshot: false,
      allowCreate: false,
      allowReactivate: false,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
  if (result.schools.length === 0) {
    return res.status(409).json({
      ok: false,
      message: '推送名单与服务器当前年度固定名单无匹配，请先在服务器执行学校名单同步',
      ignoredCount: result.ignoredUnitNames.length,
      ignoredUnitNames: result.ignoredUnitNames,
    });
  }
  const out = result.schools.map((school) => ({
    unitName: school.unit_name,
    fillCode: school.fill_code,
    schoolCode: school.school_code,
    stage: school.stage || '未分类',
    url: render.publicUnifiedFillUrl(),
    mergeCenter: school.merge_center,
    isCenter: !!school.is_center,
  }));
  res.json({
    ok: true,
    year,
    count: out.length,
    deactivated: result.deactivated,
    ignoredCount: result.ignoredUnitNames.length,
    ignoredUnitNames: result.ignoredUnitNames,
    schools: out,
  });
});

// 桌面端回传提交（代填/本地填的数据入同一台账，等价网页提交，来源标记 desktop）。
// 单条：{ unitName, controls, filler:{name,phone}, note } 或多条：{ submissions:[...] }
router.post('/api/v1/submissions', requireApiToken, (req, res) => {
  const year = config.collectionYear;
  const body = req.body || {};
  const items = Array.isArray(body.submissions) ? body.submissions
    : (body.unitName || body.unit_name ? [body] : []);
  if (items.length === 0) return res.status(400).json({ ok: false, message: '缺少提交数据' });

  const results = [];
  for (const item of items) {
    const unitName = String(item.unitName || item.unit_name || '').trim();
    if (!unitName) { results.push({ unitName, ok: false, message: '缺少单位名称' }); continue; }
    const school = db.getActiveSchoolByName(year, unitName);
    if (!school) { results.push({ unitName, ok: false, message: '该单位不在服务器当前年度名单中' }); continue; }
    if (Number(school.collect_enabled) !== 1) {
      results.push({ unitName, ok: false, message: '该单位未标注采集，请先在看板标注' });
      continue;
    }
    const filler = item.filler || {};
    const raw = {
      ...(item.controls || {}),
      filler_name: item.filler_name || filler.name || item.fillerName || '桌面代填',
      filler_phone: item.filler_phone || filler.phone || item.fillerPhone || '00000000000',
      note: item.note || '',
    };
    const result = validateSubmission(raw, {
      stage: school.stage,
      scope: school.collect_scope === 'people' ? 'people' : 'full',
    });
    if (!result.ok) {
      const firstMsg = Object.values(result.errors)[0] || '数据校验失败';
      results.push({ unitName, ok: false, message: firstMsg, errors: result.errors });
      continue;
    }
    const saved = db.insertSubmission({
      schoolId: school.id, year, controls: result.controls, meta: result.meta, source: 'desktop',
    });
    results.push({ unitName, ok: true, version: saved.version, submissionId: saved.id });
  }

  const okCount = results.filter((r) => r.ok).length;
  res.json({
    ok: okCount > 0, year,
    saved: okCount, failed: results.length - okCount,
    cursor: db.latestSubmissionId(year),
    results,
  });
});

// 桌面端拉取每校最新提交。
// 增量优先用 sinceId（响应里的 cursor，单调递增无同秒漏单）；since（秒级时间）仅兼容旧用法。
router.get('/api/v1/submissions', requireApiToken, (req, res) => {
  // 采集年度以服务端为准（当前年 − 1），忽略客户端传入的 year
  const year = config.collectionYear;
  const since = req.query.since ? String(req.query.since) : null;
  const sinceId = req.query.sinceId ? Number(req.query.sinceId) : null;
  const mode = String(req.query.mode || req.query.view || '').toLowerCase();
  const raw = mode === 'raw' || mode === 'detail' || mode === 'details';
  const submissions = db.listLatestSubmissions(year, since, { raw, sinceId });
  const cursor = db.latestSubmissionId(year);
  res.json({ ok: true, year, since, sinceId, cursor, mode: raw ? 'raw' : 'merged', count: submissions.length, submissions });
});

module.exports = router;
