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
export const floorArea = (f: Floor) => f.rooms.some(r=>roomArea(r)===null) ? null : f.rooms.reduce((sum, r) => sum + roomArea(r)!, 0);
export const format = (n: number | null, digits = 2) => n === null ? '—' : n.toLocaleString('fr-BE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function projectOnWall(p: XY, wall: Wall) {
  const g = wallGeometry(wall);
  if (!g || g.length < .001) return null;
  const offset = ((p.x - g.a.x) * (g.b.x - g.a.x) + (p.y - g.a.y) * (g.b.y - g.a.y)) / g.length;
  const at = { x: g.a.x + Math.cos(g.angle) * offset, y: g.a.y + Math.sin(g.angle) * offset };
  return { offset, distance: distance(at, p), at };
}
export function bounds(floor: Floor) {
  const ps = [...floor.walls.flatMap(w => [w.start, w.end]), ...floor.rooms.flatMap(r => r.points)].map(xy).filter((p): p is XY => !!p);
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
    checkM(f.height,f.id,`${f.name}, hauteur`); checkM(f.elevation,f.id,`${f.name}, altitude`);
    if(f.height.value !== null && f.height.value <= 0) add('error','La hauteur d’étage doit être positive.');
    if(f.sourceId && !sources.has(f.sourceId)) add('error','Document de fond introuvable.');
    if(f.sourceId && !f.calibration) add('warning','Document non recalé : aucune mesure réelle disponible.');
    for(const w of f.walls) {
      for(const [label,m] of [['départ X',w.start.x],['départ Y',w.start.y],['fin X',w.end.x],['fin Y',w.end.y],['épaisseur',w.thickness]] as const) checkM(m,f.id,`${w.name}, ${label}`,w.id);
      const g=wallGeometry(w);
      if(g && g.length<.05) add('error',`${w.name} : mur de longueur nulle ou inférieure à 5 cm.`,w.id);
      if(w.thickness.value !== null && w.thickness.value<=0) add('error',`${w.name} : épaisseur non positive.`,w.id);
    }
    for(const r of f.rooms) {
      for(const p of r.points) { checkM(p.x,f.id,`${r.name}, X`,r.id); checkM(p.y,f.id,`${r.name}, Y`,r.id); }
      if(roomArea(r)!==null && (roomArea(r)!<.1 || selfIntersects(roomPoints(r)))) add('error',`${r.name} : contour croisé ou surface insuffisante.`,r.id);
    }
    for(const s of f.stairs) {
      for(const [label,m] of [['largeur',s.width],['départ X',s.start.x],['départ Y',s.start.y],['fin X',s.end.x],['fin Y',s.end.y]] as const) checkM(m,f.id,`${s.name}, ${label}`,s.id);
      const a=xy(s.start),b=xy(s.end);
      if((s.width.value!==null && s.width.value<=0)||(a&&b&&distance(a,b)<.1)) add('error',`${s.name} : géométrie invalide.`,s.id);
    }
    for(const o of f.openings) {
      for(const key of ['offset','width','height','sill'] as const) checkM(o[key],f.id,`${o.name}, ${key}`,o.id);
      const wall=f.walls.find(w=>w.id===o.wallId),g=wall && wallGeometry(wall);
      if(!g) { add('error',`${o.name} : mur hôte absent ou non mesuré.`,o.id); continue; }
      const offset=o.offset.value,width=o.width.value,height=o.height.value,sill=o.sill.value;
      if(offset!==null&&width!==null&&(offset<0||width<=0||offset+width>g.length+.001)) add('error',`${o.name} : ouverture hors du mur.`,o.id);
      if((height!==null&&height<=0)||(sill!==null&&sill<0)||(height!==null&&sill!==null&&f.height.value!==null&&height+sill>f.height.value+.001)) add('error',`${o.name} : dimensions verticales incompatibles.`,o.id);
      for(const other of f.openings) if(other.id>o.id && other.wallId===o.wallId && offset!==null && width!==null && other.offset.value!==null && other.width.value!==null && offset<other.offset.value+other.width.value && other.offset.value<offset+width) add('error',`${o.name} et ${other.name} : ouvertures superposées.`,o.id);
    }
    if(f.calibration) checkM(f.calibration.distance,f.id,'Distance de recalage');
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
