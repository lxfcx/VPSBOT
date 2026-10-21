import os
import pathlib
import subprocess
import tempfile
import unittest

SOURCE = pathlib.Path('deploy/vps/manage.sh').read_text()
FUNCTIONS = SOURCE[SOURCE.index('check_ports(){'):SOURCE.index('backup(){')]

class PrebuiltInstall(unittest.TestCase):
    def run_case(self, corrupt=False, download_fail=False):
        with tempfile.TemporaryDirectory(dir='outputs') as tmp:
            root=pathlib.Path(tmp).resolve()
            tools=root/'bin'; tools.mkdir()
            curl=tools/'curl'
            curl.write_text('''#!/bin/bash
while [[ $# -gt 0 ]]; do
 if [[ "$1" == '-o' ]]; then out="$2"; shift 2; else url="$1"; shift; fi
done
[[ "${FAIL:-0}" == 1 ]] && exit 22
if [[ "$url" == *.sha256 ]]; then
 if [[ "${CORRUPT:-0}" == 1 ]]; then printf '%064d  file\\n' 0 > "$out"; else printf 'image' | sha256sum > "$out"; fi
else printf 'image' > "$out"; fi
'''); curl.chmod(0o755)
            docker=tools/'docker'; docker.write_text('#!/bin/bash\nprintf "%s\\n" "$*" >> "$ROOT/docker-calls"\n');docker.chmod(0o755)
            env=dict(os.environ,PATH=str(tools)+':'+os.environ['PATH'],ROOT=str(root),CORRUPT=str(int(corrupt)),FAIL=str(int(download_fail)))
            result=subprocess.run(['bash','-c','set -euo pipefail\n'+FUNCTIONS+'\nload_image'],env=env,text=True,capture_output=True)
            called=(root/'docker-calls').exists()
            self.assertFalse(list(root.glob('.image-*')))
            return result.returncode,called
    def test_verified_image_is_loaded(self):
        self.assertEqual(self.run_case(),(0,True))
    def test_bad_checksum_never_loads(self):
        status,called=self.run_case(corrupt=True);self.assertNotEqual(status,0);self.assertFalse(called)
    def test_missing_release_never_builds_or_loads(self):
        status,called=self.run_case(download_fail=True);self.assertNotEqual(status,0);self.assertFalse(called)

if __name__=='__main__': unittest.main()
