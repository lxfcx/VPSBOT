#!/usr/bin/env bash
set -euo pipefail
[[ "$EUID" -eq 0 ]] || { echo '请使用 sudo 运行'; exit 1; }
systemctl disable --now prism-agent.service 2>/dev/null || true
rm -f -- /etc/systemd/system/prism-agent.service
# Delete only fixed, application-owned locations. Never clear global audit logs.
rm -rf -- /opt/prism-agent /etc/prism-agent /var/cache/prism-agent /var/lib/prism-agent
systemctl daemon-reload
systemctl reset-failed prism-agent.service 2>/dev/null || true
echo '探针程序、配置及专属缓存目录已删除。控制端历史请在界面删除节点。系统审计、备份、Shell 历史不属于本探针，不会被清除。'
