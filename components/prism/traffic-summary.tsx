'use client';
import {useEffect,useState} from 'react';
import {Server,bytes} from '@/lib/model';
import {request} from '@/lib/client';
export default function TrafficSummary({servers,publicView=false}:{servers:Server[];publicView?:boolean}){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 const load=()=>request(publicView?'public/traffic':'traffic-summary').then(d=>{setData(d);setError('')}).catch(e=>setError(e.message));
 useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t)},[publicView]);
 return <section className="glass asset-details"><div className="panel-heading"><h2>今日流量与采样峰值</h2><button className="secondary" onClick={load}>刷新</button></div><p className="form-note">{data?.day} UTC · 仅计算今日已保留的同次开机采样区间差值；重启、记录删除及接入前时段可能缺失，不等同服务商账单。</p>{error&&<p role="alert">{error}</p>}<div className="traffic-table-scroll"><table className="daily-traffic-table"><thead><tr><th>节点</th><th>今日已观测流量</th><th>上行峰值</th><th>下行峰值</th><th>采样</th></tr></thead><tbody>{servers.map(s=>{const r=data?.rows.find((x:any)=>x.server===s.id);return <tr key={s.id}><td>{s.meta.name}</td><td>{r?.samples>1?<><b>{bytes((r.tx||0)+(r.rx||0))}</b><small>↑ {bytes(r.tx||0)} · ↓ {bytes(r.rx||0)}</small></>:'等待足够采样'}</td><td>{r?bytes(r.peakUpload||0)+'/s':'—'}</td><td>{r?bytes(r.peakDownload||0)+'/s':'—'}</td><td>{r?.samples||0} 个点</td></tr>})}</tbody></table></div></section>
}
