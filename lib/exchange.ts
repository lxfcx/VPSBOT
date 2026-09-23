export type Rates={base:string;rates:Record<string,number>;fetchedAt:number;source:string;stale:boolean;error?:string};
let cached:Rates|undefined, pending:Promise<Rates>|undefined, retryAt=0;
export async function exchangeRates():Promise<Rates>{
 const now=Date.now();
 if(cached&&now-cached.fetchedAt<300000)return cached;
 if(pending)return pending;
 if(now<retryAt)return cached?{...cached,stale:true,error:'刷新失败，使用上次汇率'}:{base:'USD',rates:{USD:1},fetchedAt:0,source:'Coinbase',stale:true,error:'汇率暂不可用'};
 pending=(async()=>{try{
  const res=await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD',{signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw new Error('upstream');const data:any=await res.json();
  if(data.data?.currency!=='USD')throw new Error('base');const rates:Record<string,number>={USD:1};
  for(const c of ['CNY','EUR','GBP','USDT','USDC']){const n=Number(data.data.rates?.[c]);if(Number.isFinite(n)&&n>0)rates[c]=n}
  if(!rates.CNY||!rates.EUR||!rates.GBP)throw new Error('missing rates');
  cached={base:'USD',rates,fetchedAt:Date.now(),source:'Coinbase',stale:false};return cached;
 }catch{retryAt=Date.now()+60000;return cached?{...cached,stale:true,error:'刷新失败，使用上次汇率'}:{base:'USD',rates:{USD:1},fetchedAt:0,source:'Coinbase',stale:true,error:'汇率暂不可用，未进行跨币种汇总'}}finally{pending=undefined}})();return pending;
}
export function convert(amount:number,from:string,to:string,rates:Record<string,number>){if(from===to)return amount;return rates[from]>0&&rates[to]>0?amount/rates[from]*rates[to]:null}
