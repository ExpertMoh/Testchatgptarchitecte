import { useState } from 'react';
import { Box, ChevronRight, FileCheck2, Info, Layers3, Trash2, X } from 'lucide-react';
import type { Floor, Measure, Project, Selection, Point } from '../model/schema';
import { controlMeasurements, format, roomArea, setWallFootprint, wallGeometry } from '../model/geometry';
import { MeasureField } from './MeasureField';

type Props={project:Project;floor:Floor;selection:Selection;onFloor:(f:Floor)=>void;onSelection:(s:Selection)=>void;onDelete:()=>void;onSource:()=>void};
export function Inspector({project,floor,selection,onFloor,onSelection,onDelete,onSource}:Props){
  const [tab,setTab]=useState<'properties'|'sources'>('properties');
  const wall=selection?.kind==='wall'?floor.walls.find(w=>w.id===selection.id):null;
  const room=selection?.kind==='room'?floor.rooms.find(r=>r.id===selection.id):null;
  const opening=selection?.kind==='opening'?floor.openings.find(o=>o.id===selection.id):null;
  const stair=selection?.kind==='stair'?floor.stairs.find(s=>s.id===selection.id):null;
  const entity=wall??room??opening??stair;
  const updateEntity=(key:string,value:unknown)=>{
    if(wall)onFloor({...floor,walls:floor.walls.map(w=>w.id===wall.id?(key==='footprint'?setWallFootprint(w,value as Point[]):{...w,[key]:value}):w)});
    if(room)onFloor({...floor,rooms:floor.rooms.map(r=>r.id===room.id?{...r,[key]:value}:r)});
    if(opening)onFloor({...floor,openings:floor.openings.map(o=>o.id===opening.id?{...o,[key]:value}:o)});
    if(stair)onFloor({...floor,stairs:floor.stairs.map(s=>s.id===stair.id?{...s,[key]:value}:s)});
  };
  const field=(label:string,value:Measure,set:(m:Measure)=>void,min?:number)=><MeasureField key={`${entity?.id??floor.id}-${label}`} label={label} value={value} sources={project.sources} onChange={set} min={min}/>;
  const pointFields=(label:string,p:Point,set:(p:Point)=>void)=><div className="point-fields"><h4>{label}</h4>{field('X · '+label,p.x,x=>set({...p,x}))}{field('Y · '+label,p.y,y=>set({...p,y}))}</div>;
  return <aside className="inspector">
    <div className="panel-tabs"><button className={tab==='properties'?'active':''} onClick={()=>setTab('properties')}>Propriétés</button><button className={tab==='sources'?'active':''} onClick={()=>setTab('sources')}>Sources <span>{project.sources.length}</span></button></div>
    <div className="inspector-scroll">
    {tab==='properties'?<>
      <div className="inspector-heading"><span className="entity-icon">{entity?<Box size={20}/>:<Layers3 size={20}/>}</span><div><small>{entity?({wall:'MUR',room:'PIÈCE',opening:'OUVERTURE',stair:'ESCALIER'}[selection!.kind]):'ÉTAGE ACTIF'}</small><h3>{entity?.name??floor.name}</h3></div>{entity&&<button className="icon-btn" title="Désélectionner" onClick={()=>onSelection(null)}><X size={15}/></button>}</div>
      {entity?<>
        <label className="text-field">Nom de l’élément<input aria-label="Nom de l’élément" value={entity.name} onChange={e=>updateEntity('name',e.target.value)}/></label>
        {wall&&<><div className="derived"><span>Longueur calculée</span><strong>{format(wallGeometry(wall)?.length??null)} m</strong></div>{wall.footprint?<><div className="derived"><span>Épaisseur moyenne · déduite</span><strong>{format(wall.thickness.value)} m</strong></div><p className="wall-provenance">Le contour tracé des deux parements alimente la 2D et la 3D. L’épaisseur est déduite de ce contour, pas de la largeur d’un trait.</p><details><summary>Éditer les parements tracés</summary>{wall.footprint.map((p,i)=><div key={i}>{pointFields(`Parement ${i+1}`,p,v=>updateEntity('footprint',wall.footprint!.map((q,j)=>i===j?v:q)))}</div>)}</details></>:<>{field('Épaisseur réelle',wall.thickness,v=>updateEntity('thickness',v),.01)}{pointFields('Départ',wall.start,v=>updateEntity('start',v))}{pointFields('Fin',wall.end,v=>updateEntity('end',v))}</>}</>}
        {room&&<>{room.controlDimensions&&<div className="dimension-controls"><h4>COTES ÉCRITES / TRACÉ</h4>{controlMeasurements(room).map((c,i)=><div key={i} className={c.delta!==null&&Math.abs(c.delta)>.05?'dimension-mismatch':''}><strong>{c.label}</strong><span>Cote lue : {format(c.expected.value)} m · tracé : {format(c.observed)} m</span><small>{c.delta!==null&&Math.abs(c.delta)>.05?`Écart ${format(c.delta)} m · à corriger ou vérifier`:'Contrôle dans une tolérance de 5 cm'}</small></div>)}</div>}<div className="derived"><span>Surface calculée · déduite</span><strong>{format(roomArea(room))} m²</strong></div><p className="help">Surface du contour dessiné, hors certification de surface habitable.</p><label className="text-field">Nature de l’espace<select aria-label="Nature de l’espace" value={room.kind??'interior'} onChange={e=>updateEntity('kind',e.target.value)}><option value="interior">Espace intérieur</option><option value="exterior">Espace extérieur</option><option value="unverified">Usage non attesté</option></select></label><label className="text-field">Couleur du plan<input aria-label="Couleur de la pièce" type="color" value={room.color} onChange={e=>updateEntity('color',e.target.value)}/></label><details><summary>Coordonnées du contour</summary>{room.points.map((p,i)=><div key={i}>{pointFields(`Point ${i+1}`,p,v=>updateEntity('points',room.points.map((q,j)=>i===j?v:q)))}</div>)}</details></>}
        {opening&&<><label className="text-field">Mur hôte<select aria-label="Mur hôte" value={opening.wallId} onChange={e=>updateEntity('wallId',e.target.value)}>{floor.walls.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>{field('Distance depuis le départ',opening.offset,v=>updateEntity('offset',v),0)}{field('Largeur',opening.width,v=>updateEntity('width',v),.01)}{field('Hauteur',opening.height,v=>updateEntity('height',v),.01)}{field('Allège / seuil',opening.sill,v=>updateEntity('sill',v),0)}</>}
        {stair&&<>{stair.footprint?<><p className="help">Emprise tracée depuis le document. La largeur constante peut rester inconnue pour un escalier tournant.</p><details><summary>Contour de l’emprise</summary>{stair.footprint.map((p,i)=><div key={i}>{pointFields(`Emprise ${i+1}`,p,v=>updateEntity('footprint',stair.footprint!.map((q,j)=>i===j?v:q)))}</div>)}</details></>:<>{field('Largeur de l’emprise',stair.width,v=>updateEntity('width',v),.01)}{pointFields('Départ',stair.start,v=>updateEntity('start',v))}{pointFields('Fin',stair.end,v=>updateEntity('end',v))}</>}<p className="help">Emprise et flèche uniquement. Marches, pente et trémie restent à documenter.</p></>}
        <button className="delete-btn" onClick={onDelete}><Trash2 size={14}/> Supprimer l’élément</button>
      </>:<>
        <label className="text-field">Nom de l’étage<input aria-label="Nom de l’étage" value={floor.name} onChange={e=>onFloor({...floor,name:e.target.value})}/></label>
        {field('Altitude du plancher',floor.elevation,v=>onFloor({...floor,elevation:v}))}
        {field('Hauteur d’étage',floor.height,v=>onFloor({...floor,height:v}),.1)}
        <div className="divider"/><h4>ÉLÉMENTS DU NIVEAU</h4>
        <div className="element-stats"><div><strong>{floor.walls.length}</strong><span>Murs</span></div><div><strong>{floor.rooms.length}</strong><span>Pièces</span></div><div><strong>{floor.openings.length}</strong><span>Ouvertures</span></div></div>
        <div className="hint-card"><Info size={17}/><p>Sélectionnez un élément dans le plan ou la maquette pour consulter ses dimensions et sa provenance.</p></div>
      </>}
      <div className="divider"/><h4>FIABILITÉ DES DONNÉES</h4>
      <ul className="evidence-legend"><li><i className="dot confirmed"/><span>Confirmée</span><small>Cote vérifiée</small></li><li><i className="dot inferred"/><span>Déduite</span><small>Calcul ou tracé</small></li><li><i className="dot unknown"/><span>Inconnue</span><small>À documenter</small></li></ul>
      {project.reference&&<div className="wall-provenance">Relevé du PDF : contours manuels et mesures déduites à contrôler en superposition. Une absence d’erreur géométrique ne certifie pas la fidélité au bâtiment.</div>}{project.demonstration&&<div className="demo-note"><FileCheck2 size={15}/><p>Les valeurs de ce projet sont fictives. Elles ne décrivent pas l’immeuble réel.</p></div>}
    </>:<>
      <div className="section-title"><h3>Documents du projet</h3><span>{project.sources.length}</span></div>
      <p className="help">Chaque cote conserve sa source, son statut et sa justification. Aucun envoi de document à un serveur.</p>
      {project.sources.map(s=><div className="source-card" key={s.id}><div className="source-card-icon"><FileCheck2 size={19}/></div><div><strong>{s.name}</strong><small>{s.kind==='demo'?'DONNÉES FICTIVES':s.kind.toUpperCase()}</small><p>{s.description}</p>{s.image&&<button className="text-button" disabled={floor.walls.length+floor.rooms.length+floor.stairs.length>0} title="L’association est possible sur un étage vide, pour préserver les tracés existants." onClick={()=>onFloor({...floor,sourceId:s.id,calibration:null})}>Afficher sur cet étage <ChevronRight size={12}/></button>}</div></div>)}
      <button className="secondary-btn full-width" onClick={onSource}>Importer un document</button>
    </>}
    </div>
    <div className="inspector-bottom"><span className="live-dot"/> Modèle partagé 2D / 3D <span>v0.1</span></div>
  </aside>;
}
