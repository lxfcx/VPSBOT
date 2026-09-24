'use client';
import {LayoutGrid,Rows3,List,Grid3X3} from 'lucide-react';
export type Layout='large'|'compact'|'mini'|'list';
export function LayoutCycle({value,onChange}:{value:Layout;onChange:(v:Layout)=>void}){const modes:Layout[]=['large','compact','mini','list'],labels={compact:'小卡片',large:'完整卡片',mini:'迷你卡片',list:'列表'},Icon=value==='list'?List:value==='mini'?Grid3X3:value==='large'?LayoutGrid:Rows3,next=modes[(modes.indexOf(value)+1)%4];return <button className="secondary" onClick={()=>onChange(next)} aria-label={`当前${labels[value]}，切换为${labels[next]}`} title={`切换为${labels[next]}`}><Icon size={17}/>{labels[value]}</button>}
