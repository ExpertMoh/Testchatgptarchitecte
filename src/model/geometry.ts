import type { Point, XY, Wall, Room, Floor, Project, Measure } from './schema';
export const xy = (p: Point): XY | null => p.x.value === null || p.y.value === null ? null : { x: p.x.value, y: p.y.value };
export const distance = (a: XY, b: XY) => Math.hypot(b.x - a.x, b.y - a.y);
export function wallGeometry(wall: Wall) {
  const a = xy(wall.start), b = xy(wall.end);
  if (!a || !b) return null;
  return { a, b, length: distance(a, b), angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
export const roomPoints = (r: Room) => r.points.map(xy).filter((p): p is XY => p !== null);
export function area(points: XY[]) {
  return Math.abs(points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
}
export const roomArea = (r: Room) => r.points.some(p => !xy(p)) ? null : area(roomPoints(r));
export const floorArea = (f: Floor) => { const rooms=f.rooms.filter(r=>!r.kind||r.kind==='interior'); return rooms.some(r=>roomArea(r)===null)?null:rooms.reduce((sum,r)=>sum+roomArea(r)!,0); };
export const format = (n: number | null, digits = 2) => n === null ? '—' : n.toLocaleString('fr-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function projectOnWall(p: XY, wall: Wall) {
  const g = wallGeometry(wall);
  if (!g || g.length < .001) return null;
  const offset = ((p.x - g.a.x) * (g.b.x - g.a.x) + (p.y - g.a.y) * (g.b.y - g.a.y)) / g.length;
  const at = { x: g.a.x + Math.cos(g.angle) * offset, y: g.a.y + Math.sin(g.angle) * offset };
  return { offset, distance: distance(at, p), at };
}
export function bounds(floor: Floor) {
  const ps = [...floor.walls.flatMap(w => w.footprint ?? [w.start, w.end]), ...floor.rooms.flatMap(r => r.points)].map(xy).filter((p): p is XY => !!p);
  if (!ps.length) return { x: -1.8, y: -1.5, width: 10.2, height: 16 };
  const minX = Math.min(...ps.map(p => p.x)), maxX = Math.max(...ps.map(p => p.x));
  const minY = Math.min(...ps.map(p => p.y)), maxY = Math.max(...ps.map(p => p.y));
  return { x: minX - 1.5, y: minY - 1.4, width: Math.max(maxX - minX + 3, 5), height: Math.max(maxY - minY + 2.8, 5) };
}
function cross(a: XY, b: XY, c: XY) { return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
export function selfIntersects(ps: XY[]) {
  for (let i=0;i<ps.length;i++) for(let j=i+1;j<ps.length;j++) {
    if(j===i+1 || (i===0 && j===ps.length-1)) continue;
    const a=ps[i],b=ps[(i+1)%ps.length],c=ps[j],d=ps[(j+1)%ps.length];
    if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) return true;
  }
  return false;
}
export type Issue = { severity: 'error' | 'warning'; floorId: string; elementId?: string; message: string };
export function validateGeometry(project: Project): Issue[] {
  const issues: Issue[] = [], sources = new Set(project.sources.map(s => s.id));
  const checkM = (m: Measure, floorId: string, label: string, elementId?: string) => {
    if(m.value === null) issues.push({ severity:'warning',floorId,elementId,message:`${label} : valeur inconnue.` });
    else if(!m.sourceId || !sources.has(m.sourceId)) issues.push({ severity:'error',floorId,elementId,message:`${label} : source absente.` });
  };
  const ids = new Set<string>();
  for(const f of project.floors) {
    const add = (severity: Issue['severity'], message: string, elementId?: string) => issues.push({severity,message,floorId:f.id,elementId});
    for(const e of [f,...f.walls,...f.rooms,...f.openings,...f.stairs]) { if(ids.has(e.id)) add('error','Identifiant dupliqué.',e.id); ids.add(e.id); }
    for(const e of [...f.walls,...f.rooms,...f.openings,...f.stairs])if(e.review?.sourceId&&!sources.has(e.review.sourceId))add('warning',`${e.name} : source de l’observation introuvable.`,e.id);
    checkM(f.height,f.id,`${f.name}, hauteur`); checkM(f.elevation,f.id,`${f.name}, altitude`);
    if(f.height.value !== null && f.height.value <= 0) add('error','La hauteur d’étage doit être positive.');
    if(f.sourceId && !sources.has(f.sourceId)) add('error','Document de fond introuvable.');
    if(f.sourceId && !f.calibration) add('warning','Document non recalé : aucune mesure réelle disponible.');
    for(const w of f.walls) {
      for(const [label,m] of [['départ X',w.start.x],['départ Y',w.start.y],['fin X',w.end.x],['fin Y',w.end.y],['épaisseur',w.thickness]] as const) checkM(m,f.id,`${w.name}, ${label}`,w.id);
      if(w.footprint){for(const p of w.footprint){checkM(p.x,f.id,`${w.name}, parement X`,w.id);checkM(p.y,f.id,`${w.name}, parement Y`,w.id);}const ps=w.footprint.map(xy);if(ps.every(p=>!!p)&&(area(ps as XY[])<.001||selfIntersects(ps as XY[])))add('error',`${w.name} : contour de parements invalide.`,w.id);}
      const g=wallGeometry(w);
      if(g && g.length<.05) add('error',`${w.name} : mur de longueur nulle ou inférieure à 5 cm.`,w.id);
      if(w.thickness.value !== null && w.thickness.value<=0) add('error',`${w.name} : épaisseur non positive.`,w.id);
    }
    for(const r of f.rooms) {
      for(const c of controlMeasurements(r)){checkM(c.expected,f.id,`${r.name}, ${c.label}`,r.id);if(c.observed===null)add('warning',`${r.name}, ${c.label} : extrémité de contrôle inconnue.`,r.id);else if(c.delta!==null&&Math.abs(c.delta)>.05)add('warning',`${r.name}, ${c.label} : tracé ${format(c.observed)} m / cote ${format(c.expected.value)} m ; écart ${format(c.delta)} m à corriger ou vérifier.`,r.id);}
      if(r.kind==='unverified')add('warning',`${r.name} : usage non attesté.`,r.id);
      for(const p of r.points) { checkM(p.x,f.id,`${r.name}, X`,r.id); checkM(p.y,f.id,`${r.name}, Y`,r.id); }
      if(roomArea(r)!==null && (roomArea(r)!<.1 || selfIntersects(roomPoints(r)))) add('error',`${r.name} : contour croisé ou surface insuffisante.`,r.id);
    }
    for(const s of f.stairs) {
      for(const [label,m] of [['largeur',s.width],['départ X',s.start.x],['départ Y',s.start.y],['fin X',s.end.x],['fin Y',s.end.y]] as const) checkM(m,f.id,`${s.name}, ${label}`,s.id);
      const a=xy(s.start),b=xy(s.end);
      if((s.width.value!==null && s.width.value<=0)||(a&&b&&distance(a,b)<.1)) add('error',`${s.name} : géométrie invalide.`,s.id);
    }
    for(const o of f.openings) {
      if(o.operationSourceId&&!sources.has(o.operationSourceId))add('error',`${o.name} : source du mécanisme introuvable.`,o.id);
      for(const key of ['offset','width','height','sill'] as const) checkM(o[key],f.id,`${o.name}, ${key}`,o.id);
      const wall=f.walls.find(w=>w.id===o.wallId),g=wall && wallGeometry(wall);
      if(!g) { add('error',`${o.name} : mur hôte absent ou non mesuré.`,o.id); continue; }
      const offset=o.offset.value,width=o.width.value,height=o.height.value,sill=o.sill.value;
      if(offset!==null&&width!==null&&(offset<0||width<=0||offset+width>g.length+.001)) add('error',`${o.name} : ouverture hors du mur.`,o.id);
      if((height!==null&&height<=0)||(sill!==null&&sill<0)||(height!==null&&sill!==null&&f.height.value!==null&&height+sill>f.height.value+.001)) add('error',`${o.name} : dimensions verticales incompatibles.`,o.id);
      for(const other of f.openings) if(other.id>o.id && other.wallId===o.wallId && offset!==null && width!==null && other.offset.value!==null && other.width.value!==null && offset<other.offset.value+other.width.value && other.offset.value<offset+width) add('error',`${o.name} et ${other.name} : ouvertures superposées.`,o.id);
    }
    if(f.calibration){checkM(f.calibration.distance,f.id,'Distance de recalage');if(f.calibration.distance.value!==null&&Math.abs(distance(f.calibration.pixelA,f.calibration.pixelB)*f.calibration.metersPerPixel-f.calibration.distance.value)>1e-5)add('error','Le facteur de recalage ne correspond pas à la cote de référence.');}
  }
  for(let i=0;i<project.floors.length;i++) for(let j=i+1;j<project.floors.length;j++) {
    const a=project.floors[i],b=project.floors[j], ae=a.elevation.value,be=b.elevation.value,ah=a.height.value,bh=b.height.value;
    if(ae!==null&&be!==null&&ah!==null&&bh!==null&&ae<be+bh-.001&&be<ae+ah-.001) issues.push({severity:'error',floorId:a.id,message:`Volumes d’étage superposés : ${a.name} / ${b.name}.`});
  }
  return issues;
}

export type WallPiece = { from:number; to:number; bottom:number; top:number };
/** Rectangle decomposition gives real holes without CSG or fictitious dimensions. */
export function wallPieces(wall: Wall, floor: Floor, clipHeight: number): WallPiece[] {
  const g=wallGeometry(wall),height=floor.height.value;
  if(!g||g.length<.05||height===null||height<=0||wall.thickness.value===null||wall.thickness.value<=0)return [];
  const top=Math.min(height,clipHeight);
  const openings=floor.openings.filter(o=>o.wallId===wall.id&&o.offset.value!==null&&o.width.value!==null&&o.height.value!==null&&o.sill.value!==null).filter(o=>o.offset.value!>=0&&o.width.value!>0&&o.height.value!>0&&o.sill.value!>=0&&o.offset.value!+o.width.value!<=g.length+.001&&o.height.value!+o.sill.value!<=height+.001);
  const edges=[...new Set([0,g.length,...openings.flatMap(o=>[o.offset.value!,o.offset.value!+o.width.value!])])].sort((a,b)=>a-b);
  const pieces:WallPiece[]=[];
  for(let i=0;i<edges.length-1;i++){
    const from=edges[i],to=edges[i+1],mid=(from+to)/2;
    const voids=openings.filter(o=>mid>o.offset.value!&&mid<o.offset.value!+o.width.value!).map(o=>({bottom:Math.min(top,o.sill.value!),top:Math.min(top,o.sill.value!+o.height.value!)})).sort((a,b)=>a.bottom-b.bottom);
    let y=0;
    for(const hole of voids){if(hole.bottom>y)pieces.push({from,to,bottom:y,top:hole.bottom});y=Math.max(y,hole.top);}
    if(y<top)pieces.push({from,to,bottom:y,top});
  }
  return pieces.filter(p=>p.to-p.from>.001&&p.top-p.bottom>.001);
}


type Registration = Pick<NonNullable<Floor['calibration']>, 'metersPerPixel'|'origin'|'rotation'>;

/** World registration retains the scan; rotation only aligns the same facade datum. */
export function pixelToWorld(pixel: XY, calibration: Registration): XY {
  const a=calibration.rotation??0, o=calibration.origin??{x:0,y:0}, s=calibration.metersPerPixel;
  return {x:o.x+s*(Math.cos(a)*pixel.x-Math.sin(a)*pixel.y),y:o.y+s*(Math.sin(a)*pixel.x+Math.cos(a)*pixel.y)};
}
export function worldToPixel(world: XY, calibration: Registration): XY {
  const a=calibration.rotation??0, o=calibration.origin??{x:0,y:0}, s=calibration.metersPerPixel;
  const x=world.x-o.x,y=world.y-o.y;
  return {x:(Math.cos(a)*x+Math.sin(a)*y)/s,y:(-Math.sin(a)*x+Math.cos(a)*y)/s};
}
export function sourceBounds(width:number,height:number,calibration:Registration) {
  const ps=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>pixelToWorld(p,calibration));
  const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));
  return {x,y,width:Math.max(...ps.map(p=>p.x))-x,height:Math.max(...ps.map(p=>p.y))-y};
}
function clipOutline(points:XY[], origin:XY, direction:XY, bound:number,keepAbove:boolean):XY[] {
  const result:XY[]=[];
  const signed=(p:XY)=>(p.x-origin.x)*direction.x+(p.y-origin.y)*direction.y-bound;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=signed(a),db=signed(b);
    const insideA=keepAbove?da>=-1e-8:da<=1e-8,insideB=keepAbove?db>=-1e-8:db<=1e-8;
    if(insideA)result.push(a);
    if(insideA!==insideB){const t=da/(da-db);result.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
  }
  return result;
}
export function wallSolids(wall:Wall,floor:Floor,clipHeight:number) {
  const g=wallGeometry(wall);if(!g||wall.footprint?.some(p=>!xy(p)))return [];
  const t=wall.thickness.value;if(t===null||t<=0)return [];
  const normal={x:-Math.sin(g.angle)*t/2,y:Math.cos(g.angle)*t/2};
  const outline=wall.footprint?wall.footprint.map(xy).filter((p):p is XY=>!!p):[
    {x:g.a.x+normal.x,y:g.a.y+normal.y},{x:g.b.x+normal.x,y:g.b.y+normal.y},
    {x:g.b.x-normal.x,y:g.b.y-normal.y},{x:g.a.x-normal.x,y:g.a.y-normal.y}];
  if(outline.length<3)return [];
  const direction={x:Math.cos(g.angle),y:Math.sin(g.angle)};
  const projections=outline.map(p=>(p.x-g.a.x)*direction.x+(p.y-g.a.y)*direction.y);
  return wallPieces(wall,floor,clipHeight).map(part=>{
    const from=part.from<=1e-8?Math.min(...projections):part.from;
    const to=part.to>=g.length-1e-8?Math.max(...projections):part.to;
    const shape=clipOutline(clipOutline(outline,g.a,direction,from,true),g.a,direction,to,false);
    return {...part,outline:shape};
  }).filter(part=>part.outline.length>=3&&area(part.outline)>1e-8);
}

/** Editing traced parements also refreshes the host axis and its derived thickness. */
export function setWallFootprint(wall:Wall,footprint:Point[]):Wall {
  const mid=(a:Point,b:Point):Point=>({x:averageMeasure(a.x,b.x),y:averageMeasure(a.y,b.y)});
  const start=mid(footprint[0],footprint[3]),end=mid(footprint[1],footprint[2]);
  const a=xy(start),b=xy(end),ps=footprint.map(xy);
  let thickness=unknownMeasure('Épaisseur du contour à documenter.');
  if(a&&b&&distance(a,b)>.001&&ps.every(p=>!!p)){
    const length=distance(a,b),nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
    const t=(Math.abs((ps[0]!.x-ps[3]!.x)*nx+(ps[0]!.y-ps[3]!.y)*ny)+Math.abs((ps[1]!.x-ps[2]!.x)*nx+(ps[1]!.y-ps[2]!.y)*ny))/2;
    thickness={value:t,status:'inferred',sourceId:footprint[0].x.sourceId,note:'Distance normale moyenne déduite du contour des parements édité.'};
  }
  return {...wall,footprint,start,end,thickness};
}
function unknownMeasure(note:string):Measure{return{value:null,status:'unknown',sourceId:null,note};}
function averageMeasure(a:Measure,b:Measure):Measure {
  if(a.value===null||b.value===null||!a.sourceId||!b.sourceId)return unknownMeasure('Axe indéterminé car un parement est inconnu.');
  return {value:(a.value+b.value)/2,status:'inferred',sourceId:a.sourceId,note:'Axe déduit de la moyenne des deux parements édités.'};
}


export function controlMeasurements(room:Room){
  return (room.controlDimensions??[]).map(control=>{
    const a=room.points[control.from]&&xy(room.points[control.from]),b=room.points[control.to]&&xy(room.points[control.to]);
    const observed=a&&b?distance(a,b):null;
    const delta=observed!==null&&control.expected.value!==null?observed-control.expected.value:null;
    return {...control,observed,delta};
  });
}
