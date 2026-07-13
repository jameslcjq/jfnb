# 经费年报生成工具

Electron 版经费年报批量生成工具，支持监控 Excel 源文件、导入教育事业年报、生成经费年报、预览报表并辅助登录网报平台。

## 环境

- Node.js 20 或更新版本
- Windows 10/11
- 默认数据目录：`D:\laojiu\gzdata`
- 默认安装目录：`D:\laojiu\gznb`

## 常用命令

```bash
npm install
npm start
npm run check
npm test
npm run package
```

## 主要目录

- `src/main.js`：Electron 主进程、IPC、文件导入导出和授权校验。
- `src/renderer.js`：界面交互、报表预览、网报平台辅助操作。
- `src/report-engine.js`：Excel 读取、业务计算、报表写入。
- `src/watcher.js`：监控目录扫描和源文件归档。
- `src/path-safety.js`：落盘路径和文件名安全处理。
- `tests/run-tests.js`：轻量回归测试。

## 注意事项

- 软件不设置本机登录账号和密码；首次打开会先进入设置向导，填写本单位名称、学校类型，并选择有无正式财务报表。
- 网报平台账号密码通过 Windows 安全存储加密后保存在本机，不再明文落盘。
- 软件授权、经办/学校角色和联网/单机部署形态均在主进程强制校验；生产版不接受本地 override。
- 不要把 `node_modules/`、`release/`、数据库、账号文件、授权缓存提交到版本管理。
- `D:\laojiu\gzdata` 中的数据文件属于运行时数据，打包产物不会覆盖已有模板。
- 网报平台 webview 仅允许访问 `moe.edu.cn` 域名，如平台切换域名，需要同步调整白名单。
