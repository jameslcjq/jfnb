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
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
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
    // 客户端问题按 4xx 返回，不误报服务器故障；日志只记脱敏元数据，不落原始请求体
    const isParse = err?.type === 'entity.parse.failed';
    const isTooLarge = err?.type === 'entity.too.large';
    const status = isParse ? 400 : (isTooLarge ? 413 : (Number(err?.status) >= 400 && Number(err?.status) < 500 ? Number(err.status) : 500));
    const message = isParse ? '请求内容不是有效格式'
      : (isTooLarge ? '请求内容过大' : (status === 500 ? '服务器内部错误' : '请求不合法'));
    console.error('[server error]', {
      status,
      type: err?.type || err?.name || 'Error',
      message: err?.message,
      path: req.path,
      method: req.method,
    });
    if (req.path.startsWith('/api/')) return res.status(status).json({ ok: false, message });
    return res.status(status).send(message);
  });

  return app;
}

module.exports = { createApp };
