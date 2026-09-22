import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
// Compile the actual production handlers; replace only the Cloudflare environment binding.
mkdirSync('tests/.compiled',{recursive:true});
for(const f of ['model','accounts','profile','geo','telemetry','network','backend']){let source=readFileSync(`lib/${f}.ts`,'utf8').replace("import { env } from 'cloudflare:workers';","const env = globalThis.TEST_ENV;").replace(/from ['"]\.\/(model|accounts|profile|geo|telemetry)['"]/g,"from './$1.mjs'");writeFileSync(`tests/.compiled/${f}.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_tidy_imperial_guard.sql','utf8'));sqlite.exec(readFileSync('drizzle/0001_shallow_thundra.sql','utf8'));sqlite.exec(readFileSync('drizzle/0002_watery_polaris.sql','utf8'));
function statement(sql,params=[]){return {bind(...args){return statement(sql,args)},async first(){return sqlite.prepare(sql).get(...params)||null},async all(){return {results:sqlite.prepare(sql).all(...params)}},async run(){const r=sqlite.prepare(sql).run(...params);return {meta:{changes:r.changes}}}}}
globalThis.TEST_ENV={DB:{prepare:statement,async batch(items){sqlite.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}},AUTH_MODE:'token',ADMIN_TOKEN:'test-admin-not-a-real-secret',CRON_TOKEN:'test-cron-not-a-real-secret'};
const {api}=await import('./.compiled/backend.mjs');
const admin={Authorization:'Bearer test-admin-not-a-real-secret'};
async function call(path,method='GET',body,headers=admin){return api(new Request('https://prism.test/api/monitor/'+path,{method,headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split('?')[0].split('/'))}
const metric={cpu:15,memory:30,disk:20,swap:0,load:.5,cores:2,memoryTotal:4e9,diskTotal:80e9,upload:1000,download:500,tx:1e9,rx:2e9,tcp:30,udp:4,uptime:400,os:'Debian 12',kernel:'6.1',arch:'x86_64',bootId:'boot-a',checks:[{name:'Cloudflare',ms:6,loss:0}]};
let first,second,token;
function older(id){sqlite.prepare('UPDATE servers SET seen=seen-10 WHERE id=?').run(id)}
await test('reject anonymous and forged site identity on self-hosted token mode',async()=>{await assert.rejects(()=>call('servers','GET',undefined,{}),/UNAUTHORIZED/);await assert.rejects(()=>call('servers','GET',undefined,{'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'a@b.test'}),/UNAUTHORIZED/)});
await test('create nodes, persist metadata, return one-time token, hide token from listings',async()=>{first=await (await call('servers','POST',{name:'Test node'})).json();token=first.token;second=await(await call('servers','POST',{name:'Second node'})).json();assert.equal(token.length,72);const rows=await(await call('servers')).json();assert.equal(rows.length,2);assert.equal(rows[0].meta.name,'Test node');assert.equal(rows[0].token,undefined);assert.notEqual(sqlite.prepare('SELECT token FROM servers WHERE id=?').get(first.id).token,token)});
await test('bad token and invalid metrics rejected; real sample stored',async()=>{assert.equal((await call('report','POST',metric,{Authorization:'Bearer wrong'})).status,401);await assert.rejects(()=>call('report','POST',{...metric,cpu:101},{Authorization:'Bearer '+token}));assert.equal((await call('report','POST',metric,{Authorization:'Bearer '+token})).status,200);assert.equal((await call('report','POST',metric,{Authorization:'Bearer '+token})).status,429);const rows=await(await call('servers')).json();assert.equal(rows[0].metrics.cpu,15);assert.equal(rows[0].metrics.cycleTx,0)});
await test('traffic deltas, CPU warning, deduplication and hysteresis recovery',async()=>{await call('settings','PUT',{hold:0,cpu:80,recovery:5});older(first.id);await call('report','POST',{...metric,cpu:85,tx:metric.tx+2048},{Authorization:'Bearer '+token});let events=await(await call('events')).json();assert.equal(events.filter(e=>e.kind==='warning').length,1);assert.equal((await(await call('servers')).json())[0].metrics.cycleTx,2048);older(first.id);await call('report','POST',{...metric,cpu:78,tx:metric.tx+4096},{Authorization:'Bearer '+token});events=await(await call('events')).json();assert.equal(events.length,1);older(first.id);await call('report','POST',{...metric,cpu:74,tx:metric.tx+5000},{Authorization:'Bearer '+token});events=await(await call('events')).json();assert.equal(events.filter(e=>e.kind==='recovery').length,1)});
await test('manual order and edits are durable',async()=>{await call('order','POST',[second.id,first.id]);assert.equal((await(await call('servers')).json())[0].id,second.id);await call('servers/'+first.id,'PATCH',{note:'中文备注',currency:'USDC',cycle:6});const rows=await(await call('servers')).json();assert.equal(rows[1].meta.currency,'USDC');assert.equal(rows[1].meta.note,'中文备注')});
await test('authorized settings show requested keys without caching; delivery failures remain retryable',async()=>{await call('settings','PUT',{telegramEnabled:true,telegramToken:'123456:fakeToken',telegramChat:'test-chat',aiKey:'fake-api-key'});const s=await(await call('settings')).json();assert.equal(s.aiKey,'fake-api-key');assert.equal(s.telegramToken,'123456:fakeToken');assert.equal((await call('settings')).headers.get('cache-control'),'no-store');await assert.rejects(()=>call('settings','GET',undefined,{}),/UNAUTHORIZED/);assert.equal(s.hasAiKey,true);globalThis.fetch=async()=>new Response(JSON.stringify({ok:false}),{status:500});await assert.rejects(()=>call('telegram-test','POST',{}),/发送失败/);assert.ok(sqlite.prepare('SELECT count(*) as n FROM events WHERE delivered=0').get().n>0);globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{status:200});await call('sweep','POST',{});assert.equal(sqlite.prepare('SELECT count(*) as n FROM events WHERE delivered=0').get().n,0)});
await test('offline watchdog records one event and recovery after heartbeat',async()=>{sqlite.prepare('UPDATE servers SET seen=? WHERE id=?').run(Math.floor(Date.now()/1000)-100,first.id);await call('cron','POST',{}, {Authorization:'Bearer test-cron-not-a-real-secret'});let events=await(await call('events')).json();assert.equal(events.filter(e=>e.message.includes('离线告警')).length,1);await call('cron','POST',{}, {Authorization:'Bearer test-cron-not-a-real-secret'});events=await(await call('events')).json();assert.equal(events.filter(e=>e.message.includes('离线告警')).length,1);await call('report','POST',{...metric,cpu:20},{Authorization:'Bearer '+token});events=await(await call('events')).json();assert.equal(events.filter(e=>e.message.includes('离线已恢复')).length,1)});
await test('rotate credentials revokes old agent token',async()=>{const replacement=await(await call('servers/'+first.id+'/token','POST',{})).json();assert.notEqual(replacement.token,token);assert.equal((await call('report','POST',metric,{Authorization:'Bearer '+token})).status,401)});
await test('delete removes node, samples, alerts and events only for that node',async()=>{await call('servers/'+first.id,'DELETE');assert.equal((await(await call('servers')).json()).length,1);for(const table of ['samples','events'])assert.equal(sqlite.prepare(`SELECT count(*) as n FROM ${table} WHERE server=?`).get(first.id).n,0);assert.equal(sqlite.prepare('SELECT count(*) as n FROM alerts WHERE id LIKE ?').get(first.id+':%').n,0)});
await test('permanent free / unlimited plan suppresses quota and expiry; manual geo survives reports',async()=>{
 await call('settings','PUT',{hold:0,telegramEnabled:false});
 await call('servers/'+second.id,'PATCH',{billingType:'free',expiryMode:'never',expires:'2020-01-01',trafficMode:'unlimited',quota:1,trafficOffsetGb:500,autoGeo:false,country:'JP',latitude:35.68,longitude:139.65,operator:'人工确认',provider:'Oracle'});
 await call('report','POST',metric,{Authorization:'Bearer '+second.token,'cf-connecting-ip':'192.0.2.40'});await call('sweep','POST');
 const s=(await(await call('servers')).json())[0];assert.equal(s.meta.operator,'人工确认');assert.equal(s.meta.country,'JP');assert.equal(s.meta.trafficMode,'unlimited');assert.ok(s.meta.trafficOffsetCycle);assert.ok(s.firstSeen>0);
 const events=(await(await call('events')).json()).filter(e=>e.server===second.id);assert.equal(events.some(e=>e.message.includes('到期')||e.message.includes('流量告警')),false);
 assert.equal((await call('servers/'+second.id+'/renew','POST',{expires:'2027-01-01',amount:0,currency:'USD',note:''})).status,400);
});
await test('full resource usage warns immediately despite hold; warning escalation deduplicated and snapshots correct',async()=>{
 await call('settings','PUT',{hold:600,cpu:80});older(second.id);await call('report','POST',{...metric,cpu:100},{Authorization:'Bearer '+second.token});
 let events=(await(await call('events')).json()).filter(e=>e.server===second.id&&e.message.includes('cpu'));assert.equal(events.length,1);assert.equal(JSON.parse(events[0].payload).metrics.cpu,100);
 older(second.id);await call('report','POST',{...metric,cpu:100},{Authorization:'Bearer '+second.token});assert.equal((await(await call('events')).json()).filter(e=>e.server===second.id&&e.message.includes('cpu')).length,1);
 older(second.id);await call('report','POST',metric,{Authorization:'Bearer '+second.token});await call('settings','PUT',{hold:0});older(second.id);await call('report','POST',{...metric,cpu:85},{Authorization:'Bearer '+second.token});older(second.id);await call('report','POST',{...metric,cpu:100},{Authorization:'Bearer '+second.token});
 events=(await(await call('events')).json()).filter(e=>e.server===second.id);assert.equal(events.filter(e=>e.message.includes('cpu满载')).length,1);assert.ok((await(await call('servers')).json())[0].onlineSeconds>=40);
});
await test('renewal writes durable billing record; records pagination stable',async()=>{
 await call('servers/'+second.id,'PATCH',{billingType:'paid',expiryMode:'date',expires:'2027-01-01'});
 assert.equal((await call('servers/'+second.id+'/renew','POST',{expires:'2027-04-01',amount:12,currency:'USDC',note:'续费核对'})).status,200);
 assert.equal((await(await call('servers')).json())[0].meta.expires,'2027-04-01');const records=await(await call('audit?category=billing')).json();assert.ok(records.some(e=>JSON.parse(e.detail).note==='续费核对'));
 const all=await(await call('audit')).json(),offset=await(await call('audit?offset=1')).json();assert.equal(offset[0].id,all[1].id);
});
await test('IP country and coordinates auto-detected from trusted request metadata without paid token',async()=>{
 const node=await(await call('servers','POST',{name:'定位测试'})).json();const r=new Request('https://prism.test/api/monitor/report',{method:'POST',headers:{Authorization:'Bearer '+node.token,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.100'},body:JSON.stringify({...metric,provider:'Oracle'})});Object.defineProperty(r,'cf',{value:{country:'US',city:'Los Angeles',latitude:'34.05',longitude:'-118.24',asn:7018,asOrganization:'AT&T Services'}});assert.equal((await api(r,['report'])).status,200);
 const s=(await(await call('servers')).json()).find(s=>s.id===node.id);assert.equal(s.meta.country,'US');assert.equal(s.meta.latitude,34.05);assert.match(s.meta.operator,/美国/);assert.match(s.meta.region,/洛杉矶/);assert.equal(s.meta.billingType,'paid');assert.equal(s.meta.provider,'Oracle');assert.match(s.meta.network,/待核验/);
 const result=await(await call('servers/'+node.id+'/analyze','POST')).json();assert.equal(result.provider,'rules');assert.ok((await(await call('servers')).json()).find(s=>s.id===node.id).analysis.text);
});
await test('TG includes formatted snapshot, full metrics, free/unlimited annotations, and no secrets',async()=>{
 const {telegramMessage}=await import('./.compiled/backend.mjs');const {emptyMeta}=await import('./.compiled/model.mjs');const text=telegramMessage({kind:'warning',message:'CPU 满载',time:Math.floor(Date.now()/1000)},{id:'snapshot',seen:1,meta:{...emptyMeta,name:'中文节点',country:'US',billingType:'free',expiryMode:'never',trafficMode:'unlimited',ip:'192.0.2.1'},metrics:{...metric,cpu:100}},'请检查占用进程');for(const part of ['🚨','🇺🇸','CPU：100.0%','内存','磁盘','Swap','TCP','永久免费','无限','请检查占用进程'])assert.ok(text.includes(part),part);assert.ok(!text.includes('fakeToken'));assert.ok(text.length<=4000);
});
await test('profile persistence and image storage validate signatures and clean replaced objects',async()=>{
 const objects=new Map();globalThis.TEST_ENV.FILES={async put(key,bytes,options){objects.set(key,{bytes:new Uint8Array(bytes),httpMetadata:options.httpMetadata})},async get(key){const v=objects.get(key);return v?{body:v.bytes,httpMetadata:v.httpMetadata}:null},async delete(key){objects.delete(key)}};
 await call('profile','PUT',{displayName:'监控管理员',bio:'中文简介',theme:'light',backgroundOpacity:.5});assert.equal((await(await call('profile')).json()).displayName,'监控管理员');
 const upload=(bytes)=>api(new Request('https://prism.test/api/monitor/assets/avatar',{method:'POST',headers:admin,body:bytes}),['assets','avatar']);assert.equal((await upload('<svg onload="alert(1)"></svg>')).status,415);
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);assert.equal((await upload(png)).status,200);assert.equal(objects.size,1);const original=[...objects.keys()][0];await upload(png);assert.equal(objects.size,1);assert.equal(objects.has(original),false);
 const img=await call('assets/avatar');assert.equal(img.headers.get('content-type'),'image/png');assert.equal(img.headers.get('x-content-type-options'),'nosniff');assert.equal((await(await call('profile')).json()).avatar,true);await call('assets/avatar','DELETE');assert.equal(objects.size,0);
 await assert.rejects(()=>upload(new Uint8Array(2*1024**2+1)),/大小限制/);
});
await test('password setup, login, cookie auth, current-password check, and session revocation',async()=>{
 const password='test-long-password-123';assert.equal((await call('auth/status','GET',undefined,{})).status,200);
 await assert.rejects(()=>call('auth/setup','POST',{username:'operator',password},{}),/UNAUTHORIZED/);
 assert.equal((await call('auth/setup','POST',{username:'operator',password})).status,200);assert.notEqual(sqlite.prepare('SELECT password FROM accounts').get().password,password);
 assert.equal((await call('auth/login','POST',{username:'operator',password:'wrong'},{})).status,401);
 const login=await call('auth/login','POST',{username:'operator',password},{});assert.equal(login.status,200);const raw=login.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict'])assert.ok(raw.includes(flag));const cookies={Cookie:raw.split(';')[0]};assert.equal((await call('servers','GET',undefined,cookies)).status,200);
 assert.equal((await call('auth/password','POST',{password:'new-long-password-123',currentPassword:'wrong'},cookies)).status,403);
 assert.equal((await call('auth/password','POST',{password:'new-long-password-123',currentPassword:password},cookies)).status,200);await assert.rejects(()=>call('servers','GET',undefined,cookies),/UNAUTHORIZED/);
 assert.equal((await call('auth/login','POST',{username:'operator',password},{})).status,401);
 assert.equal((await call('auth/login','POST',{username:'operator',password:'new-long-password-123'},{})).status,200);
 for(let i=0;i<10;i++)await call('auth/login','POST',{username:'operator',password:'wrong'},{'cf-connecting-ip':'192.0.2.250'});assert.equal((await call('auth/login','POST',{username:'operator',password:'wrong'},{'cf-connecting-ip':'192.0.2.250'})).status,429);
 assert.equal((await call('profile','PUT',{}, {...admin,Origin:'https://evil.test'})).status,403);
});
await test('Sites profile and audit ownership isolated; Sites does not accept app passwords',async()=>{
 const saved=globalThis.TEST_ENV.ADMIN_TOKEN;delete globalThis.TEST_ENV.ADMIN_TOKEN;globalThis.TEST_ENV.AUTH_MODE='sites';const user={'oai-authenticated-user-id':'other-owner','oai-authenticated-user-email':'owner@example.test'};
 assert.equal((await(await call('servers','GET',undefined,user)).json()).length,0);assert.equal((await(await call('audit','GET',undefined,user)).json()).length,0);assert.notEqual((await(await call('profile','GET',undefined,user)).json()).displayName,'监控管理员');assert.equal((await call('auth/setup','POST',{username:'attack',password:'password-password'},user)).status,400);
 globalThis.TEST_ENV.ADMIN_TOKEN=saved;globalThis.TEST_ENV.AUTH_MODE='token';
});

await test('one-use enrollment preserves current token until redeemed, then requires the new probe heartbeat',async()=>{
 const node=await(await call('servers','POST',{name:'一键部署测试'})).json();await call('report','POST',metric,{Authorization:'Bearer '+node.token});
 const issued=await(await call('servers/'+node.id+'/enrollment','POST')).json();assert.equal(issued.ticket.length,64);assert.notEqual(sqlite.prepare('SELECT id FROM enrollments WHERE server=?').get(node.id).id,issued.ticket);
 older(node.id);assert.equal((await call('report','POST',metric,{Authorization:'Bearer '+node.token})).status,200);
 const path='servers/'+node.id+'/enrollment?id='+issued.enrollmentId;assert.equal((await(await call(path)).json()).redeemedAt,0);
 const redeemed=await call('enroll','POST',{ticket:issued.ticket},{});assert.equal(redeemed.status,200);const next=await redeemed.json();assert.equal(next.token.length,72);
 assert.equal((await call('enroll','POST',{ticket:issued.ticket},{})).status,401);assert.equal((await call('report','POST',metric,{Authorization:'Bearer '+node.token})).status,401);
 let status=await(await call(path)).json();assert.ok(status.redeemedAt>0);assert.equal(status.seen,0);
 assert.equal((await call('report','POST',metric,{Authorization:'Bearer '+next.token})).status,200);status=await(await call(path)).json();assert.ok(status.seen>=status.redeemedAt);
 await assert.rejects(()=>call('servers/'+node.id+'/enrollment','POST',undefined,{}),/UNAUTHORIZED/);
 const a=await(await call('servers/'+node.id+'/enrollment','POST')).json(),b=await(await call('servers/'+node.id+'/enrollment','POST')).json();assert.equal((await call('enroll','POST',{ticket:a.ticket},{})).status,401);
 sqlite.prepare('UPDATE enrollments SET expires=0 WHERE server=?').run(node.id);assert.equal((await call('enroll','POST',{ticket:b.ticket},{})).status,401);
 await call('servers/'+node.id,'DELETE');assert.equal(sqlite.prepare('SELECT count(*) n FROM enrollments WHERE server=?').get(node.id).n,0);
});
await test('trends expose real persisted samples only, in time order and without credentials',async()=>{
 const trends=await(await call('trends')).json();assert.ok(trends[second.id].length>0);assert.ok(trends[second.id].every(p=>p.upload===metric.upload));assert.equal(trends[second.id][0].token,undefined);assert.ok(trends[second.id].length<=60);assert.deepEqual(trends[second.id][0].checks,metric.checks);
 const token=globalThis.TEST_ENV.ADMIN_TOKEN;delete globalThis.TEST_ENV.ADMIN_TOKEN;globalThis.TEST_ENV.AUTH_MODE='sites';assert.deepEqual(await(await call('trends','GET',undefined,{'oai-authenticated-user-id':'isolated','oai-authenticated-user-email':'isolated@example.com'})).json(),{});globalThis.TEST_ENV.ADMIN_TOKEN=token;globalThis.TEST_ENV.AUTH_MODE='token';
});
await test('globe coordinate picking round-trips rotation and rejects space; history stays bounded and deduplicated',async()=>{
 const {unproject,distanceKm,addSample,rateScale}=await import('./.compiled/telemetry.mjs');
 for(const [lat,lon] of [[0,0],[35,139],[-33,-70],[80,170]]){const p=unproject(200,200,200,200,150,-lon*Math.PI/180,lat*Math.PI/180);assert.ok(Math.abs(p.latitude-lat)<1e-6);assert.ok(Math.abs(p.longitude-lon)<1e-6)}
 assert.equal(unproject(0,0,200,200,150,0,0),null);assert.ok(Math.abs(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:180})-20015)<2);
 let points=[];for(let i=0;i<70;i++)points=addSample(points,{time:i,upload:i});assert.equal(points.length,60);points=addSample(points,{time:69,upload:999});assert.equal(points.length,60);assert.equal(points.at(-1).upload,999);assert.deepEqual(rateScale(0,[0]),{peak:0,percent:0});assert.deepEqual(rateScale(50,[100,80]),{peak:100,percent:50});
});

await test('branding persists, old profile writes preserve it, invalid names are rejected and owners remain isolated',async()=>{
 const initial=await(await call('profile')).json();assert.equal(initial.platformName,'全球VPS联动观察');
 await call('profile','PUT',{...initial,platformName:'我的全球观察台',documentTitle:'节点监控',overviewTitle:'我的总览',pageTitles:{...initial.pageTitles,servers:'我的节点'}});
 await call('profile','PUT',{displayName:'管理员',bio:'',theme:'dark',backgroundOpacity:.3});
 const saved=await(await call('profile')).json();assert.equal(saved.platformName,'我的全球观察台');assert.equal(saved.pageTitles.servers,'我的节点');
 await assert.rejects(()=>call('profile','PUT',{...saved,platformName:' '}));
 const token=globalThis.TEST_ENV.ADMIN_TOKEN;delete globalThis.TEST_ENV.ADMIN_TOKEN;globalThis.TEST_ENV.AUTH_MODE='sites';
 try{const other=await(await call('profile','GET',undefined,{'oai-authenticated-user-id':'another-owner','oai-authenticated-user-email':'owner@example.com'})).json();assert.equal(other.platformName,'全球VPS联动观察')}finally{globalThis.TEST_ENV.ADMIN_TOKEN=token;globalThis.TEST_ENV.AUTH_MODE='token'}
 const {telegramMessage}=await import('./.compiled/backend.mjs');assert.ok(telegramMessage({time:1,message:'恢复'},null,'',saved.platformName).includes(saved.platformName));
});
await test('opaque globe hides rear routes inside silhouette and retains raised arcs outside it',async()=>{
 const {sphereVisible}=await import('./.compiled/telemetry.mjs');
 assert.equal(sphereVisible(0,0,-1),false);assert.equal(sphereVisible(.7,.3,-.5),false);assert.equal(sphereVisible(0,0,1),true);assert.equal(sphereVisible(1.1,0,-.3),true);assert.equal(sphereVisible(0,-1.2,-.1),true);
});
await test('carrier target configuration is validated, delivered only to its node, and persists typed real samples',async()=>{
 const target={carrier:'telecom',name:'授权电信测点',host:'example.com',port:443};
 const a=await(await call('servers','POST',{name:'三网测试',networkTargets:[target]})).json();
 await assert.rejects(()=>call('servers/'+a.id,'PATCH',{networkTargets:[target,target]}));
 await assert.rejects(()=>call('servers/'+a.id,'PATCH',{networkTargets:[{...target,host:'https://example.com/path'}]}));
 const check={name:target.name,carrier:target.carrier,target:'example.com:443',ms:88,loss:5};
 const response=await(await call('report','POST',{...metric,checks:[check]},{Authorization:'Bearer '+a.token})).json();assert.deepEqual(response.networkTargets,[target]);
 const samples=await(await call('servers/'+a.id+'/history')).json();assert.deepEqual(samples.at(-1).checks,[check]);
 const other=await(await call('servers','POST',{name:'隔离'})).json();assert.deepEqual((await(await call('report','POST',metric,{Authorization:'Bearer '+other.token})).json()).networkTargets,[]);
 await call('servers/'+a.id,'PATCH',{networkTargets:[]});older(a.id);assert.deepEqual((await(await call('report','POST',metric,{Authorization:'Bearer '+a.token})).json()).networkTargets,[]);
});
await test('carrier plots never mix replaced endpoints or bridge failures and missing heartbeats',async()=>{
 const {carrierSamples,latencyStats,latencyPath}=await import('./.compiled/network.mjs');
 const check=ms=>({name:'test',carrier:'telecom',target:'example.com:443',ms,loss:0});
 const points=[{time:10,check:check(10)},{time:20,check:check(30)},{time:30,check:check(null)},{time:40,check:check(100)},{time:90,check:check(90)}];
 assert.equal(latencyStats(points).jitter,20);assert.equal(latencyStats(points).count,5);assert.equal(latencyStats([]).avg,null);
 const path=latencyPath(points,0,100,120);assert.equal((path.match(/M/g)||[]).length,3);assert.equal((path.match(/L/g)||[]).length,1);
 assert.equal(carrierSamples([{time:20,checks:[check(50)]}],{carrier:'telecom',host:'changed.example',port:443},600,100)[0].check,undefined);
});
await test('green meters flag full values and thresholds without treating missing data as an alarm',async()=>{
 const {meterState}=await import('./.compiled/telemetry.mjs');
 assert.deepEqual(meterState(0,80),{percent:0,full:false,warning:false});
 assert.equal(meterState(79.9,80).warning,false);
 assert.equal(meterState(80,80).warning,true);
 assert.deepEqual(meterState(125,101),{percent:100,full:true,warning:true});
 assert.deepEqual(meterState(NaN,80),{percent:0,full:false,warning:false});
});
await test('AI results, cached per-node analysis and error fallback remain honest',async()=>{
 await call('settings','PUT',{aiEnabled:true,aiKey:'test-key-not-real',autoAI:false});
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:'测试 AI 健康说明'}}]});
 const summary=await(await call('analyze','POST')).json();assert.equal(summary.provider,'ai');assert.equal(summary.text,'测试 AI 健康说明');
 const rows=await(await call('servers')).json();const id=rows[0].id;
 assert.equal((await(await call('servers/'+id+'/analyze','POST')).json()).provider,'ai');
 assert.equal((await(await call('servers')).json()).find(x=>x.id===id).analysis.text,'测试 AI 健康说明');
 globalThis.fetch=async()=>new Response('Unavailable',{status:503});
 await assert.rejects(()=>call('analyze','POST'),/AI 服务暂不可用/);
 assert.equal((await(await call('servers/'+id+'/analyze','POST')).json()).provider,'ai'); // 30-second cache is intentional.
 sqlite.prepare('UPDATE analyses SET time=time-31 WHERE server=?').run(id);
 const fallback=await(await call('servers/'+id+'/analyze','POST')).json();assert.equal(fallback.provider,'rules');assert.match(fallback.text,/AI 暂不可用/);
 await call('settings','PUT',{aiEnabled:false});
});
await test('every Telegram notification type including tests uses icon sections',async()=>{const {telegramMessage}=await import('./.compiled/backend.mjs');for(const kind of ['warning','recovery','info']){const text=telegramMessage({kind,message:'测试内容 <节点>',time:1},null);for(const part of ['🏷','📣','🕒','━━','测试内容 <节点>'])assert.ok(text.includes(part))}assert.ok(telegramMessage({server:'test',kind:'info',message:'连接测试',time:1},null).startsWith('🧪'));});
await test('passwords accept short and long nonempty values while empty is rejected',async()=>{const {authPrivate,authPublic}=await import('./.compiled/accounts.mjs');const owner='length-test';await authPrivate(new Request('https://test/auth/setup',{method:'POST',body:JSON.stringify({username:'length-test',password:'a'})}),'auth/setup',TEST_ENV.DB,owner,'token');let result=await authPublic(new Request('https://test/auth/login',{method:'POST',body:JSON.stringify({username:'length-test',password:'a'})}),'auth/login',TEST_ENV.DB,'token');assert.equal(result.status,200);await assert.rejects(()=>authPrivate(new Request('https://test/auth/password',{method:'POST',body:JSON.stringify({password:'',currentPassword:'a'})}),'auth/password',TEST_ENV.DB,owner,'token'));const long='x'.repeat(200);result=await authPrivate(new Request('https://test/auth/password',{method:'POST',body:JSON.stringify({password:long,currentPassword:'a'})}),'auth/password',TEST_ENV.DB,owner,'token');assert.equal(result.status,200);});
await test('no-key IP identification uses free data and never labels ISP as proven residential',async()=>{const {locate,networkType}=await import('./.compiled/geo.mjs');const original=globalThis.fetch;let calls=0;try{globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({success:true,country_code:'US',city:'Dallas',latitude:32.7,longitude:-96.8,connection:{asn:7018,isp:'AT&T'}}))};const geo=await locate(new Request('https://test',{headers:{'cf-connecting-ip':'8.8.8.8'}}),{});assert.equal(geo.operator,'AT&T 美国电话电报');assert.equal(geo.asn,'AS7018');assert.match(geo.network,/待核验/);assert.match(networkType('Oracle'),/数据中心/);assert.match(networkType('NTT'),/骨干/);await locate(new Request('https://test',{headers:{'cf-connecting-ip':'127.0.0.1'}}),{});assert.equal(calls,1)}finally{globalThis.fetch=original}});
sqlite.close();rmSync('tests/.compiled',{recursive:true});
