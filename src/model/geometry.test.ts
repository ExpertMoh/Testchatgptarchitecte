import { describe, expect, it } from 'vitest';
import { createDemo } from './demo';
import { ProjectSchema, point, unknown } from './schema';
import { area, distance, floorArea, projectOnWall, roomArea, selfIntersects, validateGeometry, wallPieces } from './geometry';
import { parseProject } from '../lib/files';

describe('Modèle architectural et provenance',()=>{
  it('charge une démonstration valide, identifiée et cohérente sur tous les niveaux',()=>{
    const demo=createDemo();expect(ProjectSchema.parse(demo).demonstration).toBe(true);
    expect(validateGeometry(demo)).toEqual([]);
    expect(demo.floors).toHaveLength(5);
    for(const f of demo.floors){expect(f.height.status).toBe('inferred');expect(f.height.sourceId).toBe('demo');}
  });
  it('refuse une mesure inconnue à laquelle une valeur aurait été inventée',()=>{
    const demo=createDemo();demo.floors[0].height={...unknown(),value:2.5};expect(ProjectSchema.safeParse(demo).success).toBe(false);
  });
  it('refuse une cote renseignée sans provenance',()=>{
    const demo=createDemo();demo.floors[0].height.sourceId=null;expect(ProjectSchema.safeParse(demo).success).toBe(false);
  });
  it('conserve le modèle, les statuts et les références dans un aller-retour JSON',()=>{
    const demo=createDemo();expect(parseProject(JSON.stringify(demo))).toEqual(demo);
  });
  it('rejette un fichier de version incompatible ou des coordonnées non finies',()=>{
    expect(()=>parseProject('{"schemaVersion":99}')).toThrow('Projet incompatible');
    const demo=createDemo();demo.floors[0].walls[0].start.x.value=Infinity;expect(ProjectSchema.safeParse(demo).success).toBe(false);
  });
});
describe('Géométrie métrique partagée',()=>{
  it('calcule des longueurs et des surfaces sans dépendre du rendu',()=>{
    expect(distance({x:0,y:0},{x:3,y:4})).toBe(5);
    expect(area([{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}])).toBe(12);
    const f=createDemo().floors[2];expect(floorArea(f)).toBeCloseTo(70.7424,4);
    const r=f.rooms[0];r.points[0]= {x:unknown(),y:unknown()};expect(roomArea(r)).toBeNull();
  });
  it('projette une ouverture suivant la direction du mur, y compris un mur oblique',()=>{
    const w={...createDemo().floors[0].walls[0],start:point(0,0),end:point(3,4)};
    const p=projectOnWall({x:1.5,y:2},w)!;expect(p.offset).toBeCloseTo(2.5);expect(p.distance).toBeCloseTo(0);
  });
  it('découpe physiquement un mur autour des ouvertures',()=>{
    const f=createDemo().floors[2],w=f.walls[0];const pieces=wallPieces(w,f,Infinity);
    const volume=pieces.reduce((sum,p)=>sum+(p.to-p.from)*(p.top-p.bottom)*w.thickness.value!,0);
    expect(volume).toBeCloseTo((6.6*2.8-2*1.55*1.7)*.3);
    expect(pieces.some(p=>p.from===.7&&p.to===2.25&&p.bottom===.8)).toBe(false);
  });
  it('ne crée pas un volume de mur avec une épaisseur ou une hauteur inconnue',()=>{
    const f=createDemo().floors[2];f.walls[0].thickness=unknown();expect(wallPieces(f.walls[0],f,Infinity)).toEqual([]);
    f.height=unknown();expect(wallPieces(f.walls[1],f,Infinity)).toEqual([]);
    expect(validateGeometry({...createDemo(),floors:[f]}).some(i=>i.severity==='warning')).toBe(true);
  });
  it('détecte les contours croisés et les murs dégénérés',()=>{
    expect(selfIntersects([{x:0,y:0},{x:3,y:3},{x:0,y:3},{x:3,y:0}])).toBe(true);
    const demo=createDemo(),f=demo.floors[2];f.walls[0].end=f.walls[0].start;
    expect(validateGeometry(demo).some(i=>i.message.includes('longueur nulle'))).toBe(true);
  });
  it('détecte les ouvertures hors du mur ou superposées',()=>{
    const demo=createDemo(),f=demo.floors[2];f.openings[0].width.value=20;
    expect(validateGeometry(demo).some(i=>i.message.includes('hors du mur'))).toBe(true);
    expect(validateGeometry(demo).some(i=>i.message.includes('ouvertures superposées'))).toBe(true);
  });
  it('détecte les étages qui se chevauchent et les sources manquantes',()=>{
    const demo=createDemo();demo.floors[2].elevation.value=1;demo.floors[0].height.sourceId='missing';
    expect(validateGeometry(demo).some(i=>i.message.includes('superposés'))).toBe(true);
    expect(validateGeometry(demo).some(i=>i.message.includes('source absente'))).toBe(true);
  });
});
