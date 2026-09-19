import {readFileSync,writeFileSync} from 'node:fs';
const id=process.argv[2];
if(!id||!/^[-a-f0-9]{36}$/i.test(id))throw new Error('Usage: node scripts/prepare-selfhost.mjs YOUR_D1_DATABASE_UUID');
const config=JSON.parse(readFileSync('deploy/wrangler.example.json','utf8'));
config.d1_databases[0].database_id=id;
writeFileSync('deploy/wrangler.json',JSON.stringify(config,null,2)+'\n');
writeFileSync('dist/server/selfhost.js',readFileSync('deploy/worker.mjs','utf8').replace("'../dist/server/index.js'","'./index.js'"));
console.log('Prepared self-hosted Worker config. Set ADMIN_TOKEN and CRON_TOKEN as Wrangler secrets.');
