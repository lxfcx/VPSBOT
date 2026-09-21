# SSH 一键部署

作者：lxfcx · TG：@LXFCX6

准备一个指向本服务器的域名，放行 TCP 80/443；这两个端口不要被其他网站占用。脚本自动安装所需组件、生成内部密钥、构建面板、配置 HTTPS 和开机启动，无需手工编辑配置。

## 安装

SSH 中执行一行，按提示输入自己的域名：

```bash
curl -fsSL https://raw.githubusercontent.com/lxfcx/VPSBOT/main/deploy/vps/manage.sh -o vpsbot-install.sh && sudo bash vpsbot-install.sh install && rm -f vpsbot-install.sh
```

也可在 `install` 后面加自己的域名，例如 `install monitor.example.com`，不再询问域名。下载命令全部成功后才会执行安装；成功后删除当前目录的引导脚本。失败会保留脚本用于排错。

安装成功后打开 `https://你的域名`：

- 账号：`admin`
- 密码：`123456`
- 首次登录先修改默认密码（至少 12 个字符），可同时修改账号，再使用新账号密码登录。
- 日后在右上角 **个人信息 → 登录与密码** 修改账号密码。
- 旧安装已有账号时不会覆盖，不会因升级恢复成默认密码。

当前自托管域名会显示独立登录页。ChatGPT 私人演示站仍使用 ChatGPT 登录，不会生成此默认账号。

## 日常命令

```bash
sudo vpsbot update
```

更新前自动备份，保留账号、探针、设置和图片。备份会短暂停止面板；不要删除 `/opt/vpsbot`。如果源码被手工修改，更新会停止，避免覆盖修改。

```bash
sudo vpsbot status
sudo vpsbot logs
sudo vpsbot restart
sudo vpsbot backup
```

分别为状态、日志、重启、备份。日志按 Ctrl+C 退出，不会关闭面板。备份在 `/opt/vpsbot/backups`，含密钥和数据库，下载后妥善保管。

若初次安装被网络/镜像下载问题打断，排除原因后继续：

```bash
sudo vpsbot start
```

此命令要求源码和配置已经准备好。若连管理命令都未安装，请查看原安装错误；重新运行下载的引导脚本不会直接覆盖已有目录。

## 一键卸载面板

**以下命令会删除面板数据库、上传图片、配置、证书和面板目录内的备份，无法撤销。需要的数据请先复制到其他地方。**

```bash
sudo vpsbot uninstall --yes
```

只删除本工具管理的面板容器、项目卷、网络、本地构建镜像、安装目录和管理命令。保留 Docker 本身、共享基础镜像/构建缓存、其他应用与系统日志，不执行全局 prune，也不清空 SSH 历史。

其他服务器的探针独立运行，面板卸载不会远程删除它们。删除面板之前，可在每台被监控服务器执行：

```bash
curl -fsSL https://raw.githubusercontent.com/lxfcx/VPSBOT/main/agent/uninstall.sh -o vpsbot-agent-uninstall.sh && sudo bash vpsbot-agent-uninstall.sh && rm -f vpsbot-agent-uninstall.sh
```

它仅清理该探针的文件和服务，不承诺擦除系统/云厂商审计或历史备份。

## 接入服务器

登录面板 → 添加服务器 → 编辑 → 安装探针 → 复制命令 → 在对应服务器 SSH 执行。面板本机也这样安装一次，就能监控宿主机资源。

## 几个必要说明

- 自动安装支持 Debian/Ubuntu 的 apt 和 CentOS 的 dnf；旧系统仍须满足运行组件条件，详见 [系统兼容说明](VPS_DEPLOYMENT.zh-CN.md)。
- 缺少 curl 时先执行 Debian/Ubuntu：`sudo apt-get update && sudo apt-get install -y curl`；CentOS：`sudo dnf install -y curl`。
- 脚本不自动更改防火墙、删除其他网站或关闭 SELinux；域名解析和云安全组需正确。
- 固定安装路径 `/opt/vpsbot`，Compose 项目名 `vpsbot`。已有同名目录/项目时停止，不自动接管。
- 之前按手动教程安装的面板继续使用原目录的 Compose 命令；本脚本不会把旧数据当成新安装覆盖。默认账号仅在自托管后端没有账号时初始化。
- 已验证本地构建、HTTP 登录改密与脚本模拟分支；未在你的真实 VPS 上执行安装、更新或卸载。
