import {Metrics,Server} from './model';
export type Sample={time:number;cpu:number;memory:number;disk:number;upload:number;download:number;checks?:Metrics['checks']};
export type Trends=Record<string,Sample[]>;
export function addSample(history:Sample[],sample:Sample,limit=60){return [...history.filter(p=>p.time!==sample.time),sample].sort((a,b)=>a.time-b.time).slice(-limit)}
export function sampleOf(s:Server):Sample|null{const m=s.metrics;return m&&s.seen?{time:s.seen,cpu:m.cpu,memory:m.memory,disk:m.disk,upload:m.upload,download:m.download,checks:m.checks}:null}
export function rateScale(value:number,history:number[]){const peak=Math.max(0,value,...history.filter(Number.isFinite));return {peak,percent:Math.max(0,Math.min(100,peak?value/peak*100:0))}}
export function distanceKm(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){const rad=Math.PI/180,dLat=(b.latitude-a.latitude)*rad,dLon=(b.longitude-a.longitude)*rad,h=Math.sin(dLat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dLon/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)))}
export function unproject(x:number,y:number,cx:number,cy:number,r:number,rotation:number,tilt:number){const px=(x-cx)/r,py=(cy-y)/r;if(px*px+py*py>1)return null;const z=Math.sqrt(Math.max(0,1-px*px-py*py)),wy=py*Math.cos(tilt)+z*Math.sin(tilt),wz=-py*Math.sin(tilt)+z*Math.cos(tilt),wx=px*Math.cos(rotation)-wz*Math.sin(rotation),zz=px*Math.sin(rotation)+wz*Math.cos(rotation);return {latitude:Math.asin(Math.max(-1,Math.min(1,wy)))*180/Math.PI,longitude:Math.atan2(wx,zz)*180/Math.PI}}

// An elevated rear arc is visible only outside the opaque globe silhouette.
export function sphereVisible(x:number,y:number,z:number){return z>=0||x*x+y*y>1.0001}

export function meterState(value:number,threshold=100){const valid=Number.isFinite(value),percent=valid?Math.min(100,Math.max(0,value)):0;return {percent,full:valid&&value>=100,warning:valid&&(value>=100||value>=threshold)}}
