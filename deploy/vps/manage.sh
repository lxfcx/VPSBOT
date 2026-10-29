#!/usr/bin/env bash
# VPSBOT_MANAGED_CLI
set -euo pipefail
umask 077
ROOT=/opt/vpsbot
APP="$ROOT/app"
CLI=/usr/local/bin/vpsbot
REPO=https://github.com/lxfcx/VPSBOT.git
PROJECT=vpsbot
ACTION="${1:-help}"
[[ "$ACTION" == help || "$ACTION" == --help ]] && { echo '用法：vpsbot install [域名] | update | start | status | logs | restart | backup | uninstall --yes'; exit 0; }
[[ "$EUID" -eq 0 ]] || { echo "请用 sudo 运行：sudo vpsbot $ACTION"; exit 1; }
command -v flock >/dev/null || { echo '缺少 flock，请先安装 util-linux。'; exit 1; }
exec 9>/run/lock/vpsbot-manager.lock
flock -n 9 || { echo '另一项面板操作正在运行，请稍后再试。'; exit 1; }
compose(){ docker compose --project-name "$PROJECT" --project-directory "$APP/deploy/vps" -f "$APP/deploy/vps/compose.yaml" "$@"; }
managed(){ [[ ! -L "$ROOT" && -f "$ROOT/.managed-vpsbot" && "$(cat "$ROOT/.managed-vpsbot")" == vpsbot ]] || { echo '未找到本命令管理的面板；不会修改手工部署或其他项目。'; exit 1; }; }
wait_panel(){
 local attempt
 for attempt in $(seq 1 60); do
  if compose exec -T panel node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return; fi
  sleep 2
 done
 echo '面板未就绪，请执行 sudo vpsbot logs 检查；数据已保留。'; return 1
}
check_ports(){
 command -v ss >/dev/null || { echo '缺少 ss，请安装 iproute2（Debian/Ubuntu）或 iproute（CentOS）。'; return 1; }
 if [[ -n "$(ss -H -ltn '( sport = :80 or sport = :443 )')" || -n "$(ss -H -lun 'sport = :443')" ]]; then
  echo '80/443 已被占用。请使用空闲的新服务器，或配置现有反向代理；安装已停止，不会关闭其他网站。'
  ss -ltnp '( sport = :80 or sport = :443 )'
  return 1
 fi
}
load_image(){
 local arch image_tmp base
 case "$(uname -m)" in x86_64) arch=amd64;; aarch64|arm64) arch=arm64;; *) echo '预构建镜像仅支持 amd64 / arm64'; return 1;; esac
 image_tmp=$(mktemp -d "$ROOT/.image-XXXXXX")
 base="https://github.com/lxfcx/VPSBOT/releases/latest/download/vpsbot-panel-linux-$arch.tar.gz"
 echo "下载 $arch 预构建面板镜像（无需 npm 或本机编译）…"
 if ! curl --fail --location --retry 3 --connect-timeout 20 "$base" -o "$image_tmp/panel.tar.gz" || ! curl --fail --location --retry 3 --connect-timeout 20 "$base.sha256" -o "$image_tmp/checksum"; then
  rm -rf -- "$image_tmp"
  echo '镜像下载失败或 GitHub 尚未发布镜像。请稍后运行 sudo vpsbot start；不会退回本机编译。'
  return 1
 fi
 local expected actual
 expected=$(awk 'NR==1 {print $1}' "$image_tmp/checksum")
 actual=$(sha256sum "$image_tmp/panel.tar.gz" | awk '{print $1}')
 if [[ ! "$expected" =~ ^[a-f0-9]{64}$ || "$expected" != "$actual" ]]; then
  rm -rf -- "$image_tmp"; echo '镜像校验失败，请重试下载。'; return 1
 fi
 if ! docker load -i "$image_tmp/panel.tar.gz"; then rm -rf -- "$image_tmp"; return 1; fi
 rm -rf -- "$image_tmp"
}
check_https(){
 local host
 host=$(sed -n 's/^DOMAIN=//p' "$APP/deploy/vps/.env" | head -1)
 if curl --fail --silent --show-error --connect-timeout 10 --max-time 20 "https://$host/healthz" >/dev/null; then
  echo "HTTPS 检查通过，请打开：https://$host"
 else
  echo "面板容器已就绪，但 https://$host 尚未通过 HTTPS 检查。请检查 DNS、证书及云安全组；不代表网站安装成功。"
  return 1
 fi
}
backup(){
 local stamp="$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
 mkdir -p "$stamp"
 compose stop panel
 # Always resume the panel if the archive step fails; updates never erase data.
 # /data is node-owned (0700). With cap_drop: ALL, root cannot bypass it.
 if compose run --rm --no-deps --user node --entrypoint tar panel -C /data -czf - . > "$stamp/data.tar.gz"; then
  cp "$APP/deploy/vps/.env" "$stamp/panel.env"
  git -C "$APP" rev-parse HEAD > "$stamp/commit.txt"
  compose start panel
  echo "备份完成：$stamp"
 else
  compose start panel || true
  echo '备份失败，未继续更新。'; return 1
 fi
}
case "$ACTION" in
 install)
  if [[ -e "$ROOT" ]]; then echo "$ROOT 已存在。已安装请使用 sudo vpsbot update；不会覆盖已有目录。"; exit 1; fi
  [[ ! -e "$CLI" && ! -L "$CLI" ]] || { echo "$CLI 已存在，停止以避免覆盖其他文件。"; exit 1; }
  domain="${2:-}"
  if [[ -z "$domain" ]]; then read -r -p '输入面板域名（例如 monitor.example.com，不含 https://）：' domain </dev/tty; fi
  [[ ${#domain} -le 253 && "$domain" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$ ]] || { echo '域名格式不正确。'; exit 1; }
  # Install only prerequisite packages, selected by the existing package manager.
  if command -v apt-get >/dev/null; then apt-get update; apt-get install -y git curl ca-certificates openssl iproute2;
  elif command -v dnf >/dev/null; then dnf -y install git curl ca-certificates openssl iproute;
  else echo '需要 apt-get 或 dnf；旧系统请参阅兼容说明。'; exit 1; fi
  if command -v docker >/dev/null; then
   [[ -z "$(docker ps -aq --filter label=com.docker.compose.project=vpsbot)" && -z "$(docker volume ls -q --filter label=com.docker.compose.project=vpsbot)" ]] || { echo '检测到同名 Docker 项目，请先确认现有部署。'; exit 1; }
  fi
  check_ports
  mkdir -p "$ROOT"
  printf 'vpsbot\n' > "$ROOT/.managed-vpsbot"
  git clone --depth 1 "$REPO" "$APP"
  install -m 755 "$APP/deploy/vps/manage.sh" "$CLI"
  printf 'DOMAIN=%s\nADMIN_TOKEN=%s\n' "$domain" "$(openssl rand -hex 32)" > "$APP/deploy/vps/.env"
  chmod 600 "$APP/deploy/vps/.env"
  bash "$APP/deploy/vps/install-docker.sh"
  bash "$APP/deploy/vps/check-host.sh"
  touch "$ROOT/.runtime-created"
  load_image
  compose up -d --no-build
  wait_panel
  check_https
  echo "面板已启动：https://$domain"
  echo '首次账号：admin  密码：123456；首次登录需修改默认密码。'
  echo '若 HTTPS 尚未就绪，请确认域名指向本机，TCP 80/443 已放行且未被其他网站占用。'
  ;;
 update)
  managed
  [[ -z "$(git -C "$APP" status --porcelain)" ]] || { echo '源码存在本地修改，停止更新以保留改动。'; exit 1; }
  backup
  git -C "$APP" pull --ff-only
  load_image
  compose up -d --no-build
  wait_panel
  check_https
  install -m 755 "$APP/deploy/vps/manage.sh" "$CLI"
  echo '更新完成；账号密码、服务器和图片数据均保留。'
  ;;
 start)
  managed
  bash "$APP/deploy/vps/install-docker.sh"
  bash "$APP/deploy/vps/check-host.sh"
  touch "$ROOT/.runtime-created"
  load_image
  compose up -d --no-build
  wait_panel
  ;;
 status) managed; compose ps ;;
 logs) managed; compose logs --tail=100 -f ;;
 restart) managed; compose restart; wait_panel ;;
 backup) managed; backup ;;
 uninstall)
  managed
  [[ "${2:-}" == --yes ]] || { echo '此命令将删除本面板及其数据库、图片、配置、证书、备份。确认删除请执行：sudo vpsbot uninstall --yes'; exit 1; }
  if [[ -f "$ROOT/.runtime-created" ]]; then
   if command -v docker >/dev/null && [[ -f "$APP/deploy/vps/.env" ]]; then
    compose down --volumes --remove-orphans --rmi local
   else
    echo 'Docker 或配置不可用，不能确认资源已清理；保留目录以便恢复。'; exit 1
   fi
  fi
  # Never prune Docker globally or touch separately installed monitoring agents.
  rm -rf -- "$ROOT"
  if [[ -f "$CLI" ]] && grep -q '^# VPSBOT_MANAGED_CLI$' "$CLI"; then rm -f -- "$CLI"; fi
  rm -f /run/lock/vpsbot-manager.lock
  echo '本面板的容器、项目卷、网络、本地构建镜像、配置、证书、上传、备份和管理命令已清理。'
  echo '保留 Docker、共享基础镜像及系统软件；其他主机的探针需在对应主机卸载。'
  ;;
 *) echo '未知命令。运行 vpsbot help 查看用法。'; exit 1 ;;
esac
