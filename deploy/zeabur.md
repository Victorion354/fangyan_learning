# 部署到 Zeabur

适合没有服务器、但需要一个固定公网地址的场景。整条链路是：

```text
GitHub 仓库 → Zeabur 拉取仓库并按 Dockerfile 构建
                        ├─ PostgreSQL（留言、账号、举报、审计）
                        ├─ （可选）Redis（多实例限流与 SSE 广播）
                        └─ 自动生成 https://<服务名>.zeabur.app
```

项目根目录已有 `Dockerfile`，Zeabur 会自动识别，不需要改运行命令。

## 0. 前置条件

- GitHub 账号（用来托管代码）
- Zeabur 账号（直接用 GitHub 登录）
- 本机 Node.js >= 22.13（只在推送前跑检查用）

Zeabur 免费计划可以完成整套部署，但资源有额度限制、长期无访问可能冷启动，具体以 [zeabur.com/pricing](https://zeabur.com/pricing) 当前说明为准。

## 1. 把代码推到 GitHub

仓库目前没有远端。先在 GitHub 网页新建一个空仓库（不要勾选 README / .gitignore），然后：

```bash
cd "D:/Dou.Fore design/fangyan-learning"
git status                      # 确认工作区干净
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

推送前确认这些文件没有进仓库（`.gitignore` 已覆盖）：

- `.env`
- `site-info.json`
- `data/community.sqlite`
- `node_modules/`

仓库不含 `node_modules` 约 12 MB，不需要 Git LFS。

## 2. 创建 Zeabur 项目

1. 登录 Zeabur 控制台，点 **创建项目**。
2. 选择区域：面向中国大陆访问建议 **香港**，其次新加坡 / 东京。
3. 项目建好后进入项目页面。

## 3. 先加 PostgreSQL

1. 点 **部署新服务** → **数据库** → **PostgreSQL**。
2. 区域与项目保持一致，等待状态变为 Running。
3. 打开数据库服务的 **变量** 页，确认存在 `POSTGRES_CONNECTION_STRING`。

不要给数据库生成公网域名，应用通过项目内网连接即可。

> 数据必须放 PostgreSQL。Zeabur 的容器文件系统在重启后会重置，用默认 SQLite 会导致留言与账号丢失。

## 4. 部署应用

1. 项目页点 **部署新服务** → **GitHub**。
2. 首次使用需要授权 Zeabur 读取仓库。
3. 选择刚才推送的仓库，Zeabur 检测到 `Dockerfile` 后会按 Docker 方式构建。
4. 点 **部署**，首次构建通常 2–5 分钟。

构建成功后，服务日志里会出现：

```text
一声一味 · 社区服务已启动
社区数据层：PostgreSQL
```

如果日志显示 `SQLite`，说明第 5 步的 `DATABASE_URL` 还没生效，先补变量再重新部署。

## 5. 配置环境变量

打开应用服务 → **变量** → **编辑原始环境变量**（批量模式），粘贴下面这段，把尖括号内容替换成真实值：

```bash
PORT=8787
DB_DRIVER=postgres
DATABASE_URL=${POSTGRES_CONNECTION_STRING}

CLIENT_TOKEN_SECRET=<64 位随机十六进制>
COMMUNITY_ADMIN_TOKEN=<管理员令牌>

TRUST_PROXY=true
PUBLIC_BASE_URL=https://<服务名>.zeabur.app

MAIL_PROVIDER=disabled
MAIL_FROM=no-reply@localhost

# 运营主体信息，拿到真实资料后再填；留空时隐私页显示“上线前补充”
OPERATOR_NAME=
OPERATOR_ADDRESS=
PRIVACY_EMAIL=
PRIVACY_CONTACT_NAME=
COMPLAINT_CONTACT=
SUPERVISOR_CONTACT=
DATA_REGION=
```

生成随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

各项说明：

| 变量 | 作用 | 注意 |
| --- | --- | --- |
| `DATABASE_URL` | 切换到 PostgreSQL 数据层 | 用 `${POSTGRES_CONNECTION_STRING}` 引用，Zeabur 会自动展开成内网连接串 |
| `CLIENT_TOKEN_SECRET` | 匿名会话令牌的 HMAC 密钥 | **必须固定**。更换后所有匿名会话失效，用户会丢失点赞与删除凭证 |
| `COMMUNITY_ADMIN_TOKEN` | 管理员入口令牌 | 只保存在浏览器 `sessionStorage`，别写进代码或截图 |
| `PUBLIC_BASE_URL` | 生成邮件里的验证 / 重置链接 | 生成域名后必须回填，否则邮件链接会指向错误地址 |
| `TRUST_PROXY` | 位于网关后时读取 `X-Forwarded-*` | Zeabur 前面有网关，固定为 `true` |
| `MAIL_PROVIDER` | 邮件通道 | 未配置发件服务前保持 `disabled`，避免出现“以为发了但没发” |
| `OPERATOR_*` 等 | 隐私政策里的运营主体信息 | 留空则隐私页显示“上线前补充”，不会编造内容 |

保存后 Zeabur 会自动重新部署。

## 6. 生成域名并回填端口

1. 应用服务页 → **域名** → **生成域名**，得到 `https://<服务名>.zeabur.app`。
2. 端口按下面规则填：
   - 变量列表里有 Zeabur 自动注入的 `PORT`：填同一个数字，不要自己再加一条 `PORT`。
   - 没有自动注入：保留第 5 步的 `PORT=8787`，域名端口也填 `8787`。
3. 把 `PUBLIC_BASE_URL` 改成刚拿到的完整地址（含 `https://`），等待重新部署完成。

页面打不开且返回 502，基本都是端口不一致：域名端口、`PORT` 变量、容器实际监听必须三者相同。

## 7. 部署后验证

在本机指向线上地址跑一次自检：

```bash
npm run deploy:check:prod -- --base-url https://<服务名>.zeabur.app
```

此时仍会因“邮件未接入、运营主体未填写”报错，这是预期结果，说明自检确实在检查真实配置。

再手工确认：

- `GET /api/health` 返回 `"store":"postgres"`，且 `features.siteInfo` 与预期一致
- 首页、学习页、行动页、方法页、数据页、隐私页、方言详情页都能打开，样式与脚本正常
- 匿名发一条留言 → 立即出现在列表 → 用管理员令牌删除
- `/.env`、`/site-info.json`、`/data/community.sqlite`、`/server.js` 均返回 404
- 管理员令牌能进入「内容管理」，操作后审计日志有记录

## 8. 接入真实邮件（可选）

1. 在 Resend 注册并验证发件域名。
2. 在 Zeabur 变量里改成：

```bash
MAIL_PROVIDER=resend
MAIL_FROM=no-reply@你的域名
MAIL_FROM_NAME=一声一味
MAIL_REPLY_TO=contact@你的域名
RESEND_API_KEY=<Resend API Key>
```

3. 在服务页的 **命令执行** 里跑一次测试：

```bash
npm run mail:test -- you@example.com
```

未验证发件域名时，Resend 会拒绝投递。

## 9. 可选增强

- **Redis**：加一个 Redis 服务，然后在应用变量里写 `REDIS_URL=${REDIS_CONNECTION_STRING}`。单实例时不是必需；多实例或想共享限流计数时再加。
- **对象存储**：默认语音以内联 data URI 存进数据库（单条上限 1.5 MB），功能完整但不适合大量音频。要改成直传，配置 Cloudflare R2 / AWS S3 的 `S3_BUCKET`、`S3_REGION`、`S3_ENDPOINT`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_BASE_URL`、`S3_PUBLIC_ORIGIN`。
- **自定义域名**：在域名页选“自定义域名”，按提示加 CNAME。绑定后记得同步改 `PUBLIC_BASE_URL`。

## 10. 日常发布与回滚

- 发布：`git push` 后 Zeabur 自动构建部署；也可在控制台手动触发。
- 回滚：服务页 → 部署记录 → 选择历史版本回滚。
- 备份：在 PostgreSQL 服务的命令执行里用 `pg_dump` 导出；正式对外前建议配置定期备份。

## 11. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 构建失败在 `npm ci` | `package-lock.json` 与 `package.json` 不同步 | 本机跑 `npm install` 后提交新的 lock 文件 |
| 启动日志显示 SQLite | `DATABASE_URL` 没生效 | 检查变量引用是否为 `${POSTGRES_CONNECTION_STRING}`，确认数据库服务在同一个项目 |
| 502 / 无法访问 | 端口不一致 | 域名端口、`PORT`、实际监听三者统一 |
| 重启后点赞与删除失效 | `CLIENT_TOKEN_SECRET` 每次随机 | 固定该变量 |
| 重启后数据清空 | 用了 SQLite 且没有持久卷 | 切 PostgreSQL，或给 `/app/data` 挂持久卷 |
| 隐私页一直显示“上线前补充” | 未配置运营主体 | 填 `OPERATOR_NAME` / `OPERATOR_ADDRESS` / `PRIVACY_EMAIL` 后重新部署 |
| 大陆访问慢或间歇失败 | `zeabur.app` 走海外线路 | 选香港区域，或绑定自有域名并接 CDN |

## 不使用 GitHub 的替代方式

Zeabur 支持 **本地项目** 直接上传。上传前先排除 `node_modules`、`.env`、`data/community.sqlite`、`site-info.json`，否则包体过大且会把本地数据与密钥带上去。上传方式不方便做版本管理和回滚，长期维护仍建议用 GitHub。
