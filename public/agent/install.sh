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
cat > /opt/prism-agent/prism_agent.py <<'PRISM_PYTHON_PAYLOAD'
#!/usr/bin/env python3
"""Prism Linux agent. Python 3.9+, standard library only; no remote execution."""
import concurrent.futures
import collections
import json
import os
import platform
import resource
import shutil
import signal
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CONFIG = Path(os.environ.get('PRISM_CONFIG', '/etc/prism-agent/config.json'))
STOP = False
HISTORY = collections.defaultdict(lambda: collections.deque(maxlen=20))

def read(path):
    try:
        return Path(path).read_text()
    except (OSError, UnicodeError):
        return ''

def cpu_ticks():
    values = list(map(int, read('/proc/stat').splitlines()[0].split()[1:9]))
    return sum(values), values[3] + values[4]

def net_bytes():
    tx = rx = 0
    for line in read('/proc/net/dev').splitlines()[2:]:
        name, data = line.split(':', 1)
        if name.strip() == 'lo':
            continue
        v = data.split()
        rx += int(v[0]); tx += int(v[8])
    return tx, rx

def os_release():
    data = {}
    for line in read('/etc/os-release').splitlines():
        if '=' in line:
            k, v = line.split('=', 1); data[k] = v.strip('"')
    return data.get('PRETTY_NAME', platform.system())

def connections(proto):
    return sum(max(0, len(read('/proc/net/' + name).splitlines()) - 1)
               for name in (proto, proto + '6'))

def probe(target):
    name, host, port = target['name'], target['host'], int(target.get('port', 443))
    start = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=3):
            ms = round((time.monotonic() - start) * 1000, 2)
    except OSError:
        ms = None
    key = (target.get('carrier', ''), name, host, port)
    HISTORY[key].append(ms is None)
    result = {'name': name, 'ms': ms, 'loss': round(sum(HISTORY[key]) / len(HISTORY[key]) * 100, 2)}
    if target.get('carrier') in ('telecom', 'unicom', 'mobile'):
        result.update(carrier=target['carrier'], target=f'{host}:{port}')
    return result

def remote_targets(base, incoming):
    # Bounded TCP endpoints only; never execute commands supplied by the panel.
    if not isinstance(incoming, list) or len(incoming) > 3:
        return None
    clean, seen = [], set()
    for item in incoming:
        if not isinstance(item, dict): return None
        carrier, host, port = item.get('carrier'), item.get('host', ''), item.get('port', 443)
        if carrier not in ('telecom', 'unicom', 'mobile') or carrier in seen: return None
        if not isinstance(host, str) or not 1 <= len(host) <= 253 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:' for c in host): return None
        if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535: return None
        name = item.get('name', carrier)
        if not isinstance(name, str) or not 1 <= len(name) <= 30: return None
        seen.add(carrier)
        clean.append({'carrier': carrier, 'host': host, 'port': port, 'name': name})
    combined = [t for t in base if not t.get('carrier')][:7] + clean
    active = {(t.get('carrier', ''), t['name'], t['host'], int(t.get('port', 443))) for t in combined}
    for key in list(HISTORY):
        if key not in active: del HISTORY[key]
    return combined

def snapshot(previous, targets, cached_checks=None):
    ticks = cpu_ticks(); net = net_bytes(); stamp = time.monotonic()
    delta = max(1, ticks[0] - previous['ticks'][0])
    cpu = max(0, min(100, (1 - (ticks[1] - previous['ticks'][1]) / delta) * 100))
    mem = {}
    for line in read('/proc/meminfo').splitlines():
        key, value = line.split(':', 1); mem[key] = int(value.split()[0]) * 1024
    total = max(1, mem.get('MemTotal', 1))
    available = mem.get('MemAvailable', mem.get('MemFree', 0))
    swap_total = mem.get('SwapTotal', 0)
    root = shutil.disk_usage('/')
    mounts, seen = [], set()
    for line in read('/proc/mounts').splitlines():
        fields = line.split()
        if len(fields) < 3 or not fields[0].startswith('/dev/'):
            continue
        path = fields[1].replace('\\040', ' ')
        try:
            device = os.stat(path).st_dev
            if device in seen:
                continue
            seen.add(device)
            usage = shutil.disk_usage(path)
            mounts.append({'path': path, 'total': usage.total, 'used': usage.used,
                           'percent': usage.used / max(1, usage.total) * 100})
        except OSError:
            pass
    elapsed = max(.001, stamp - previous['stamp'])
    if cached_checks is None:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            checks = list(pool.map(probe, targets[:10]))
    else:
        checks = cached_checks
    m = {'cpu': round(cpu, 2), 'memory': round((1 - available / total) * 100, 2),
         'disk': round(root.used / max(1, root.total) * 100, 2),
         'swap': round((1 - mem.get('SwapFree', 0) / swap_total) * 100, 2) if swap_total else 0,
         'load': os.getloadavg()[0], 'cores': os.cpu_count() or 1,
         'memoryTotal': total, 'diskTotal': root.total,
         'upload': max(0, net[0] - previous['net'][0]) / elapsed,
         'download': max(0, net[1] - previous['net'][1]) / elapsed,
         'tx': net[0], 'rx': net[1], 'tcp': connections('tcp'), 'udp': connections('udp'),
         'uptime': float(read('/proc/uptime').split()[0]), 'os': os_release(),
         'kernel': platform.release(), 'arch': platform.machine(),
         'cpuModel': next((line.split(':', 1)[1].strip() for line in read('/proc/cpuinfo').splitlines() if line.startswith('model name')), platform.machine()),
         'virtualization': (read('/sys/class/dmi/id/product_name').strip() or '未知')[:100],
         'processes': sum(name.isdigit() for name in os.listdir('/proc')),
         'bootId': read('/proc/sys/kernel/random/boot_id').strip(),
         'provider': ('甲骨文 Oracle 云' if 'oracle' in (read('/sys/class/dmi/id/sys_vendor') + read('/sys/class/dmi/id/product_name')).lower() else ''), 'checks': checks, 'disks': mounts[:30]}
    return m, {'ticks': ticks, 'net': net, 'stamp': stamp}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward a bearer token to another endpoint.

def main():
    global STOP
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    config = json.loads(CONFIG.read_text())
    endpoint = config['endpoint'].rstrip('/')
    if not endpoint.startswith('https://'):
        raise SystemExit('HTTPS endpoint required')
    token = config['token']
    targets = config.get('targets', [{'name': 'Google', 'host': 'www.google.com'},
                                    {'name': 'Cloudflare', 'host': 'www.cloudflare.com'},
                                    {'name': 'Apple', 'host': 'www.apple.com'}])
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    base_targets = list(targets)
    previous = {'ticks': cpu_ticks(), 'net': net_bytes(), 'stamp': time.monotonic()}
    signal.signal(signal.SIGTERM, lambda *_: stop())
    signal.signal(signal.SIGINT, lambda *_: stop())
    time.sleep(1)
    failures = 0
    interval = 3
    probe_pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    probe_future = None
    probe_stamp = 0
    cached_checks = []
    def collect_checks(items):
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            return list(pool.map(probe, items[:10]))
    while not STOP:
        start = time.monotonic()
        try:
            if probe_future is not None and probe_future.done():
                try: cached_checks = probe_future.result()
                except (OSError, ValueError): cached_checks = []
                probe_future = None
            if probe_future is None and time.monotonic() - probe_stamp >= 3:
                probe_future = probe_pool.submit(collect_checks, list(targets))
                probe_stamp = time.monotonic()
            metrics, previous = snapshot(previous, targets, cached_checks)
            req = urllib.request.Request(endpoint + '/api/monitor/report', data=json.dumps(metrics).encode(),
                                         headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token}, method='POST')
            with opener.open(req, timeout=25) as response:
                if response.status != 200:
                    raise OSError('Unexpected response')
                reply = json.loads(response.read(8192))
                interval = 3
                if 'networkTargets' in reply:
                    updated = remote_targets(base_targets, reply['networkTargets'])
                    if updated is not None: targets = updated
            failures = 0
        except (OSError, ValueError, urllib.error.HTTPError):
            failures += 1  # No payloads, secrets, persistent logs or local cache.
        delay = min(60, max(interval, 2 ** min(failures, 6)))
        while not STOP and time.monotonic() - start < delay:
            time.sleep(.5)

def stop():
    global STOP
    STOP = True

if __name__ == '__main__':
    main()

PRISM_PYTHON_PAYLOAD
chmod 755 /opt/prism-agent/prism_agent.py
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
