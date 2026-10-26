import { describe, expect, it } from 'vitest';
import { createDemo } from './demo';
import { createReferenceProject } from './reference';
import { ProjectSchema, point, unknown } from './schema';
import { canStand, doorReadiness, inside, interiorRooms, moveVisitor, openingLocation, roomEntry, roomHeading, roomInventory } from './exploration';

const floor=()=>createDemo().floors.find(f=>f.id==='first')!;
describe('visite intérieure',()=>{
 it('place le visiteur à l’intérieur d’une pièce concave',()=>{
  const r={...floor().rooms[0],points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]].map(([x,y])=>point(x,y))};
  const p=roomEntry(r)!;expect(p).not.toBeNull();expect(inside(p,[{x:0,y:0},{x:4,y:0},{x:4,y:1},{x:1,y:1},{x:1,y:4},{x:0,y:4}])).toBe(true);
  expect(roomEntry({...r,points:[[0,0],[.1,0],[.1,.1],[0,.1]].map(([x,y])=>point(x,y))})).toBeNull();
 });
 it('oriente la caméra vers un point visible de la pièce et refuse une hauteur insuffisante',()=>{
  const f=floor(),r=f.rooms[0],p=roomEntry(r)!,heading=roomHeading(r,p);
  expect(inside({x:p.x+heading.x*.2,y:p.y+heading.y*.2},r.points.map(p=>({x:p.x.value!,y:p.y.value!})))).toBe(true);
  f.height.value=1.5;expect(canStand(f,p,new Set(),true)).toBe(false);
 });
 it('trouve un point dégagé dans chaque espace intérieur du relevé',()=>{
  for(const f of createReferenceProject().floors)for(const r of interiorRooms(f)){
   const p=roomEntry(r);expect(p,`${f.name} / ${r.name}`).not.toBeNull();expect(canStand(f,p!,new Set()),`${f.name} / ${r.name}`).toBe(true);
  }
 });
 it('bloque les murs, les portes fermées et la sortie du plancher',()=>{
  const f=floor();expect(canStand(f,{x:3,y:0},new Set(),true)).toBe(false);
  expect(canStand(f,{x:4.98,y:4.6},new Set(),true)).toBe(false);
  expect(canStand(f,{x:20,y:20},new Set(),true)).toBe(false);
 });
 it('autorise le passage par une porte ouverte documentée, jamais par une ouverture inconnue',()=>{
  const f=floor(),o=f.openings.find(o=>o.id==='first-door1')!,p=openingLocation(f,o)!;
  expect(doorReadiness(f,o)).toContain('Gonds');expect(doorReadiness(f,o,true)).toBeNull();
  expect(canStand(f,p,new Set([o.id]),true)).toBe(true);
  const crossing=moveVisitor(f,{x:p.x,y:4.25},{x:0,y:.75},new Set([o.id]),true);expect(crossing.y).toBeCloseTo(5);
  o.height=unknown();expect(canStand(f,p,new Set([o.id]),true)).toBe(false);expect(doorReadiness(f,o,true)).toContain('Hauteur');
 });
 it('empêche la traversée d’une cloison mince par un déplacement long',()=>{
  const f=floor(),p=moveVisitor(f,{x:2,y:4},{x:0,y:2},new Set(),true);
  expect(p.y).toBeLessThan(4.6-.18);expect(p.y).toBeGreaterThan(4);
 });
 it('garde un obstacle sur le vantail ouvert et bloque une fenêtre même signalée ouverte',()=>{
  const f=floor();expect(canStand(f,{x:4.55,y:5},new Set(['first-door1']),true)).toBe(false);
  expect(canStand(f,{x:1.4,y:0},new Set(['first-window1']),true)).toBe(false);
 });
 it('ne rend pas interactive une porte sans provenance du mécanisme ni dimensions compatibles',()=>{
  const f=floor(),o=f.openings.find(o=>o.kind==='door')!;o.hinge='start';o.swing=1;
  expect(doorReadiness(f,o)).toContain('source');o.operationSourceId='demo';expect(doorReadiness(f,o)).toBeNull();
  o.height.value=30;expect(doorReadiness(f,o)).toContain('incompatibles');
 });
 it('associe les éléments proches sans inventer de mobilier et exclut les espaces non attestés',()=>{
  const f=createReferenceProject().floors.find(f=>f.id==='first')!,r=f.rooms.find(r=>/commun/i.test(r.name))!;
  const inventory=roomInventory(f,r);expect(inventory.some(e=>e.selection.kind==='opening')).toBe(true);expect(inventory.some(e=>e.selection.kind==='wall')).toBe(true);
  expect(interiorRooms(f).some(r=>r.kind==='unverified')).toBe(false);
 });
 it('conserve les observations et les sources dans un aller-retour JSON',()=>{
  const p=createDemo(),r=p.floors[0].rooms[0];r.review={status:'to-improve',note:'Relever la fissure sur site',sourceId:null};
  p.floors[0].openings[3].operationSourceId='demo';const restored=ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
  expect(restored.floors[0].rooms[0].review).toEqual(r.review);expect(restored.floors[0].openings[3].operationSourceId).toBe('demo');
 });
});
