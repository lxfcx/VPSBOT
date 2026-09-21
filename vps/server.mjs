import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {openStorage} from './storage.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const publicRoot=resolve(root,'public');
const admin=process.env.ADMIN_TOKEN||'';
if(admin.length<32)throw new Error('ADMIN_TOKEN must contain at least 32 characters');
const origin=new URL(process.env.PUBLIC_URL||'');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('PUBLIC_URL must be an HTTPS origin, e.g. https://monitor.example.com');
const storage=openStorage(resolve(process.env.DATA_DIR||'data'),resolve(root,'migrations'));
// Bootstrap only an empty account store. Updates never overwrite a user's credentials.
if(!storage.sqlite.prepare("SELECT owner FROM accounts WHERE owner='admin'").get()){
 const salt=randomBytes(32).toString('hex');
 const password=pbkdf2Sync('123456',salt,100000,32,'sha256').toString('hex');
 storage.sqlite.prepare('INSERT OR IGNORE INTO accounts(owner,username,salt,password,changed) VALUES (?,?,?,?,0)').run('admin','admin',salt,password);
}
const cron=randomBytes(32).toString('hex');
globalThis.VPS_ENV={DB:storage.DB,FILES:storage.FILES,AUTH_MODE:'token',ADMIN_TOKEN:admin,CRON_TOKEN:cron};
const {api}=await import('./backend/api.mjs');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon','.json':'application/json','.sh':'text/plain; charset=utf-8','.py':'text/plain; charset=utf-8','.woff2':'font/woff2'};
async function readBody(req,max){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max){const e=new Error('请求内容过大');e.status=413;throw e}chunks.push(chunk)}return Buffer.concat(chunks)}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);if(url.origin!==origin.origin)throw Object.assign(new Error('无效地址'),{status:400});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  if(url.pathname==='/healthz'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));return}
  if(url.pathname.startsWith('/api/monitor/')){
   if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&req.headers.origin!==origin.origin){res.writeHead(403);res.end('Cross-origin request denied');return}
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value&&!key.startsWith('oai-')&&!key.startsWith('cf-')&&!['host','content-length','connection','transfer-encoding','cf-connecting-ip','x-forwarded-for','x-real-ip'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value)}
   // Only trust a single IP written by the private reverse proxy, never a client-supplied forwarding chain.
   const ip=process.env.TRUST_PROXY==='1'&&isIP(req.headers['x-real-ip']||'')?req.headers['x-real-ip']:req.socket.remoteAddress;
   headers.set('cf-connecting-ip',ip||'unknown');
   const body=['GET','HEAD'].includes(req.method)?undefined:await readBody(req,url.pathname.startsWith('/api/monitor/assets/')?8*1024**2:1024**2);
   const request=new Request(url,{method:req.method,headers,...(body===undefined?{}:{body})});
   const response=await api(request,url.pathname.slice('/api/monitor/'.length).split('/').map(decodeURIComponent));
   res.statusCode=response.status;response.headers.forEach((v,k)=>{if(k!=='set-cookie')res.setHeader(k,v)});
   if(response.headers.getSetCookie().length)res.setHeader('Set-Cookie',response.headers.getSetCookie());
   res.setHeader('Cache-Control','private, no-store');res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  let file=resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(publicRoot+sep)&&file!==publicRoot){res.writeHead(404);res.end();return}
  try{if(!(await stat(file)).isFile())file=resolve(publicRoot,'index.html')}catch{if(extname(file)){res.writeHead(404);res.end();return}file=resolve(publicRoot,'index.html')}
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control',file.includes(sep+'assets'+sep)?'public,max-age=31536000,immutable':'no-cache');res.end(req.method==='HEAD'?undefined:await readFile(file));
 }catch(e){res.statusCode=e.message==='UNAUTHORIZED'?401:e.name==='ZodError'?400:e.status||503;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:res.statusCode===401?'请先登录':res.statusCode===400?'输入内容不符合要求':res.statusCode===413?'上传内容过大':'服务暂时不可用，请检查服务日志'}));if(res.statusCode===503)console.error('Request failed:',e.name)}
});
server.requestTimeout=30000;server.headersTimeout=15000;
let sweeping=false;
async function sweep(){if(sweeping)return;sweeping=true;try{const r=await api(new Request(new URL('/api/monitor/cron',origin),{method:'POST',headers:{Authorization:'Bearer '+cron}}),['cron']);if(!r.ok)console.error('Watchdog failed:',r.status)}catch(e){console.error('Watchdog failed:',e.name)}finally{sweeping=false}}
const timer=setInterval(sweep,60000);timer.unref();
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>{console.log('VPS panel listening; scheduled watchdog enabled');void sweep()});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(timer);server.close(()=>{storage.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()});
