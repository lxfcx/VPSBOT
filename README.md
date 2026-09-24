# 🌐 全球VPS联动观察

一套中文 VPS 监控面板：淡紫色玻璃日夜主题、动态地球、真实资源采样、流量与资产概览、Telegram 事件通知。前端采用 React / TypeScript，自托管后端采用 Node.js + SQLite，Linux 探针仅依赖 Python 标准库。

**🧩 作者：LXFCX** · **📮 Telegram：[@lxfcx6](https://t.me/lxfcx6)** · **📦 [GitHub 仓库](https://github.com/lxfcx/VPSBOT)**

所有安装、更新、卸载和使用说明统一维护在本 README。

## 🧭 快速导航

- [🚀 安装面板](#install)
- [🔄 更新面板](#update)
- [🛠️ 面板管理与备份](#manage)
- [🗑️ 一键卸载面板](#uninstall)
- [📡 探针安装与管理](#agent)
- [🎛️ 功能与配置](#features)
- [🩺 常见问题](#faq)
- [🧑‍💻 开发与验证](#development)
- [📮 联系作者](#contact)

<a id="install"></a>
## 🚀 1. 安装面板

### ✅ 安装前准备

| 项目 | 说明 |
| --- | --- |
| 🖥️ 主机 | 一台可使用 root / sudo 的 Linux VPS |
| 🐧 系统 | 自动安装使用 Debian / Ubuntu 的 apt-get 或 CentOS 系列的 dnf；仍须满足 Docker、Compose 与内核要求，不承诺任意历史版本均兼容 |
| 🌍 域名 | 将面板域名的 DNS 解析指向此服务器；如设置 AAAA，IPv6 也需可达 |
| 🔓 端口 | 默认 Caddy 部署需要 TCP 80/443 空闲且云安全组、防火墙放行 |
| 📂 路径 | 固定安装到 `/opt/vpsbot`；已有同名目录或项目时不会覆盖 |

> 已有 Nginx 或其他程序占用 80/443 时，不要停止现有业务来强行运行默认安装。已有反向代理的部署按自己的端口映射继续管理；本页提供现有 Nginx 部署的更新命令。

### ⚡ SSH 一键安装

在**面板服务器**执行，按提示填写域名（不带 `https://`）：

```bash
curl -fsSL https://raw.githubusercontent.com/lxfcx/VPSBOT/main/deploy/vps/manage.sh -o vpsbot-install.sh && sudo bash vpsbot-install.sh install && rm -f vpsbot-install.sh
```

脚本安装依赖、构建面板、创建持久化数据卷并启动 Caddy。域名和端口验证正常后，Caddy 自动申请与续期 HTTPS 证书。也可在 `install` 后追加自己的域名，跳过询问。

### 🔐 首次访问

打开 `https://你的域名`，首页为公开只读监控，点击右上角登录图标进入后台。

| 项目 | 默认值 |
| --- | --- |
| 👤 账号 | `admin` |
| 🔑 密码 | `123456` |

首次登录需修改默认密码。之后可在**个人信息 → 登录与密码**修改账号和密码；已有账号不会因更新或重启恢复为默认值。

<a id="update"></a>
## 🔄 2. 更新面板

### 🟣 默认一键安装的 Caddy 部署

```bash
sudo vpsbot update
```

更新前自动备份，保留账号、服务器、设置、图片和数据库。备份会短暂停止面板；源码存在本地修改时停止更新，不覆盖改动。

### 🟢 已配置 Nginx 的现有部署

**仅适用于已经存在 `/opt/vpsbot/nginx.override.yaml` 的部署，包括本项目现有的 Nginx + 127.0.0.1:18080 方案。** 该文件保留端口映射、公开地址及反向代理配置。

```bash
cd /opt/vpsbot/app && \
git pull --ff-only && \
docker compose -p vpsbot \
  -f deploy/vps/compose.yaml \
  -f /opt/vpsbot/nginx.override.yaml \
  up -d --build --no-deps panel
```

此命令只重建面板，不启动 Caddy，不占用新的 80/443 端口。它不会自动生成备份；更新前请保存数据卷及部署配置。自定义反代部署不要使用上面的 `sudo vpsbot update`，该管理脚本目前不会自动加载 override 文件。

更新后刷新网页即可。**更新面板不会自动替换其他服务器上的探针**，探针更新命令见下文。

<a id="manage"></a>
## 🛠️ 3. 面板管理与备份

以下 `vpsbot` 命令适用于由一键安装器管理的默认部署：

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| 📊 查看状态 | `sudo vpsbot status` | 查看容器状态 |
| 📜 查看日志 | `sudo vpsbot logs` | 按 Ctrl+C 退出查看，不会关闭服务 |
| ♻️ 重启面板 | `sudo vpsbot restart` | 重启项目服务 |
| 💾 创建备份 | `sudo vpsbot backup` | 数据与配置保存到 `/opt/vpsbot/backups` |
| ▶️ 继续安装 | `sudo vpsbot start` | 源码和配置已准备好、但构建或启动中断时使用 |

备份含数据库和部署密钥，请妥善保管，并复制到其他主机。卸载会删除面板目录内的备份。

现有 Nginx 部署查看状态或日志：

```bash
docker ps --filter name=vpsbot-panel
docker logs --tail=100 vpsbot-panel-1
```

恢复数据时需先停止面板，把备份恢复到原 `/data` 持久化卷，保留部署环境配置和文件所有权，再启动原 Compose 项目。不要在 SQLite 正在写入时直接覆盖数据库。

<a id="uninstall"></a>
## 🗑️ 4. 一键卸载面板

> ⚠️ 此操作不可恢复：删除本面板数据库、上传图片、配置、项目证书和面板目录内的备份。请先将需要保留的数据复制到其他位置。

在**面板服务器**执行：

```bash
sudo vpsbot uninstall --yes
```

适用于安装器管理且带管理标记的项目；不会接管手工部署。清理本项目容器、数据卷、网络、本地构建镜像、安装目录与管理命令，保留 Docker、共享基础镜像、其他应用及系统日志。不执行全局 Docker 清理。

- 📡 其他服务器上的探针不会被远程卸载，需逐台执行下方探针卸载命令。
- 🌐 自行配置的 Nginx 站点和外部证书不由该脚本删除；手工部署需按实际 Compose 文件清理。
- 🧾 不承诺抹除系统审计、Shell 历史、云平台日志或外部备份。

<a id="agent"></a>
## 📡 5. 探针安装 / 管理命令

### ➕ 安装探针

1. 登录后台，添加服务器。
2. 打开该服务器的**编辑 → 安装探针**。
3. 点击**生成此节点的一键安装命令 → 复制完整命令**。
4. 在**对应被监控服务器的 SSH** 中粘贴执行。
5. 服务自动启动并设置开机自启，面板收到心跳后显示真实数据。

每台服务器使用自己生成的命令，不能共用。凭证仅可兑换一次、有效 15 分钟；过期或兑换后安装失败时重新生成。面板所在主机也需要单独安装探针，才能采集宿主机指标。

探针要求 **Python 3.9+、systemd 247+**。安装器检查实际能力，不只按发行版名称判断。仅支持 Linux；旧系统应先满足依赖条件。

### 🔄 更新已安装的探针

在**每台被监控服务器**执行一次，保留配置和凭证，仅更新程序并重启：

```bash
curl -fsSL https://raw.githubusercontent.com/lxfcx/VPSBOT/main/agent/update.sh -o /tmp/vpsbot-agent-update.sh && sudo bash /tmp/vpsbot-agent-update.sh && rm -f /tmp/vpsbot-agent-update.sh
```

⏱️ 新版资源采样、上报及线路探测均以 **3 秒**为目标周期。探测独立执行且不重叠；网络超时、服务器负载或失败退避可能延长实际间隔，页面刷新频率不等于探针已收到新数据。

### 🛠️ 常用管理命令

| 操作 | 命令 |
| --- | --- |
| 📊 查看运行状态 | `sudo systemctl --no-pager --full status prism-agent` |
| ♻️ 重启探针 | `sudo systemctl restart prism-agent` |
| ⏸️ 暂停采集 | `sudo systemctl stop prism-agent` |
| ▶️ 恢复采集 | `sudo systemctl start prism-agent` |
| 🔌 开机自启并启动 | `sudo systemctl enable --now prism-agent` |

📂 程序：`/opt/prism-agent`；配置：`/etc/prism-agent/config.json`。不要公开配置中的凭证。修改面板地址或重新授权，优先在后台生成该节点的新安装命令并执行；仅修改名称、价格、备注、网络类型或线路目标可直接在面板编辑，无需重新安装。

### 🗑️ 一键卸载探针

在**要移除监控的服务器**执行：

```bash
curl -fsSL https://raw.githubusercontent.com/lxfcx/VPSBOT/main/agent/uninstall.sh -o /tmp/vpsbot-agent-uninstall.sh && sudo bash /tmp/vpsbot-agent-uninstall.sh && rm -f /tmp/vpsbot-agent-uninstall.sh
```

清理探针服务、程序、配置和专属缓存目录。面板端的节点和历史不会随之删除；需要时登录后台删除节点或对应记录。系统日志与外部备份不属于探针卸载范围。

<a id="features"></a>
## 🎛️ 6. 功能与配置

| 分类 | 功能说明 |
| --- | --- |
| 🪟 界面 | 日夜玻璃主题、头像与背景、平台名称自定义、手机自适应 |
| 🗂️ 浏览 | 完整 / 小卡 / 迷你 / 列表四种视图；搜索、国家代码筛选、分组与手动排序 |
| 🌐 地球 | 节点定位、动态汇聚线路、缩放、旋转、点击节点查看详情；线路为逻辑拓扑，不是 traceroute |
| 📈 指标 | CPU、内存、磁盘、负载、TCP/UDP、上传下载走势、系统与在线时长 |
| 📦 流量 | 本周期用量、GB/TB 自动换算、配额、无限流量、UTC 重置日与人工校准 |
| 💰 资产 | 套餐总额与币种切换，USD / CNY / GBP / EUR / USDT / USDC；免费、一次性及周期付费 |
| 🔔 通知 | 资源阈值、离线、恢复等独立事件；Telegram 图标排版、持续超限与恢复回差 |
| 🧠 健康 | 无 OpenAI Key 也可执行规则检测；可选 AI 增强说明，不自动执行远程修复命令 |
| 🧾 历史 | 状态事件、操作、账单、指标历史；独立滚动及受权限控制的删除 |

### 📊 数据口径

- **累计流量**：上报的网卡累计计数，受重启和计数器重置影响；达到 1024 GB 自动显示 TB，不等于今日流量。
- **本周期流量**：按账期采样累计；缺失接入前记录时不会编造历史，可用服务商用量校准。探针默认统计非 lo 接口，复杂虚拟网络可能重复计数，需按实际接口配置。
- **今日统计**：UTC 日期内已保留的连续采样差值，不补造缺失历史。
- **上传下载圆点条**：相对采样窗口峰值，走势取真实样本，不代表套餐带宽占用率。
- **资产**：概览为当前填写套餐价格的合计，不是累计付款；统一入口中的资产明细另按平均月份天数估算剩余价值，不代表退款金额。续费提醒支持“1 天后提醒”和“本周期不再提醒”，仅保存于当前浏览器；到期日变更后重新提醒，不影响 Telegram 通知。汇率来自公开参考接口，缺失时标注待换算；USDT/USDC 不强行按 1 美元处理。
- **网络识别**：基于 IP / ASN 与运营商信息，可人工修正；不能仅凭 ASN 证明住宅、原生或广播属性。

### 📬 Telegram 与 AI

在**工作空间设置**填写自己的 Bot Token 和 Chat ID，先在 Telegram 启动机器人或将其加入目标群，再点击**发送测试通知**。CPU、内存、磁盘、流量按设置阈值判断，恢复时发送对应恢复事件；线路高延迟不应当作服务器离线。

OpenAI API Key 为可选项，不配置也能采集、展示、规则告警和推送。启用外部集成后，对应指标、事件或 IP 查询会发送给所配置服务。巡检与通知重试存在调度和网络耗时，不承诺瞬时或绝不重复送达。

三网目标填写自己有权检测且运营商归属明确的域名/IP与 TCP 端口；不清楚时可留空。测量方向是服务器到目标，不是国内三网到节点的反向测量；失败率为 TCP 连接尝试失败率，不是 ICMP 丢包率。

### 👀 前台与后台

前台无需登录，展示只读监控；后台顶部日夜按钮旁可切换前台。公开信息包括节点名称、地区、运营商、系统、指标、价格、到期与近似坐标；不公开 IP、探针凭证、集成密钥、私人备注、探测目标地址及操作记录。修改配置必须登录。

<a id="faq"></a>
## 🩺 7. 常见问题

**❓ 80/443 被占用，域名打不开？**

```bash
sudo ss -ltnp '( sport = :80 or sport = :443 )'
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

若已有 Nginx，使用现有反向代理和独立本地面板端口；不要让 Caddy 与 Nginx 抢同一端口。还需检查 DNS、云安全组、证书和反代目标。

**❓ 面板正常但节点一直没更新？**

在该节点检查 `systemctl status prism-agent`，确认其可访问面板 HTTPS 地址，并更新旧探针。仅更新面板不会升级远端程序。

**❓ `curl` 不存在？**

Debian / Ubuntu：

```bash
sudo apt-get update && sudo apt-get install -y curl
```

使用 dnf 的 CentOS 系列：

```bash
sudo dnf install -y curl
```

**❓ 首次安装中断？**

保留错误输出，先解决下载、端口或环境问题。已生成源码、配置及管理命令时可用 `sudo vpsbot start` 继续；不要删除数据目录后反复重装。

<a id="development"></a>
## 🧑‍💻 8. 开发与验证

推荐 Node.js 24，使用仓库锁定的 pnpm 依赖。VPS 构建产物由 `vps/build.mjs` 生成，生产后端需要持久化 `/data` 和正确的公开 HTTPS 地址。

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build:vps
node --test tests/backend.test.mjs
node --test tests/vps.test.mjs
node scripts/test-fleet-ui.mjs
python3 tests/agent-network.test.py
```

| 目录 | 内容 |
| --- | --- |
| `app` / `components/prism` | 页面、卡片、地球与设置 |
| `lib` | 认证、监控、告警、汇率与集成 |
| `vps` / `deploy/vps` | Node.js 后端、Docker 与 SSH 管理脚本 |
| `agent` | Linux 探针与安装/更新/卸载 |
| `tests` | 后端、界面输出、探针与部署检查 |

仓库仍保留 Cloudflare Workers / D1 部署代码，VPS 用户无需配置 Cloudflare。未实现 Windows/macOS 探针、Web SSH、自动修复及集群高可用。不把单元测试通过视为所有发行版和真实服务端到端验证。第三方资源许可保留在各资源目录。

<a id="contact"></a>
## 📮 联系作者

如需部署帮助、功能定制、问题反馈，请联系作者：

- 👤 Telegram：[@lxfcx6](https://t.me/lxfcx6)
- 🧩 项目作者：**LXFCX**
- 📦 GitHub：[lxfcx/VPSBOT](https://github.com/lxfcx/VPSBOT)
- 🐛 问题反馈：[提交 Issue](https://github.com/lxfcx/VPSBOT/issues)

反馈请附上部署方式、版本、系统、报错与已隐藏敏感信息的截图或日志；不要公开密码、Bot Token、API Key 或探针安装凭证。
