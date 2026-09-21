#!/usr/bin/env bash
set -euo pipefail
# Read-only preflight: no downloads, installations, firewall or config changes.
[[ "$(uname -s)" == Linux ]] || { echo '需要 Linux 宿主机。'; exit 1; }
case "$(uname -m)" in
  x86_64|aarch64|arm64) ;;
  *) echo '当前发布构建路径面向 x86_64 / ARM64；其他架构需自行核验 Node 24 与镜像。'; exit 1 ;;
esac
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  echo "系统：${PRETTY_NAME:-未知}；内核：$(uname -r)；架构：$(uname -m)"
fi
command -v docker >/dev/null || { echo '缺少 Docker，请先按系统安装。'; exit 1; }
docker info >/dev/null || { echo 'Docker daemon 不可用；检查服务或使用 sudo。'; exit 1; }
docker compose version
docker buildx version
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$base/.env" ]] || { echo '请先按教程创建 deploy/vps/.env。'; exit 1; }
docker compose --project-directory "$base" -f "$base/compose.yaml" config --quiet
echo '基础检查通过（未输出密钥）。这不替代镜像构建、域名 HTTPS 与实际心跳验收。'
