const { createApp } = require('./app');
const { config, warnMissing } = require('./config');

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`经费年报采集服务已启动：http://${config.host}:${config.port}`);
  console.log(`对外基础地址：${config.publicBaseUrl}`);
  console.log(`管理看板：${config.publicBaseUrl}/admin`);
  for (const w of warnMissing()) console.warn(`[警告] ${w}`);
});

function shutdown(signal) {
  console.log(`收到 ${signal}，正在关闭…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
