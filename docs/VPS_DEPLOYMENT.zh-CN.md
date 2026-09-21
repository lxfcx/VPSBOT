# 在一台 VPS 部署全球VPS联动观察

作者：[lxfcx](https://github.com/lxfcx) · 联系 TG：[@LXFCX6](https://t.me/LXFCX6)

本教程对应 v0.6 独立服务器版本。前端、API、SQLite 数据库、头像/背景存储都在自己的 VPS；不需要 Cloudflare Workers、D1、R2 或 Cloudflare Token。原 Cloudflare 部署先放一边。

## 1. 准备

- 一台 Linux VPS：以下安装命令以 **Ubuntu 24.04 LTS** 为例，root 或 sudo 权限；建议 2 核、2GB 内存、10GB 可用磁盘用于构建和数据。小内存机器可在另一台机器构建镜像再传入。
- 一个域名，例如 `monitor.example.com`，A 记录指向面板 VPS 公网 IPv4。有可用 IPv6 才添加 AAAA。先使用直连 DNS，避免代理影响真实来源 IP。
- 云厂商安全组允许 TCP 80、443 和自己的 SSH 端口；UDP 443 可选。3000 和数据库无需对公网开放。本 Compose 仅发布 Caddy 的 80/443。
- 服务器能访问 GitHub、npm、Docker 镜像仓库。需要 TG/AI 时，还需访问 Telegram 和所配置的 AI 服务。
- 现有网站已占用 80/443 时，不要直接启动第二个反代；让已有反代转发至面板，并使用有效 HTTPS。

Caddy 会自动申请/续期证书，前提是域名解析正确、验证端口可达。详见 [Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)。首次登录必须使用 HTTPS，账号 Cookie 带 Secure 属性。

## 2. 安装 Docker 和 Compose

已有 Docker 且 `sudo docker compose version` 正常，可跳过。本段为新 Ubuntu 主机；Debian 请使用 [Docker Debian 安装说明](https://docs.docker.com/engine/install/debian/)，不要照搬 Ubuntu 软件源。以下依据 [Docker 官方 Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/)。

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
```

若提示与已有 docker.io / podman-docker / containerd 冲突，按官方说明处理当前安装，勿盲目卸载承载其他服务的容器环境。Docker 发布端口可能绕过 UFW，入口控制还应在云安全组和 Docker 防火墙规则中确认。

## 3. 下载源码，配置域名与初始化密钥

```bash
git clone https://github.com/lxfcx/VPSBOT.git
cd VPSBOT/deploy/vps
umask 077
printf 'DOMAIN=monitor.example.com\nADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)" > .env
nano .env
```

将 `DOMAIN` 改成自己的域名，**不带 https://、路径或尾部斜线**。`ADMIN_TOKEN` 保留自动生成的 64 位随机字符串，它是面板的管理密钥，不是 Cloudflare Token、GitHub Token 或 TG Bot Token。不要把 `.env` 上传或发给别人；代码已忽略它。

## 4. 构建并启动

在 `VPSBOT/deploy/vps` 目录执行：

```bash
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=100 panel caddy
```

首次构建需下载依赖。正常时 panel 为 healthy，caddy 为 running。浏览器打开 `https://你的域名`。也可以验证：

```bash
curl -fsS https://monitor.example.com/healthz
curl -fsS https://monitor.example.com/api/monitor/auth/status
```

替换示例域名。第一条应返回 `{"ok":true}`，第二条包含 `"mode":"token"`。匿名访问服务器列表返回 401 是正常的访问保护。

数据保存在 Compose 的 `panel_data` 卷；头像/背景在其中的 uploads，数据库为 monitor.sqlite。重建镜像和普通 `down` 不删除数据。**不要执行 `docker compose down -v`，它会删除数据卷。** 面板每分钟运行离线/到期检查，资源超限在每次探针上报时评估。

## 5. 首次登录、设定账号密码

1. 初次打开可能展示明确标注的示例节点。它们不是你的真实服务器。
2. 点设置，找到“自托管管理员登录”，填入 `.env` 内 `ADMIN_TOKEN`，点“验证并登录”。密钥仅存在当前标签页会话。
3. 如仍在演示环境，点“切换实时监控”。
4. 点右上角个人资料，设置登录账号与密码（至少 12 个字符）。记下账号密码。
5. 在个人页退出，重新以账号密码登录；也可关闭标签页后重新打开。以后日常登录用密码即可。ADMIN_TOKEN 仍是管理员密钥，需长期妥善保管。
6. 个人页还可修改平台名、浏览器标题、各栏目标题、头像、背景和日夜主题。

## 6. 接入服务器，面板所在 VPS 也能监控

1. 在实时模式点击“添加服务器”，填写名称与账单/套餐信息并保存。
2. 进入该服务器的 **编辑 → 安装探针**。
3. 点击“生成此节点的一键安装命令”，再点复制。
4. SSH 登录对应服务器，执行完整命令。每个节点使用自己的命令，不能混用。
5. 命令有效 15 分钟且仅可兑换一次。安装完成自动启动 prism-agent 并开机自启，默认每 10 秒上报。
6. 收到心跳后查看 CPU、内存、硬盘、网络与运行时长。采样条随真实数据更新；历史不足时空格表示未采样。

探针支持 Linux + systemd 247+ + Python 3.9+。需要 curl；Ubuntu/Debian 缺少时：

```bash
sudo apt update
sudo apt install -y python3 curl ca-certificates
```

**监控面板本机：** 同样在面板添加一个节点，复制命令，在面板 VPS 的宿主机执行，不是在 Docker 容器内执行，这样统计的是宿主机资源。

检查探针：

```bash
sudo systemctl status prism-agent --no-pager
sudo journalctl -u prism-agent -n 80 --no-pager
```

更新探针：重新在节点编辑页生成安装命令并在原服务器执行。生成命令不会撤销旧探针，兑换时才替换凭证。卸载方式见仓库 `agent/uninstall.sh`，执行前阅读脚本；它移除本程序的服务/配置，不承诺擦除操作系统审计、云厂商记录或历史备份。面板上的节点记录需在编辑中另行删除。

## 7. 国家、运营商、永久免费和无限流量

普通 VPS 没有 Cloudflare 的请求地理元数据。要自动定位，在设置里配置 IPinfo Token；反代会把真实来源 IP 交给后端查询。无定位服务时可在编辑中手动填写国家、地区、运营商与经纬度，关闭“根据探针来源 IP 自动定位”，再保存。不要把默认国家当成真实识别结果。

使用 CDN/其他反向代理时必须重新确认可信 IP 链路，本方案默认直连 Caddy。地理数据库是近似信息，ASN 不能证明真实住宅、伪家宽或原生/广播 IP；请人工核验并备注。免费与无限套餐也应按订单确认：

- 付款类型设“免费”，有效期设“永久有效 / 永不过期”；不是所有 Oracle 节点都免费。
- 流量类型设“无限流量”，不会因额度触发告警。
- 限额套餐填写 GB、重置日和手工补录量。累计流量为采集后估算，账单以提供商为准。

## 8. 三网线路动态曲线

节点编辑中配置电信、联通、移动各自的目标主机、端口和地区，使用你有权限探测且运营商归属经过核验的测点。保存后配置随心跳响应下发，后续出现实际采样曲线。

当前方向是 **被监控服务器 → 三网目标**，测量 TCP 建连时延、波动与失败率。它不是国内三网到服务器的反向测量，也不是 ICMP 丢包/MTR。未配置时明确显示未配置，不用随机数伪造曲线。

## 9. TG 与 AI

设置中填写自己的 TG Bot Token、Chat ID，开启通知后保存并测试。先在 TG 与机器人建立对话或将其加入目标群。CPU/内存/磁盘等阈值支持 80/90%，配合持续超限时间、恢复回差控制抖动；满载立即告警，恢复另发通知，重复事件去重。

AI 设置需填 OpenAI 模型和 API Key；当前使用 OpenAI 官方接口，不支持自定义接口地址。未配置 AI 时显示规则健康说明，不能称为 AI 已检测。TG 和 AI 都需要面板 VPS 能访问相应外部服务。`@LXFCX6` 是作者联系方式，不是通知机器人或 Chat ID。

## 10. 备份、更新和恢复

从 `deploy/vps` 目录执行。以下备份会暂停面板几秒以保证数据库与上传文件一致：

```bash
mkdir -p backups
chmod 700 backups
sudo docker compose stop panel
sudo docker compose run --rm --no-deps --user root --entrypoint tar panel -C /data -czf - . > backups/panel-data.tar.gz
sudo docker compose start panel
chmod 600 backups/panel-data.tar.gz
cp .env backups/panel.env
chmod 600 backups/panel.env
```

确认命令成功和压缩包非空，保存到另一台机器。归档含 API/TG 密钥及账号资料，按敏感备份保管。示例会覆盖同名备份；保留多版本时先改名。

更新前先备份并记下 `git rev-parse HEAD`，然后：

```bash
git pull --ff-only
sudo docker compose up -d --build
sudo docker compose ps
```

启动会自动应用未执行的数据库迁移，已应用的迁移不应修改。需回滚时同时恢复相应版本的代码与备份，避免旧代码使用新数据库结构。

恢复前确认当前目录是正确的部署目录、`backups/panel-data.tar.gz` 是所需备份；先停面板，将现有卷另做备份。恢复会覆盖当前数据库和上传数据：

```bash
sudo docker compose stop panel
sudo docker compose run --rm --no-deps --user root --entrypoint sh panel -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
sudo docker compose run --rm -T --no-deps --user root --entrypoint tar panel -C /data -xzf - < backups/panel-data.tar.gz
sudo docker compose run --rm --no-deps --user root --entrypoint chown panel -R node:node /data
sudo docker compose start panel
```

## 11. 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 域名打不开 / 证书失败 | 确认 A/AAAA、80/443、安全组和现有端口占用，查看 caddy 日志。 |
| 502 | 查看 panel 日志与 healthy 状态；检查 PUBLIC_URL 域名与 ADMIN_TOKEN 长度。 |
| 无法登录 / 401 | 用 HTTPS；确认密码或 ADMIN_TOKEN 正确，非 Cloudflare Token。 |
| 地球没有节点或位置不对 | 配置 IPinfo，或关闭自动定位后手动保存国家、经纬度。 |
| 安装后仍离线 | 检查 systemctl、服务器出站 HTTPS、系统时间、命令是否过期、复制的节点是否正确。 |
| 曲线只有几个格子 | 尚无足够历史；等待实际采样。数据缺口不会补成“正常”。 |
| 所有节点同时失联 | 先检查面板主机网络/磁盘/负载；面板自身宕机时不能由自己发送告警，应另用外部可用性监控。 |
| TG 没消息 | 保存后测试，核对 Bot Token 与 Chat ID、机器人权限和 VPS 对 Telegram 的访问。 |
| 上传后重启丢失 | 确认 panel_data 挂载；不要使用临时容器文件系统或删除卷。 |

## 验证范围

本版独立运行时已覆盖本地 HTTP 集成验证：前端/安装脚本服务、身份隔离、节点创建、真实格式心跳、密码登录、上传和重启持久化。Docker/公网证书/实际 VPS 接入需在你的主机按本教程验收；这里没有代替你在真实服务器执行部署。
