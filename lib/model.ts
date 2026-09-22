export type Carrier='telecom'|'unicom'|'mobile';
export type NetworkTarget={carrier:Carrier;name:string;host:string;port:number};
export type Metrics = {
    trafficBasis?:string;
    cpu: number;
    memory: number;
    disk: number;
    swap: number;
    load: number;
    cores: number;
    memoryTotal: number;
    diskTotal: number;
    upload: number;
    download: number;
    tx: number;
    rx: number;
    tcp: number;
    udp: number;
    uptime: number;
    os: string;
    kernel: string;
    arch: string;
    bootId?: string;
    provider?: string;
    cycle?: string;
    cycleTx?: number;
    cycleRx?: number;
    checks: {
        name: string;
        ms: number | null;
        loss: number;
        carrier?:Carrier;
        target?:string;
    }[];
    disks?: {
        path: string;
        total: number;
        used: number;
        percent: number;
    }[];
};
export type Meta = {
    networkTargets?:NetworkTarget[];
    name: string;
    group: string;
    country: string;
    region: string;
    operator: string;
    network: string;
    note: string;
    currency: string;
    price: number;
    cycle: number;
    expires: string;
    quota: number;
    resetDay: number;
    tags: string;
    ip?: string;
    asn?: string;
    confidence?: string;
    source?: string;
    broadcast?: string;
    maintenance?: boolean;
    billingType?: 'paid' | 'free' | 'one-time';
    expiryMode?: 'date' | 'never' | 'unknown';
    trafficMode?: 'limited' | 'unlimited' | 'unknown';
    trafficCalibration?:{cycle:string;usedGb:number;baseline:number;at:number};
    trafficOffsetGb?: number;
    trafficOffsetCycle?: string;
    planNote?: string;
    provider?: string;
    autoGeo?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    locationAccuracy?: string;
    osOverride?: string;
};
export type Server = {
    id: string;
    meta: Meta;
    metrics: Metrics | null;
    seen: number;
    position: number;
    onlineSeconds?: number;
    firstSeen?: number;
    analysis?: {text:string;provider:string;time:number;sample:number} | null;
};
export const currencies: Record<string, string> = { USD: '$', CNY: '¥', GBP: '£', EUR: '€', USDT: '₮', USDC: '◉' };
export const defaults = { cpu: 80, memory: 90, disk: 90, swap: 90, traffic: 90, latency: 300, loss: 20, offline: 60, hold: 30, recovery: 5, expiryDays: 7, telegramEnabled: false, telegramToken: '', telegramChat: '', aiEnabled: false, aiKey: '', aiModel: 'gpt-4.1-mini', ipinfoToken: '', retentionDays: 7, hubId: '', autoAI: true, aiInterval: 300 };
export const emptyMeta: Meta = { name: '', group: '默认分组', country: 'ZZ', region: '待识别', operator: '待识别', network: '待核验', note: '', currency: 'USD', price: 0, cycle: 1, expires: '', quota: 1000, resetDay: 1, tags: '', billingType: 'paid', expiryMode: 'date', trafficMode: 'limited', trafficOffsetGb: 0, planNote: '', provider: '', autoGeo: true, latitude: null, longitude: null, osOverride: '' };
export const countryName = (code: string) => { try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code) || code;
}
catch {
    return code;
} };
export const flag = (code: string) => /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...code.split('').map(c => 127397 + c.charCodeAt(0))) : '🌐';
export const bytes = (n: number) => { if (!Number.isFinite(n))
    return '—'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < 4) {
    n /= 1024;
    i++;
} return `${n.toFixed(i ? 1 : 0)} ${units[i]}`; };
export const online = (s: Server, timeout = 60, now=Date.now()/1000) => s.seen > 0 && now - s.seen < timeout;

export function duration(seconds:number){const s=Math.max(0,Math.floor(seconds||0)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return `${d?d+'天 ':''}${h}小时 ${m}分 ${s%60}秒`}
export function expiryDays(meta:Meta){return meta.expiryMode==='never'||meta.expiryMode==='unknown'||!meta.expires?null:Math.ceil((Date.parse(meta.expires)-Date.now())/864e5)}
export function cycleKey(resetDay:number,now=new Date()){return new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-(now.getUTCDate()<resetDay?1:0),resetDay)).toISOString().slice(0,10)}
export function accumulateTraffic(m:any,previous:any,cycle:string,now:number){
 const start=Date.parse(cycle)/1000,bootInCycle=now-m.uptime>=start,same=previous?.cycle===cycle,reboot=!!previous&&(previous.bootId&&m.bootId?previous.bootId!==m.bootId:m.uptime<previous.uptime),seed=!previous||!previous.trafficBasis;
 let tx=same?previous.cycleTx||0:0,rx=same?previous.cycleRx||0:0,basis=same?previous.trafficBasis:'完整采样';
 if(seed){if(bootInCycle&&!reboot){tx=m.tx;rx=m.rx;basis='本次开机累计（本账期内，可能缺少更早开机记录）'}else{tx+=previous&&!reboot?Math.max(0,m.tx-previous.tx):0;rx+=previous&&!reboot?Math.max(0,m.rx-previous.rx):0;basis='部分采样（历史账单用量待校准）'}}
 else if(same){tx+=reboot?bootInCycle?m.tx:0:Math.max(0,m.tx-previous.tx);rx+=reboot?bootInCycle?m.rx:0:Math.max(0,m.rx-previous.rx)}
 else{tx=bootInCycle?m.tx:0;rx=bootInCycle?m.rx:0;basis='新账期采样（跨账期心跳间隔不计入）'}
 return {cycle,cycleTx:tx,cycleRx:rx,trafficBasis:basis};
}
export function trafficUsed(s:Server){const m=s.metrics,cycle=cycleKey(s.meta.resetDay);const raw=m?.cycle===cycle?(m.cycleTx||0)+(m.cycleRx||0):s.id.startsWith('demo')?(m?.tx||0)+(m?.rx||0):0;const cal=s.meta.trafficCalibration;if(cal?.cycle===cycle)return cal.usedGb*1024**3+Math.max(0,raw-cal.baseline);const offset=(!s.meta.trafficOffsetCycle||s.meta.trafficOffsetCycle===cycle)?(s.meta.trafficOffsetGb||0):0;return raw+offset*1024**3}
export function networkLabel(meta:Meta){if(meta.autoGeo===false)return meta.operator+' · '+meta.network;const op=meta.operator.replace(' 美国电话电报','').replace(' 日本电信','');return op+' · '+(meta.network.includes('接入运营商')?'家宽待核验':meta.network.split('（')[0])}

export const unlimited=(m:Meta)=>m.trafficMode==='unlimited';
export const expiryLabel=(m:Meta)=>m.expiryMode==='never'?'永久有效':m.expiryMode==='unknown'?'到期未确认':m.expires||'未设置到期';
export const planLabel=(m:Meta)=>m.billingType==='free'?(m.expiryMode==='never'?'永久免费':'免费套餐'):m.billingType==='one-time'?'一次性付费':`${currencies[m.currency]}${m.price}/${m.cycle===1?'月':m.cycle===3?'季':m.cycle===6?'半年':'年'}`;
export type Health={level:'healthy'|'warning'|'critical'|'offline'|'unknown'|'maintenance';title:string;text:string;issues:string[];score:number};
export function health(s:Server,c:any=defaults,now=Date.now()/1000):Health{
 if(s.meta.maintenance)return {level:'maintenance',title:'维护中',text:'节点处于维护窗口，新告警已暂停。',issues:[],score:0};
 if(!s.metrics||!s.seen)return {level:'unknown',title:'等待首个心跳',text:'尚无采样，不能判断服务器健康状态。',issues:[],score:0};
 if(!online(s,c.offline,now))return {level:'offline',title:'连接中断',text:`超过 ${c.offline} 秒没有心跳。检查探针服务、网络和主机电源。`,issues:['心跳超时'],score:0};
 const m=s.metrics,issues:string[]=[];
 for(const [key,name] of [['cpu','CPU'],['memory','内存'],['disk','根磁盘'],['swap','Swap']] as const)if(m[key]>=c[key])issues.push(`${name} ${m[key].toFixed(1)}% ≥ ${c[key]}%`);
 for(const d of m.disks||[])if(d.path!=='/'&&d.percent>=c.disk)issues.push(`磁盘 ${d.path} ${d.percent.toFixed(1)}%`);
 for(const p of m.checks){if(p.ms===null)issues.push(`${p.name} 连接失败`);else if(p.ms>=c.latency)issues.push(`${p.name} 延迟 ${p.ms.toFixed(0)} ms`);if(p.loss>=c.loss)issues.push(`${p.name} 连接失败率 ${p.loss}%`)}
 if(!unlimited(s.meta)&&s.meta.trafficMode!=='unknown'&&s.meta.quota>0&&trafficUsed(s)/1024**3/s.meta.quota*100>=c.traffic)issues.push('本周期流量接近或超过配额');
 const days=expiryDays(s.meta);if(days!==null&&days<=c.expiryDays)issues.push(days<0?'服务器已到期':`${days} 天后到期`);
 const advice:string[]=[];
 if(m.cpu>=c.cpu)advice.push('CPU 偏高：检查 top 中持续占用的进程和计划任务');
 if(m.memory>=c.memory||m.swap>=c.swap)advice.push('内存压力：检查进程内存、Swap 与 OOM 日志');
 if(m.disk>=c.disk||(m.disks||[]).some(d=>d.percent>=c.disk))advice.push('磁盘空间不足：检查大文件、日志轮转与 inode 使用率');
 if(m.checks.some(p=>p.ms===null||p.loss>=c.loss||p.ms>=c.latency))advice.push('线路异常：核对探测目标、防火墙和上游网络，多目标对比定位');
 if(issues.some(x=>x.includes('配额')))advice.push('流量接近配额：检查大流量进程和账期重置日期');
 if(days!==null&&days<=c.expiryDays)advice.push('到期提醒：核实账单及续费安排');
 const critical=['cpu','memory','disk','swap'].some(k=>(m as any)[k]>=100)||m.disks?.some(d=>d.percent>=100);
 return {level:critical?'critical':issues.length?'warning':'healthy',title:critical?'资源已满载':issues.length?'需要关注':'运行健康',text:issues.length?issues.join('；')+'。'+advice.join('；')+'。以上为规则建议，未执行自动修复。':'资源使用、连接探测与心跳均未触发当前阈值。',issues,score:Math.max(0,100-issues.length*15-(critical?30:0))};
}
export const defaultTitles={overview:'总览',servers:'服务器',alerts:'告警中心',billing:'账单与到期',ai:'AI 洞察',audit:'操作记录'};
export type Profile={platformName:string;documentTitle:string;overviewTitle:string;platformSubtitle:string;pageTitles:typeof defaultTitles;displayName:string;bio:string;theme:'dark'|'light'|'system';avatar:boolean;background:boolean;backgroundOpacity:number;authMode:string;username?:string;passwordConfigured?:boolean};
export const defaultProfile:Profile={platformName:'全球VPS联动观察',documentTitle:'全球VPS联动观察',overviewTitle:'全球VPS联动观察',platformSubtitle:'全球服务器实时监测',pageTitles:defaultTitles,displayName:'Personal workspace',bio:'每一次心跳，都清晰可见。',theme:'dark',avatar:false,background:false,backgroundOpacity:.35,authMode:'sites'};
export function nextExpiry(meta:Meta){const current=meta.expires&&Date.parse(meta.expires)>Date.now()?new Date(meta.expires+'T12:00:00Z'):new Date();const day=current.getUTCDate(),month=current.getUTCMonth()+meta.cycle,year=current.getUTCFullYear();return new Date(Date.UTC(year,month,Math.min(day,new Date(Date.UTC(year,month+1,0)).getUTCDate()),12)).toISOString().slice(0,10)}
