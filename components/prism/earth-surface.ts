// Local geographic artwork: land outlines, latitude-based vegetation and desert
// colours. This is an illustrative globe, not a satellite or weather image.
export function earthSurface(rings:number[][][]){
 const tw=1024,th=512,texture=document.createElement('canvas');texture.width=tw;texture.height=th;
 const t=texture.getContext('2d')!;t.fillStyle='#1675ac';t.fillRect(0,0,tw,th);
 const land=document.createElement('canvas');land.width=tw;land.height=th;const mask=land.getContext('2d')!;
 for(const ring of rings){for(const shift of [-tw,0,tw]){mask.beginPath();let last:number|undefined;ring.forEach(([lng,lat],i)=>{let x=(lng+180)/360*tw;if(last!==undefined){while(x-last>tw/2)x-=tw;while(x-last< -tw/2)x+=tw}last=x;const y=(90-lat)/180*th;if(i)mask.lineTo(x+shift,y);else mask.moveTo(x+shift,y)});mask.closePath();mask.fill()}}
 const m=mask.getImageData(0,0,tw,th).data,p=t.getImageData(0,0,tw,th);
 for(let y=0;y<th;y++)for(let x=0;x<tw;x++){const i=(y*tw+x)*4,lat=90-y/th*180,lng=x/tw*360-180;let rgb:number[];
 if(m[i+3]){const desert=(lat>13&&lat<33&&lng>-18&&lng<65)||(lat< -17&&lat> -32&&lng>115&&lng<145);rgb=Math.abs(lat)>67?[225,237,230]:desert?[195,168,104]:Math.abs(lat)<15?[46,117,65]:Math.abs(lat)>48?[110,137,89]:[96,148,78]}else rgb=lat>79?[207,229,235]:[20,111+Math.round(14*Math.cos(lat*Math.PI/180)),166];
 for(let k=0;k<3;k++)p.data[i+k]=rgb[k];p.data[i+3]=255}
 const surface=document.createElement('canvas'),n=256;surface.width=n;surface.height=n;const ctx=surface.getContext('2d')!,frame=ctx.createImageData(n,n),pixels:{i:number;x:number;y:number;z:number;shade:number}[]=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const px=(x+.5)/n*2-1,py=1-(y+.5)/n*2,d=px*px+py*py;if(d<=1){const z=Math.sqrt(1-d);pixels.push({i:(y*n+x)*4,x:px,y:py,z,shade:.40+.60*Math.max(0,-px*.35+py*.35+z*.87)})}}
 let oldRot=NaN,oldTilt=NaN;
 return (target:CanvasRenderingContext2D,cx:number,cy:number,r:number,rot:number,tilt:number)=>{
 if(rot!==oldRot||tilt!==oldTilt){oldRot=rot;oldTilt=tilt;const cr=Math.cos(rot),sr=Math.sin(rot),ct=Math.cos(tilt),st=Math.sin(tilt);
 for(const v of pixels){const uy=v.y*ct+v.z*st,uz=-v.y*st+v.z*ct,wx=v.x*cr-uz*sr,wz=v.x*sr+uz*cr;const lng=Math.atan2(wx,wz),lat=Math.asin(Math.max(-1,Math.min(1,uy)));const x=Math.min(tw-1,Math.max(0,Math.floor((lng+Math.PI)/(2*Math.PI)*tw))),y=Math.min(th-1,Math.max(0,Math.floor((Math.PI/2-lat)/Math.PI*th))),j=(y*tw+x)*4;for(let k=0;k<3;k++)frame.data[v.i+k]=p.data[j+k]*v.shade;frame.data[v.i+3]=255}ctx.putImageData(frame,0,0)}
 target.save();target.beginPath();target.arc(cx,cy,r,0,Math.PI*2);target.clip();target.imageSmoothingEnabled=true;target.drawImage(surface,cx-r,cy-r,r*2,r*2);target.restore();
 }
}
