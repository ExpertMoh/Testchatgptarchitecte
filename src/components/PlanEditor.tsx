import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Crosshair, Eye, EyeOff, Maximize2, Minus, MousePointer2, Plus, RotateCcw } from 'lucide-react';
import type { Floor, Project, Selection, XY } from '../model/schema';
import { measure, point, uid, unknown } from '../model/schema';
import { bounds, distance, format, projectOnWall, roomArea, roomPoints, wallGeometry, xy } from '../model/geometry';
export type Tool = 'select'|'wall'|'room'|'door'|'window'|'stair'|'measure'|'calibrate'|'pan';
type Props={project:Project;floor:Floor;tool:Tool;selection:Selection;dimensions:boolean;snap:boolean;onFloor:(f:Floor)=>void;onSelection:(s:Selection)=>void;notify:(s:string)=>void};
const prompts:Record<Tool,string>={select:'Cliquez sur un élément pour le sélectionner',wall:'Cliquez sur le départ, puis sur la fin du mur',room:'Dessinez un contour · double-clic ou Entrée pour fermer',door:'Cliquez sur un mur pour placer une porte',window:'Cliquez sur un mur pour placer une fenêtre',stair:'Cliquez sur les deux extrémités de l’emprise',measure:'Cliquez sur deux points pour mesurer',calibrate:'Cliquez sur les deux extrémités d’une cote connue',pan:'Glissez pour déplacer le plan'};
export function PlanEditor({project,floor,tool,selection,dimensions,snap,onFloor,onSelection,notify}:Props) {
  const svg=useRef<SVGSVGElement>(null);
  const initial=bounds(floor);
  const [view,setView]=useState(initial);
  const [draft,setDraft]=useState<XY[]>([]);
  const [cursor,setCursor]=useState<XY|null>(null);
  const [measurement,setMeasurement]=useState<[XY,XY]|null>(null);
  const [calibration,setCalibration]=useState<[XY,XY]|null>(null);
  const [knownDistance,setKnownDistance]=useState('');
  const [citation,setCitation]=useState('');
  const pan=useRef<{p:XY;view:typeof view;moved:boolean}|null>(null);
  const source=project.sources.find(s=>s.id===floor.sourceId);
  const imageScale=floor.calibration?.metersPerPixel??(8/(source?.pixelWidth??1));
  const imageWidth=(source?.pixelWidth??0)*imageScale,imageHeight=(source?.pixelHeight??0)*imageScale;
  const fit=()=>setView(source?.image?{x:-1,y:-1,width:Math.max(imageWidth+2,4),height:Math.max(imageHeight+2,4)}:bounds(floor));
  useEffect(()=>{setDraft([]);setCursor(null);setMeasurement(null);setCalibration(null);},[tool,floor.id]);
  useEffect(()=>{fit();},[floor.id,floor.sourceId,floor.calibration?.metersPerPixel]); // Camera changes only on level / document / calibration.
  const world=(e:{clientX:number;clientY:number}):XY=>{
    const matrix=svg.current?.getScreenCTM();if(!matrix)return{x:0,y:0};
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
    const grid=snap&&tool!=='calibrate'&&tool!=='pan'&&!(source&&!floor.calibration);
    return {x:grid?Math.round(p.x*20)/20:p.x,y:grid?Math.round(p.y*20)/20:p.y};
  };
  const evidenceId=source?.id??(project.demonstration?'demo':null);
  const drawPoint=(p:XY)=>point(p.x,p.y,evidenceId!,source?'Tracé manuel déduit du recalage du document.':'Tracé sur le jeu de démonstration fictif.');
  const finishRoom=(points=draft)=>{
    if(points.length<3) {notify('Un contour exige au moins trois points.');return;}
    const id=uid();onFloor({...floor,rooms:[...floor.rooms,{id,name:'Nouvelle pièce',points:points.map(drawPoint),color:'#e4e9db'}]});onSelection({kind:'room',id});setDraft([]);
  };
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))return;if(e.key==='Escape'){setDraft([]);setMeasurement(null);onSelection(null);}if(e.key==='Enter'&&tool==='room'){e.preventDefault();finishRoom();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const clicked=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(pan.current?.moved){pan.current=null;return;}
    if(tool==='pan')return;
    const p=world(e);
    if(tool==='select'){if(e.target===svg.current||(e.target as Element).getAttribute('data-background'))onSelection(null);return;}
    if(source&&!floor.calibration&&tool!=='calibrate'){notify('Recalez le document avant de tracer ou de mesurer.');return;}
    if(tool==='calibrate'){
      if(!source?.image){notify('Importez d’abord un document à recaler.');return;}
      if(draft.length===0)setDraft([p]);else{if(distance(draft[0],p)<.001)return;setCalibration([draft[0],p]);setDraft([]);}return;
    }
    if(tool!=='measure'&&!evidenceId){notify('Importez et recalez un document avant de dessiner.');return;}
    if(tool==='measure'&&!source&&!project.demonstration&&!floor.walls.length&&!floor.rooms.length){notify('Importez un document recalé ou un modèle métrique avant de mesurer.');return;}
    if(tool==='measure'){if(!draft.length)setDraft([p]);else{setMeasurement([draft[0],p]);setDraft([]);}return;}
    if(tool==='door'||tool==='window'){
      const nearest=floor.walls.map(w=>({w,projection:projectOnWall(p,w)})).filter(r=>r.projection&&r.projection.offset>=0&&r.projection.offset<=wallGeometry(r.w)!.length).sort((a,b)=>a.projection!.distance-b.projection!.distance)[0];
      if(!nearest||nearest.projection!.distance>.4){notify('Cliquez à proximité d’un mur.');return;}
      const id=uid();onFloor({...floor,openings:[...floor.openings,{id,name:tool==='door'?'Nouvelle porte':'Nouvelle fenêtre',kind:tool,wallId:nearest.w.id,offset:measure(nearest.projection!.offset,evidenceId!,'inferred','Position du clic projetée sur le mur.'),width:unknown(),height:unknown(),sill:unknown()}]});onSelection({kind:'opening',id});notify('Ouverture créée : renseignez largeur, hauteur et seuil dans les propriétés.');return;
    }
    if(tool==='room'){
      if(e.detail>1)return;
      if(draft.length>=3&&distance(draft[0],p)<.18){finishRoom();return;}
      setDraft([...draft,p]);return;
    }
    if(!draft.length){setDraft([p]);return;}
    if(distance(draft[0],p)<.05){notify('Tracez un élément d’au moins 5 cm.');return;}
    const id=uid();
    if(tool==='wall'){onFloor({...floor,walls:[...floor.walls,{id,name:'Nouveau mur',start:drawPoint(draft[0]),end:drawPoint(p),thickness:unknown('L’épaisseur du trait de l’image ne donne pas l’épaisseur réelle du mur.')}]});onSelection({kind:'wall',id});notify('Mur tracé. Son épaisseur réelle reste à documenter.');}
    if(tool==='stair'){onFloor({...floor,stairs:[...floor.stairs,{id,name:'Emprise d’escalier',start:drawPoint(draft[0]),end:drawPoint(p),width:unknown()}]});onSelection({kind:'stair',id});}
    setDraft([]);
  };
  const choose=(kind:NonNullable<Selection>['kind'],id:string,e:React.MouseEvent)=>{if(tool==='select'){e.stopPropagation();onSelection({kind,id});}};
  const zoom=(factor:number)=>setView(v=>({x:v.x+v.width*(1-factor)/2,y:v.y+v.height*(1-factor)/2,width:Math.min(150,Math.max(2,v.width*factor)),height:Math.min(200,Math.max(2,v.height*factor))}));
  const pointerDown=(e:ReactPointerEvent<SVGSVGElement>)=>{if(tool==='pan'||e.button===1){pan.current={p:{x:e.clientX,y:e.clientY},view,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}};
  const pointerMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
    setCursor(world(e));
    if(pan.current&&e.buttons){const c=pan.current;const matrix=svg.current?.getScreenCTM();if(!matrix)return;const dx=(e.clientX-c.p.x)/matrix.a,dy=(e.clientY-c.p.y)/matrix.d;if(Math.abs(dx)+Math.abs(dy)>.03)c.moved=true;setView({...c.view,x:c.view.x-dx,y:c.view.y-dy});}
  };
  const confirmCalibration=()=>{
    if(!calibration||!source)return;
    const d=Number(knownDistance.replace(',','.'));if(!Number.isFinite(d)||d<=0||d>10000){notify('Renseignez une distance positive en mètres.');return;}
    if(!citation.trim()){notify('Indiquez la référence de la cote vérifiée.');return;}
    if(floor.walls.length||floor.rooms.length||floor.stairs.length){notify('Recalage refusé : utilisez un étage de relevé vide pour préserver les tracés existants.');return;}
    const pixelA={x:calibration[0].x/imageScale,y:calibration[0].y/imageScale},pixelB={x:calibration[1].x/imageScale,y:calibration[1].y/imageScale};
    onFloor({...floor,calibration:{metersPerPixel:d/distance(pixelA,pixelB),pixelA,pixelB,distance:measure(d,source.id,'confirmed',citation)}});setCalibration(null);setKnownDistance('');setCitation('');notify('Échelle recalée. Contrôlez une seconde cote indépendante avant le relevé.');
  };
  const ps=floor.walls.flatMap(w=>[xy(w.start),xy(w.end)]).filter((p):p is XY=>!!p);
  const minX=ps.length?Math.min(...ps.map(p=>p.x)):0,maxX=ps.length?Math.max(...ps.map(p=>p.x)):0,minY=ps.length?Math.min(...ps.map(p=>p.y)):0,maxY=ps.length?Math.max(...ps.map(p=>p.y)):0;
  return <div className={`plan-board tool-${tool}`}>
    <div className="board-overlays"><span className="board-label">{source&&!floor.calibration?'DOCUMENT NON RECALÉ':'PLAN VECTORIEL'} <span>·</span> {floor.shortName}</span><div className="north-arrow"><span>N</span><svg width="22" height="30" viewBox="0 0 22 30"><path d="M11 1L19 25L11 20L3 25Z" fill="none" stroke="currentColor"/><path d="M11 1V20L3 25Z" fill="currentColor"/></svg></div></div>
    <svg ref={svg} id="architectural-plan" role="img" aria-label={`Plan 2D — ${floor.name}`} className="plan-svg" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} onClick={clicked} onDoubleClick={e=>{if(tool==='room'){e.preventDefault();finishRoom();}}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onWheel={e=>{if(e.ctrlKey)e.preventDefault();zoom(e.deltaY>0?1.08:.92);}}>
      <defs><pattern id="grid-small" width=".25" height=".25" patternUnits="userSpaceOnUse"><circle cx=".125" cy=".125" r=".008" fill="#c2c8bf"/></pattern><pattern id="wall-hatch" width=".1" height=".1" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".1" height=".1" fill="#4b5751"/><line x1="0" y1="0" x2="0" y2=".1" stroke="#748078" strokeWidth=".02"/></pattern></defs>
      <rect data-background="true" x={view.x} y={view.y} width={view.width} height={view.height} fill="url(#grid-small)"/>
      {source?.image&&floor.sourceVisible&&<image data-background="true" href={source.image} x="0" y="0" width={imageWidth} height={imageHeight} opacity={floor.sourceOpacity}/>}
      {floor.rooms.map(r=>{const ps=roomPoints(r);if(ps.length<3)return null;const cx=ps.reduce((s,p)=>s+p.x,0)/ps.length,cy=ps.reduce((s,p)=>s+p.y,0)/ps.length;return <g key={r.id} onClick={e=>choose('room',r.id,e)} className="plan-element"><polygon points={ps.map(p=>`${p.x},${p.y}`).join(' ')} fill={r.color} fillOpacity={source?.image ? .8 : 1} stroke={selection?.id===r.id?'#c87543':'#c9d0c5'} strokeWidth={selection?.id===r.id?.055:.012}/><text x={cx} y={cy-.04} className="room-name">{r.name.toLocaleUpperCase('fr')}</text><text x={cx} y={cy+.29} className="room-area">{format(roomArea(r))} m²</text></g>;})}
      {project.demonstration&&floor.id==='first'&&<g className="furniture" pointerEvents="none" stroke="#a5b09d" fill="none" strokeWidth=".025"><rect x=".5" y=".5" width="2.5" height=".85" rx=".12"/><path d="M.75 .5V1.35M2.75 .5V1.35M.5 .72H3"/><rect x="1.1" y="1.85" width="1.25" height=".65" rx=".08"/><rect x="5.7" y=".6" width=".35" height="2.2"/><rect x=".45" y="5" width=".55" height="2.25"/><circle cx=".72" cy="5.4" r=".13"/><circle cx=".72" cy="5.85" r=".13"/><rect x=".6" y="8.3" width="2.15" height="1.8" rx=".04"/><path d="M.6 8.75H2.75"/><rect x=".75" y="8.42" width=".7" height=".25" rx=".07"/><rect x="1.9" y="8.42" width=".7" height=".25" rx=".07"/></g>}
      {floor.walls.map(w=>{const g=wallGeometry(w);if(!g)return null;const selected=selection?.id===w.id;return <g key={w.id} onClick={e=>choose('wall',w.id,e)} className="plan-element" data-element-id={w.id}><line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="transparent" strokeWidth={Math.max(.3,w.thickness.value??.1)}/><line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke={selected?'#bf7349':w.thickness.value===null?'#c88f3a':'url(#wall-hatch)'} strokeWidth={w.thickness.value??.035} strokeDasharray={w.thickness.value===null?'.1 .06':undefined} strokeLinecap="square"/>{selected&&[g.a,g.b].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".075" fill="#fff" stroke="#bf7349" strokeWidth=".025"/>)}</g>;})}
      {floor.openings.map(o=>{const w=floor.walls.find(w=>w.id===o.wallId),g=w&&wallGeometry(w);if(!g||o.offset.value===null)return null;const width=o.width.value;const x=g.a.x+Math.cos(g.angle)*o.offset.value,y=g.a.y+Math.sin(g.angle)*o.offset.value,t=w!.thickness.value??.12;return <g key={o.id} className="plan-element" transform={`translate(${x} ${y}) rotate(${g.angle*180/Math.PI})`} onClick={e=>choose('opening',o.id,e)} stroke={selection?.id===o.id?'#bf7349':o.kind==='window'?'#71968d':'#7a8a75'} strokeWidth=".025"><rect x="0" y={-Math.max(t/2,.1)} width={width??.15} height={Math.max(t,.2)} fill="transparent" stroke="none"/>{width===null?<><circle r=".1" fill="#f0daaf"/><text y=".07" textAnchor="middle" fontSize=".18" fill="#684b24" stroke="none">?</text></>:<><rect x="0" y={-t/2-.008} width={width} height={t+.016} fill="#f9faf6" stroke="none"/>{o.kind==='window'?<><rect x=".025" y={-t/2+.025} width={Math.max(.01,width-.05)} height={Math.max(.03,t-.05)} fill="#e1eeec"/><line x1="0" y1="0" x2={width} y2="0"/></>:<><path d={`M0 0 L0 ${width} A${width} ${width} 0 0 0 ${width} 0`} fill="none"/><line x1="0" y1="0" x2="0" y2={width} strokeWidth=".04"/></>}</>}</g>;})}
      {floor.stairs.map(s=>{const a=xy(s.start),b=xy(s.end);if(!a||!b)return null;const l=distance(a,b),angle=Math.atan2(b.y-a.y,b.x-a.x);const width=s.width.value;return <g key={s.id} className="plan-element" transform={`translate(${a.x} ${a.y}) rotate(${angle*180/Math.PI})`} onClick={e=>choose('stair',s.id,e)} stroke={selection?.id===s.id?'#bf7349':'#8b9486'} strokeWidth=".024" fill="none">{width!==null&&<rect x="0" y={-width/2} width={l} height={width} fill="#f1f0e9"/>}<line x1="0" y1="0" x2={l} y2="0"/><path d={`M${l-.23} -.12L${l} 0L${l-.23} .12`}/></g>;})}
      {dimensions&&ps.length>0&&<g stroke="#8d988c" strokeWidth=".015" fill="none" className="dimension-lines"><path d={`M${minX} ${minY-.35}V${minY-.9}M${maxX} ${minY-.35}V${minY-.9}M${minX} ${minY-.7}H${maxX}`}/><path d={`M${minX-.1} ${minY-.8}l.2 .2M${maxX-.1} ${minY-.8}l.2 .2`}/><text x={(minX+maxX)/2} y={minY-.82} stroke="none" fill="#64715f" textAnchor="middle" fontSize=".2">{format(maxX-minX)} m · déduit</text><path d={`M${minX-.35} ${minY}H${minX-.9}M${minX-.35} ${maxY}H${minX-.9}M${minX-.7} ${minY}V${maxY}`}/><text transform={`translate(${minX-.85} ${(minY+maxY)/2}) rotate(-90)`} stroke="none" fill="#64715f" textAnchor="middle" fontSize=".2">{format(maxY-minY)} m · déduit</text></g>}
      {draft.length>0&&<g stroke="#bc784d" strokeWidth=".035" fill="none" pointerEvents="none"><polyline points={[...draft,...(cursor?[cursor]:[])].map(p=>`${p.x},${p.y}`).join(' ')} strokeDasharray=".12 .06"/>{draft.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".065" fill="#bc784d"/>)}</g>}
      {measurement&&<g stroke="#b2764b" strokeWidth=".025" pointerEvents="none"><line x1={measurement[0].x} y1={measurement[0].y} x2={measurement[1].x} y2={measurement[1].y}/>{measurement.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r=".06" fill="#b2764b"/>)}<text x={(measurement[0].x+measurement[1].x)/2} y={(measurement[0].y+measurement[1].y)/2-.17} textAnchor="middle" stroke="none" fill="#925b38" fontSize=".22">{format(distance(...measurement))} m · déduit</text></g>}
    </svg>
    <div className="plan-help"><MousePointer2 size={12}/>{prompts[tool]}{draft.length>0&&<button title="Annuler le tracé" onClick={()=>setDraft([])}><RotateCcw size={12}/></button>}</div>
    <div className="plan-bottom"><span>{source&&!floor.calibration?'Échelle à définir':'Unités : mètres'}<span className="scale-line"/></span><div className="zoom-controls"><button aria-label="Zoom arrière" onClick={()=>zoom(1.2)}><Minus size={15}/></button><span>{Math.round(initial.width/view.width*100)} %</span><button aria-label="Zoom avant" onClick={()=>zoom(.8)}><Plus size={15}/></button><button aria-label="Cadrer le plan" onClick={fit}><Maximize2 size={14}/></button></div></div>
    {source?.image&&<div className="source-visibility"><button className="icon-btn" title="Afficher ou masquer le fond" onClick={()=>onFloor({...floor,sourceVisible:!floor.sourceVisible})}>{floor.sourceVisible?<Eye size={14}/>:<EyeOff size={14}/>}</button><input aria-label="Opacité du document" type="range" min="0" max="1" step=".05" value={floor.sourceOpacity} onChange={e=>onFloor({...floor,sourceOpacity:Number(e.target.value)})}/></div>}
    {calibration&&<div className="modal-backdrop"><form className="modal compact" onSubmit={e=>{e.preventDefault();confirmCalibration();}}><div className="modal-icon"><Crosshair size={23}/></div><h2>Recalér le document</h2><p>Entrez la distance réelle correspondant aux deux points choisis. Le « 1/100 » imprimé ne garantit pas l’échelle du fichier.</p><label className="text-field">Distance vérifiée, en mètres<input autoFocus aria-label="Distance vérifiée" inputMode="decimal" required value={knownDistance} onChange={e=>setKnownDistance(e.target.value)} placeholder="Ex. 5,00"/></label><label className="text-field">Référence de la cote<input aria-label="Référence de la cote" required value={citation} onChange={e=>setCitation(e.target.value)} placeholder="Ex. cote 5 m, barre graphique en bas de page"/></label><p className="help">Recalage uniforme sans correction de perspective. Utilisez un document orthogonal et vérifiez une seconde cote.</p><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setCalibration(null)}>Annuler</button><button className="primary-btn" type="submit">Appliquer l’échelle</button></div></form></div>}
  </div>;
}
