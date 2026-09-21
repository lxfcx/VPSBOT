"""Reproduce umask-077 copied artifacts; run the exact Dockerfile normalization."""
import os
import pathlib
import shlex
import subprocess
import tempfile
import unittest

class RuntimePermissions(unittest.TestCase):
    def readable_as_node(self, directory):
        # Check the runtime tree's POSIX other-user bits. UID switching cannot
        # traverse the enclosing workspace's private sandbox directories.
        for path in [directory, *directory.rglob('*')]:
            needed = 0o005 if path.is_dir() else 0o004
            if path.stat().st_mode & needed != needed:
                return 13
        return 0

    def test_restrictive_checkout_becomes_readable_without_writable_code(self):
        with tempfile.TemporaryDirectory() as tmp:
            app=pathlib.Path(tmp)/'app';app.mkdir(mode=0o700)
            names=['server.mjs','storage.mjs','backend/api.mjs','migrations/0000.sql','public/index.html']
            for name in names:
                p=app/name;p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                p.write_text('fixture');p.chmod(0o600)
            self.assertEqual(self.readable_as_node(app),13)
            dockerfile=pathlib.Path('deploy/vps/Dockerfile').read_text()
            command=next(line[4:] for line in dockerfile.splitlines() if line.startswith('RUN find /app '))
            subprocess.run(['sh','-c',command.replace('/app',shlex.quote(str(app)))],check=True)
            self.assertEqual(self.readable_as_node(app),0)
            for name in names:
                st=(app/name).stat()
                self.assertEqual(st.st_mode&0o777,0o644)
                self.assertEqual(st.st_uid,0)
            self.assertIn('USER node',dockerfile)
            self.assertIn('chmod 0700 /data',dockerfile)

if __name__=='__main__': unittest.main()
