# 经费年报关键数采集服务端

面向**民办学校 / 无报表学校 / 合并填报学校群**的在线关键数采集服务。
所有学校通过同一个统一链接填写关键数，桌面软件一键拉取后批量生成草稿年报。

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
    { "unitName": "沭阳县中心园", "schoolCode": "3132...", "stage": "幼儿园", "mergeCenter": "沭阳县中心园", "isCenter": true },
    { "unitName": "沭阳县成员园A", "schoolCode": "3132...", "stage": "幼儿园", "mergeCenter": "沭阳县中心园", "staffCount": 12 },
    { "unitName": "沭阳县独立民办园", "schoolCode": "3132...", "stage": "幼儿园", "contact": "138..." }
  ]
}
```

- `mergeCenter` 语义：**显式提供该字段**（含显式 null=独立填报）以调用方为准，
  内置合并关系只在**未提供**该字段时兜底——桌面端拆组因此能真正生效。
- `staffCount`（可选）：教职工数，来自教育事业年报。填表页据此做「人均年工资」合理性提示
  （人均低于 1.5 万或高于 15 万时在提交确认页给出黄色警示，不阻断提交）。
- 此接口始终执行增量 upsert，不会停用本轮缺席学校；为兼容旧桌面端，即使请求带
  `snapshot: true` 也会被忽略。完整年度快照只能在服务器本地执行 `npm run sync:schools`，
  脚本会先校验名单 `schoolYear` 与采集年度一致，再停用快照中缺席的学校。
- 同 `(year, unitName)` 重复推送保留内部 `fillCode`（仅兼容旧客户端），仅更新合并关系/联系人/教职工数。
- 名单先整体校验、后单事务写入：任一项不合法整批返回 400，不会部分写入。

返回：

```json
{ "ok": true, "year": 2026, "count": 3, "schools": [
  {
    "unitName": "沭阳县成员园A",
    "schoolId": 12,
    "fillCode": "a1b2...",
    "schoolCode": "3132...",
    "stage": "幼儿园",
    "url": "https://.../fill",
    "mergeCenter": "沭阳县中心园",
    "isCenter": false
  }
]}
```

所有 `schools[].url` 都是同一个统一填报地址，可以直接群发。学校打开后自行选择学段和本校。

### 2. 拉取提交（默认按合并中心园汇总，支持增量）

`GET /api/v1/submissions?sinceId=123`

- 增量优先用 `sinceId`：传上次响应中的 `cursor`（提交流水最大 id，单调递增，
  无同秒漏单问题）。`since`（秒级时间字符串）仅作旧版兼容。
- 响应含 `cursor` 字段，保存后用于下次增量拉取。
- 默认 `mode=merged`：合并组成员填报后，数值字段自动求和（按分累加避免浮点误差）、
  开关字段自动取“或”，以中心园 `unitName` 返回。
- 如需排查原始成员园明细，可加 `mode=raw`。
- 已被快照对账停用的学校，其提交不再返回、不再计入汇总。
- 每条提交带 `source`：`web`=网页自填；`desktop`=桌面软件代填/本地填回传。

### 3. 回传提交（桌面软件代填 / 本地填的数据入库）

`POST /api/v1/submissions`（token 鉴权）

```json
{
  "unitName": "沭阳县某小学",
  "filler": { "name": "经办员", "phone": "138..." },
  "note": "本地代填",
  "controls": { "staffCount": 22, "studentCount": 320, "...": "与网页表单同构" }
}
```

- 也支持批量：`{ "submissions": [ {…}, {…} ] }`。
- 与网页提交进**同一台账**：按单位名定位在册学校，用同一套 `validateSubmission`
  按该校 `stage`/`collectScope` 校验，版本号递增，`source` 标记为 `desktop`。
- 单位不在当前年度名单、或未标注采集，则该条失败（`results[].ok=false`）。
- 采集年度以服务端为准（当前年 − 1）。

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
      "schoolStage": "幼儿园",
      "staffCount": 12, "teacherCount": 9,
      "externalLongTermStaffCount": 0, "retiredStaffCount": 0,
      "studentCount": 150,
      "kindergartenStudentCount": 150,
      "preschoolOneYearEndCount": 60, "nurseryEndCount": 0,
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
- 年末人员、学生总数以及当前学校适用的分学段人数均为必填整数。服务端校验教学人员
  不大于在职教职工、分学段学生合计等于学生总数，并校验随班、寄宿、学前一年、托育
  等分项不大于对应学段人数。`schoolStage` 随提交保留，供桌面端正确映射报表。
- **教育事业年报已弃用**——年末人员/学生数改由学校在表单直接填报，桌面端据此填写
  人员情况表年末各行。工资合理性提示（人均年工资区间）也直接使用表单教职工数。

## 内置合并关系

服务端内置 4 组合并幼儿园关系。名单同步时即使上游未传 `mergeCenter`，也会自动按内置关系写入：

- 沭阳县仰龙湾儿童之家
- 沭阳县怀文幼儿园
- 沭阳县南京路幼儿园
- 沭阳县沭城镇祥和幼儿园

## 年度采集设计

- 采集以 `year` 为边界。学校名单、填报状态、提交数据和汇总结果都按年度保存。
- 填报页和管理看板的采集年度不可手选，系统自动按当前年份减 1 计算：例如 2026 年采集 2025 年数据，2027 年自动采集 2026 年数据。
- 新年度开始时无需人工切换年份，但必须准备对应年度的学校信息数据；固定 2025 名单
  不能写入其他年度，年度不一致时 `npm run sync:schools` 会直接失败且不改数据库。
- 同一学校同一年度可以重复提交，系统保留版本号，并以最新一次作为拉取和汇总依据。
- 管理看板按年度查看填报进度；历史年度数据不删除，后续可保留查询和备份。
- 合并幼儿园按年度汇总。被合并园填写本校账上数据，服务端自动汇总到对应合并后幼儿园。

## 标注采集（哪些学校出现在填表页）

- **默认只有合并组学校（中心园+成员园）纳入在线采集**；名单里的其他学校
  （独立民办、公办等）不出现在填表页，也不接收提交。
- 在 `/admin` 看板对任意学校点「采集·全部」或「采集·仅人员」即可纳入；
  「取消采集」移出。名单重同步不会抹掉人工标注。
- **采集范围 scope**：`full`=完整关键数（无报表学校）；`people`=仅人员与学段明细
  （公办有报表学校——财务数走五件套，表单自动隐藏财务分区，只需填人数）。
- 拉取接口每条提交带 `collectScope`，桌面端据此区分：full → 草稿引擎生成；
  people → 「学校状态」页五件套生成时自动使用其人员数。

## 学校填表页

`GET /fill` —— 统一填报页。先选择学段和学校，再动态显示该校适用的分学段字段。
旧版 `GET /fill/:fillCode` 仅保留为兼容跳转，统一跳回 `/fill`。
学校学段为空或不受支持时禁止提交，并提示管理员先维护名单。

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

- 拉取/推送令牌只配在桌面端，不出现在填表页 HTML 中；桌面端强制 https
  （仅 localhost/127.0.0.1 联调允许 http）。
- `/fill` 只列出当前年度已标注采集的学校，使用普通内部编号选择，不向页面下发内部 `fillCode`；取消采集后该校立即从列表移除。
- 填报提交按来源 IP 限制为 15 分钟最多 30 次，降低暴力猜测和批量灌入风险。
- 管理看板 cookie 限定部署路径前缀，https 下自动加 Secure。
- 学校名等同步数据在填表页一律按纯文本渲染，不拼接 HTML。
- 全站 https；数据库每日备份（`BACKUP_DIR` 可配，默认数据库同级 backups/）。
