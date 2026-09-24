import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import FleetSummary from '../components/prism/fleet-summary';
import {emptyMeta,defaults,Server} from '../lib/model';
const node=(currency:string,price:number,billingType:'paid'|'free'='paid'):Server=>({id:currency,meta:{...emptyMeta,name:currency,currency,price,billingType},seen:0,position:0,metrics:null});
await test('asset amounts remain numeric in original currencies before exchange API resolves',()=>{
 const html=renderToStaticMarkup(<FleetSummary servers={[node('USD',12),node('EUR',9.95)]} settings={defaults}/>);
 assert.match(html,/12\.00/);assert.match(html,/9\.95/);assert.match(html,/原币套餐金额/);assert.doesNotMatch(html,/原币见下方|NaN/);
});
await test('free nodes do not invent asset costs; same-currency amounts require no API',()=>{
 const html=renderToStaticMarkup(<FleetSummary servers={[node('CNY',88),node('USD',999,'free')]} settings={defaults}/>);
 assert.match(html,/88\.00/);assert.doesNotMatch(html,/999/);assert.match(html,/套餐合计/);
});
