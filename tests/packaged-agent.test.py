import unittest
from pathlib import Path

class PackagedAgentTests(unittest.TestCase):
    def test_downloaded_installers_embed_current_agent(self):
        source = Path('agent/prism_agent.py').read_text()
        self.assertEqual(source, Path('public/agent/prism_agent.py').read_text())
        installer = Path('public/agent/install.sh').read_text()
        payload = installer.split("<<'PRISM_PYTHON_PAYLOAD'\n", 1)[1].split('\nPRISM_PYTHON_PAYLOAD\n', 1)[0]
        self.assertEqual(payload, source)
        self.assertIn('interval = 3', payload)
        self.assertNotIn('max(10,', payload)
    def test_vps_build_refreshes_installer_before_copying_public_assets(self):
        build = Path('vps/build.mjs').read_text()
        self.assertLess(build.index('execFileSync(process.execPath'), build.index('await build('))

if __name__ == '__main__':
    unittest.main()
