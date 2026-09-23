import {emptyMeta,Server} from './model';
// Explicit allowlists: no IP, private notes, probe destinations, credentials, or AI text.
export function viewerServer(row:any):Server{
 const source=JSON.parse(row.meta),meta:any={...emptyMeta};
 for(const key of ['name','group','country','region','operator','network','currency','price','cycle','expires','quota','resetDay','billingType','expiryMode','trafficMode','maintenance','latitude','longitude','osOverride','autoGeo','trafficCalibration','trafficOffsetGb','trafficOffsetCycle'])if(source[key]!==undefined)meta[key]=source[key];
 let metrics:any=null;if(row.metrics){const m=JSON.parse(row.metrics);metrics={};for(const key of ['cpu','memory','disk','swap','load','cores','memoryTotal','diskTotal','upload','download','tx','rx','tcp','udp','uptime','os','arch','cycle','cycleTx','cycleRx','trafficBasis'])if(m[key]!==undefined)metrics[key]=m[key];metrics.kernel='';metrics.checks=(m.checks||[]).map((p:any,i:number)=>({name:p.carrier?({telecom:'中国电信',unicom:'中国联通',mobile:'中国移动'} as any)[p.carrier]||'线路检测':['Google','Cloudflare','Apple'].includes(p.name)?p.name:`线路 ${i+1}`,ms:p.ms,loss:p.loss,carrier:p.carrier}));}
 return {id:row.id,meta,metrics,seen:row.seen,position:row.position,onlineSeconds:row.online_seconds||0,firstSeen:row.first_seen||0};
}
