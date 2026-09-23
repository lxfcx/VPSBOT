'use client';
import {useEffect,useRef,useState} from 'react';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
export function TrafficInput({value,onChange,disabled=false,label}:{value:number;onChange:(gb:number)=>void;disabled?:boolean;label:string}){
 const [unit,setUnit]=useState(value>=1024?'TB':'GB'),[draft,setDraft]=useState(String(value>=1024?value/1024:value));const emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current){emitted.current=value;setDraft(String(value/(unit==='TB'?1024:1)))}},[value,unit]);
 return <div className="traffic-input"><Input aria-label={label} inputMode="decimal" disabled={disabled} value={draft} placeholder="输入流量" onChange={e=>{const v=e.target.value;if(!/^\d*(\.\d*)?$/.test(v))return;setDraft(v);const n=Number(v)*(unit==='TB'?1024:1);emitted.current=n;onChange(n)}}/><NativeSelect aria-label={label+'单位'} disabled={disabled} value={unit} onChange={e=>{const next=e.target.value;setUnit(next);setDraft(String(value/(next==='TB'?1024:1)))}}><NativeSelectOption value="GB">GB</NativeSelectOption><NativeSelectOption value="TB">TB</NativeSelectOption></NativeSelect></div>
}
