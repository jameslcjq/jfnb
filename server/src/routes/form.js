const express = require('express');
const db = require('../db');
const { validateSubmission } = require('../validation');
const render = require('../render');
const { config } = require('../config');

const router = express.Router();

function selectedSchoolFromRequest(req, year) {
  const code = String(req.body?.fill_code || req.body?.school || '').trim();
  if (!code) return null;
  const school = db.getSchoolByCode(code);
  if (!school || Number(school.year) !== Number(year)) return null;
  // 快照对账停用的学校不再接收提交
  if (Number(school.active) !== 1) return null;
  return school;
}

router.get('/fill', (req, res) => {
  const year = config.collectionYear;
  const schools = db.listSchools(year);
  res.send(render.unifiedFormPage({
    year,
    schools,
  }));
});

router.post('/fill', (req, res) => {
  const year = config.collectionYear;
  const schools = db.listSchools(year);
  const school = selectedSchoolFromRequest(req, year);
  if (!school) {
    return res.status(400).send(render.unifiedFormPage({
      year,
      schools,
      values: req.body || {},
      errors: { fill_code: '请选择本校' },
      formError: '请选择学校后再提交',
    }));
  }

  const result = validateSubmission(req.body || {});
  if (!result.ok) {
    const last = db.getLatestSubmission(school.id);
    return res.status(400).send(render.unifiedFormPage({
      year,
      schools,
      selectedSchool: school,
      values: req.body || {},
      errors: result.errors,
      lastVersion: last ? last.version : 0,
    }));
  }

  const saved = db.insertSubmission({
    schoolId: school.id,
    year: config.collectionYear,
    controls: result.controls,
    meta: result.meta,
  });
  res.send(render.successPage(school, saved.version));
});

module.exports = router;
