import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/agent',{recursive:true});
const py=readFileSync('agent/prism_agent.py','utf8');
let sh=readFileSync('agent/install.sh','utf8');
sh=sh.replace('[[ -f "$agent_source_dir/prism_agent.py" ]] || { echo \'找不到探针源文件\'; exit 1; }','');
sh=sh.replace('install -m 755 "$agent_source_dir/prism_agent.py" /opt/prism-agent/prism_agent.py',"cat > /opt/prism-agent/prism_agent.py <<'PRISM_PYTHON_PAYLOAD'\n"+py+"\nPRISM_PYTHON_PAYLOAD\nchmod 755 /opt/prism-agent/prism_agent.py");
writeFileSync('public/agent/install.sh',sh);
writeFileSync('public/agent/uninstall.sh',readFileSync('agent/uninstall.sh'));
writeFileSync('public/agent/prism_agent.py',py);
