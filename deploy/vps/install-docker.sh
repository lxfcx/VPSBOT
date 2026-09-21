#!/usr/bin/env bash
set -euo pipefail
# Install official Docker packages for the detected distro. No distro-version gate.
# Does not remove existing runtimes, change firewall rules or disable SELinux.
[[ "$EUID" -eq 0 ]] || { echo '请使用 sudo bash deploy/vps/install-docker.sh'; exit 1; }
if command -v docker >/dev/null; then
  echo '检测到已有 Docker，保留现有安装。'
  docker info >/dev/null || { echo 'Docker daemon 无法连接，请检查服务状态。'; exit 1; }
  docker compose version || { echo '需要安装 Docker Compose 插件，见部署教程中对应系统的步骤。'; exit 1; }
  docker buildx version || { echo '需要 Docker Buildx 插件。'; exit 1; }
  exit 0
fi
[[ -r /etc/os-release ]] || { echo '无法识别发行版，请手动安装 Docker 与 Compose。'; exit 1; }
. /etc/os-release
case "${ID:-}" in
  debian|ubuntu)
    suite="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
    [[ "$suite" =~ ^[a-z]+$ ]] || { echo '无法确定软件源代号，请按官方说明手动配置。'; exit 1; }
    apt-get update
    apt-get install -y ca-certificates curl git openssl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    cat > /etc/apt/sources.list.d/docker.sources <<REPO
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: $suite
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
REPO
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ;;
  centos)
    command -v dnf >/dev/null || { echo '此 CentOS 未提供 dnf，请参考旧系统迁移说明；不自动替换软件源或安装失维护版本。'; exit 1; }
    dnf -y install dnf-plugins-core ca-certificates curl git openssl
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ;;
  *) echo "检测到 ${PRETTY_NAME:-未知系统}，请按发行版官方说明安装 Docker 和 Compose，然后执行 check-host.sh。"; exit 1 ;;
esac
systemctl enable --now docker
docker info >/dev/null
docker compose version
docker buildx version
echo 'Docker 与构建组件检查通过。接下来配置 deploy/vps/.env 并启动面板。'
