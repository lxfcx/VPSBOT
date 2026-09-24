import {viewerServer} from './public-view';
export async function nodeHistory(d:D1Database,id:string,range:number,publicView=false){
 const from=Math.floor(Date.now()/1000)-range;
 const rows=await d.prepare(`WITH ranked AS (SELECT time,value,ROW_NUMBER() OVER (ORDER BY time,id) AS rn,COUNT(*) OVER () AS total FROM samples WHERE server=? AND time>=?) SELECT time,value FROM ranked WHERE rn=1 OR rn=total OR rn % MAX(1,CAST((total+598)/599 AS INTEGER))=0 ORDER BY time LIMIT 601`).bind(id,from).all();
 return rows.results.map((r:any)=>({time:r.time,...(publicView?viewerServer({id,meta:'{}',metrics:r.value,seen:r.time}).metrics:JSON.parse(r.value))}));
}
