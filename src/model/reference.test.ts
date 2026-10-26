import { describe,it,expect } from 'vitest';
import { createReferenceProject } from './reference';
import { ProjectSchema } from './schema';
import { area, floorArea, pixelToWorld, roomArea, roomPoints, selfIntersects, setWallFootprint, sourceBounds, validateGeometry, wallSolids, worldToPixel, xy } from './geometry';
import { parseProject } from '../lib/files';

describe('Relevé du PDF original',()=>{
  it('identifie les pages sources, leurs extraits et le document effectivement reçu',()=>{
    const p=createReferenceProject();expect(ProjectSchema.safeParse(p).success).toBe(true);expect(p.demonstration).toBe(false);
    expect(p.reference?.sha256).toBe('19dbd04b3234c71b7b1f57c324ce2b30dead8841040cc71a26c6a6da438d9c2e');
    expect(p.floors.map(f=>p.sources.find(s=>s.id===f.sourceId)!.page)).toEqual([4,5,6,7,8]);
    expect(p.sources.filter(s=>s.image)).toHaveLength(5);
    expect(p.sources.some(s=>s.kind==='demo')).toBe(false);
  });
  it('conserve les organisations propres à chaque étage, sans réutiliser un plan type',()=>{
    const p=createReferenceProject(),[ss,rdc,one,two,three]=p.floors;
    expect(ss.rooms.map(r=>r.name)).toEqual(['Cave · stock commerce','Cave arrière','WC']);
    expect(rdc.rooms.map(r=>r.name)).toEqual(['Réserve','Commerce','Commun','SAS','Cage d’escalier']);
    expect(one.rooms.some(r=>r.name==='Cuisine')).toBe(true);expect(two.rooms.some(r=>r.name==='Cuisine')).toBe(true);
    expect(three.rooms.some(r=>r.name==='Cuisine-séjour')).toBe(true);const a=pixelToWorld({x:(460-215)*2.2,y:(825-55)*2.2},three.calibration!),b=pixelToWorld({x:(410-215)*2.2,y:(560-55)*2.2},three.calibration!);
    const side=(p:{x:number;y:number},q:{x:number;y:number},r:{x:number;y:number})=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    for(const w of three.walls){const ps=w.footprint!.map(p=>xy(p)!);for(let i=0;i<ps.length;i++){const c=ps[i],d=ps[(i+1)%ps.length];expect(side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0,w.name).toBe(false);}}
    expect(one.stairs[0].footprint!.length).toBeGreaterThan(4);expect(two.stairs[0].footprint!.length).toBeGreaterThan(4);expect(three.stairs[0].footprint).toHaveLength(4);
    expect(one.rooms[0].points).not.toEqual(two.rooms[0].points);
  });
  it('reprend les repères de plancher de la coupe avec des sources explicites',()=>{
    const fs=createReferenceProject().floors;
    expect(fs.map(f=>f.elevation.value)).toEqual([-1.9,0,3.95,7.23,9.77]);
    for(const f of fs){expect(f.elevation.status).toBe('confirmed');expect(f.height.status).toBe('inferred');expect(f.height.sourceId).toBe('plan-p3');}
  });
  it('ne remplit aucune hauteur ni allège d’ouverture non relevée',()=>{
    for(const f of createReferenceProject().floors)for(const o of f.openings){expect(o.height.value).toBeNull();expect(o.sill.value).toBeNull();expect(o.height.status).toBe('unknown');expect(o.width.status).toBe('inferred');}
  });
  it('exclut des surfaces intérieures les espaces arrière dont l’usage n’est pas attesté',()=>{
    const f=createReferenceProject().floors[2];const total=f.rooms.reduce((s,r)=>s+roomArea(r)!,0);
    expect(f.rooms.some(r=>r.kind==='unverified')).toBe(true);expect(floorArea(f)).toBeLessThan(total);
  });
  it('conserve les repères, contours de murs, emprises et images dans le JSON',()=>{
    const p=createReferenceProject();expect(parseProject(JSON.stringify(p))).toEqual(p);
  });
  it('ne contient pas d’erreur géométrique inexpliquée ; les inconnues restent signalées',()=>{
    const p=createReferenceProject(),issues=validateGeometry(p);
    expect(issues.filter(i=>i.severity==='error')).toEqual([]);
    expect(issues.some(i=>i.message.includes('valeur inconnue'))).toBe(true);
    for(const f of p.floors){for(const r of f.rooms)expect(selfIntersects(roomPoints(r)),r.id).toBe(false);for(const w of f.walls)expect(selfIntersects(w.footprint!.map(q=>xy(q)!)),w.id).toBe(false);}
  });
});
describe('Superposition et volumes du tracé',()=>{
  it('fait un aller-retour exact entre pixels du document et mètres dans un repère tourné',()=>{
    for(const f of createReferenceProject().floors){const c=f.calibration!;
      const pixel={x:371.25,y:940.75};const projected=pixelToWorld(pixel,c);const back=worldToPixel(projected,c);
      expect(back.x).toBeCloseTo(pixel.x,8);expect(back.y).toBeCloseTo(pixel.y,8);
      const source=createReferenceProject().sources.find(s=>s.id===f.sourceId)!;const b=sourceBounds(source.pixelWidth!,source.pixelHeight!,c);expect(b.width).toBeGreaterThan(0);expect(b.height).toBeGreaterThan(0);
    }
  });
  it('utilise le même contour matériel pour la 2D et le volume 3D quand les ouvertures verticales sont inconnues',()=>{
    const f=createReferenceProject().floors[2];
    for(const w of f.walls){const solids=wallSolids(w,f,1.1);expect(solids.length,w.id).toBeGreaterThan(0);const modeled=solids.reduce((s,part)=>s+area(part.outline)*(part.top-part.bottom),0);expect(modeled,w.id).toBeCloseTo(area(w.footprint!.map(p=>xy(p)!))*1.1,6);}
  });
  it('actualise axe et épaisseur à partir des parements édités',()=>{
    const w=createReferenceProject().floors[2].walls[0],points=w.footprint!.map(p=>structuredClone(p));
    for(const p of points)p.x.value!+=.25;
    const moved=setWallFootprint(w,points);
    expect(moved.start.x.value!).toBeCloseTo(w.start.x.value!+.25);expect(moved.thickness.value!).toBeCloseTo(w.thickness.value!);expect(moved.start.x.status).toBe('inferred');
  });
});

describe('Contrôles des géométries tracées éditables',()=>{
 it('signale un contour matériel croisé et ne le certifie pas comme cohérent',()=>{
  const p=createReferenceProject(),w=p.floors[0].walls[0];const ps=w.footprint!;w.footprint=[ps[0],ps[2],ps[1],ps[3]];
  expect(validateGeometry(p).some(i=>i.elementId===w.id&&i.message.includes('parements invalide'))).toBe(true);
 });
 it('refuse un facteur de recalage incohérent et omet les volumes incomplets',()=>{
  const p=createReferenceProject(),f=p.floors[2];f.calibration!.metersPerPixel*=2;
  expect(validateGeometry(p).some(i=>i.message.includes('facteur de recalage'))).toBe(true);
  f.walls[0].footprint![0].x={value:null,status:'unknown',sourceId:null,note:'À relever'};
  expect(wallSolids(f.walls[0],f,1.1)).toEqual([]);
 });
});

it('rend visibles les écarts entre une cote écrite et la distance graphique, sans déclarer le relevé exact',()=>{
 const p=createReferenceProject(),room=p.floors[2].rooms.find(r=>r.name==='Chambre')!;
 expect(room.controlDimensions?.[0].expected.value).toBe(3.55);
 expect(room.controlDimensions?.[0].expected.sourceId).toBe('plan-p6');
 expect(validateGeometry(p).some(i=>i.elementId===room.id&&i.message.includes('écart'))).toBe(true);
});
