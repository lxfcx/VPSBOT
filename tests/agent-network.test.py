import importlib.util
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('agent','agent/prism_agent.py')
a=importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
class Socket:
 def __enter__(self): return self
 def __exit__(self,*args): return False
class NetworkTest(unittest.TestCase):
 def test_endpoint_change_resets_failure_window(self):
  a.HISTORY.clear()
  t={'carrier':'telecom','name':'test','host':'example.com','port':443}
  with patch.object(a.socket,'create_connection',side_effect=OSError()): self.assertEqual(a.probe(t)['loss'],100)
  with patch.object(a.socket,'create_connection',return_value=Socket()):
   self.assertEqual(a.probe(t)['loss'],50)
   changed={**t,'host':'changed.example'}
   result=a.probe(changed)
   self.assertEqual(result['loss'],0)
   self.assertEqual(result['target'],'changed.example:443')
 def test_remote_configuration_is_bounded_and_removable(self):
  base=[{'name':'base','host':'example.com'}]
  t={'carrier':'mobile','name':'移动','host':'example.com','port':443}
  self.assertEqual(len(a.remote_targets(base,[t])),2)
  self.assertEqual(a.remote_targets(base,[]),base)
  self.assertIsNone(a.remote_targets(base,[t,t]))
  self.assertIsNone(a.remote_targets(base,[{**t,'host':'$(echo bad)'}]))
  self.assertIsNone(a.remote_targets(base,[{**t,'port':0}]))
if __name__=='__main__': unittest.main()
