import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
await build({configFile:false,plugins:[react()],resolve:{alias:{'@':process.cwd()}},build:{ssr:resolve('tests/fleet-ui.test.tsx'),outDir:resolve('outputs/ui-tests'),emptyOutDir:true},ssr:{noExternal:['lucide-react']}});
await import(pathToFileURL(resolve('outputs/ui-tests/fleet-ui.test.js')).href);
