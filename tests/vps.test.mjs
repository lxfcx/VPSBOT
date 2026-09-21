import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
const temp=await mkdtemp(join(tmpdir(),'vps-integration-'));
const port=await new Promise(resolve=>{const s=createServer().listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))})});
const base=`http://127.0.0.1:${port}`,admin='test-only-32-byte-long-admin-credential';
let child;
async function start(){child=spawn(process.execPath,['dist-vps/server.mjs'],{env:{...process.env,DATA_DIR:temp,PORT:String(port),PUBLIC_URL:'https://monitor.example.test',ADMIN_TOKEN:admin},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('listening'))resolve()});child.once('exit',c=>reject(new Error('server exited '+c)));child.stderr.on('data',()=>{})});}
async function stop(){if(child?.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited}}
const call=(path,method='GET',data,headers={Authorization:'Bearer '+admin})=>fetch(base+'/api/monitor/'+path,{method,headers:{'Content-Type':'application/json',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
try{await start();
await test('standalone serves frontend and install assets, rejects anonymous and forged identity',async()=>{assert.equal((await fetch(base)).status,200);assert.match(await(await fetch(base+'/agent/install.sh')).text(),/systemctl/);assert.equal((await call('servers','GET',undefined,{})).status,401);assert.equal((await call('servers','GET',undefined,{'oai-authenticated-user-id':'admin'})).status,401);assert.equal((await fetch(base+'/api/monitor/servers',{method:'POST',headers:{Origin:'https://evil.test',Authorization:'Bearer '+admin},body:'{}'})).status,403)});
let node;
await test('real HTTP node creation, agent reporting and persistence after restart',async()=>{node=await(await call('servers','POST',{name:'VPS smoke test',autoGeo:false})).json();assert.ok(node.token);const payload={cpu:25,memory:30,disk:20,swap:0,load:.5,cores:2,memoryTotal:4e9,diskTotal:80e9,upload:1024,download:2048,tx:1e9,rx:2e9,tcp:4,udp:2,uptime:300,os:'Debian 12',kernel:'6.1',arch:'x86_64',bootId:'smoke',checks:[{name:'Google',ms:8,loss:0}]};assert.equal((await call('report','POST',payload,{Authorization:'Bearer '+node.token})).status,200);await stop();await start();const nodes=await(await call('servers')).json();assert.equal(nodes[0].metrics.cpu,25);assert.equal(nodes[0].meta.name,'VPS smoke test');assert.equal(nodes[0].token,undefined)});
await test('password setup and cookie login use same persistent backend',async()=>{assert.equal((await call('auth/setup','POST',{username:'admin',password:'vps-test-password-123'})).status,200);const login=await call('auth/login','POST',{username:'admin',password:'vps-test-password-123'},{});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.equal((await call('servers','GET',undefined,{Cookie:cookie.split(';')[0]})).status,200)});
await test('image upload survives restart, cannot be read anonymously',async()=>{const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');const r=await fetch(base+'/api/monitor/assets/avatar',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'image/png'},body:png});assert.equal(r.status,200);await stop();await start();const got=await call('assets/avatar');assert.equal(got.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await got.arrayBuffer()),png);assert.equal((await call('assets/avatar','GET',undefined,{})).status,401)});
await test('HTTP settings, branding, sorting, renewal records and rule analysis connect end-to-end',async()=>{
 assert.equal((await call('settings','PUT',{cpu:80,hold:0,offline:120})).status,200);
 assert.equal((await(await call('settings')).json()).offline,120);
 const profile=await(await call('profile')).json();
 assert.equal((await call('profile','PUT',{...profile,platformName:'绿色观察台',theme:'light'})).status,200);
 assert.equal((await(await call('profile')).json()).platformName,'绿色观察台');
 const second=await(await call('servers','POST',{name:'Ordered second',autoGeo:false})).json();
 assert.equal((await call('order','POST',[second.id,node.id])).status,200);
 assert.equal((await(await call('servers')).json())[0].id,second.id);
 assert.equal((await call('servers/'+node.id,'PATCH',{note:'已核验',expiryMode:'date',currency:'CNY'})).status,200);
 assert.equal((await call('servers/'+node.id+'/renew','POST',{expires:'2099-01-01',amount:88,currency:'CNY',note:'年度续期'})).status,200);
 assert.ok((await(await call('audit?category=billing')).json()).some(x=>x.action==='记录续期'));
 assert.equal((await(await call('analyze','POST')).json()).provider,'rules');
 assert.equal((await call('servers/'+node.id+'/analyze','POST')).status,200);
 assert.equal((await call('servers/'+second.id,'DELETE')).status,200);
 assert.equal((await call('servers/'+second.id+'/history')).status,404);
});
await test('HTTP one-use install credential -> heartbeat -> full CPU warning -> history and events',async()=>{
 const enrollment=await(await call('servers/'+node.id+'/enrollment','POST')).json();
 const redeemed=await(await call('enroll','POST',{ticket:enrollment.ticket},{})).json();
 assert.ok(redeemed.token);
 assert.equal((await call('enroll','POST',{ticket:enrollment.ticket},{})).status,401);
 const payload={cpu:100,memory:30,disk:20,swap:0,load:.5,cores:2,memoryTotal:4e9,diskTotal:80e9,upload:1024,download:2048,tx:1e9,rx:2e9,tcp:4,udp:2,uptime:400,os:'Debian 12',kernel:'6.1',arch:'x86_64',bootId:'smoke',checks:[{name:'Google',ms:8,loss:0}]};
 assert.equal((await call('report','POST',payload,{Authorization:'Bearer '+node.token})).status,401);
 assert.equal((await call('report','POST',payload,{Authorization:'Bearer '+redeemed.token})).status,200);
 const state=await(await call('servers/'+node.id+'/enrollment?id='+enrollment.enrollmentId)).json();
 assert.ok(state.redeemedAt&&state.seen>=state.redeemedAt);
 assert.equal((await(await call('servers/'+node.id+'/history')).json()).at(-1).cpu,100);
 assert.equal((await(await call('trends')).json())[node.id].at(-1).cpu,100);
 assert.ok((await(await call('events')).json()).some(x=>x.kind==='warning'&&x.message.includes('cpu')));
 assert.equal((await call('sweep','POST')).status,200);
});
await test('HTTP password change revokes sessions, replacement login and logout revoke access',async()=>{
 const login=await call('auth/login','POST',{username:'admin',password:'vps-test-password-123'},{});
 const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('auth/password','POST',{password:'changed-vps-password-123',currentPassword:'wrong'},{Cookie:cookie})).status,403);
 assert.equal((await call('auth/password','POST',{password:'changed-vps-password-123',currentPassword:'vps-test-password-123'},{Cookie:cookie})).status,200);
 assert.equal((await call('servers','GET',undefined,{Cookie:cookie})).status,401);
 assert.equal((await call('auth/login','POST',{username:'admin',password:'vps-test-password-123'},{})).status,401);
 const replacement=await call('auth/login','POST',{username:'admin',password:'changed-vps-password-123'},{});
 const newCookie=replacement.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('auth/logout','POST',undefined,{Cookie:newCookie})).status,200);
 assert.equal((await call('servers','GET',undefined,{Cookie:newCookie})).status,401);
});
}finally{await stop();await rm(temp,{recursive:true,force:true})}
