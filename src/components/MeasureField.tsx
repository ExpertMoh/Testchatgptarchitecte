import { useEffect, useState } from 'react';
import type { Measure, Source } from '../model/schema';
import { unknown } from '../model/schema';
import { ChevronDown } from 'lucide-react';
const names = { confirmed:'Confirmée',inferred:'Déduite',unknown:'Inconnue' };
export function MeasureField({label,value,sources,onChange,min}:{label:string;value:Measure;sources:Source[];onChange:(v:Measure)=>void;min?:number}) {
  const [text,setText]=useState(value.value===null?'':String(value.value));
  const [expanded,setExpanded]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setText(value.value===null?'':String(value.value));setError('');},[value]);
  const commit=()=>{
    if(text.trim()==='') { onChange(unknown(value.note));return; }
    const n=Number(text.replace(',','.'));
    if(!Number.isFinite(n)||Math.abs(n)>100000||(min!==undefined&&n<min)) { setError('Valeur hors limites.');return; }
    if(!value.sourceId) {setExpanded(true);setError('Associez une source avant de renseigner la valeur.');return;}
    setError('');onChange({...value,value:n,status:value.status==='unknown'?'inferred':value.status});
  };
  return <div className="measure-field">
    <label>{label}<span>m</span></label>
    <div className="measure-input"><input aria-label={label} inputMode="decimal" value={text} placeholder="Inconnue" onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter') e.currentTarget.blur();}}/><button title="Provenance de la valeur" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><i className={`dot ${value.status}`}/><ChevronDown size={13}/></button></div>
    {error&&<small className="field-error">{error}</small>}
    {expanded&&<div className="provenance-editor">
      <label>Statut<select aria-label={`Statut : ${label}`} value={value.status} onChange={e=>{const status=e.target.value as Measure['status'];if(status==='unknown')onChange({...value,value:null,status});else if(value.value!==null&&value.sourceId)onChange({...value,status});else setError('Renseignez une source puis une valeur avant de confirmer.');}}>{Object.entries(names).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
      <label>Source<select aria-label={`Source : ${label}`} value={value.sourceId??''} onChange={e=>onChange({...value,sourceId:e.target.value||null,...(!e.target.value?{value:null,status:'unknown' as const}:{})})}><option value="">À documenter</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Justification<input aria-label={`Justification : ${label}`} value={value.note} onChange={e=>onChange({...value,note:e.target.value})}/></label>
    </div>}
  </div>;
}
