# 一声一味 · 中国十大方言

一个可运行的方言学习图鉴：十个方言区、词汇翻卡、十句对比、方言辨识小测、主页面乡音社区、数据观察、保护行动、数据与方法，以及每个方言的详细历史、人言乡音、可交互分布地图和使用人口对比。社区支持匿名留言，也支持用户名 + 密码账号、可选邮箱验证与密码找回、关键词先发后审、举报队列、管理员操作审计、数据导出与账号注销；学习进度、收藏和错题只保存在本机浏览器。

## 打开方式

- 直接双击 `index.html`（会跳转到 `方言学习页.html`），或直接打开 `方言学习页.html`。
- 也可以在本目录启动一个静态服务器，例如：

  ```bash
  python -m http.server 8000
  ```

  然后访问 `http://localhost:8000/`。

- 如果需要**实时社区**（留言跨浏览器同步）和**服务端人口数据**，启动自带的零依赖 Node 服务：

  ```bash
  node server.js
  ```

  然后访问 `http://localhost:8787/`。默认端口 `8787`，可用环境变量修改：

  ```bash
  PORT=8788 HOST=127.0.0.1 node server.js
  ```

  如需管理员删除任意留言、处理待审内容和举报，可在启动时设置管理员令牌（不设置则只能凭发布时返回的删除令牌删除，管理接口返回 503）：

  ```bash
  COMMUNITY_ADMIN_TOKEN=请换成随机长字符串 node server.js
  ```

  内容审核默认开启，举报达到 3 条会自动转入待审。需要调整时：

  ```bash
  MODERATION_ENABLED=true REPORT_HIDE_THRESHOLD=3 MODERATION_KEYWORDS=自定义词1,自定义词2 node server.js
  ```

  未启动 Node 服务时，页面会自动回退到本机浏览器存储，功能仍可使用。

详情页地址形如 `fangyan-detail.html?d=guangzhou`，`d` 可取：
`beijing`、`guangzhou`、`shanghai`、`xiamen`、`meizhou`、`changsha`、`nanchang`、`taiyuan`、`huizhou`、`nanning`。
详情页右上角的下拉框可以直接切换方言，无需返回主页。

## 演示数据与三角色

需要快速演示社区治理闭环时，可以一键写入演示数据：

```bash
npm run demo:seed    # 清空当前社区数据，写入三角色、公开留言、待审与举报样本
npm run demo:reset   # 只清空社区数据
```

`demo:seed` 会写入：

| 角色 | 登录方式 | 用途 |
| --- | --- | --- |
| 游客 | 无需登录 | 匿名留言、点赞、举报 |
| 普通用户 | `xiangyin` / `xiangyin2026` | 登录发帖、查看“我的学习”账号数据、导出与注销 |
| 管理员账号 | `guanli` / `guanli2026` | 演示登录态；管理面板仍需下面的服务端令牌 |

管理员面板还需要在启动服务时设置令牌：

```bash
COMMUNITY_ADMIN_TOKEN=demo-admin-token-2026 node server.js
```

然后在页面「管理员面板」中填入同一个令牌，即可看到待审留言与举报队列。

> `demo:seed` 和 `demo:reset` 都会删除现有留言、账号、登录会话与举报，只适合本机或演示环境。脚本默认读取 `.env`，并与服务端使用同一套 SQLite / PostgreSQL 选择逻辑。

## 页面结构

详情页从上到下依次是：

1. **发展脉络**：每个方言 8 个阶段，用日常语言解释来龙去脉，关键处附“小贴士”。
2. **人言乡音**：只展示许可清晰、可再分发的真人录音，逐条标注作者、许可和来源；没有授权录音的方言显示“暂无授权录音”。
3. **分布与风俗**：天地图在线地图 + 离线示意地图可切换，右侧是对应地区的代表风俗。
4. **使用人口**：当前方言的人口数字、十区排名与占比，以及十个方言区的人口对比图。

详情页顶部新增了「发展脉络 / 人言乡音 / 分布与风俗 / 使用人口」四个快捷入口，滚动时自动高亮当前板块，方便直接跳转。地图缩放范围调整为 2–18 级，可以拉远看全国/周边全貌，也可以放大到更细的街区尺度。

主页末尾是**乡音社区 · 每人一句家乡话**：按方言板块浏览、筛选、留言、上传/录制语音、点赞、接话和删除。启动 Node 服务时跨浏览器同步，否则只保存在本机浏览器。社区已从十个详情页统一收拢到主页，详情页只保留指向主页社区的链接。登录账号后留言会归属账号；未登录仍可匿名发布。留言采用“先发后审”，命中垃圾广告等关键词或举报达到阈值的留言会进入待审队列，由管理员处理。隐私政策见 `privacy.html`。

主页新增**我的学习**：收藏词汇、翻面记录、辨识错题和测验成绩只写入本机 `localStorage`，不上传服务端；登录后同时汇总账号名下的留言与举报，并支持导出或清空本机学习记录。

**数据观察**（`data.html`）用原生 SVG 展示城市青少年熟练度、代表方言代际趋势与活力指数排序，并为每个图表提供可展开的数据表。**保护行动**（`action.html`）包含价值、挑战、三条原则、六条路径、城市案例、政策时间线和一份可勾选的行动清单。**数据与方法**（`methods.html`）集中说明使用人口、占比、样本调查、趋势估算与活力指数的口径、公式和来源。

移动端导航统一由 `assets/nav.js` 注入汉堡按钮并生成抽屉菜单：支持 Esc 关闭、点击外部关闭、焦点锁定和 `aria-expanded` 状态；键盘用户可以通过页首“跳到主要内容”链接跳过导航。所有页面共用 `assets/nav.css` 的焦点样式。

## 文件结构

```
index.html              入口（跳转到方言学习页.html）
方言学习页.html          主页（含“我的学习”与“每人一句家乡话”乡音社区）
fangyan-detail.html     方言详情页（发展脉络、人言乡音、地图、人口）
data.html               数据观察（城市青年、代际趋势、活力指数与关键指标）
action.html             保护行动（价值、挑战、路径、案例、时间线与行动清单）
methods.html            数据与方法（口径、公式、来源与社区数据说明）
privacy.html            隐私政策页（收集范围、保存期限、导出与注销）
server.js               社区服务：静态托管 + 社区 API/SSE + 人口 API
lib/
  accounts.js           scrypt 密码哈希、用户名/邮箱校验、账号与邮箱令牌
  mailer.js             邮件适配层（console / Resend / SendGrid，零依赖 HTTPS API）
  moderation.js         垃圾广告/诈骗等关键词过滤与广告特征检测
  community-store.js    SQLite 数据层（Node 内置 node:sqlite，开发默认）
  postgres-store.js     PostgreSQL 数据层（生产可选）
  store.js              数据层工厂（按环境选择 SQLite / PostgreSQL）
  redis.js              Redis 适配层（跨实例限流 + SSE 广播）
  object-store.js       S3 兼容对象存储适配层（语音预签名直传）
  optional.js           可选依赖加载器（未安装时给出清晰提示）
db/
  migrations/001_init.sql  PostgreSQL 建表脚本（启动时自动执行）
deploy/
  Caddyfile             反向代理 + 静态托管示例
  nginx.conf            Nginx 反向代理示例
scripts/
  init-s3.js            本地对象存储建桶 / 匿名读 / CORS 初始化（Compose 一次性任务）
  demo-data.js          演示数据：seed / reset，预置游客、普通用户、管理员与待审/举报样本
  check.js              静态数据、页面引用、脚本语法与本地资源检查
  version-assets.js     按内容哈希刷新 JS/CSS 版本号
Dockerfile              生产镜像（安装可选依赖）
docker-compose.yml      应用 + PostgreSQL + Redis + RustFS + Caddy
.env.example            部署环境变量模板
assets/
  data/
    dialects.js         方言共享数据：主页、详情页、社区与服务端共用（唯一数据源）
    insight.js          数据观察、保护行动、来源与方法说明的唯一内容源
  config.js             天地图 Key 与接口地址配置
  index.css             入口跳转页样式
  index.js              入口跳转逻辑
  main.css              主页面样式
  main.js               主页面渲染、互动与结构化数据逻辑
  detail.css            详情页样式
  detail.js             详情页地图、音频、人口与结构化数据逻辑
  nav.css               共享导航样式：skip link、焦点样式、移动端抽屉
  nav.js                共享导航逻辑：汉堡按钮、焦点锁定、Esc 关闭
  learn.css             “我的学习”收藏、错题与进度样式
  learn.js              本机学习记录、收藏、错题、导出与账号数据汇总
  community.css         主页面乡音社区样式（含账号栏、管理面板、同意勾选）
  community.js          主页面乡音社区逻辑（本地 / 服务端实时）
  account.js            账号面板：登录、注册、邮箱验证、找回密码、导出数据、注销
  admin.js              管理员面板：待审、举报、公开/隐藏/删除、审计日志与导出
  insight.css           数据观察 / 保护行动 / 数据与方法页样式
  insight.js            原生 SVG 图表、行动清单与来源列表渲染
  privacy.css           隐私政策页样式
  mapdata.js            离线省界 SVG 路径 + 投影参数
  chinageo.js           简化后的省级 GeoJSON，供 Leaflet 在线地图使用
  china.json            省界 GeoJSON 源数据
  audio/
    manifest.js         授权录音清单（标题、转写、许可、来源）
    *.mp3 / *.wav       已下载的授权录音
  *.jpg                 原始配图
  *-800.webp / *-1600.webp  响应式 WebP 配图
data/
  population.json       十个方言区公开人口统计与口径说明
  community.json        旧版社区 JSON（仅首次启动时导入 SQLite，之后不再写入）
  community.sqlite      社区 SQLite 数据库（运行时生成，含留言与点赞）
package.json            脚本入口（默认零运行时依赖，生产可选依赖见 optionalDependencies）
tests/                  node:test 自动化测试（共享数据 + 数据层适配 + 服务端/账号接口）
.github/workflows/ci.yml  Node 22/24 自动检查与测试
```

## 开发与检查

项目默认保持**零运行时依赖**，只要求 Node.js 22.13 及以上（社区数据层使用内置的 `node:sqlite`，该版本起不再需要 `--experimental-sqlite` 开关）。`package.json` 没有 `dependencies`，只有可选的 `optionalDependencies`（`pg` / `redis` / S3 SDK）；不启用生产适配层时不需要 `npm install`。

生产部署（PostgreSQL + Redis + 对象存储）需要先安装这些可选依赖，或直接使用仓库里的 Docker Compose。

```bash
npm start        # 等同于 node server.js
npm run build    # 按内容哈希刷新页面里的 assets/*.js|css 版本号
npm run check    # 检查共享数据、页面引用、外置脚本/样式、本地资源
npm test         # 运行共享数据与服务端接口测试
npm run demo:seed   # 写入演示数据（会清空现有社区数据）
npm run demo:reset  # 清空社区数据
```

`npm run check` 会验证：

- `assets/data/dialects.js` 中十个方言的必填字段、历史阶段、省份、地图范围与风俗数据；
- 主页、详情页、数据观察、保护行动、数据与方法、隐私页是否加载了对应样式与脚本；
- 主页、详情页、社区和服务端是否仍然读取同一份共享数据；
- 页面引用的外置脚本与 `server.js`、`assets/community.js`、`assets/data/dialects.js`、`scripts/demo-data.js` 的语法，以及外置 CSS 的花括号配对；
- 页面是否仍残留可执行内联脚本或内联 `<style>`，避免与严格 CSP 冲突；
- 带 `?v=` 的本地 JS/CSS 版本号是否与文件内容哈希一致；
- 页面里引用的本地 `assets/*` 文件是否真实存在。

修改 `assets/*.js` 或 `assets/*.css` 后，先运行 `npm run build` 更新版本号，再运行 `npm run check`。版本号用于配合一年期 `immutable` 缓存，避免浏览器继续使用旧资源。

`npm test` 使用 Node 内置的 `node:test`，不会修改正式的 `data/community.sqlite`。服务端测试会自动选择一个空闲端口，并把社区数据库写到系统临时目录。服务端支持以下环境变量，便于测试或单独部署时隔离数据：

```bash
PORT=8787
HOST=0.0.0.0
DATA_DIR=./data                 # 数据目录，默认 ./data
COMMUNITY_DB=./data/community.sqlite   # 社区 SQLite 数据库
COMMUNITY_FILE=./data/community.json   # 仅用于首次导入旧数据
POPULATION_FILE=./data/population.json
COMMUNITY_ADMIN_TOKEN=随机长字符串
CLIENT_TOKEN_SECRET=随机长字符串   # 不设置时每个进程随机生成，重启后旧会话失效
CLIENT_TOKEN_TTL_MS=86400000       # 匿名会话有效期，默认 24 小时
USER_SESSION_TTL_MS=2592000000     # 账号登录会话有效期，默认 30 天
REPORT_HIDE_THRESHOLD=3            # 举报达到多少条自动转待审
MODERATION_ENABLED=true            # false 关闭关键词过滤，举报队列仍可用
MODERATION_KEYWORDS=词1,词2        # 追加审核关键词
PUBLIC_BASE_URL=https://example.com # 邮件中验证/重置链接的站点地址
MAIL_PROVIDER=console              # console / resend / sendgrid / disabled
MAIL_FROM=no-reply@example.com
MAIL_FROM_NAME=一声一味
RESEND_API_KEY=                    # 使用 Resend 时填写
SENDGRID_API_KEY=                  # 使用 SendGrid 时填写
EMAIL_VERIFY_TTL_MS=86400000       # 邮箱验证链接有效期，默认 24 小时
EMAIL_RESET_TTL_MS=1800000         # 密码重置链接有效期，默认 30 分钟
AUDIT_EXPORT_LIMIT=5000            # 审计日志单次导出上限
ALLOWED_ORIGINS=http://example.com,https://example.org
PUBLIC_API_ORIGIN=https://api.example.com   # 页面与 API 不同源时用于 CSP
TRUST_PROXY=true                    # 位于 Caddy / Nginx 之后时信任 X-Forwarded-For

# 生产适配层（不配置则使用 SQLite + 内存限流 + 内联语音）
DB_DRIVER=postgres
DATABASE_URL=postgres://user:password@localhost:5432/fangyan
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=https://s3.example.com
S3_PUBLIC_ENDPOINT=https://s3.example.com   # 浏览器可达地址，用于预签名 PUT
S3_REGION=us-east-1
S3_BUCKET=fangyan-audio
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.example.com/fangyan-audio
S3_FORCE_PATH_STYLE=true
UPLOAD_TTL_SECONDS=300
```

`community.json` 只在数据库中还没有导入标记（`meta.community_json_imported`）时读取一次，把旧留言、点赞与删除令牌哈希迁移进数据库；之后所有读写都走当前数据层，JSON 文件不再更新。SQLite 启用 WAL 模式与外键约束；PostgreSQL 启动时会自动执行 `db/migrations/001_init.sql`（幂等）。留言上限由服务端统一裁剪。

`DATABASE_URL` 存在时自动使用 PostgreSQL，也可以用 `DB_DRIVER=postgres` 显式指定。`REDIS_URL` 用于跨实例限流与 SSE 广播；未配置时回退到单实例内存模式。配置 `S3_BUCKET` 后，`POST /api/uploads/sign` 会返回预签名 PUT 地址，浏览器把语音直接上传到对象存储，留言只保存对象键；未配置时继续使用内联 data URI。

邮件默认使用 `MAIL_PROVIDER=console`：验证邮件和重置邮件只会打印到服务端控制台，适合本地开发，不会真实发信。生产环境可切换为 `resend` 或 `sendgrid`，只需填写对应 API Key，不引入额外依赖。邮箱是账号的可选字段；未绑定邮箱的账号仍可正常登录、发帖、导出和注销，但无法使用邮箱验证与自助找回密码。邮件中的链接优先使用 `PUBLIC_BASE_URL` 生成，未设置时按请求 Host 推断。

管理员操作会写入 `audit_logs` 表：登录、修改留言状态、管理员删除留言、处理/忽略举报、导出审计日志。每条记录包含操作者令牌指纹（SHA-256 前 12 位，不保存明文令牌）、IP、User-Agent、目标类型/ID、详情 JSON 与时间。审计日志只记录管理员操作，不记录普通用户发帖、点赞或注销；管理面板的“审计”标签支持按操作类型筛选与 CSV/JSON 导出。

`ALLOWED_ORIGINS` 用逗号分隔允许跨域调用 API 的来源；不设置时只允许同源请求。设置后同源仍然可用。如果直接用 `file://` 打开页面并连接本机服务，浏览器会发送 `Origin: null`，需要显式把 `null` 加入白名单，否则社区会回退到本地模式。

社区写操作使用服务端签发的匿名会话：页面先请求 `POST /api/session`，服务端返回带过期时间的 HMAC 签名令牌与随机客户端 ID，后续通过 `X-Client-Token` 或 `Authorization: Bearer <token>` 提交。读取接口仍兼容旧的 `X-Client-Id`，但发布和点赞不再接受只带客户端 ID 的请求。设置固定的 `CLIENT_TOKEN_SECRET` 后，服务重启不会让已签发令牌立即失效。

测试覆盖健康检查、静态页面、敏感文件屏蔽、路径绕过、安全响应头、CSP、CORS 同源/白名单/拒绝、匿名会话签发/刷新/篡改/过期、发布/删除令牌、管理员删除、点赞去重、发布限流与 `Retry-After`、非法输入、对象存储未配置时的降级行为、人口接口，以及 SQLite 数据层的创建/点赞/删除/裁剪/重开持久化、旧 JSON 导入、旧库缺列升级和数据层/对象存储适配器；账号测试覆盖注册校验、大小写不敏感重名、登录/退出、隐私同意、邮箱验证、忘记密码与重置、账号留言归属与删除、关键词待审、举报去重与阈值、管理员接口、管理员审计日志与 CSV/JSON 导出、数据导出与注销。当前共 56 项测试。仓库还提供 `.github/workflows/ci.yml`，在 Node 22/24 上自动运行 `npm run check` 与 `npm test`。

`server.js` 对所有响应附加基础安全响应头：`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: SAMEORIGIN`、`Permissions-Policy: camera=(), microphone=(self), geolocation=()`。

同时启用了内容安全策略（CSP）：

```text
default-src 'self'; base-uri 'self'; object-src 'none';
frame-ancestors 'self'; form-action 'self';
script-src 'self' https://cdn.jsdelivr.net https://unpkg.com;
script-src-attr 'none';
style-src 'self' https://cdn.jsdelivr.net https://unpkg.com;
style-src-attr 'unsafe-inline';
img-src 'self' data: blob: https://*.tianditu.gov.cn https://cdn.jsdelivr.net https://unpkg.com;
font-src 'self' data:;
media-src 'self' data: blob:;
connect-src 'self' https://*.tianditu.gov.cn;
worker-src 'self' blob:; manifest-src 'self'
```

页面脚本和样式都已拆到 `assets/*.js` / `assets/*.css`，因此 `script-src` 与 `style-src` 不再需要 `'unsafe-inline'`。仍保留 `style-src-attr 'unsafe-inline'`，因为页面和脚本会生成 `style="--c:…"` 这类内联样式属性；`script-src-attr 'none'` 则禁止内联事件处理器。外部脚本、样式、图片和媒体来源已经收窄到本站、Leaflet CDN 与天地图。

HTTPS 部署时还会自动附加 `Strict-Transport-Security` 和 `Cross-Origin-Opener-Policy: same-origin`；HTTP 本地调试不发送这两个头，避免浏览器忽略或误伤。

发布、点赞、删除、注册、登录、举报、邮箱验证、找回密码、导出和注销接口使用限流（发布 20 次/分钟、点赞 120 次/分钟、删除 30 次/分钟、注册 10 次/10 分钟、登录 20 次/10 分钟、举报 30 次/分钟、邮箱验证 20 次/10 分钟、重发验证 5 次/10 分钟、找回密码 5 次/10 分钟、重置密码 10 次/10 分钟、导出 10 次/10 分钟、注销 5 次/10 分钟），超限返回 `429` 并带 `Retry-After`。限流表会定期清理过期记录，但重启服务后会清零，仍不是分布式生产级限流。

## 生产部署（方案 B）

面向公网部署时，推荐把静态资源、API、数据和语音拆开：

```text
用户浏览器
  ├─ 静态资源 → CDN / 对象存储
  └─ /api → Caddy / Nginx 反向代理
               ├─ Node API（server.js）
               ├─ PostgreSQL（留言、点赞、元数据）
               ├─ Redis（限流、SSE 多实例广播）
               └─ 对象存储（音频、图片）
```

仓库提供一套可直接启动的最小栈：

```bash
cp .env.example .env
# 编辑 .env，至少设置 CLIENT_TOKEN_SECRET、POSTGRES_PASSWORD、S3_SECRET_ACCESS_KEY
docker compose up -d --build
```

启动后：

- 页面与静态资源：`http://localhost/`（Caddy 直接托管）
- API：`http://localhost/api/*`（反代到 Node `app:8787`）
- 对象存储控制台：`http://localhost:9001`（本地用 RustFS，登录用 `.env` 里的 `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`）
- PostgreSQL / Redis 只在 Compose 内部网络暴露，不映射到宿主机

组件对应关系：

| 组件 | 开发默认 | 生产方案 | 启用方式 |
| --- | --- | --- | --- |
| 数据层 | SQLite（`node:sqlite`） | PostgreSQL | `DATABASE_URL` 或 `DB_DRIVER=postgres` |
| 限流 / SSE | 进程内内存 | Redis | `REDIS_URL` |
| 语音 | 内联 data URI | S3 兼容对象存储 | `S3_BUCKET` + 凭据 |
| 静态资源 | Node 静态托管 | Caddy / CDN | `deploy/Caddyfile` 或 `deploy/nginx.conf` |

注意事项：

- `db/migrations/001_init.sql` 会在服务启动时自动执行，幂等；也可以手动用 `psql` 执行。
- 本地对象存储使用 **RustFS**（`rustfs/rustfs`）。MinIO 社区版镜像已在 2025 年从 Docker Hub 和 quay.io 下架，`minio/minio` 现在拉取会直接报 `pull access denied`，因此不再使用。生产环境请换成 AWS S3 / Cloudflare R2 / 阿里云 OSS 等正式服务。
- 浏览器直传对象存储需要桶 CORS 允许站点 Origin 的 `PUT`；本地由 `s3-init` 一次性任务（`scripts/init-s3.js`）建桶、开放匿名读取并写入 CORS，允许来源由 `S3_CORS_ORIGINS` 控制，同时 RustFS 侧读取 `RUSTFS_CORS_ALLOWED_ORIGINS`。
- 对象存储公开读地址由 `S3_PUBLIC_BASE_URL` 决定；生产环境建议绑定 CDN 域名，并把该域名加入 CSP（`deploy/Caddyfile` 使用 `S3_PUBLIC_ORIGIN`）。
- 自建对象存储常出现「服务端走内网域名、浏览器走公网域名」的情况：`S3_ENDPOINT` 供服务端读写，`S3_PUBLIC_ENDPOINT` 专门用来生成预签名 PUT 地址。不设置时回退到 `S3_ENDPOINT`。Compose 里 `S3_ENDPOINT=http://rustfs:9000`、`S3_PUBLIC_ENDPOINT=http://localhost:9000`，两者指向同一个 RustFS。
- 如果页面与 API 不同源，设置 `PUBLIC_API_ORIGIN`，否则 CSP 会拦截 `connect-src`。
- 静态文件由 Caddy/Nginx 托管时，反向代理配置里已经补上安全响应头与 CSP；改用 CDN 时需要在 CDN 侧配置同等响应头。
- 删除留言时会同步删除对应语音对象；但超过留言上限被自动裁剪的旧留言，其对象暂不会自动清理，需要后续加定时清理任务。
- Redis 不可用时服务会回退到单实例内存限流；生产环境建议监控 Redis 连接。
- 账号、内容审核、举报、邮箱验证、密码找回、管理审计日志与隐私流程已接入，但仍缺少双因素认证和自动化数据保留任务，**不能直接当作公开上线服务**。

## 性能与 SEO

- 主页十张方言卡片使用 `<picture>` + `srcset`（800w / 1600w）和 `sizes`，高 DPI 屏幕按需选择大图；详情页头图同样使用 800w / 1600w，并补充了宽高以避免布局跳动。
- 详情页对 Leaflet CDN（jsDelivr，备用 unpkg）和天地图瓦片域名做 `preconnect` / `dns-prefetch`，减少地图首次加载的握手等待。
- 静态资源返回 `ETag` 与 `Last-Modified`，支持 `304` 条件请求；带 `?v=` 内容哈希版本号的 JS/CSS 使用一年期 `immutable` 缓存，图片/字体/音频缓存 7 天，HTML 与 JSON 保持 `no-cache` 以便及时更新。版本号由 `npm run build` 生成，`npm run check` 会阻止过期版本号。
- 文本类静态资源（HTML/CSS/JS/JSON/SVG）在浏览器支持时使用 gzip 压缩，并按编码区分 `ETag`；压缩结果带内存缓存，避免重复压缩。较大的 JSON API 响应也会 gzip。
- 主页与详情页补充了 `og:image:alt`、`og:locale`、Twitter Card；详情页会按当前方言更新分享标题、描述和图片。
- 结构化数据由共享方言数据动态生成：主页输出 `ItemList`，详情页输出 `WebPage`，不额外维护一份方言清单。
- 本地 Lighthouse 的 SEO、无障碍与最佳实践三项，在主页和详情页均为 100 分；性能项没有作为自动化门槛，因为天地图与 Leaflet CDN 的加载速度受网络环境影响。
- `sitemap.xml`、`robots.txt` 和固定 `canonical` 需要等实际部署域名确定后再加，避免写死错误地址。

## 方言数据维护

- 方言的名称、颜色、简称、省份、历史时间线、风俗、地图示意范围统一放在 `assets/data/dialects.js`。主页、详情页、乡音社区和 `server.js` 都从这里读取，新增或修改方言时不需要再改四处。
- 主页的词汇 `WORDS`、例句 `SENTENCES`、测验 `QUIZ`、冷知识 `FACTS` 仍保存在 `assets/main.js` 内，因为它们只被主页使用，没有跨页面重复。
- 新增方言时，除数据外还需要准备 `assets/<id>.jpg` 与对应的 `-800.webp` / `-1600.webp` 配图；服务端板块列表会自动跟随 `dialects.js`。

## 地图说明

- **在线地图**：Leaflet 1.9.4 从 CDN 动态加载（jsDelivr，失败自动改用 unpkg），底图使用**天地图**（国家地理信息公共服务平台）的 `vec_w` 矢量底图与 `cva_w` 注记图层，标准地图数据审图号 `GS(2024)0650号`。缩放范围为 2–18 级：2 级可看全国及周边全貌，18 级可放大到街区尺度。
- **配置 Key**：打开 `assets/config.js`，把在 [天地图开发者平台](https://lbs.tianditu.gov.cn/) 申请的**浏览器端 Web Key** 填入 `tiandituKey`：

  ```js
  window.FANGYAN_CONFIG = {
    tiandituKey: '你的浏览器端 Key',
    ...
  };
  ```

  未填写 Key 时，页面**不会加载任何未授权底图**，会直接显示离线示意并给出提示。
- **常见报错**：如果控制台或页面提示 `301007 域名不匹配`，说明 Key 已生效，但当前访问域名不在 Key 的白名单里。注意：天地图控制台**不接受 `localhost`、`127.0.0.1`**，会提示“填写的IP或者域名有误”。本地调试可改用 `http://lvh.me:8787/` 访问（备用：`http://127.0.0.1.nip.io:8787/`），并把 `lvh.me` 加入 [天地图控制台](https://console.tianditu.gov.cn/api/key) 的域名白名单（多个域名用英文逗号分隔），保存后等待几分钟生效。部署到线上后，把实际域名加入白名单即可。`301012` 表示 Key 类型不对，请改用浏览器端 Key；`301013` 表示 Key 无效或已停用。若控制台开启了“安全密钥”，请先关闭，或确认当前页面已按天地图文档完成签名配置。
- **离线示意**：省界来自 DataV GeoJSON 的简化数据，投影后生成 SVG；断网、CDN 不可用、天地图瓦片加载失败或 12 秒内没有任何瓦片加载成功时自动回退，也可以手动切换。
- 方言区范围与核心区为近似示意，**不作为国界或行政区划依据**。在线底图版权归天地图所有，使用时需遵守天地图服务条款并保留署名与审图号。若用于公开发布，还需按标准地图管理规定履行地图审核手续。
- 修改 `assets/china.json` 后，需要重新生成两种地图数据：`assets/mapdata.js`（离线 SVG 路径与投影参数）和 `assets/chinageo.js`（在线地图使用的简化 GeoJSON）。参赛版仓库保留生成后的结果，不再附带开发期的生成脚本；如需重建，可基于 `china.json` 编写投影脚本，页面里的省名高亮依赖 `DET[].provinces` 与 GeoJSON 中的省名完全一致。

## 人口数据说明

- 十个方言区的人口采用同一份口径：中国社会科学院语言研究所等《中国语言地图集》第 2 版（2012），人口数字依据 2004 年《中国行政区划简册》。
- 数据存放在 `data/population.json`，服务端每次请求 `/api/population` 会重新读取该文件，并返回 `checkedAt` 校验时间；页面上的“刷新数据”按钮会重新拉取。
- 数字单位为万人：官话 79858、闽语 7500、吴语 7379、晋语 6305、粤语 5882、赣语 4800、客家话 4220、湘语 3637、平话 778、徽语 330，十区合计 120689 万。
- 图中“闽语*”对应地图集的“闽语大区”，范围大于日常所说的闽南语；“平话”对应“平话和土话区”，范围大于桂南平话；官话是方言大区，不等同于普通话。
- 图表按人口从多到少排列，**连线/条形只用于比较大小，不代表时间趋势**。页面没有编造历年人口曲线，因为目前找不到十个方言区同一口径的可靠时间序列。
- **没有权威的“实时人口”来源**：这里的“实时”指服务端实时读取最新发布的公开统计并显示校验时间，不是 2026 年实时人口。页面会明确标注数据版本与 2004 年人口口径。
- 窄屏会自动切换为横向条形图，避免折线图标签缩得太小。

## 乡音社区说明（主页面）

- 社区入口在主页末尾 `#community`，十个方言详情页不再重复放置社区模块，只保留指向主页社区的链接。
- **有 Node 服务时**：留言默认保存到 `data/community.sqlite`（Node 内置 SQLite）；配置 `DATABASE_URL` 后改用 PostgreSQL。通过 `/api/community` 读写，并用 SSE（`/api/community/stream`）向所有打开的页面推送刷新事件；点赞按匿名会话客户端 ID 去重。发布和点赞要求服务端签发的匿名会话令牌（`POST /api/session` → `X-Client-Token` 或 `Authorization: Bearer`），读取仍兼容 `X-Client-Id`。匿名令牌只区分浏览器会话，不是账号认证；账号登录态使用单独的 `Authorization: Bearer <user session token>`，两者可以同时携带。
- **跨域限制**：API 默认只允许同源请求；需要其他站点调用时，用 `ALLOWED_ORIGINS` 显式配置白名单，预检来自未授权来源会返回 `403`。
- **删除权限**：发布成功时服务端只向发布者返回一次随机删除令牌，浏览器把它保存在 `localStorage`（键名 `fangyan-delete-tokens-v1`）。删除时必须带上该令牌、管理员令牌，或登录发布留言的账号。换设备、换浏览器或清理浏览器数据后，匿名发布者会失去删除令牌；此时只能由设置 `COMMUNITY_ADMIN_TOKEN` 的管理员删除。
- **账号**：用户名 + 密码注册，邮箱为可选字段。密码使用 Node 内置 `crypto.scrypt` 加盐哈希；登录会话令牌只保存 SHA-256 哈希，默认 30 天过期，可服务端吊销。用户名大小写不敏感唯一，允许 2–24 位中文、字母、数字、下划线或短横线；密码 8–72 位。注册和发帖都必须勾选隐私同意。填写邮箱后可发送验证邮件；忘记密码时可通过邮箱重置，重置成功后其他设备上的旧登录会失效。
- **邮箱与找回密码**：注册时填写的邮箱会收到验证链接（默认 24 小时有效）；账号面板可对未验证邮箱重新发送。忘记密码时输入邮箱，服务端只在账号存在时发送重置链接（默认 30 分钟有效），无论邮箱是否存在都返回同样的提示，避免枚举账号。未绑定邮箱的账号暂时无法自助找回密码。
- **内容审核**：`lib/moderation.js` 对垃圾广告、诈骗、色情交易、违禁品等关键词做过滤，并检测多个外链、疑似手机号和重复字符堆砌。命中后留言进入 `pending` 待审队列，不直接公开；管理员可恢复公开、隐藏或删除。设置 `MODERATION_ENABLED=false` 可关闭关键词过滤，`MODERATION_KEYWORDS` 可追加自定义词。
- **举报**：公开留言可举报，同一举报人对同一条留言只能举报一次。未处理举报达到 `REPORT_HIDE_THRESHOLD`（默认 3）时，留言自动转入待审。管理员可在管理面板处理或忽略举报。
- **隐私数据权利**：账号栏提供“导出数据”和“注销账号”。导出为 JSON，不含密码哈希或会话令牌；注销需输入密码，会删除账号、账号名下留言与语音、登录会话和该账号提交的举报。未登录时的匿名留言不与账号绑定，注销不会自动删除。完整说明见 `privacy.html`。
- **管理员面板**：页面上的“内容管理”入口需要 `COMMUNITY_ADMIN_TOKEN`，令牌只保存在 `sessionStorage`，关闭标签页即失效。管理接口使用 `X-Admin-Token`；未配置令牌时返回 `503`。
- **没有 Node 服务时**：自动回退到纯前端本地模式，留言、语音、点赞和回复保存在当前浏览器的 `localStorage`（键名 `fangyan-community-v1`）。
- 语音支持本地上传或浏览器录音，单个文件限制约 1.5MB；浏览器不支持录音时会提示改用上传。
- 配置对象存储后，语音不再塞进数据库：页面先请求 `POST /api/uploads/sign` 拿到预签名 PUT 地址，直传成功后留言只保存对象键，播放地址由 `S3_PUBLIC_BASE_URL` 生成。未配置对象存储时自动回退到内联 data URI。
- 换设备、换浏览器或清理浏览器数据后，本地模式留言会消失；服务端模式的数据保存在 SQLite 或 PostgreSQL 中。账号、审核、举报、邮箱验证、密码找回、管理审计与隐私数据权利已接入，但仍缺少双因素认证和自动保留期清理，**不能直接当作公开上线服务**。

### 账号、审核与举报接口

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | 注册并登录；body 需 `username`、`password`、`consent: true`，可选 `displayName`、`email` | 无 |
| `POST` | `/api/auth/login` | 用户名 + 密码登录 | 无 |
| `POST` | `/api/auth/logout` | 吊销当前登录会话 | 账号 Bearer |
| `GET` | `/api/auth/me` | 当前账号信息 | 账号 Bearer |
| `POST` | `/api/auth/verify-email` | 验证邮箱；body 需 `token` | 无 |
| `POST` | `/api/auth/resend-verification` | 重新发送验证邮件 | 账号 Bearer |
| `POST` | `/api/auth/forgot-password` | 申请密码重置邮件；body 需 `email` | 无 |
| `POST` | `/api/auth/reset-password` | 重置密码；body 需 `token`、`password` | 无 |
| `GET` | `/api/me/export` | 导出账号、本人留言与举报记录 JSON | 账号 Bearer |
| `DELETE` | `/api/account` | 注销账号；body 需 `password` | 账号 Bearer |
| `POST` | `/api/community/:id/report` | 举报公开留言；body 可选 `reason` | 匿名会话令牌 |
| `GET` | `/api/admin/session` | 校验管理员令牌并返回操作者指纹与邮件配置状态 | `X-Admin-Token` |
| `POST` | `/api/admin/session` | 管理员登录并写入审计日志 | `X-Admin-Token` |
| `GET` | `/api/admin/overview` | 用户数、留言数、状态统计、未处理举报数 | `X-Admin-Token` |
| `GET` | `/api/admin/posts?status=pending` | 管理端留言列表，`status` 可为 `visible`/`pending`/`hidden`/`removed`/`all` | `X-Admin-Token` |
| `PATCH` | `/api/admin/posts/:id` | 修改留言状态；body `{ status }` | `X-Admin-Token` |
| `GET` | `/api/admin/reports?status=open` | 举报列表，`status` 可为 `open`/`resolved`/`dismissed`/`all` | `X-Admin-Token` |
| `POST` | `/api/admin/reports/:id` | 处理举报；body `{ action: "resolve" \| "dismiss", hidePost?: true }` | `X-Admin-Token` |
| `GET` | `/api/admin/audit` | 审计日志列表，可按 `action`、`targetType`、`targetId`、`before`、`limit` 筛选 | `X-Admin-Token` |
| `GET` | `/api/admin/audit/export?format=csv` | 导出审计日志，`format` 为 `csv` 或 `json` | `X-Admin-Token` |

留言状态只有四种：`visible`（公开）、`pending`（待审）、`hidden`（隐藏）、`removed`（已移除）。公开列表只返回 `visible`；创建留言命中审核时响应会带 `pending: true` 和提示文本，但不会立即出现在公开列表中。

## 人言乡音与录音说明

- 录音清单在 `assets/audio/manifest.js`，只收录许可清晰、可再分发的真人录音，并在播放器下方标注作者、许可和来源链接。
- 当前已接入：
  - **粤语**：Tatoeba 录音，作者 `cantonesespoken`，许可 CC BY 4.0。
  - **闽南语**：Taigi Speech 真人录音（Guo Yu-Kai），许可 CC BY-SA 4.0；为台湾闽南语（台语），与厦门、泉州口音存在差异。
  - **吴语**：WenetSpeech-Wu 数据集示例，许可 Apache-2.0；该片段没有逐字转写，只用于展示听感。
- 官话、客家话、湘语、赣语、晋语、徽语、平话目前**没有找到许可清晰、可再分发的真人录音**，页面会显示“暂无授权录音”，不会用合成音或未授权音频冒充方言。
- 发音按钮使用浏览器 `speechSynthesis` 的**普通话合成音**，不是方言真实发音；页面已明确标注。

## 数据与素材说明

- 历史叙述为资料性整理，参考《论语》《方言》《中国语言地图集》等公开资料；人口数据以上述地图集口径为准。
- 行政边界来自 DataV GeoJSON（简化版），仅用于示意；**不是标准地图，不作为国界或行政区划依据**。
- 原图为 JPG，页面优先加载 WebP；不支持 WebP 的浏览器回退到 JPG。
- 授权录音的许可与署名信息以 `assets/audio/manifest.js` 为准；再分发时请保留对应署名和许可链接。

## 已知限制

- **部分方言暂无授权录音**：官话、客家话、湘语、赣语、晋语、徽语、平话没有找到许可清晰的真人录音，页面如实留空。
- **天地图需要自行申请 Key**：仓库不包含任何 Key；未配置时只能使用离线示意。在线底图需遵守天地图服务条款，公开发布前请确认 Key 的配额与使用范围。
- **人口不是实时人口**：现有公开统计最晚只到 2012 年出版、2004 年人口口径，没有权威的 2026 年实时数据。
- **社区服务仍是原型级防护**：已有账号、邮箱验证、密码找回、关键词先发后审、举报队列、数据导出、账号注销与管理审计日志；删除支持“发布令牌 + 管理员令牌 + 账号登录态”。但匿名会话令牌可自由申请、举报阈值可被多会话绕过、限流重启即清零，且没有双因素认证和自动数据保留任务，仍不是生产级方案；未设置 `CLIENT_TOKEN_SECRET` 时重启会让旧匿名令牌失效。
- **源码屏蔽只覆盖自带 Node 服务**：`server.js` 会拒绝访问 `server.js`、`README.md`、`*.py`、`data/`、`.git/` 等敏感路径；如果改用 `python -m http.server` 或普通静态托管，这些文件仍可能被直接下载，请不要把项目根目录原样公开到公网。
- **共享数据已收拢**：方言名称、颜色、省份、历史、风俗和地图范围统一在 `assets/data/dialects.js`，主页、详情页、社区和服务端都从这一份数据读取；修改方言信息时只需要改这个文件。
- **注音与用词需要母语者审校**：页面混用粤拼、白话字/台罗及近音标注，部分方言词使用民间借字或近音字写法。
