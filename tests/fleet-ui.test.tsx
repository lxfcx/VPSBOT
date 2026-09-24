import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import FleetSummary from '../components/prism/fleet-summary';
import {emptyMeta,defaults,Server} from '../lib/model';
const node=(currency:string,price:number,billingType:'paid'|'free'='paid'):Server=>({id:currency,meta:{...emptyMeta,name:currency,currency,price,billingType},seen:0,position:0,metrics:null});
await test('asset shows one numeric currency subtotal and a currency selector before rates load',()=>{
 const html=renderToStaticMarkup(<FleetSummary servers={[node('USD',12),node('EUR',9.95)]} settings={defaults}/>);
 assert.match(html,/12\.00/);assert.doesNotMatch(html,/9\.95/);assert.match(html,/资产显示货币/);assert.match(html,/1 台待补充汇率/);assert.doesNotMatch(html,/原币见下方|NaN/);
});
await test('free nodes do not invent asset costs; same-currency amounts require no API',()=>{
 const html=renderToStaticMarkup(<FleetSummary servers={[node('CNY',88),node('USD',999,'free')]} settings={defaults}/>);
 assert.match(html,/88\.00/);assert.doesNotMatch(html,/999/);assert.match(html,/套餐合计/);
});

await test('compact and mini expose cycle traffic separately from lifetime traffic',async()=>{
 const {default:DenseCard}=await import('../components/prism/dense-card');
 const {cycleKey}=await import('../lib/model');
 const s=node('USD',12);s.meta={...s.meta,country:'US',region:'洛杉矶',quota:1024,trafficMode:'limited'} as any;
 s.metrics={cpu:1,memory:2,disk:3,load:0.1,cores:2,uptime:86400,upload:1024,download:2048,tx:900*1024**3,rx:900*1024**3,tcp:577,udp:6,checks:[],cycle:cycleKey(s.meta.resetDay),cycleTx:5*1024**3,cycleRx:7*1024**3} as any;
 s.seen=Date.now()/1000;
 for(const mode of ['compact','mini'] as const){
 const html=renderToStaticMarkup(<DenseCard s={s} mode={mode} settings={defaults} now={s.seen} open={()=>{}} edit={()=>{}} sort={false} move={()=>{}} onDrag={()=>{}} onDrop={()=>{}}/>);
 assert.match(html,/12(?:\.0+)? GB/);assert.match(html,/1(?:\.0+)? TB/);assert.match(html,/洛杉矶/);assert.match(html,/577/);assert.match(html,/本周期流量使用率/);assert.match(html,/quota-reset/);
 }
});

await test('renewal snooze expires and a changed expiry date re-enables reminders',async()=>{
 const {reminderVisible,remainingValue}=await import('../components/prism/asset-center');
 const s=node('USD',12);s.meta.expires='2030-01-01';const now=1000;
 assert.equal(reminderVisible(s,{},now),true);
 assert.equal(reminderVisible(s,{USD:{expires:s.meta.expires,until:2000,dismiss:false}},now),false);
 assert.equal(reminderVisible(s,{USD:{expires:s.meta.expires,until:2000,dismiss:false}},2001),true);
 assert.equal(reminderVisible(s,{USD:{expires:s.meta.expires,until:0,dismiss:true}},now),false);
 assert.equal(reminderVisible(s,{USD:{expires:'2029-01-01',until:0,dismiss:true}},now),true);
 assert.equal(remainingValue(s,null),null);
 s.meta.billingType='one-time';assert.equal(remainingValue(s,12),null);
 s.meta.billingType='free';assert.equal(remainingValue(s,0),0);
});
await test('overview keeps fixed units and a single combined asset action',()=>{
 const s=node('USD',12);s.metrics={tx:1024**4,rx:0,upload:1024**2,download:0} as any;s.seen=Date.now()/1000;
 const html=renderToStaticMarkup(<FleetSummary servers={[s]} settings={defaults}/>);
 assert.match(html,/1\.000/);assert.match(html,/MB\/s/);assert.match(html,/打开资产与续费提醒/);assert.doesNotMatch(html,/aria-label="打开到期提醒"|aria-label="打开资产与汇率换算"/);
});
