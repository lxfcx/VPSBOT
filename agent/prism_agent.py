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
