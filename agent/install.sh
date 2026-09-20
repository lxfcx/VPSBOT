#!/usr/bin/env bash
set -euo pipefail
# Run from a checked-out release; no curl | bash and no unverified binaries.
[[ "$EUID" -eq 0 ]] || { echo '请使用 sudo 运行'; exit 1; }
command -v python3 >/dev/null || { echo '请先安装 Python 3.9 或更新版本'; exit 1; }
command -v systemctl >/dev/null || { echo '目前安装脚本支持 systemd Linux'; exit 1; }
python3 -c 'import sys; assert sys.version_info >= (3,9), "Python >= 3.9 required"'
agent_source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$agent_source_dir/prism_agent.py" ]] || { echo '找不到探针源文件'; exit 1; }
endpoint="${1:-}"
token="${2:-}"
if [[ "$token" == '--enroll' ]]; then
  [[ "$endpoint" == https://* ]] || { echo '后端必须使用 HTTPS'; exit 1; }
  enrollment_ticket="${3:-}"
  [[ "$enrollment_ticket" =~ ^[a-f0-9]{64}$ ]] || { echo '安装凭证格式不正确'; exit 1; }
  token="$(printf '%s\n%s\n' "$endpoint" "$enrollment_ticket" | python3 -c '
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
printf '%s\n%s\n' "$endpoint" "$token" | python3 -c 'import json,sys,os; a=sys.stdin.read().splitlines(); p="/etc/prism-agent/config.json"; fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600); os.fchmod(fd,0o600); os.write(fd,json.dumps({"endpoint":a[0],"token":a[1]}).encode()); os.close(fd)'
cat > /etc/systemd/system/prism-agent.service <<'UNIT'
[Unit]
Description=Prism read-only server metrics agent
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
DynamicUser=yes
LoadCredential=config:/etc/prism-agent/config.json
Environment=PRISM_CONFIG=%d/config
ExecStart=/usr/bin/python3 -B /opt/prism-agent/prism_agent.py
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
