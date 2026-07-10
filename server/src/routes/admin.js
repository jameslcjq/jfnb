const express = require('express');
const db = require('../db');
const render = require('../render');
const { isAdmin, safeEqual } = require('../auth');
const { config } = require('../config');

const router = express.Router();

router.get('/admin', (req, res) => {
  if (!isAdmin(req)) return res.send(render.adminLoginPage());

  const year = config.collectionYear;
  const schools = db.listSchools(year);
  const withSub = schools.map((school) => ({ school, submission: db.getLatestSubmission(school.id) }));

  const groupMap = new Map();
  const independents = [];
  for (const item of withSub) {
    const center = item.school.merge_center;
    if (center) {
      if (!groupMap.has(center)) groupMap.set(center, []);
      groupMap.get(center).push(item);
    } else {
      independents.push(item);
    }
  }

  const groups = [...groupMap.entries()].map(([center, members]) => ({
    center,
    // 中心园排最前
    members: members.sort((a, b) => (b.school.is_center - a.school.is_center)
      || a.school.unit_name.localeCompare(b.school.unit_name, 'zh')),
  }));

  const filled = withSub.filter((i) => i.submission).length;
  res.send(render.adminDashboard({
    year,
    groups,
    independents,
    stats: { total: withSub.length, filled },
  }));
});

router.post('/admin/login', (req, res) => {
  const token = String((req.body && req.body.token) || '');
  if (!config.adminToken || !safeEqual(token, config.adminToken)) {
    return res.status(401).send(render.adminLoginPage('令牌错误'));
  }
  res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200`);
  res.redirect(render.publicPath('/admin'));
});

router.get('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0');
  res.redirect(render.publicPath('/admin'));
});

module.exports = router;
