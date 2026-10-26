import type { Floor, Opening, Room, Selection, Wall, XY } from './schema';
import { distance, projectOnWall, roomPoints, wallGeometry, xy } from './geometry';

/** Navigation conventions, not measurements of the building or accessibility criteria. */
export const VISITOR = { radius: .18, eye: 1.65, clearance: 1.8, speed: 1.6 };
export function segmentDistance(p:XY,a:XY,b:XY) {
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
  const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
  return distance(p,{x:a.x+t*dx,y:a.y+t*dy});
}
export function inside(p:XY,ps:XY[]) {
  if(ps.length<3)return false;
  if(ps.some((a,i)=>segmentDistance(p,a,ps[(i+1)%ps.length])<1e-7))return true;
  let yes=false;
  for(let i=0,j=ps.length-1;i<ps.length;j=i++){
    const a=ps[i],b=ps[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
}
function boundaryDistance(p:XY,ps:XY[]){return Math.min(...ps.map((a,i)=>segmentDistance(p,a,ps[(i+1)%ps.length])));}
export function interiorRooms(floor:Floor){return floor.rooms.filter(r=>(!r.kind||r.kind==='interior')&&r.points.every(p=>xy(p)));}
export function roomAt(floor:Floor,p:XY){return interiorRooms(floor).find(r=>inside(p,roomPoints(r)));}
/** A point inside concave rooms, away from boundaries, rather than an unsafe vertex average. */
export function roomEntry(room:Room):XY|null {
  const ps=roomPoints(room);if(ps.length!==room.points.length||ps.length<3)return null;
  const minX=Math.min(...ps.map(p=>p.x)),maxX=Math.max(...ps.map(p=>p.x));
  const minY=Math.min(...ps.map(p=>p.y)),maxY=Math.max(...ps.map(p=>p.y));
  let best:XY|null=null,clearance=-1;
  for(let x=0;x<=24;x++)for(let y=0;y<=24;y++){
    const p={x:minX+(maxX-minX)*x/24,y:minY+(maxY-minY)*y/24};
    if(inside(p,ps)){const d=boundaryDistance(p,ps);if(d>clearance){best=p;clearance=d;}}
  }
  return clearance>=VISITOR.radius?best:null;
}
/** Face the longest visible part of this contour when jumping into a room. */
export function roomHeading(room:Room,p:XY):XY {
  const ps=roomPoints(room);let heading={x:0,y:-1},best=0;
  for(let i=0;i<32;i++){
    const angle=i*Math.PI/16,direction={x:Math.cos(angle),y:Math.sin(angle)};let length=.1;
    while(length<30&&inside({x:p.x+direction.x*length,y:p.y+direction.y*length},ps))length+=.1;
    if(length>best){best=length;heading=direction;}
  }
  return heading;
}
export function openingLocation(floor:Floor,o:Opening) {
  const w=floor.walls.find(w=>w.id===o.wallId),g=w&&wallGeometry(w);
  const offset=o.offset.value,width=o.width.value;
  if(!g||g.length<.001||offset===null||width===null||width<=0||offset<0||offset+width>g.length+.001)return null;
  return {x:g.a.x+Math.cos(g.angle)*(offset+width/2),y:g.a.y+Math.sin(g.angle)*(offset+width/2)};
}
/** Missing or inconsistent dimensions never produce a leaf or an opening in the wall. */
export function doorReadiness(floor:Floor,o:Opening,demonstration=false):string|null {
  if(o.kind!=='door')return 'Cette ouverture est une fenêtre.';
  if(!openingLocation(floor,o))return 'Position ou largeur à documenter.';
  if(o.height.value===null||o.sill.value===null)return 'Hauteur et seuil à documenter dans les propriétés.';
  if(o.height.value<=0||o.sill.value<0||floor.height.value===null||o.height.value+o.sill.value>floor.height.value+.001)return 'Dimensions incompatibles avec la hauteur de l’étage.';
  if(!demonstration&&(!o.hinge||!o.swing||!o.operationSourceId))return 'Gonds, sens d’ouverture et source à documenter.';
  return null;
}
export function effectiveDoor(o:Opening,demo=false):Opening{return demo?{...o,hinge:o.hinge??'start',swing:o.swing??1}:o;}
/** Infers proximity only; it does not certify room ownership or furniture contents. */
export function roomInventory(floor:Floor,room:Room):{selection:NonNullable<Selection>;name:string;label:string;review?:Wall['review']}[] {
  const ps=roomPoints(room);if(ps.length!==room.points.length)return [];
  const near=(p:XY,tolerance:number)=>inside(p,ps)||boundaryDistance(p,ps)<=tolerance;
  const walls=floor.walls.filter(w=>{
    const g=wallGeometry(w);if(!g)return false;
    return ps.some((p,i)=>{
      const q=ps[(i+1)%ps.length];
      return Math.min(segmentDistance(p,g.a,g.b),segmentDistance(q,g.a,g.b),segmentDistance(g.a,p,q),segmentDistance(g.b,p,q))<Math.max(.25,(w.thickness.value??0)/2+.08);
    });
  });
  return [
    ...walls.map(w=>({selection:{kind:'wall' as const,id:w.id},name:w.name,label:'Mur',review:w.review})),
    ...floor.openings.filter(o=>{const p=openingLocation(floor,o),w=floor.walls.find(w=>w.id===o.wallId);return p&&near(p,Math.max(.3,(w?.thickness.value??0)/2+.12));}).map(o=>({selection:{kind:'opening' as const,id:o.id},name:o.name,label:o.kind==='door'?'Porte':'Fenêtre',review:o.review})),
    ...floor.stairs.filter(s=>(s.footprint??[s.start,s.end]).some(p=>{const q=xy(p);return q&&near(q,.15);})).map(s=>({selection:{kind:'stair' as const,id:s.id},name:s.name,label:'Escalier',review:s.review})),
  ];
}
function footprint(w:Wall):XY[]{
  if(w.footprint)return w.footprint.map(xy).filter((p):p is XY=>!!p);
  const g=wallGeometry(w),t=w.thickness.value;if(!g||t===null||t<=0)return [];
  const n={x:-Math.sin(g.angle)*t/2,y:Math.cos(g.angle)*t/2};
  return [{x:g.a.x+n.x,y:g.a.y+n.y},{x:g.b.x+n.x,y:g.b.y+n.y},{x:g.b.x-n.x,y:g.b.y-n.y},{x:g.a.x-n.x,y:g.a.y-n.y}];
}
export function canStand(floor:Floor,p:XY,openDoors:ReadonlySet<string>,demo=false):boolean {
  if(floor.height.value===null||floor.height.value<VISITOR.clearance)return false;
  const onFloor=interiorRooms(floor).some(r=>inside(p,roomPoints(r)));
  let inDoorway=false;
  for(const w of floor.walls){
    const outline=footprint(w);if(outline.length<3)continue;
    if(!inside(p,outline)&&boundaryDistance(p,outline)>=VISITOR.radius)continue;
    const projected=projectOnWall(p,w);
    const passage=projected&&floor.openings.find(o=>o.wallId===w.id&&openDoors.has(o.id)&&!doorReadiness(floor,o,demo)&&o.sill.value!<=.08&&o.height.value!>=VISITOR.clearance&&projected.offset>=o.offset.value!+VISITOR.radius&&projected.offset<=o.offset.value!+o.width.value!-VISITOR.radius);
    if(!passage)return false;
    inDoorway=true;
  }
  // An open leaf remains an obstacle. Its zero thickness is intentional: thickness is unmeasured.
  for(const o of floor.openings.filter(o=>openDoors.has(o.id)&&!doorReadiness(floor,o,demo))){
    const door=effectiveDoor(o,demo),w=floor.walls.find(w=>w.id===o.wallId)!,g=wallGeometry(w)!;
    const sign=door.hinge==='end'?-1:1,offset=o.offset.value!+(sign===-1?o.width.value!:0);
    const a={x:g.a.x+Math.cos(g.angle)*offset,y:g.a.y+Math.sin(g.angle)*offset};
    const angle=g.angle+door.swing!*Math.PI/2;
    const b={x:a.x+sign*o.width.value!*Math.cos(angle),y:a.y+sign*o.width.value!*Math.sin(angle)};
    if(segmentDistance(p,a,b)<VISITOR.radius)return false;
  }
  return onFloor||inDoorway;
}
/** Substeps prevent tunnelling through thin walls; axis tests allow sliding along them. */
export function moveVisitor(floor:Floor,start:XY,delta:XY,openDoors:ReadonlySet<string>,demo=false):XY {
  let p={...start};const n=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.y)/.05));
  for(let i=0;i<n;i++){
    const next={x:p.x+delta.x/n,y:p.y+delta.y/n};
    if(canStand(floor,next,openDoors,demo))p=next;
    else {const x={x:next.x,y:p.y};if(canStand(floor,x,openDoors,demo))p=x;const y={x:p.x,y:next.y};if(canStand(floor,y,openDoors,demo))p=y;}
  }
  return p;
}
