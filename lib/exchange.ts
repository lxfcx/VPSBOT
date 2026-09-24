export type Rates={base:string;rates:Record<string,number>;fetchedAt:number;source:string;stale:boolean;error?:string};
let cached:Rates|undefined,pending:Promise<Rates>|undefined,retryAt=0;
export async function exchangeRates():Promise<Rates>{
 const now=Date.now();if(cached&&now-cached.fetchedAt<(cached.source==='ExchangeRate-API'?3600000:300000))return cached;
 if(pending)return pending;
 const fallback=():Rates=>cached?{...cached,stale:true,error:'刷新失败，使用缓存汇率'}:{base:'USD',rates:{USD:1},fetchedAt:0,source:'暂不可用',stale:true,error:'汇率不可用，保留原币金额'};
 if(now<retryAt)return fallback();
 pending=(async()=>{try{
  let source='Coinbase',raw:any;
  try{const r=await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD',{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d:any=await r.json();if(d.data?.currency!=='USD')throw Error();raw=d.data.rates;if(!raw?.CNY||!raw?.EUR||!raw?.GBP)throw Error()}
  catch{const r=await fetch('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d:any=await r.json();if(d.result!=='success'||d.base_code!=='USD')throw Error();raw=d.rates;source='ExchangeRate-API'}
  const rates:Record<string,number>={USD:1};for(const c of ['CNY','EUR','GBP','USDT','USDC']){const n=Number(raw?.[c]);if(Number.isFinite(n)&&n>0)rates[c]=n}if(!rates.CNY||!rates.EUR||!rates.GBP)throw Error();
  cached={base:'USD',rates,fetchedAt:Date.now(),source,stale:false};return cached;
 }catch{retryAt=Date.now()+60000;return fallback()}finally{pending=undefined}})();return pending;
}
export function convert(amount:number,from:string,to:string,rates:Record<string,number>){if(from===to)return amount;return rates[from]>0&&rates[to]>0?amount/rates[from]*rates[to]:null}
