'use client';
import {Fragment,useEffect,useState} from 'react';
import {Server,bytes} from '@/lib/model';
import {Flag} from './icons';
import NetworkHistory from './network-history';
import {request} from '@/lib/client';
export default function TrafficSummary({servers,publicView=false}:{servers:Server[];publicView?:boolean}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const load=()=>request(publicView?'public/traffic':'traffic-summary').then(d=>{setData(d);setError('')}).catch(e=>setError(e.message));
 useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t)},[publicView]);
 return <section className="glass asset-details"><div className="panel-heading"><h2>今日流量与采样峰值</h2><button className="secondary" onClick={load}>刷新</button></div><div className="traffic-totals"><div><span>今日已观测流量</span><strong>{data?bytes(data.rows.reduce((n:number,r:any)=>n+(r.samples>1?(r.tx||0)+(r.rx||0):0),0)):'—'}</strong></div><div><span>上行采样峰值</span><strong>{data?bytes(Math.max(0,...data.rows.map((r:any)=>r.peakUpload||0)))+'/s':'—'}</strong></div><div><span>下行采样峰值</span><strong>{data?bytes(Math.max(0,...data.rows.map((r:any)=>r.peakDownload||0)))+'/s':'—'}</strong></div></div><p className="form-note">{data?.day} UTC · 仅计算今日已保留的同次开机采样区间差值；重启、记录删除及接入前时段可能缺失，不等同服务商账单。</p>{error&&<p role="alert">{error}</p>}<div className="traffic-table-scroll"><table className="daily-traffic-table"><thead><tr><th>节点</th><th>今日已观测流量</th><th>上行峰值</th><th>下行峰值</th><th>累计流量</th><th>采样 / 操作</th></tr></thead><tbody>{servers.map(s=>{const r=data?.rows.find((x:any)=>x.server===s.id);return <Fragment key={s.id}><tr><td><span className="summary-node-name"><Flag code={s.meta.country}/>{s.meta.name}</span></td><td>{r?.samples>1?<><b>{bytes((r.tx||0)+(r.rx||0))}</b><small>↑ {bytes(r.tx||0)} · ↓ {bytes(r.rx||0)}</small></>:'等待足够采样'}</td><td>{r?bytes(r.peakUpload||0)+'/s':'—'}</td><td>{r?bytes(r.peakDownload||0)+'/s':'—'}</td><td>{(((s.metrics?.tx||0)+(s.metrics?.rx||0))/1024**4).toFixed(3)} TB</td><td>{r?.samples||0} 个点 <button className="secondary" aria-expanded={selected===s.id} onClick={()=>setSelected(selected===s.id?'':s.id)}>详情</button></td></tr>{selected===s.id&&<tr><td colSpan={6}><NetworkHistory id={s.id} publicView={publicView} range={86400}/></td></tr>}</Fragment>})}</tbody></table></div></section>
}
