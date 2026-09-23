'use client';
import {LayoutGrid,Rows3,List} from 'lucide-react';
export type Layout='large'|'compact'|'list';
export function LayoutCycle({value,onChange}:{value:Layout;onChange:(v:Layout)=>void}){const modes:Layout[]=['compact','large','list'],labels={compact:'紧凑卡片',large:'完整卡片',list:'列表'},Icon=value==='list'?List:value==='large'?LayoutGrid:Rows3,next=modes[(modes.indexOf(value)+1)%3];return <button className="secondary" onClick={()=>onChange(next)} aria-label={`当前${labels[value]}，切换为${labels[next]}`} title={`切换为${labels[next]}`}><Icon size={17}/>{labels[value]}</button>}
