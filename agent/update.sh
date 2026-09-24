#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { echo '请使用 root 或 sudo 运行'; exit 1; }
[[ -f /etc/prism-agent/config.json && -f /opt/prism-agent/prism_agent.py ]] || { echo '尚未安装探针，请先在面板编辑节点中部署'; exit 1; }
command -v python3 >/dev/null
command -v curl >/dev/null
update_file=$(mktemp /opt/prism-agent/.update-XXXXXX.py)
trap 'rm -f "$update_file"' EXIT
curl --fail --location --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/lxfcx/VPSBOT/main/agent/prism_agent.py -o "$update_file"
python3 -c 'import ast,sys; ast.parse(open(sys.argv[1]).read())' "$update_file"
install -m 755 "$update_file" /opt/prism-agent/prism_agent.py
systemctl restart prism-agent
systemctl is-active --quiet prism-agent
echo '探针已更新并启动，资源指标目标每 3 秒上报；线路探测独立每 10 秒执行。'
