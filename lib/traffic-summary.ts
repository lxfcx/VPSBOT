export async function dailyTraffic(d:D1Database,owner:string){
 const start=Math.floor(new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z').getTime()/1000);
 // Daily figures include only intervals bounded by retained samples, never invented pre-install data.
 const rows=await d.prepare(`WITH points AS (
 SELECT server,time,json_extract(value,'$.tx') AS tx,json_extract(value,'$.rx') AS rx,
 json_extract(value,'$.upload') AS upload,json_extract(value,'$.download') AS download,
 json_extract(value,'$.bootId') AS boot,
 LAG(value) OVER (PARTITION BY server ORDER BY time,id) AS previous,
 LAG(time) OVER (PARTITION BY server ORDER BY time,id) AS previous_time
 FROM samples WHERE time>=? AND server IN (SELECT id FROM servers WHERE owner=?)
 ) SELECT server,COUNT(*) AS samples,MIN(time) AS first,MAX(time) AS last,
 MAX(upload) AS peakUpload,MAX(download) AS peakDownload,
 SUM(CASE WHEN previous IS NOT NULL AND COALESCE(boot,'')=COALESCE(json_extract(previous,'$.bootId'),'') AND tx>=json_extract(previous,'$.tx') THEN tx-json_extract(previous,'$.tx') ELSE 0 END) AS tx,
 SUM(CASE WHEN previous IS NOT NULL AND COALESCE(boot,'')=COALESCE(json_extract(previous,'$.bootId'),'') AND rx>=json_extract(previous,'$.rx') THEN rx-json_extract(previous,'$.rx') ELSE 0 END) AS rx
 FROM points GROUP BY server`).bind(start,owner).all();
 return {day:new Date(start*1000).toISOString().slice(0,10),timezone:'UTC',rows:rows.results,partial:true};
}
