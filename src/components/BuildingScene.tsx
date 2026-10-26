import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, Html, Line as ThreeLine, OrbitControls, PointerLockControls } from '@react-three/drei';
import { Box, ChevronDown, DoorOpen, Expand, Eye, Footprints, Layers3, List, RotateCcw, ScanLine, View, X } from 'lucide-react';
import * as THREE from 'three';
import type { Floor, Project, Selection, Room, Opening, XY } from '../model/schema';
import { bounds, format, roomArea, roomPoints, wallGeometry, wallSolids, xy } from '../model/geometry';
import { canStand, doorReadiness, effectiveDoor, interiorRooms, moveVisitor, openingLocation, roomAt, roomEntry, roomHeading, roomInventory, VISITOR } from '../model/exploration';

type CameraMode='orbit'|'top'|'walk';
// Stable options prevent Canvas from resetting the camera on live location updates.
const CAMERA={position:[14,16,17] as [number,number,number],fov:35,near:.04,far:200};
const RENDERER={antialias:true};
type Props={project:Project;floor:Floor;selection:Selection;onSelection:(s:Selection)=>void;notify:(s:string)=>void;active:boolean;onExpand:()=>void};
type Destination={point:XY;heading:XY;revision:number};
class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="scene-unavailable"><Box size={32}/><h3>Le rendu 3D est indisponible</h3><p>Activez WebGL dans votre navigateur. Le plan 2D et toutes les données restent accessibles.</p></div>:this.props.children;}
}
function RoomMesh({room,elevation,selected,onClick,labels}:{room:Room;elevation:number;selected:boolean;onClick:()=>void;labels:boolean}) {
  const points=useMemo(()=>roomPoints(room),[room]),entry=useMemo(()=>roomEntry(room),[room]);
  const shape=useMemo(()=>new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.y))),[points]);
  if(points.length!==room.points.length||room.kind==='unverified')return null;
  return <group><mesh rotation={[-Math.PI/2,0,0]} position={[0,elevation,0]} receiveShadow onClick={e=>{e.stopPropagation();onClick();}}><shapeGeometry args={[shape]}/><meshStandardMaterial color={selected?'#d5b68d':room.color} side={THREE.DoubleSide} roughness={.9}/></mesh>
    {labels&&entry&&<Html center position={[entry.x,elevation+.04,entry.y]} zIndexRange={[4,0]} distanceFactor={15}><button className={`room-3d-label ${selected?'selected':''}`} onClick={onClick}>{room.name}{room.review&&<i className={`review-dot ${room.review.status}`}/>}<small>{format(roomArea(room))} m² · déduit</small></button></Html>}
  </group>;
}
function DoorLeaf({floor,opening,open,selected,onClick,clip,demo}:{floor:Floor;opening:Opening;open:boolean;selected:boolean;onClick:()=>void;clip:number;demo:boolean}){
  const hinge=useRef<THREE.Group>(null);
  const {invalidate}=useThree();
  const o=effectiveDoor(opening,demo),wall=floor.walls.find(w=>w.id===o.wallId),g=wall&&wallGeometry(wall);
  useFrame((_,dt)=>{if(hinge.current){const target=open?-o.swing!*Math.PI/2:0;hinge.current.rotation.y=THREE.MathUtils.damp(hinge.current.rotation.y,target,12,Math.min(dt,.05));if(Math.abs(hinge.current.rotation.y-target)>.001)invalidate();}});
  if(!g||doorReadiness(floor,opening,demo))return null;
  const width=o.width.value!,height=Math.min(o.height.value!,clip-o.sill.value!);
  if(height<=0)return null;
  const end=o.hinge==='end',offset=o.offset.value!+(end?width:0),sign=end?-1:1;
  return <group position={[g.a.x+Math.cos(g.angle)*offset,(floor.elevation.value??0)+o.sill.value!,g.a.y+Math.sin(g.angle)*offset]} rotation={[0,-g.angle,0]}>
    <group ref={hinge}><mesh position={[sign*width/2,height/2,0]} onClick={e=>{e.stopPropagation();onClick();}} castShadow>
      <planeGeometry args={[width,height]}/><meshStandardMaterial color={selected?'#d69b68':'#b5a084'} side={THREE.DoubleSide} roughness={.72}/>
    </mesh></group>
  </group>;
}
function FloorMesh({floor,selected,onSelect,clip,ghost,xray,labels,openDoors,onDoor,demo}:{floor:Floor;selected:Selection;onSelect:(s:Selection)=>void;clip:number;ghost:boolean;xray:boolean;labels:boolean;openDoors:ReadonlySet<string>;onDoor:(o:Opening)=>void;demo:boolean}) {
  const elevation=floor.elevation.value,height=floor.height.value;
  const solids=useMemo(()=>floor.walls.map(w=>({wall:w,parts:wallSolids(w,floor,clip).map(part=>({...part,args:[new THREE.Shape(part.outline.map(p=>new THREE.Vector2(p.x,-p.y))),{depth:part.top-part.bottom,bevelEnabled:false}] as [THREE.Shape,THREE.ExtrudeGeometryOptions]}))})),[floor.walls,floor.openings,height,clip]);
  if(elevation===null||height===null||height<=0)return null;
  return <group>
    {floor.rooms.map(r=><RoomMesh key={r.id} room={r} elevation={elevation+.002} selected={selected?.id===r.id} onClick={()=>onSelect({kind:'room',id:r.id})} labels={labels}/>)}
    {solids.map(({wall:w,parts})=><group key={w.id} onClick={e=>{e.stopPropagation();onSelect({kind:'wall',id:w.id});}}>{parts.map((part,i)=>{
      return <mesh key={i} position={[0,elevation+part.bottom,0]} rotation={[-Math.PI/2,0,0]} castShadow={!xray} receiveShadow><extrudeGeometry args={part.args}/><meshStandardMaterial color={selected?.id===w.id?'#bf835a':ghost?'#c5cec4':'#e5e2d7'} roughness={.85} transparent={xray} opacity={xray?.18:1} depthWrite={!xray}/></mesh>;
    })}</group>)}
    {floor.openings.map(o=>{
      if(o.kind==='door'){
        const p=openingLocation(floor,o),reason=doorReadiness(floor,o,demo);
        return reason?(p&&labels?<Html key={o.id} center position={[p.x,elevation+.08,p.y]} distanceFactor={15} zIndexRange={[4,0]}><button className="door-unknown-marker" title={`${o.name} · ${reason}`} onClick={()=>onSelect({kind:'opening',id:o.id})}>Porte · ?</button></Html>:null):<DoorLeaf key={o.id} floor={floor} opening={o} open={openDoors.has(o.id)} selected={selected?.id===o.id} onClick={()=>{onSelect({kind:'opening',id:o.id});onDoor(o);}} clip={clip} demo={demo}/>;
      }
      const w=floor.walls.find(w=>w.id===o.wallId),g=w&&wallGeometry(w),p=openingLocation(floor,o),h=o.height.value,sill=o.sill.value;
      if(!g||!p||h===null||sill===null||h<=0||sill<0||sill>=clip||sill+h>height+.001)return null;
      const shown=Math.min(h,clip-sill);
      return <mesh key={o.id} position={[p.x,elevation+sill+shown/2,p.y]} rotation={[0,-g.angle,0]} onClick={e=>{e.stopPropagation();onSelect({kind:'opening',id:o.id});}}><planeGeometry args={[o.width.value!,shown]}/><meshStandardMaterial color={selected?.id===o.id?'#c88858':'#8db7b3'} transparent opacity={.4} roughness={.18} metalness={.15} side={THREE.DoubleSide}/></mesh>;
    })}
    {floor.stairs.map(s=>{
      const a=xy(s.start),b=xy(s.end),width=s.width.value;
      let ps=s.footprint?.map(xy).filter((p):p is XY=>!!p);
      if(s.footprint&&ps?.length!==s.footprint.length)return null;
      if(!ps&&a&&b&&width!==null&&width>0){const angle=Math.atan2(b.y-a.y,b.x-a.x),n={x:-Math.sin(angle)*width/2,y:Math.cos(angle)*width/2};ps=[{x:a.x+n.x,y:a.y+n.y},{x:b.x+n.x,y:b.y+n.y},{x:b.x-n.x,y:b.y-n.y},{x:a.x-n.x,y:a.y-n.y}];}
      if(!ps)return null;
      const shape=new THREE.Shape(ps.map(p=>new THREE.Vector2(p.x,-p.y))),path=(s.path??[s.start,s.end]).map(xy).filter((p):p is XY=>!!p);
      return <group key={s.id} onClick={e=>{e.stopPropagation();onSelect({kind:'stair',id:s.id});}}><mesh rotation={[-Math.PI/2,0,0]} position={[0,elevation+.012,0]}><shapeGeometry args={[shape]}/><meshStandardMaterial color={selected?.id===s.id?'#bf835a':'#c5b59b'} side={THREE.DoubleSide}/></mesh>{path.length>=2&&<ThreeLine points={path.map(p=>[p.x,elevation+.025,p.y])} color="#816b4c" lineWidth={1.5}/>}</group>;
    })}
  </group>;
}
function SceneActivity({active}:{active:boolean}){
  const invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{if(active)invalidate();},[active,invalidate]);
  return null;
}
function InspectionLight(){
  const light=useRef<THREE.PointLight>(null);
  useFrame(({camera})=>{if(light.current)light.current.position.copy(camera.position);});
  return <pointLight ref={light} intensity={5} distance={14} decay={1.5}/>;
}
function Rig({mode,revision,targetY,frame,destination,center,floor,openDoors,demo,input,onLocation,onInteract,onLock}:{mode:CameraMode;revision:string;targetY:number;frame:[number,number,number];destination:Destination;center:XY;floor:Floor;openDoors:ReadonlySet<string>;demo:boolean;input:MutableRefObject<Set<string>>;onLocation:(p:XY)=>void;onInteract:(p:XY)=>void;onLock:(locked:boolean)=>void}){
  const {camera,gl,size}=useThree(),keys=useRef(new Set<string>()),elapsed=useRef(0);
  const callbacks=useRef({onLocation,onInteract,onLock});callbacks.current={onLocation,onInteract,onLock};
  useEffect(()=>{
    const vertical=35*Math.PI/180,horizontal=2*Math.atan(Math.tan(vertical/2)*size.width/size.height);
    const direction=mode==='top'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,.95,1.3).normalize();
    const right=mode==='top'?new THREE.Vector3(1,0,0):new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();let d=3;
    for(const x of [-frame[0]/2,frame[0]/2])for(const y of [-frame[1]/2,frame[1]/2])for(const z of [-frame[2]/2,frame[2]/2]){
      const p=new THREE.Vector3(x,y,z),depth=p.dot(direction);d=Math.max(d,depth+Math.abs(p.dot(right))/Math.tan(horizontal/2),depth+Math.abs(p.dot(up))/Math.tan(vertical/2));
    }
    d*=1.15;camera.up.set(0,1,0);
    if(mode==='top'){camera.position.set(0,targetY+d,.01);camera.up.set(0,0,-1);camera.lookAt(0,targetY,0);}
    else if(mode==='walk'){camera.position.set(destination.point.x-center.x,VISITOR.eye,destination.point.y-center.y);camera.lookAt(camera.position.x+destination.heading.x*3,VISITOR.eye-1.1,camera.position.z+destination.heading.y*3);callbacks.current.onLocation(destination.point);}
    else{camera.position.copy(direction.multiplyScalar(d).add(new THREE.Vector3(0,targetY,0)));camera.lookAt(0,targetY,0);}
    if(camera instanceof THREE.PerspectiveCamera)camera.fov=mode==='walk'?80:35;
    camera.updateProjectionMatrix();
    // Geometry edits and selections must not reset a visitor's position or orientation.
  },[mode,revision,targetY,camera,size.width,size.height,frame[0],frame[1],frame[2],destination.revision]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(mode!=='walk'||['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;
      if(document.pointerLockElement===gl.domElement){if(['KeyW','KeyZ','KeyS','KeyD','KeyA','KeyQ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.current.add(e.code);if(e.code==='KeyE'&&!e.repeat)callbacks.current.onInteract({x:camera.position.x+center.x,y:camera.position.z+center.y});}
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code),blur=()=>{keys.current.clear();input.current.clear();};
    const lock=()=>{blur();callbacks.current.onLock(document.pointerLockElement===gl.domElement);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('pointerlockchange',lock);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('pointerlockchange',lock);blur();};
  },[mode,gl,camera,center.x,center.y,input]);
  useEffect(()=>()=>{if(document.pointerLockElement===gl.domElement)document.exitPointerLock();},[mode,gl]);
  useFrame((_,dt)=>{
    if(mode!=='walk')return;
    const key=(s:string)=>input.current.has(s)||(document.pointerLockElement===gl.domElement&&keys.current.has(s));
    if(key('look-left'))camera.rotateY(Math.min(dt,.05)*1.3);
    if(key('look-right'))camera.rotateY(-Math.min(dt,.05)*1.3);
    const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)),delta=new THREE.Vector3();
    if(key('KeyW')||key('KeyZ')||key('ArrowUp'))delta.add(forward);
    if(key('KeyS')||key('ArrowDown'))delta.sub(forward);
    if(key('KeyD')||key('ArrowRight'))delta.add(right);
    if(key('KeyA')||key('KeyQ')||key('ArrowLeft'))delta.sub(right);
    if(delta.lengthSq()){
      delta.normalize().multiplyScalar(VISITOR.speed*Math.min(dt,.05));
      const p=moveVisitor(floor,{x:camera.position.x+center.x,y:camera.position.z+center.y},{x:delta.x,y:delta.z},openDoors,demo);
      camera.position.set(p.x-center.x,VISITOR.eye,p.y-center.y);
    }
    elapsed.current+=dt;if(elapsed.current>.2){elapsed.current=0;callbacks.current.onLocation({x:camera.position.x+center.x,y:camera.position.z+center.y});}
  });
  return <>{mode==='walk'?<><PointerLockControls domElement={gl.domElement} selector="#enter-walk"/><InspectionLight/></>:<OrbitControls makeDefault target={[0,targetY,0]} enableRotate={mode!=='top'} minDistance={1} maxDistance={90} maxPolarAngle={Math.PI/2-.02}/>}</>;
}
export function BuildingScene({project,floor,selection,onSelection,notify,onExpand,active}:Props){
  const [all,setAll]=useState(false),[cut,setCut]=useState(true),[mode,setMode]=useState<CameraMode>('orbit'),[reset,setReset]=useState(0);
  const [exploring,setExploring]=useState(false),[labels,setLabels]=useState(false),[xray,setXray]=useState(false),[locked,setLocked]=useState(false);
  const [openDoors,setOpenDoors]=useState<Set<string>>(new Set()),[currentRoomId,setCurrentRoomId]=useState<string|null>(null),[focusedRoomId,setFocusedRoomId]=useState<string|null>(null),[visitorPosition,setVisitorPosition]=useState<XY|null>(null);
  const input=useRef(new Set<string>()),location=useRef<XY|null>(null),layout=useRef<HTMLDivElement>(null);
  const rooms=interiorRooms(floor),living=rooms.find(r=>/séjour|commerce|stock/i.test(r.name))??rooms[0];
  const initial=useMemo(()=>living?roomEntry(living):null,[living]);
  const [destination,setDestination]=useState<Destination>({point:initial??{x:0,y:0},heading:living&&initial?roomHeading(living,initial):{x:0,y:-1},revision:0});
  useEffect(()=>{setOpenDoors(new Set());setMode('orbit');setCurrentRoomId(null);setFocusedRoomId(null);setVisitorPosition(null);location.current=null;},[floor.id,project.id]);
  const [supported]=useState(()=>{try{return !!document.createElement('canvas').getContext('webgl2');}catch{return false;}});
  const floors=all?project.floors:[floor],boxes=floors.map(bounds);
  const minX=Math.min(...boxes.map(b=>b.x)),maxX=Math.max(...boxes.map(b=>b.x+b.width)),minZ=Math.min(...boxes.map(b=>b.y)),maxZ=Math.max(...boxes.map(b=>b.y+b.height));
  const lowest=all?Math.min(...floors.map(f=>f.elevation.value??0)):0,highest=all?Math.max(...floors.map(f=>(f.elevation.value??0)+(f.height.value??0))):cut?1.1:(floor.height.value??0);
  const center={x:(minX+maxX)/2,y:(minZ+maxZ)/2},targetY=(lowest+highest)/2;
  const activeRoom=rooms.find(r=>r.id===(mode==='walk'?currentRoomId:focusedRoomId))??rooms.find(r=>r.id===selection?.id)??living;
  const inventory=activeRoom?roomInventory(floor,activeRoom):[];
  const shownDoors=inventory.filter(e=>e.selection.kind==='opening').map(e=>floor.openings.find(o=>o.id===e.selection.id)!).filter(o=>o.kind==='door');
  const incomplete=floor.openings.filter(o=>o.height.value===null||o.sill.value===null).length;
  const jump=(room:Room)=>{
    const p=roomEntry(room);
    if(!p||!canStand(floor,p,openDoors,project.demonstration)){notify('Aucun point de visite dégagé dans ce contour. Vérifiez les murs et les dimensions.');return;}
    if(floor.elevation.value===null||floor.height.value===null){notify('Renseignez altitude et hauteur avant la visite.');return;}
    setAll(false);setCut(false);setMode('walk');setExploring(true);setCurrentRoomId(room.id);setFocusedRoomId(room.id);onSelection({kind:'room',id:room.id});setDestination(d=>({point:p,heading:project.demonstration?{x:0,y:1}:roomHeading(room,p),revision:d.revision+1}));onExpand();
  };
  const toggleDoor=(o:Opening)=>{
    const reason=doorReadiness(floor,o,project.demonstration);if(reason){notify(reason);return;}
    if(openDoors.has(o.id)&&mode==='walk'&&location.current){const next=new Set(openDoors);next.delete(o.id);if(!canStand(floor,location.current,next,project.demonstration)){notify('Éloignez-vous du passage avant de fermer la porte.');return;}}
    setOpenDoors(prev=>{const next=new Set(prev);if(next.has(o.id))next.delete(o.id);else next.add(o.id);return next;});
  };
  const interact=(p:XY)=>{
    const nearest=floor.openings.filter(o=>o.kind==='door').map(o=>({o,p:openingLocation(floor,o)})).filter(e=>e.p).sort((a,b)=>Math.hypot(a.p!.x-p.x,a.p!.y-p.y)-Math.hypot(b.p!.x-p.x,b.p!.y-p.y))[0];
    if(nearest&&Math.hypot(nearest.p!.x-p.x,nearest.p!.y-p.y)<1.8){onSelection({kind:'opening',id:nearest.o.id});toggleDoor(nearest.o);}else notify('Approchez-vous d’une porte (moins de 1,80 m, convention d’interaction).');
  };
  const trackLocation=(p:XY)=>{location.current=p;setVisitorPosition(p);const id=roomAt(floor,p)?.id??null;setCurrentRoomId(old=>old===id?old:id);};
  const control=(code:string,label:string,text:string)=><button aria-label={label} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);input.current.add(code);}} onPointerUp={()=>input.current.delete(code)} onPointerCancel={()=>input.current.delete(code)} onLostPointerCapture={()=>input.current.delete(code)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();input.current.add(code);}}} onKeyUp={()=>input.current.delete(code)} onBlur={()=>input.current.delete(code)}>{text}</button>;
  return <div ref={layout} className={`scene-layout ${exploring?'exploring':''}`}>
    <div className="scene-board">
      <div className="board-overlays"><span className="board-label">{all?'BÂTIMENT ASSEMBLÉ':mode==='walk'?'VISITE INTÉRIEURE':'MAQUETTE DE L’ÉTAGE'} · {floor.shortName}</span><span className="render-badge"><i/> Temps réel</span></div>
      <SceneBoundary>{supported?<Suspense fallback={<div className="scene-unavailable">Chargement de la maquette…</div>}><Canvas frameloop={!active?'never':mode==='walk'?'always':'demand'} style={{position:'absolute',inset:0}} shadows={mode!=='walk'} dpr={[1,1.5]} camera={CAMERA} onPointerMissed={()=>{if(mode!=='walk')onSelection(null);}} gl={RENDERER}>
        <SceneActivity active={active}/><color attach="background" args={['#e9ede6']}/><ambientLight intensity={mode==='walk'?.9:.65}/><hemisphereLight args={['#fffdf4','#899787',.8]}/><directionalLight castShadow position={[7,18,5]} intensity={1.8} shadow-mapSize={[1024,1024]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-.001}/>
        <group position={[-center.x,all?0:-(floor.elevation.value??0),-center.y]}>{floors.map(f=><FloorMesh key={f.id} floor={f} selected={selection} onSelect={s=>{if(f.id===floor.id){onSelection(s);if(s?.kind==='room')setFocusedRoomId(s.id);}else notify('Sélectionnez cet étage dans le panneau des niveaux.');}} clip={cut&&!all?1.1:Infinity} ghost={all&&f.id!==floor.id} xray={xray} labels={labels&&!all&&mode!=='walk'} openDoors={openDoors} onDoor={toggleDoor} demo={project.demonstration}/>)}</group>
        {mode!=='walk'&&<Grid position={[0,all?lowest-.03:-.03,0]} args={[100,100]} cellSize={1} sectionSize={5} cellColor="#c8d0c2" sectionColor="#b9c4b3" cellThickness={.5} sectionThickness={.7} fadeDistance={45} infiniteGrid/>}
        <Rig mode={mode} revision={`${floor.id}-${all}-${reset}`} targetY={targetY} frame={[Math.max(1,maxX-minX-3),Math.max(1,highest-lowest),Math.max(1,maxZ-minZ-2.8)]} destination={destination} center={center} floor={floor} openDoors={openDoors} demo={project.demonstration} input={input} onLocation={trackLocation} onInteract={interact} onLock={setLocked}/>
      </Canvas></Suspense>:<div className="scene-unavailable"><Box size={32}/><h3>WebGL 2 requis</h3><p>Activez l’accélération graphique pour la vue 3D.</p></div>}</SceneBoundary>
      <div className="scene-side-tools"><button title="Vue orbitale" aria-label="Vue orbitale" className={mode==='orbit'?'active':''} onClick={()=>setMode('orbit')}><View size={18}/></button><button title="Vue de dessus" aria-label="Vue de dessus" className={mode==='top'?'active':''} onClick={()=>setMode('top')}><ScanLine size={18}/></button><button title="Visite intérieure" aria-label="Visite intérieure" className={mode==='walk'?'active':''} onClick={()=>{if(activeRoom)jump(activeRoom);else notify('Tracez un contour de pièce avant de visiter.');}}><Footprints size={18}/></button><button title="Explorer les pièces" aria-label="Explorer les pièces" aria-pressed={exploring} className={exploring?'active':''} onClick={()=>{setExploring(!exploring);onExpand();}}><List size={18}/></button><span/><button title="Réinitialiser la caméra" aria-label="Réinitialiser la caméra" onClick={()=>{setMode('orbit');setReset(n=>n+1);}}><RotateCcw size={16}/></button><button title="Plein écran 3D" aria-label="Plein écran 3D" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>notify('Impossible de quitter le plein écran.'));else if(layout.current?.requestFullscreen)layout.current.requestFullscreen().catch(()=>notify('Le plein écran n’est pas disponible dans ce navigateur.'));else notify('Le plein écran n’est pas disponible dans ce navigateur.');}}><Expand size={16}/></button></div>
      {mode==='walk'&&<><div className="walk-location"><Footprints size={13}/><strong>{rooms.find(r=>r.id===currentRoomId)?.name??'Passage entre pièces'}</strong><span>{floor.shortName}</span></div><div className="walk-minimap" aria-label="Position dans l’étage"><svg viewBox={`${minX+1} ${minZ+.9} ${maxX-minX-2} ${maxZ-minZ-1.8}`} role="img" aria-label="Plan de localisation">{rooms.map(r=><polygon key={r.id} points={roomPoints(r).map(p=>`${p.x},${p.y}`).join(' ')} fill={r.id===currentRoomId?'#b7cba5':'#e4e9da'} stroke="#98ab86" strokeWidth={.04}/>)}{visitorPosition&&<circle cx={visitorPosition.x} cy={visitorPosition.y} r={.16} fill="#b77146" stroke="#fff" strokeWidth={.06}/>}</svg><small>Vous êtes ici</small></div><span className="walk-crosshair" aria-hidden="true">+</span><div className={`walk-help ${locked?'is-locked':''}`}><button id="enter-walk" className="primary-btn"><Footprints size={14}/> {locked?'Visite active · Échap pour libérer':'Entrer dans la visite'}</button><span>ZQSD / WASD · souris · E : porte · Échap : libérer</span><small>Œil à 1,65 m · collisions de navigation · sans validation d’accessibilité</small></div>
        {!locked&&<div className="walk-pad" aria-label="Commandes de déplacement">{control('look-left','Regarder à gauche','↶')}{control('KeyW','Avancer','↑')}{control('look-right','Regarder à droite','↷')}{control('KeyA','Se déplacer à gauche','←')}{control('KeyS','Reculer','↓')}{control('KeyD','Se déplacer à droite','→')}</div>}
      </>}
      <div className="scene-bottom"><span>{mode==='walk'?'Visite · murs infranchissables':'Glisser pour orbiter · molette pour zoomer'}</span><div><button className={all?'active':''} aria-pressed={all} onClick={()=>{setAll(!all);setMode('orbit');}}><Layers3 size={14}/> Assembler</button><button className={cut&&!all?'active':''} aria-pressed={cut&&!all} onClick={()=>{setCut(!cut);setAll(false);setMode('orbit');}}><Box size={14}/> Coupe</button></div></div>
      {cut&&!all&&mode!=='walk'&&<span className="cut-note">Coupe visuelle à 1,10 m</span>}{project.reference&&incomplete>0&&mode!=='walk'&&<span className="reference-3d-note">{incomplete} ouvertures : dimensions verticales inconnues, volumes non découpés</span>}
    </div>
    {exploring&&<aside className="exploration-panel" aria-label="Exploration des pièces"><div className="exploration-heading"><div><small>EXPLORATION 3D</small><h3>Pièces & éléments</h3></div><button className="icon-btn" aria-label="Fermer l’exploration" onClick={()=>setExploring(false)}><X size={15}/></button></div>
      <label className="text-field">Pièce à examiner<select aria-label="Pièce à examiner" value={activeRoom?.id??''} onChange={e=>{setFocusedRoomId(e.target.value);if(mode==='walk'){setMode('orbit');}onSelection({kind:'room',id:e.target.value});}}>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      {activeRoom&&<><button className="primary-btn full-width" onClick={()=>jump(activeRoom)}><Footprints size={14}/> Entrer dans cette pièce</button><div className="room-exploration-meta"><span>{format(roomArea(activeRoom))} m² · surface déduite</span><button className="text-button" onClick={()=>onSelection({kind:'room',id:activeRoom.id})}>Annoter la pièce</button></div></>}
      <div className="exploration-filters"><button aria-pressed={labels} onClick={()=>setLabels(!labels)}><List size={13}/> Noms des pièces</button><button aria-pressed={xray} onClick={()=>setXray(!xray)}><Eye size={13}/> Murs transparents</button></div>
      {xray&&<p className="exploration-note">Filtre visuel uniquement : les murs conservent leur géométrie et leurs collisions.</p>}
      <h4>PORTES À PROXIMITÉ</h4>{shownDoors.length?shownDoors.map(o=>{const reason=doorReadiness(floor,o,project.demonstration);return <div key={o.id} className="exploration-door"><button className="text-button" onClick={()=>onSelection({kind:'opening',id:o.id})}><DoorOpen size={14}/>{o.name}</button>{reason?<><small>{reason}</small><button className="secondary-btn" onClick={()=>onSelection({kind:'opening',id:o.id})}>Documenter cette porte</button></>:<button className="secondary-btn" aria-pressed={openDoors.has(o.id)} onClick={()=>toggleDoor(o)}>{openDoors.has(o.id)?'Fermer':'Ouvrir'} · {o.name}</button>}</div>;}):<p className="help">Aucune porte repérée au voisinage de ce contour.</p>}
      <h4>ÉLÉMENTS DU MODÈLE · {inventory.length}</h4><p className="exploration-note">Rapprochement géométrique à vérifier. Le contenu mobilier et les équipements ne sont pas inventoriés par le PDF.</p><div className="exploration-inventory">{inventory.map(e=><button key={e.selection.id} className={selection?.id===e.selection.id?'active':''} onClick={()=>onSelection(e.selection)}><span><small>{e.label}{e.review?` · ${e.review.status==='done'?'Traité':e.review.status==='to-improve'?'À améliorer':'À vérifier'}`:''}</small><strong>{e.name}</strong></span>{e.review&&<i className={`review-dot ${e.review.status}`}/>}<ChevronDown size={12}/></button>)}</div>
      <p className="exploration-note">Cliquer un élément ouvre ses propriétés, ses sources et son suivi de correction. L’accès direct à une pièce ne certifie pas un chemin praticable.</p>
    </aside>}
  </div>;
}
