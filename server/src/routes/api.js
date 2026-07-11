const express = require('express');
const db = require('../db');
const render = require('../render');
const { requireApiToken } = require('../auth');
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
