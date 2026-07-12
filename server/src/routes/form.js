const express = require('express');
const db = require('../db');
const { validateSubmission } = require('../validation');
const render = require('../render');
const { config } = require('../config');

const router = express.Router();

function validCollectSchool(school, year) {
  if (!school || Number(school.year) !== Number(year)) return null;
  if (Number(school.active) !== 1 || Number(school.collect_enabled) !== 1) return null;
  return school;
}

function selectedSchoolFromCode(req, year) {
  const code = String(req.params?.code || '').trim();
  if (!code) return null;
  return validCollectSchool(db.getSchoolByCode(code), year);
}

function selectedSchoolFromBody(req, year) {
  return validCollectSchool(db.getSchoolById(req.body?.school_id), year);
}

function collectableSchools(year) {
  return db.listSchools(year, { collectableOnly: true });
}

function renderUnified(res, { year, school = null, values = {}, errors = {}, status = 200, formError = '' }) {
  const last = school ? db.getLatestSubmission(school.id) : null;
  return res.status(status).send(render.unifiedFormPage({
    year,
    schools: collectableSchools(year),
    selectedSchool: school,
    values,
    errors,
    lastVersion: last ? last.version : 0,
    formError,
  }));
}

router.get('/fill', (_req, res) => renderUnified(res, { year: config.collectionYear }));

router.get('/fill/:code', (req, res) => {
  // 兼容已经发出的旧地址；今后所有学校都使用同一个统一入口。
  // 这里只返回应用内路径，外层 nginx 会自动补上 /collect 前缀。
  return res.redirect(302, '/fill');
});

// 按“学校”而非 IP 计数：乡镇 NAT 下多所学校共用出口 IP，截止日集中填报不应互相误伤；
// 真正要防的是单校被脚本刷。无法定位学校时（缺 school_id）退回按 IP 兜底。
const submitAttempts = new Map();
function submitKey(req, school) {
  if (school?.id != null) return `s:${school.id}`;
  const sid = String(req.body?.school_id || req.params?.code || '').trim();
  if (sid) return `s:${sid}`;
  return `ip:${String(req.ip || req.socket?.remoteAddress || 'unknown')}`;
}
function allowSubmit(req, school) {
  const now = Date.now();
  const key = submitKey(req, school);
  const recent = (submitAttempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 30) return false;
  recent.push(now);
  submitAttempts.set(key, recent);
  if (submitAttempts.size > 20000) {
    for (const [k, times] of submitAttempts) {
      if (!times.some((time) => now - time < 15 * 60 * 1000)) submitAttempts.delete(k);
    }
  }
  return true;
}

function saveSubmission(req, res, school, { unified = false } = {}) {
  if (!allowSubmit(req, school)) return res.status(429).send('该校提交过于频繁，请 15 分钟后重试');
  const year = config.collectionYear;
  if (!school) {
    if (!unified) return res.status(404).send(render.notFoundPage());
    return renderUnified(res, {
      year,
      values: req.body || {},
      errors: { school_id: '请选择本校' },
      status: 400,
      formError: '请选择在册且已标注采集的学校',
    });
  }

  const result = validateSubmission(req.body || {}, {
    stage: school.stage,
    scope: school.collect_scope === 'people' ? 'people' : 'full',
  });
  if (!result.ok) {
    if (unified) {
      return renderUnified(res, {
        year,
        school,
        values: req.body || {},
        errors: result.errors,
        status: 400,
        formError: result.errors.schoolStage || '',
      });
    }
    const last = db.getLatestSubmission(school.id);
    return res.status(400).send(render.schoolFormPage({ year, school, values: req.body || {}, errors: result.errors,
      lastVersion: last ? last.version : 0, formError: result.errors.schoolStage || '' }));
  }

  const saved = db.insertSubmission({
    schoolId: school.id,
    year: config.collectionYear,
    controls: result.controls,
    meta: result.meta,
  });
  return res.send(render.successPage(school, saved.version));
}

router.post('/fill', (req, res) => {
  const year = config.collectionYear;
  return saveSubmission(req, res, selectedSchoolFromBody(req, year), { unified: true });
});

router.post('/fill/:code', (req, res) => {
  const year = config.collectionYear;
  return saveSubmission(req, res, selectedSchoolFromCode(req, year));
});

module.exports = router;
