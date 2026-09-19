#!/usr/bin/env python3
"""Run once per minute from an independent host, so offline nodes are detectable."""
import os, urllib.request
endpoint = os.environ['PRISM_ENDPOINT'].rstrip('/')
if not endpoint.startswith('https://'):
    raise SystemExit('HTTPS required')
request = urllib.request.Request(endpoint + '/api/monitor/cron', data=b'{}', method='POST',
    headers={'Authorization': 'Bearer ' + os.environ['PRISM_CRON_TOKEN'], 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=50) as response:
    if response.status != 200:
        raise SystemExit(1)
