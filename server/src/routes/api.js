const express = require('express');
const db = require('../db');
const render = require('../render');
const { requireApiToken } = require('../auth');
const { config } = require('../config');

const router = express.Router();

// 桌面端推送名单（幂等）。先整体校验、单事务写入；
// snapshot=true 时按年度快照对账：本轮未出现的学校自动停用。
router.post('/api/v1/schools/sync', requireApiToken, (req, res) => {
  const body = req.body || {};
  // 采集年度一律以服务端为准（当前年 − 1），忽略客户端传入的 year，避免年度错位产生孤儿名单
  const year = config.collectionYear;
  let result;
  try {
    result = db.syncSchools({ year, schools: body.schools, snapshot: !!body.snapshot });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
  const out = result.schools.map((school) => ({
    unitName: school.unit_name,
    fillCode: school.fill_code,
    url: render.publicUnifiedFillUrl(),
    mergeCenter: school.merge_center,
    isCenter: !!school.is_center,
  }));
  res.json({ ok: true, year, count: out.length, deactivated: result.deactivated, schools: out });
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
