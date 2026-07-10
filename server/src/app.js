const express = require('express');
const { config } = require('./config');
const db = require('./db');
const render = require('./render');
const formRoutes = require('./routes/form');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

function createApp() {
  db.initDatabase();
  render.setPublicBaseUrl(config.publicBaseUrl);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  app.get('/healthz', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use(apiRoutes);
  app.use(adminRoutes);
  app.use(formRoutes);

  app.get('/', (req, res) => res.redirect(render.publicPath('/admin')));

  // JSON 请求返回 JSON 错误，其余返回纯文本
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, message: 'not found' });
    return res.status(404).send(render.notFoundPage());
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[server error]', err);
    if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, message: '服务器内部错误' });
    return res.status(500).send('服务器内部错误');
  });

  return app;
}

module.exports = { createApp };
