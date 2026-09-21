"""Exercise the real shell preflight with a simulated systemd host; never install services."""
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

SOURCE = pathlib.Path('agent/install.sh').read_text()

class InstallerPreflight(unittest.TestCase):
    def run_check(self, version, python_path=None):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'systemd').mkdir()
            systemctl = root / 'systemctl'
            systemctl.write_text('#!/bin/sh\nprintf "systemd ' + str(version) + '\\n"\n')
            systemctl.chmod(0o755)
            script = root / 'install.sh'
            # Only the runtime presence check is redirected to a fixture.
            script.write_text(SOURCE.replace('/run/systemd/system', str(root / 'systemd')))
            env = dict(os.environ, PATH=str(root) + ':' + os.environ['PATH'], PRISM_PYTHON=python_path or sys.executable)
            result = subprocess.run(['bash', str(script), '--check'], env=env, text=True, capture_output=True)
            self.assertFalse((root / 'config.json').exists())
            return result

    def test_supported_capabilities_pass_without_distro_version_gate(self):
        result = self.run_check(247)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn('未写入配置或兑换凭证', result.stdout)

    def test_legacy_systemd_stops_before_enrollment(self):
        result = self.run_check(219)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('尚未兑换安装凭证', result.stdout)

    def test_invalid_custom_python_is_rejected(self):
        result = self.run_check(252, '/does/not/exist/python3')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Python 3.9+', result.stdout)

if __name__ == '__main__':
    unittest.main()
