'use client';
import {useEffect,useState} from 'react';
import {request} from '@/lib/client';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
export default function NetworkHistory({id,publicView=false,range=1200}:{id:string;publicView?:boolean;range?:number}){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true,pending=false;setRows([]);const load=async()=>{if(pending)return;pending=true;try{const r=await request(`${publicView?'public/nodes':'servers'}/${id}/history?range=${range}`);if(alive){setRows(r);setError('')}}catch(e:any){if(alive)setError(e.message)}finally{pending=false}};load();const t=setInterval(load,range===1200?3000:60000);return()=>{alive=false;clearInterval(t)}},[id,publicView,range]);
 const points=rows.filter(p=>range!==86400||new Date(p.time*1000).toISOString().slice(0,10)===new Date().toISOString().slice(0,10));
 const data=points.flatMap((p,i)=>{const v={time:p.time,upload:p.upload/1024**2,download:p.download/1024**2};return i&&p.time-points[i-1].time>Math.max(60,range/200)?[{time:points[i-1].time+1},v]:[v]});
 return <section className="network-history"><h3>{range===86400?'今日':'近 20 分钟'}上下行走势 <small>↑ 上行 · ↓ 下行 · MB/s</small></h3>{error?<p role="alert">{error}</p>:points.length<2?<p>等待足够的真实历史采样</p>:<ResponsiveContainer width="100%" height={210}><LineChart data={data}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="time" tickFormatter={v=>new Date(v*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}/><YAxis width={60}/><Tooltip labelFormatter={v=>new Date(Number(v)*1000).toLocaleTimeString('zh-CN')} contentStyle={{background:'var(--card)',border:'1px solid var(--border)'}}/><Line dataKey="upload" name="上行 MB/s" stroke="#35b68e" dot={false} isAnimationActive={false}/><Line dataKey="download" name="下行 MB/s" stroke="#b28be5" dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer>}</section>
}
