#!/usr/bin/env python3
"""Update control-plane notes using an admin token, never execute remote commands."""
import getpass, json, sys, urllib.request
if len(sys.argv) != 4:
    raise SystemExit('Usage: python3 agent/annotate.py https://monitor.example.com SERVER_ID "中文备注"')
base, server_id, note = sys.argv[1:]
if not base.startswith('https://'):
    raise SystemExit('HTTPS required')
token = getpass.getpass('管理员 Token: ')
request = urllib.request.Request(base.rstrip('/') + '/api/monitor/servers/' + server_id,
    data=json.dumps({'note': note}).encode(), method='PATCH',
    headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=15) as response:
    print('备注已更新' if response.status == 200 else '更新失败')
