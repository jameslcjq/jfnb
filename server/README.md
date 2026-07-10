# 经费年报关键数采集服务端

面向**民办学校 / 无报表学校 / 合并填报学校群**的在线关键数采集服务。
学校通过统一填报页选择本校并填写关键数，桌面软件一键拉取后批量生成草稿年报。

技术栈：Node.js + Express + better-sqlite3，无外部服务依赖，单机可跑。

## 目录

```
server/
  src/
    config.js        环境配置
    fields.js        关键数字段定义（表单+校验唯一来源，与桌面端 controls 对应）
    validation.js    提交校验（前后端同一套规则）
    db.js            SQLite 建表与查询
    auth.js          接口令牌 / 管理登录
    render.js        填表页 / 提交成功页 / 管理看板 HTML
    routes/
      form.js        GET/POST /fill  统一学校填表
      api.js         桌面端推送名单 / 拉取提交
      admin.js       /admin 进度看板
    app.js / index.js
  scripts/backup.js  每日备份（VACUUM INTO，保留14天）
  test/
    run-tests.js     校验单元测试（无原生依赖）
    smoke.js         端到端冒烟测试
```

## 快速开始

```bash
cd server
npm install
cp .env.example .env      # 修改 API_TOKEN / ADMIN_TOKEN / PUBLIC_BASE_URL
npm start                 # 监听 PORT（默认 4000）
npm test                  # 校验单测
node test/smoke.js        # 端到端冒烟
```

## 环境变量（.env）

| 变量 | 说明 |
|---|---|
| `PORT` | 监听端口，默认 4000 |
| `PUBLIC_BASE_URL` | 对外 https 地址，用于拼接填表链接，必须是学校能访问到的地址 |
| `API_TOKEN` | 桌面端推送/拉取接口令牌（长随机串） |
| `ADMIN_TOKEN` | 管理看板登录令牌 |
| `DB_PATH` | 数据库路径，默认 `server/data/collect.db` |
| `DEFAULT_YEAR` | 已弃用。采集年度由系统自动按当前年份减 1 计算 |

## 接口契约（供桌面端集成）

鉴权：请求头 `Authorization: Bearer <API_TOKEN>`（或 `x-api-token: <API_TOKEN>`）。

### 1. 推送名单（幂等）

`POST /api/v1/schools/sync`

```json
{
  "year": 2026,
  "schools": [
    { "unitName": "沭阳县中心园", "mergeCenter": "沭阳县中心园", "isCenter": true },
    { "unitName": "沭阳县成员园A", "mergeCenter": "沭阳县中心园", "staffCount": 12 },
    { "unitName": "沭阳县独立民办园", "contact": "138..." }
  ]
}
```

- `mergeCenter` 为 null/缺省 → 独立填报单位；合并组成员填中心园名，中心园自身 `isCenter:true`。
- `staffCount`（可选）：教职工数，来自教育事业年报。填表页据此做「人均年工资」合理性提示
  （人均低于 1.5 万或高于 15 万时在提交确认页给出黄色警示，不阻断提交）。
- 同 `(year, unitName)` 重复推送保留原 `fillCode`，链接不失效，仅更新合并关系/联系人/教职工数。

返回：

```json
{ "ok": true, "year": 2026, "count": 3, "schools": [
  {
    "unitName": "沭阳县成员园A",
    "fillCode": "a1b2...",
    "url": "https://.../fill",
    "mergeCenter": "沭阳县中心园",
    "isCenter": false
  }
]}
```

桌面端拿到 `schools[].url` 后统一群发同一个填报链接；学校进入后自行选择本校填写。

### 2. 拉取提交（默认按合并中心园汇总，支持增量）

`GET /api/v1/submissions?year=2026&since=2026-07-01%2000:00:00`

- `since` 可选，按 `submittedAt`（本地时间字符串）过滤，用于增量同步。
- 默认 `mode=merged`：合并组成员填报后，数值字段自动求和、开关字段自动取“或”，以中心园 `unitName` 返回。
- 如需排查原始成员园明细，可加 `mode=raw`。

返回：

```json
{ "ok": true, "year": 2026, "mode": "merged", "count": 1, "submissions": [
  {
    "unitName": "沭阳县中心园",
    "mergeCenter": "沭阳县中心园",
    "isCenter": true,
    "aggregated": true,
    "memberCount": 2,
    "submittedMemberCount": 1,
    "sourceUnitNames": ["沭阳县成员园A"],
    "version": 2,
    "submittedAt": "2026-07-09 10:20:31",
    "filler": { "name": "李四", "phone": "138..." },
    "note": "",
    "controls": {
      "tuitionIncome": 130000, "fiscalSubsidy": 0, "otherIncome": 0,
      "wageTotal": 80000, "capitalExpense": 5000,
      "netBalance": 5000,
      "hasHeating": false,
      "hasRent": false, "rentExpense": 0,
      "hasLoan": false, "interestExpense": 0,
      "hasSponsorInput": false, "sponsorInput": 0,
      "hasSponsorWithdraw": false, "sponsorWithdraw": 0,
      "hasDonation": false, "donationIncome": 0, "donationExpense": 0
    }
  }
]}
```

`controls` 结构与桌面端 `computePrivateDraft(prevYearWb, eduData, controls)` 入参完全一致，
默认可直接透传给中心园。合并组的成员汇总在服务器端完成；`mode=raw` 可取未汇总明细。

- `netBalance`（本年收支结余）：唯一允许为负的金额（结余正、亏空负、持平 0），
  合并汇总时带符号求和。桌面端按「商品服务支出 = 收入 − 关键支出 − 结余」反推，
  避免把学校攒下的结余算成支出。

## 内置合并关系

服务端内置 4 组合并幼儿园关系。名单同步时即使上游未传 `mergeCenter`，也会自动按内置关系写入：

- 沭阳县仰龙湾儿童之家
- 沭阳县怀文幼儿园
- 沭阳县南京路幼儿园
- 沭阳县沭城镇祥和幼儿园

## 年度采集设计

- 采集以 `year` 为边界。学校名单、填报状态、提交数据和汇总结果都按年度保存。
- 填报页和管理看板的采集年度不可手选，系统自动按当前年份减 1 计算：例如 2026 年采集 2025 年数据，2027 年自动采集 2026 年数据。
- 新年度开始时无需人工切换年份，只需要同步新采集年度的学校名单。
- 同一学校同一年度可以重复提交，系统保留版本号，并以最新一次作为拉取和汇总依据。
- 管理看板按年度查看填报进度；历史年度数据不删除，后续可保留查询和备份。
- 合并幼儿园按年度汇总。被合并园填写本校账上数据，服务端自动汇总到对应合并后幼儿园。

## 学校填表页

`GET /fill` —— 统一填报页，填报人通过下拉框选择本校后填写上年度本校数据。

提交后 `version` 递增，系统以最新一次为准；成功页不回显金额明细。

## 管理看板

`GET /admin` —— 用 `ADMIN_TOKEN` 登录。按合并组/独立单位分组显示填报状态，
提供「未填报名单」文本框用于催报。

## 部署建议

- nginx 反向代理 + https（复用现有证书），示例：

  ```nginx
  location /collect/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
  ```

  此时 `PUBLIC_BASE_URL=https://你的域名/collect`。

- 用 pm2 或 systemd 常驻：`pm2 start src/index.js --name gznb-collect`。
- 每日备份：crontab `0 2 * * * cd /path/server && node scripts/backup.js`。

## 安全

- 拉取/推送令牌只配在桌面端，不出现在填表页 HTML 中。
- `fillCode` 16 位随机不可枚举；填表页不泄露任何其他学校信息。
- 全站 https；数据库每日备份。
