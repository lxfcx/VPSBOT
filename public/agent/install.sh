#!/usr/bin/env bash
set -euo pipefail
# Run from a checked-out release; no curl | bash and no unverified binaries.
[[ "$EUID" -eq 0 ]] || { echo '请使用 sudo 运行'; exit 1; }
command -v python3 >/dev/null || { echo '请先安装 Python 3.9 或更新版本'; exit 1; }
command -v systemctl >/dev/null || { echo '目前安装脚本支持 systemd Linux'; exit 1; }
agent_source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

endpoint="${1:-}"
token="${2:-}"
[[ -n "$endpoint" ]] || read -r -p '后端 HTTPS 地址: ' endpoint
[[ -n "$token" ]] || read -r -s -p '探针 Token: ' token
[[ "$endpoint" == https://* ]] || { echo '后端必须使用 HTTPS'; exit 1; }
[[ "$token" =~ ^[A-Za-z0-9-]{64,100}$ ]] || { echo 'Token 格式不正确'; exit 1; }
python3 -c 'import sys; assert sys.version_info >= (3,9), "Python >= 3.9 required"'
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
    HISTORY[name].append(ms is None)
    return {'name': name, 'ms': ms, 'loss': round(sum(HISTORY[name]) / len(HISTORY[name]) * 100, 2)}

def snapshot(previous, targets):
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
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        checks = list(pool.map(probe, targets[:10]))
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
    previous = {'ticks': cpu_ticks(), 'net': net_bytes(), 'stamp': time.monotonic()}
    signal.signal(signal.SIGTERM, lambda *_: stop())
    signal.signal(signal.SIGINT, lambda *_: stop())
    time.sleep(1)
    failures = 0
    while not STOP:
        start = time.monotonic()
        try:
            metrics, previous = snapshot(previous, targets)
            req = urllib.request.Request(endpoint + '/api/monitor/report', data=json.dumps(metrics).encode(),
                                         headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token}, method='POST')
            with opener.open(req, timeout=25) as response:
                if response.status != 200:
                    raise OSError('Unexpected response')
                json.loads(response.read(4096))
            failures = 0
        except (OSError, ValueError, urllib.error.HTTPError):
            failures += 1  # No payloads, secrets, persistent logs or local cache.
        delay = min(60, max(10, 2 ** min(failures, 6)))
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
echo 'Prism 探针已安装。可用 systemctl status prism-agent 检查服务状态。'
