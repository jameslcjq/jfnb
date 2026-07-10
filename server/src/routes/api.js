const express = require('express');
const db = require('../db');
const render = require('../render');
const { requireApiToken } = require('../auth');
const { config } = require('../config');

const router = express.Router();

// 桌面端推送名单（幂等），返回各校填表码与链接
router.post('/api/v1/schools/sync', requireApiToken, (req, res) => {
  const body = req.body || {};
  // 采集年度一律以服务端为准（当前年 − 1），忽略客户端传入的 year，避免年度错位产生孤儿名单
  const year = config.collectionYear;
  const list = Array.isArray(body.schools) ? body.schools : [];
  if (list.length === 0) return res.json({ ok: false, message: '名单为空' });

  const out = [];
  const seen = new Set();
  for (const item of list) {
    const unitName = String(item.unitName || item.unit_name || '').trim();
    if (!unitName || seen.has(unitName)) continue;
    seen.add(unitName);
    const school = db.upsertSchool({
      year,
      unitName,
      mergeCenter: item.mergeCenter || item.merge_center || null,
      isCenter: !!(item.isCenter || item.is_center),
      contact: item.contact || null,
      staffCount: item.staffCount ?? item.staff_count ?? null,
    });
    out.push({
      unitName: school.unit_name,
      fillCode: school.fill_code,
      url: render.publicUnifiedFillUrl(),
      mergeCenter: school.merge_center,
      isCenter: !!school.is_center,
    });
  }
  res.json({ ok: true, year, count: out.length, schools: out });
});

// 桌面端拉取每校最新提交（支持 since 增量）
router.get('/api/v1/submissions', requireApiToken, (req, res) => {
  // 采集年度以服务端为准（当前年 − 1），忽略客户端传入的 year
  const year = config.collectionYear;
  const since = req.query.since ? String(req.query.since) : null;
  const mode = String(req.query.mode || req.query.view || '').toLowerCase();
  const raw = mode === 'raw' || mode === 'detail' || mode === 'details';
  const submissions = db.listLatestSubmissions(year, since, { raw });
  res.json({ ok: true, year, since, mode: raw ? 'raw' : 'merged', count: submissions.length, submissions });
});

module.exports = router;
