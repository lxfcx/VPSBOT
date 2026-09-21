#!/usr/bin/env bash
set -euo pipefail
# Run from a checked-out release; no curl | bash and no unverified binaries.
# Probe capabilities before redeeming a one-use ticket or writing any files.
agent_python=''
if [[ -n "${PRISM_PYTHON:-}" ]]; then
  agent_candidates=("$PRISM_PYTHON")
else
  agent_candidates=(python3 python3.14 python3.13 python3.12 python3.11 python3.10 python3.9)
fi
for candidate in "${agent_candidates[@]}"; do
  candidate_path="$(command -v "$candidate" || true)"
  if [[ "$candidate_path" =~ ^/[A-Za-z0-9_./+-]+$ ]] && "$candidate_path" -c 'import sys,ssl; assert sys.version_info >= (3,9); ssl.create_default_context()' 2>/dev/null; then
    agent_python="$candidate_path"
    break
  fi
done
[[ -n "$agent_python" ]] || { echo '需要可用的 Python 3.9+ 和 HTTPS 证书；可安装并行版本并设置 PRISM_PYTHON=/绝对路径/python3.11，不必替换系统 Python。'; exit 1; }
command -v systemctl >/dev/null || { echo '需要 systemd 服务管理器；当前系统未提供 systemctl。'; exit 1; }
agent_systemd="$(systemctl --version | head -n 1)"
agent_systemd="${agent_systemd#systemd }"
agent_systemd="${agent_systemd%% *}"
[[ "$agent_systemd" =~ ^[0-9]+$ ]] && (( agent_systemd >= 247 )) || { echo '需要 systemd 247+ 才能安全加载探针凭证；请升级宿主系统，或将面板放在新主机。尚未兑换安装凭证。'; exit 1; }
[[ -d /run/systemd/system ]] || { echo '当前不是运行中的 systemd 宿主环境；请在 VPS 宿主机执行，而非普通容器中。'; exit 1; }
[[ -r /proc/stat && -r /proc/meminfo ]] || { echo '无法读取 Linux /proc 指标。'; exit 1; }
if [[ "${1:-}" == '--check' ]]; then
  echo "探针前置检查通过：$agent_python，systemd $agent_systemd；未写入配置或兑换凭证。"
  exit 0
fi
[[ "$EUID" -eq 0 ]] || { echo '请使用 sudo 运行'; exit 1; }
agent_source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$agent_source_dir/prism_agent.py" ]] || { echo '找不到探针源文件'; exit 1; }
endpoint="${1:-}"
token="${2:-}"
if [[ "$token" == '--enroll' ]]; then
  [[ "$endpoint" == https://* ]] || { echo '后端必须使用 HTTPS'; exit 1; }
  enrollment_ticket="${3:-}"
  [[ "$enrollment_ticket" =~ ^[a-f0-9]{64}$ ]] || { echo '安装凭证格式不正确'; exit 1; }
  token="$(printf '%s\n%s\n' "$endpoint" "$enrollment_ticket" | "$agent_python" -c '
import json,sys,urllib.request,urllib.parse
endpoint,ticket=sys.stdin.read().splitlines()
p=urllib.parse.urlsplit(endpoint)
if p.scheme!="https" or not p.netloc or p.username or p.password or p.query or p.fragment:raise SystemExit("后端地址格式不正确")
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
req=urllib.request.Request(endpoint.rstrip("/")+"/api/monitor/enroll",data=json.dumps({"ticket":ticket}).encode(),headers={"Content-Type":"application/json"},method="POST")
try:
 with urllib.request.build_opener(NoRedirect()).open(req,timeout=20) as response:result=json.loads(response.read(4096))
 print(result["token"])
except Exception:raise SystemExit("安装凭证兑换失败，请检查公网后端并重新生成命令。")
')"
  unset enrollment_ticket
fi
[[ -n "$endpoint" ]] || read -r -p '后端 HTTPS 地址: ' endpoint
[[ -n "$token" ]] || read -r -s -p '探针 Token: ' token
[[ "$endpoint" == https://* ]] || { echo '后端必须使用 HTTPS'; exit 1; }
[[ "$token" =~ ^[A-Za-z0-9-]{64,100}$ ]] || { echo 'Token 格式不正确'; exit 1; }
install -d -m 755 /opt/prism-agent
install -d -m 700 /etc/prism-agent
install -m 755 "$agent_source_dir/prism_agent.py" /opt/prism-agent/prism_agent.py
# Pass secrets over stdin rather than putting them into a Python process argument.
printf '%s\n%s\n' "$endpoint" "$token" | "$agent_python" -c 'import json,sys,os; a=sys.stdin.read().splitlines(); p="/etc/prism-agent/config.json"; fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600); os.fchmod(fd,0o600); os.write(fd,json.dumps({"endpoint":a[0],"token":a[1]}).encode()); os.close(fd)'
cat > /etc/systemd/system/prism-agent.service <<UNIT
[Unit]
Description=Prism read-only server metrics agent
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
DynamicUser=yes
LoadCredential=config:/etc/prism-agent/config.json
Environment=PRISM_CONFIG=%d/config
ExecStart=$agent_python -B /opt/prism-agent/prism_agent.py
Restart=on-failure
RestartSec=10
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
UMask=0077
LimitCORE=0
StandardOutput=null
StandardError=null
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now prism-agent.service
systemctl restart prism-agent.service
unset token
systemctl is-active --quiet prism-agent.service || { echo '探针启动失败，请检查 systemctl status prism-agent'; exit 1; }
echo 'Prism 探针已启动，正在上报。返回面板等待首个心跳；systemctl status prism-agent 可查看服务状态。'
