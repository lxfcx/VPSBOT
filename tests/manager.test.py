"""Safe orchestration tests: all paths and package/runtime operations are fixtures."""
import os
import pathlib
import subprocess
import tempfile
import unittest
import json

class ManagerCommands(unittest.TestCase):
    def test_install_update_and_project_scoped_uninstall(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=pathlib.Path(tmp)
            root=base/'vpsbot'
            cli=base/'bin'/'vpsbot'
            cli.parent.mkdir()
            mock=base/'mock';mock.mkdir()
            fixture=base/'source'/'deploy'/'vps';fixture.mkdir(parents=True)
            source=pathlib.Path('deploy/vps/manage.sh').read_text().replace('ROOT=/opt/vpsbot',f'ROOT={root}').replace('CLI=/usr/local/bin/vpsbot',f'CLI={cli}').replace('/run/lock/vpsbot-manager.lock',str(base/'lock'))
            # Allow this fixture-only test on non-root developer machines.
            source=source.replace('[[ "$EUID" -eq 0 ]]', '[[ 0 -eq 0 ]]')
            for name in ['manage.sh','install-docker.sh','check-host.sh','compose.yaml']:
                (fixture/name).write_text(source if name=='manage.sh' else pathlib.Path('deploy/vps',name).read_text())
            launcher=base/'manager.sh';launcher.write_text(source)
            log=base/'calls'
            docker=mock/'docker';docker.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALL_LOG"\ncase "$*" in *"--entrypoint tar"*) printf archive;; esac\nexit 0\n');docker.chmod(0o755)
            apt=mock/'apt-get';apt.write_text('#!/bin/sh\nexit 0\n');apt.chmod(0o755)
            git=mock/'git';git.write_text('#!/usr/bin/env python3\nimport os,sys,shutil\na=sys.argv[1:]\nif a[0]=="clone": shutil.copytree(os.environ["SOURCE_FIXTURE"],a[-1])\nelif "rev-parse" in a: print("a"*40)\n');git.chmod(0o755)
            env=dict(os.environ,PATH=str(mock)+':'+os.environ['PATH'],CALL_LOG=str(log),SOURCE_FIXTURE=str(base/'source'))
            def run(*args):
                result=subprocess.run(['bash',str(launcher),*args],env=env,capture_output=True,text=True)
                self.assertEqual(result.returncode,0,result.stderr+result.stdout)
                return result
            run('install','monitor.example.com')
            secret=(root/'app/deploy/vps/.env').read_text()
            self.assertIn('DOMAIN=monitor.example.com',secret)
            self.assertRegex(secret,r'ADMIN_TOKEN=[0-9a-f]{64}')
            self.assertTrue(cli.exists())
            run('update')
            self.assertEqual((root/'app/deploy/vps/.env').read_text(),secret)
            self.assertTrue(list((root/'backups').glob('*/data.tar.gz')))
            unrelated=base/'other-app';unrelated.mkdir()
            run('uninstall','--yes')
            self.assertFalse(root.exists());self.assertFalse(cli.exists());self.assertTrue(unrelated.exists())
            calls=log.read_text()
            self.assertIn('--project-name vpsbot',calls)
            self.assertIn('down --volumes --remove-orphans --rmi local',calls)
            self.assertNotIn('prune',calls)

if __name__=='__main__': unittest.main()
