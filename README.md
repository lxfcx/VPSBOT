# 全球VPS联动观察

中文服务器监控应用：React / TypeScript 前端、Cloudflare Workers 后端、D1 数据库，以及仅依赖 Python 标准库的 Linux 探针。

这是独立实现的 **v0.5**，不是 Komari fork，不宣称与 Komari 的全部功能或协议兼容。界面参考用户提供的卡片布局，包含日夜玻璃主题、动态节点地球、三种卡片视图与实时分段进度条。

## 本次更新（v0.5）

- 点击地球节点或国旗直接打开实时详情，同位置节点可选择；详情展示 CPU、内存、磁盘、负载、上传下载，并每 10 秒刷新历史。
- 总览与详情新增三网线路面板：电信 / 联通 / 移动独立配色、5 / 10 分钟窗口、悬浮取值、曲线显隐、最新 TCP 延迟、相邻成功采样抖动、最低 / 最高 / 均值、最近 20 次 TCP 连接失败率。超时和心跳缺口不连线，更换测点不会混入旧目标采样。
- 编辑服务器中的“三网线路测量”可配置三家运营商的授权目标域名或 IP、端口和地区备注；空配置不测量、不模拟曲线。配置随成功上报响应下发到该节点，下轮测量，无需开放额外入站端口。
- 已安装旧版本的探针需更新到本版才支持面板下发目标。目标的运营商身份由管理员核验。本版方向为“被监控服务器 → 所配置目标”，不等于国内三网测点到服务器的反向测量，不提供 ICMP 丢包、MTR 或路由跳数。

## 前次更新（v0.4）

- 独立分段进度条修复绿色容器导致的满格错觉，每格支持真实比例填充；CPU、内存、磁盘、负载、周期流量、上传下载统一分段。延迟与失败率显示最近 20 条实际探测状态，没有历史时不虚构样本。
- 动态双光尾沿线路持续流动，暂停地球旋转不暂停流动；球体遮挡背面线路，仅球体轮廓外的高空弧线可见。
- 手机改为底部导航、全宽卡片，桌面保留侧栏；全站功能图标语义配色，日夜模式分别调整对比度。
- 个人设置新增平台名称、浏览器标题、总览标题、副标题与六个页面名称，服务端持久化；Telegram 使用自定义平台名称。
- 移除卡片底部安装按钮，安装入口保留在编辑弹窗中。

## 前次更新（v0.3）

- 地球支持 70%–300% 缩放、全屏、拖动、键盘操作、任意地点选点、经纬度与最近节点；右侧节点列表独立滚动、搜索、聚焦线路，直接打开详情、编辑、部署。地理距离不是延迟，逻辑弧线不是 traceroute。
- 总览新增在线集群流量曲线、CPU / 内存 / 磁盘排行、续期与待接入清单。失联节点不计入实时聚合速率。
- 每节点上传 / 下载增加进度带和真实历史曲线。进度带表示相对当前观测窗口峰值，不代表网卡带宽占用百分比；带宽总容量未配置时不猜测。无采样不生成随机曲线。真实指标默认每 10 秒更新。
- 修复日间筛选栏强制深色覆盖；两种主题均使用透明玻璃，上传背景透过卡片显示。彩色系统图标、六种币种图标 / 强调色、粗体价格、分级到期色与蓝色在线时长。
- 节点详情、编辑弹窗和地球节点操作可进入安装面板。自托管模式生成单次、15 分钟有效的安装命令；生成不会撤销现有探针，实际兑换时才轮换凭证。兑换后的首个有效心跳确认接入。命令不含长期 Agent Token。

## 已有能力（v0.2）

- 真实经纬度地球、Natural Earth 地理底图、节点国旗、动态弧线汇聚至所选主机；拖动、暂停、居中、全屏。无坐标节点明确等待定位；连线是逻辑拓扑，不是实测路由。
- 总览聚合集群健康与地域分布；服务器页提供大卡片、紧凑卡片、可展开列表，支持手动排序。
- 日间 / 夜间 / 跟随系统主题，头像与背景上传、替换、删除和透明度，资料与外观持久保存。图片使用私有 R2 存储，仅允许 PNG、JPEG、WebP。
- 本地 SVG 国旗和系统图标，中文地区、系统运行时长、监测累计在线时间。
- 免费 / 周期付费 / 一次付费，永久有效 / 指定到期 / 待确认，限量 / 无限 / 待确认流量，周期用量人工补录、续期记账、历史记录。提供商识别不等于套餐识别：Oracle 可能是付费实例，永久免费与无限流量必须依据合同确认。
- 每卡实时规则健康说明与可选 AI 定时说明；自动 AI 每次巡检最多处理 3 个到期节点，默认每节点至少间隔 300 秒。
- 阈值变红，资源 100% 绕过持续等待立即记录告警；从已触发告警升级为满载再通知一次。TG 以图标分段排版包含事件时指标快照、操作系统、流量、账单及健康说明。
- 自托管账号 / 密码登录、修改密码、撤销旧会话、登录限速；密码使用带随机盐的 PBKDF2-SHA256 100,000 次，Secure / HttpOnly / SameSite Cookie。托管预览仍由 ChatGPT 账号管理登录。
- 事件、账单与操作记录独立滚动、分页，展开历史事件查看当时健康快照。

## 已实现

- 总览、服务器管理、拖动 / 键盘按钮排序、搜索、网络类型筛选、维护模式、标签、备注。
- CPU、内存、Swap、根磁盘、各挂载盘、负载、网络收发速率与总流量、TCP / UDP 数量、启动时间、系统版本、内核、架构、启动标识采样。
- Google / Cloudflare / Apple TCP 连接探测，最近 20 次连接失败率。**不是 ICMP ping 丢包率**；TCP 延迟包括 DNS 解析时间。
- 默认 10 秒上报 / 刷新、最近 360 个 CPU 历史点、D1 持久化、默认 7 天采样保留 / 90 天事件保留。
- 月流量周期、UTC 重置日、配额、到期日期、月 / 季 / 半年 / 年付、USD / CNY / GBP / EUR / USDT / USDC。各币种独立统计，未假装换算实时汇率。
- 阈值、持续超限、防抖、恢复回差、离线、到期、重启、告警 / 恢复事件与 TG 发送重试。
- 可配置 OpenAI 中文异常分析；无密钥时明确退回规则摘要。AI 只读，不自动执行 Shell 或修复命令。
- IPinfo 来源 IP / ASN 查询、常见运营商中文映射、中文国家名称、识别证据与人工修正。**ASN 不能证明家宽、伪家宽或广播 IP**，无证据时显示待核验，不让模型编造确定结论。
- 安装、更新、修改配置、备注、卸载脚本；每节点独立 Token、哈希存储、Token 轮换与撤销。
- 自托管 Cloudflare Cron 每分钟巡检，浏览器关闭或某节点离线时仍运行。

## 部署状态与边界

私人 Sites 预览需要 ChatGPT 登录，用于查看 UI、保存自己的服务器配置。默认显示明确标注的演示数据，不会把演示数值当成真实监控。该私人地址不能供普通无人值守探针直接上报。

正式部署请使用下面的自托管 Worker。API 和探针代码已经实现，但发布到你的 Cloudflare 账户、真实服务器安装、AI/TG/IPinfo 联调需要你对应的账户配置，当前不宣称已经完成。

尚不包含 Komari 的 Web SSH 终端、主题 / 插件市场、Komari 数据迁移、Windows/macOS 探针、集群高可用、付费 IP 情报的全量家宽识别、任何服务器的全自动修复。这些不是按钮占位，而是明确未实现的独立能力。

当前使用 Worker + D1；不是传统 VPS 上的 Docker 后端。高频海量节点使用前应评估 D1 写入量及 Worker 成本。历史采样从安装接入时开始；首个报告将流量计数作为基线，不伪造本周期此前的用量。默认统计除 lo 以外的全部接口，虚拟网卡可能重复计数，生产中请按实际网络调整接口白名单。

## 自托管到 Cloudflare

需要 Node.js 24、pnpm、Cloudflare 账户与可用的 D1 / Workers / R2。依赖版本固定在 lockfile。

```bash
corepack enable
pnpm install --frozen-lockfile
node scripts/package-agent.mjs
pnpm build
pnpm exec wrangler login
pnpm exec wrangler d1 create prism-monitor
pnpm exec wrangler r2 bucket create prism-files
```

复制创建命令返回的数据库 UUID：

```bash
node scripts/prepare-selfhost.mjs YOUR_D1_DATABASE_UUID
pnpm exec wrangler d1 migrations apply prism-monitor --remote --config deploy/wrangler.json
pnpm exec wrangler secret put ADMIN_TOKEN --config deploy/wrangler.json
pnpm exec wrangler secret put CRON_TOKEN --config deploy/wrangler.json
pnpm exec wrangler deploy --config deploy/wrangler.json
```

两项 Token 应分别生成独立的至少 32 随机字节字符串（例如 `openssl rand -hex 32`），不要写入 Git。`AUTH_MODE=token` 已在自托管配置中设置。入口会丢弃所有平台身份 Header；即使访客伪造 Header 也不能获得后台权限。管理 API 接受管理员 Bearer Token 或已登录账号的 Cookie 会话；上报 API 仅接受对应的探针 Token。

打开部署后的 HTTPS 地址，点击右上角头像，在“个人资料与登录 → 恢复管理访问”中验证 `ADMIN_TOKEN`，设置用户名与至少 12 字符的密码，然后使用密码登录。修改密码会注销全部旧会话。管理员 Token 只放在当前浏览器标签页的 sessionStorage；关闭标签页清除，不作为服务器业务数据持久化。密码登录会话默认 7 天，退出可立即撤销。请妥善保管部署用 Token，它仍具有管理员访问权限。

切换“实时监控”，添加节点并复制一次性探针 Token。配置 AI / Telegram 可在设置页面完成，服务端保存后不会将密钥返回前端。数据库中的集成密钥仍属于机密，应限制 D1 访问并使用账户安全措施；当前未实施应用层 KMS 加密。

每次修改源码后重新 `pnpm build` 和 `node scripts/prepare-selfhost.mjs YOUR_D1_DATABASE_UUID`，再部署。数据库结构变更先生成增量迁移；不要修改已应用的迁移。

### Cron

自托管入口 `deploy/worker.mjs` 包含 `scheduled`，配置 `* * * * *` 每分钟执行相同的巡检 / 通知重试逻辑。离线通知时延受“离线阈值 + 最长约 1 分钟调度间隔 + 网络延迟”影响，不承诺瞬时通知。

如运行环境不支持 Cloudflare Cron，可以从**独立**管理主机每分钟运行 `agent/watchdog.py`，通过环境变量 `PRISM_ENDPOINT`、`PRISM_CRON_TOKEN` 提供连接信息。不要把唯一巡检器放在被监控的单台服务器上。

## 安装探针

**面板一键安装：**在自己的公网后端切换到实时模式，进入对应服务器 → 安装探针 → 生成命令 → 复制到目标服务器执行。安装器自动启用 systemd 服务、立即启动并设置开机自启；面板每 3 秒确认本次安装是否收到心跳。安装凭证只能兑换一次、15 分钟失效；重新生成使同节点上一份未使用命令失效。不要转发安装命令。安装失败且已兑换时重新生成，不复用旧命令。

托管 Sites 私人预览不会生成无法供无人值守服务器使用的安装凭证；必须在自托管后端操作。配置预览中的节点不会自动复制到自托管数据库。


Linux、Python 3.9+、systemd 247+。推荐 Debian 12 / Ubuntu 22.04 或更新系统。尚未在多发行版矩阵中实机验证。

在仓库根目录运行，安装时输入节点 Token（隐藏输入，不写入 Shell 命令历史）：

```bash
sudo bash agent/install.sh https://YOUR_MONITOR_DOMAIN
```

也可以从你的正式部署下载单文件安装器，检查后执行：

```bash
curl -fsSL https://YOUR_MONITOR_DOMAIN/agent/install.sh -o prism-install.sh
sudo bash prism-install.sh https://YOUR_MONITOR_DOMAIN
rm -f prism-install.sh
```

自包含安装器由 `scripts/package-agent.mjs` 从当前源码生成，无第三方 Python 包。安装在 `/opt/prism-agent`，配置 `/etc/prism-agent/config.json` 权限 0600；systemd 使用 DynamicUser 与只读保护，通过 LoadCredential 提供配置。默认不写探针日志或本地缓存，不执行远程命令。

修改端点或 Token / 更新程序：

```bash
sudo bash agent/configure.sh https://YOUR_MONITOR_DOMAIN
```

手动修改探测目标：编辑 `/etc/prism-agent/config.json` 的 `targets` 数组，格式为 `{"name":"自定义","host":"example.com","port":443}`，然后 `sudo systemctl restart prism-agent`。最多 10 个目标，失败率为滚动 20 次连接尝试的失败占比。端点必须 HTTPS，不跟随上报重定向，防止 Token 被转发到其他主机。

修改控制端中文备注：

```bash
python3 agent/annotate.py https://YOUR_MONITOR_DOMAIN SERVER_ID '住宅属性已人工核验；续费渠道…'
```

卸载：

```bash
sudo bash agent/uninstall.sh
```

只清理本探针的程序、服务、配置和专属缓存 / 数据目录；不会删除系统 journald、审计日志、备份或第三方日志。卸载不会自动删除控制端历史；在后台删除服务器将撤销 Token 并删除该节点的当前记录、样本、告警、AI 分析与事件；独立操作 / 账单审计仍保留。不能承诺“任何系统零记录”。若下载过安装器，另行删除自己保存的源码 / 安装文件。

## 告警与 AI 配置

1. 保存 CPU / 内存 / 磁盘 / Swap / 流量 / 失败率阈值、延迟、持续超限时间、恢复回差。
2. 使用自己的 Telegram Bot Token 和明确的 Chat ID。先在 Telegram 中启动机器人或加入目标群，保存后点击“发送测试通知”。
3. 按需启用 OpenAI 并填写自己的 API Key / 可用模型名称。模型请求失败不会阻止基本告警，TG 消息将注明 AI 暂不可用。
4. Cloudflare 请求元信息自动识别来源 IP 国家、ASN 和近似坐标；可选填写 IPinfo Token 增强查询。在节点首次上报、IP 变动或坐标缺失时查询。不同 IPinfo 套餐返回字段不同；没有公司类型数据时仍显示“待核验”。
5. 维护模式停止该节点新状态告警；之前排队的事件仍可能发送。Telegram 使用可重试队列，网络不确定时可能重复投递，不承诺严格 exactly-once。

开启集成意味着：服务器名称和指标发送给 OpenAI；源 IP 发给 IPinfo；告警及可选分析发往配置的 Telegram 会话。任何密钥都不要粘贴到聊天或仓库。

## 源码结构

| 路径 | 内容 |
|---|---|
| `app/page.tsx` / `app/globals.css` | 中文监控界面与玻璃主题 |
| `app/api/monitor/[...path]/route.ts` | HTTP API 错误边界 |
| `lib/backend.ts` | 采样、告警、账单、AI 与 TG |
| `lib/accounts.ts` / `lib/profile.ts` / `lib/geo.ts` | 密码会话、私有图片、网络识别 |
| `components/prism` | 地球、图标、卡片和个人设置 |
| `public/maps` / `public/flags` / `public/os` | 本地地图和图标及许可 |
| `lib/model.ts` / `lib/demo.ts` | 数据模型 / 明确标记的示例数据 |
| `db/schema.ts` / `drizzle` | D1 表结构及版本迁移 |
| `agent` | Linux 只读探针、安装与维护脚本 |
| `deploy` | 自托管 Worker 入口与部署模板 |
| `tests/backend.test.mjs` | 实际后端逻辑的 SQLite 集成测试 |
| `.github/workflows/ci.yml` | GitHub CI |

## API

基础路径 `/api/monitor`。管理端要求认证；报告端仅接受单节点 Token。

| 方法 / 路径 | 用途 |
|---|---|
| GET / POST `servers` | 列出 / 创建节点 |
| PATCH / DELETE `servers/:id` | 修改 / 删除节点及关联数据 |
| POST `servers/:id/token` | 轮换探针 Token |
| GET `servers/:id/history` | 最近 360 条历史样本 |
| POST `order` | 保存节点 ID 顺序数组 |
| GET / PUT `settings` | 设置；密钥不返回 |
| GET `events?offset=0` | 每页 100 条状态事件及指标快照 |
| GET `audit?category=billing&offset=0` | 操作 / 账单分页记录 |
| POST `servers/:id/renew` | 记录续期，不执行付款 |
| POST `servers/:id/analyze` | 单节点 AI / 规则说明 |
| GET / PUT `profile` | 个人资料和主题 |
| GET / POST / DELETE `assets/avatar` 或 `assets/background` | 私有图片读取 / 上传 / 删除 |
| GET `auth/status` | 认证模式 |
| POST `auth/setup` / `auth/login` / `auth/password` / `auth/logout` | 自托管密码设置、登录、修改、注销 |
| GET `trends` | 近 20 分钟内每节点最多 60 个真实趋势点，总查询最多 5000 个样本 |
| POST `servers/:id/enrollment` | 生成一次性安装凭证（需管理员认证、自托管模式） |
| GET `servers/:id/enrollment?id=…` | 验证指定安装的兑换与首个心跳 |
| POST `enroll` | 单次兑换安装凭证，无需浏览器登录；轮换长期探针凭证 |
| POST `report` | Agent 上报，默认最短 4 秒间隔 |
| POST `analyze` | AI 或明确标识的规则摘要 |
| POST `telegram-test` | 管理员触发测试通知 |
| POST `sweep` | 当前用户巡检 |
| POST `cron` | 全部用户巡检，仅 CRON_TOKEN |

## 验证

```bash
pnpm exec tsc --noEmit
node --test tests/backend.test.mjs
python3 tests/agent-network.test.py
python3 -m py_compile agent/*.py
bash -n agent/install.sh agent/configure.sh agent/uninstall.sh public/agent/install.sh
pnpm build
```

已执行：生产构建、TypeScript 检查、后端 24 组集成场景及 2 组探针三网测试、自托管 Worker 打包 dry-run、Linux `/proc` 实际读取与 Shell 语法检查。后端测试使用真正的 SQLite 和生产处理函数，外部 Telegram 请求使用 stub，不会实际发送消息。当前环境缺少受支持的浏览器预览服务，因此没有完成浏览器视觉验收；没有实际服务器 / Telegram / AI 密钥，不宣称端到端联调已完成。

## GitHub

项目包含完整源码与 CI。源码目标仓库：[lxfcx/VPSBOT](https://github.com/lxfcx/VPSBOT)。该仓库为公开仓库，仅存放程序源码和示例配置。不要把 `.env`、`.dev.vars`、个人部署配置、`node_modules`、数据库或构建缓存推送到仓库。

参考：[Komari](https://github.com/komari-monitor/komari)、[Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[IPinfo](https://ipinfo.io/developers/ipinfo-api)。未复制 Komari 源码。

## v0.1 升级

应用新增 `drizzle/0001_shallow_thundra.sql`，保留原始迁移。该迁移只新增数据表及带默认值的字段，不重建或清空原服务器表。已有节点按原先的指定到期和限量流量规则兼容。新增 R2 `FILES` 绑定：自托管先创建 `prism-files` 桶，再重新生成部署配置并应用增量迁移。

## v0.2 升级到 v0.3

应用增量迁移 `drizzle/0002_watery_polaris.sql` 新增安装凭证表。重新运行 `node scripts/package-agent.mjs`、构建、生成自托管配置、应用 D1 迁移，然后部署；已有服务器数据保留。无需修改旧迁移或重新安装全部探针。
