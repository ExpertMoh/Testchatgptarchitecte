import { Component, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, Line as ThreeLine, OrbitControls, PointerLockControls } from '@react-three/drei';
import { Box, Expand, Footprints, Layers3, RotateCcw, ScanLine, View } from 'lucide-react';
import * as THREE from 'three';
import type { Floor, Project, Selection, Room } from '../model/schema';
import { bounds, roomPoints, wallGeometry, wallPieces, wallSolids, xy } from '../model/geometry';
type CameraMode='orbit'|'top'|'walk';
type Props={project:Project;floor:Floor;selection:Selection;onSelection:(s:Selection)=>void;notify:(s:string)=>void};
class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="scene-unavailable"><Box size={32}/><h3>Le rendu 3D est indisponible</h3><p>Activez WebGL dans votre navigateur. Le plan 2D et toutes les données restent accessibles.</p></div>:this.props.children;}
}
function RoomMesh({room,elevation,selected,onClick}:{room:Room;elevation:number;selected:boolean;onClick:()=>void}) {
  const points=roomPoints(room);
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.y)));
  if(points.length!==room.points.length||room.kind==='unverified')return null;
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,elevation,0]} receiveShadow onClick={e=>{e.stopPropagation();onClick();}}><shapeGeometry args={[shape]}/><meshStandardMaterial color={selected?'#d5b68d':room.color} side={THREE.DoubleSide} roughness={.9}/></mesh>;
}
function FloorMesh({floor,selected,onSelect,clip,ghost}:{floor:Floor;selected:Selection;onSelect:(s:Selection)=>void;clip:number;ghost:boolean}) {
  const elevation=floor.elevation.value,height=floor.height.value;
  if(elevation===null||height===null||height<=0)return null;
  return <group>
    {floor.rooms.map(r=><RoomMesh key={r.id} room={r} elevation={elevation+.002} selected={selected?.id===r.id} onClick={()=>onSelect({kind:'room',id:r.id})}/>)}
    {floor.walls.map(w=>{const g=wallGeometry(w);if(!g)return null;const selectedWall=selected?.id===w.id;if(w.footprint)return <group key={w.id} onClick={e=>{e.stopPropagation();onSelect({kind:'wall',id:w.id});}}>{wallSolids(w,floor,clip).map((part,i)=>{const shape=new THREE.Shape(part.outline.map(p=>new THREE.Vector2(p.x,-p.y)));return <mesh key={i} position={[0,elevation+part.bottom,0]} rotation={[-Math.PI/2,0,0]} castShadow receiveShadow><extrudeGeometry args={[shape,{depth:part.top-part.bottom,bevelEnabled:false}]}/><meshStandardMaterial color={selectedWall?'#bf835a':ghost?'#c5cec4':'#dddcd0'} roughness={.85}/></mesh>;})}</group>;return <group key={w.id} position={[g.a.x,elevation,g.a.y]} rotation={[0,-g.angle,0]} onClick={e=>{e.stopPropagation();onSelect({kind:'wall',id:w.id});}}>{wallPieces(w,floor,clip).map((p,i)=><mesh key={i} castShadow receiveShadow position={[(p.from+p.to)/2,(p.bottom+p.top)/2,0]}><boxGeometry args={[p.to-p.from,p.top-p.bottom,w.thickness.value!]}/><meshStandardMaterial color={selectedWall?'#bf835a':ghost?'#c5cec4':w.thickness.value!>.2?'#dddcd0':'#eeece2'} roughness={.85}/></mesh>)}</group>;})}
    {floor.openings.filter(o=>o.kind==='window').map(o=>{
      const w=floor.walls.find(w=>w.id===o.wallId),g=w&&wallGeometry(w);const offset=o.offset.value,width=o.width.value,h=o.height.value,sill=o.sill.value;
      if(!g||offset===null||width===null||h===null||sill===null||width<=0||h<=0||sill<0||sill>=clip||offset<0||offset+width>g.length+.001)return null;
      const center=offset+width/2,shown=Math.min(h,clip-sill);
      return <mesh key={o.id} position={[g.a.x+Math.cos(g.angle)*center,elevation+sill+shown/2,g.a.y+Math.sin(g.angle)*center]} rotation={[0,-g.angle,0]} onClick={e=>{e.stopPropagation();onSelect({kind:'opening',id:o.id});}}><planeGeometry args={[width,shown]}/><meshStandardMaterial color={selected?.id===o.id?'#c88858':'#8db7b3'} transparent opacity={.48} roughness={.18} metalness={.15} side={THREE.DoubleSide}/></mesh>;
    })}
    {floor.stairs.map(s=>{const a=xy(s.start),b=xy(s.end),width=s.width.value;if(s.footprint){const ps=s.footprint.map(xy);if(ps.some(p=>!p))return null;const shape=new THREE.Shape(ps.map(p=>new THREE.Vector2(p!.x,-p!.y)));const path=(s.path??[s.start,s.end]).map(xy).filter((p):p is NonNullable<typeof p>=>!!p);return <group key={s.id} onClick={e=>{e.stopPropagation();onSelect({kind:'stair',id:s.id});}}><mesh rotation={[-Math.PI/2,0,0]} position={[0,elevation+.012,0]}><shapeGeometry args={[shape]}/><meshStandardMaterial color={selected?.id===s.id?'#bf835a':'#c5b59b'} side={THREE.DoubleSide}/></mesh>{path.length>=2&&<ThreeLine points={path.map(p=>[p.x,elevation+.025,p.y])} color="#816b4c" lineWidth={1.5}/>}</group>;}if(!a||!b||width===null||width<=0)return null;const length=Math.hypot(b.x-a.x,b.y-a.y);const angle=Math.atan2(b.y-a.y,b.x-a.x);return <group key={s.id} position={[a.x,elevation+.012,a.y]} rotation={[0,-angle,0]} onClick={e=>{e.stopPropagation();onSelect({kind:'stair',id:s.id});}}><mesh rotation={[-Math.PI/2,0,0]} position={[length/2,0,0]}><planeGeometry args={[length,width]}/><meshStandardMaterial color={selected?.id===s.id?'#bf835a':'#c5b59b'} side={THREE.DoubleSide}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[length/2,.008,0]}><planeGeometry args={[length*.75,.025]}/><meshBasicMaterial color="#8a785d"/></mesh></group>;})}
  </group>;
}
function Rig({mode,revision,targetY,frame,walkStart,walkDirection}:{mode:CameraMode;revision:string;targetY:number;frame:[number,number,number];walkStart:[number,number];walkDirection:number}) {
  const {camera,gl,size}=useThree();const keys=useRef(new Set<string>());
  useEffect(()=>{
    const vertical=35*Math.PI/180,horizontal=2*Math.atan(Math.tan(vertical/2)*size.width/size.height);
    const direction=mode==='top'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,.95,1.3).normalize();
    const right=mode==='top'?new THREE.Vector3(1,0,0):new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();
    let distance=3;
    for(const x of [-frame[0]/2,frame[0]/2])for(const y of [-frame[1]/2,frame[1]/2])for(const z of [-frame[2]/2,frame[2]/2]){
      const p=new THREE.Vector3(x,y,z),depth=p.dot(direction);
      distance=Math.max(distance,depth+Math.abs(p.dot(right))/Math.tan(horizontal/2),depth+Math.abs(p.dot(up))/Math.tan(vertical/2));
    }
    distance*=1.15;
    if(mode==='top'){camera.position.set(0,targetY+distance,0.01);camera.up.set(0,0,-1);camera.lookAt(0,targetY,0);}
    else if(mode==='walk'){camera.up.set(0,1,0);camera.position.set(walkStart[0],1.65,walkStart[1]);camera.lookAt(walkStart[0],1.65,walkStart[1]+3*walkDirection);}
    else{camera.up.set(0,1,0);camera.position.copy(new THREE.Vector3(1,.95,1.3).normalize().multiplyScalar(distance).add(new THREE.Vector3(0,targetY,0)));camera.lookAt(0,targetY,0);}
    camera.updateProjectionMatrix();
  },[mode,revision,targetY,camera,size.width,size.height,frame[0],frame[1],frame[2],walkStart[0],walkStart[1],walkDirection]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;keys.current.add(e.code);};
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code),blur=()=>keys.current.clear();
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);keys.current.clear();};
  },[]);
  useFrame((_,dt)=>{
    if(mode!=='walk'||document.pointerLockElement!==gl.domElement)return;
    const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
    const step=2*Math.min(dt,.05);
    if(keys.current.has('KeyW')||keys.current.has('KeyZ')||keys.current.has('ArrowUp'))camera.position.addScaledVector(forward,step);
    if(keys.current.has('KeyS')||keys.current.has('ArrowDown'))camera.position.addScaledVector(forward,-step);
    if(keys.current.has('KeyD')||keys.current.has('ArrowRight'))camera.position.addScaledVector(right,step);
    if(keys.current.has('KeyA')||keys.current.has('KeyQ')||keys.current.has('ArrowLeft'))camera.position.addScaledVector(right,-step);
    camera.position.y=1.65;
  });
  return mode==='walk'?<PointerLockControls domElement={gl.domElement} selector="#enter-walk"/>:<OrbitControls makeDefault target={[0,targetY,0]} enableRotate={mode!=='top'} minDistance={3} maxDistance={70} maxPolarAngle={Math.PI/2-.02}/>;
}
export function BuildingScene({project,floor,selection,onSelection,notify}:Props){
  const [all,setAll]=useState(false),[cut,setCut]=useState(true),[mode,setMode]=useState<CameraMode>('orbit'),[reset,setReset]=useState(0);
  const [supported]=useState(()=>{try{const c=document.createElement('canvas');return !!c.getContext('webgl2');}catch{return false;}});
  const floors=all?project.floors:[floor];
  const boxes=floors.map(bounds);
  const minX=Math.min(...boxes.map(b=>b.x)),maxX=Math.max(...boxes.map(b=>b.x+b.width));
  const minZ=Math.min(...boxes.map(b=>b.y)),maxZ=Math.max(...boxes.map(b=>b.y+b.height));
  const lowest=all?Math.min(...floors.map(f=>f.elevation.value??0)):0;
  const highest=all?Math.max(...floors.map(f=>(f.elevation.value??0)+(f.height.value??0))):cut?1.1:(floor.height.value??0);
  const targetY=(lowest+highest)/2;

  const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
  const chosen=(s:Selection,f:Floor)=>{if(f.id!==floor.id){notify('Sélectionnez cet étage dans le panneau des niveaux pour l’éditer.');return;}onSelection(s);};
  const living=floor.rooms.find(r=>/séjour/i.test(r.name));
  const livingPoints=living?roomPoints(living):[];
  const walkStart:[number,number]=livingPoints.length?[livingPoints.reduce((sum,p)=>sum+p.x,0)/livingPoints.length-centerX,livingPoints.reduce((sum,p)=>sum+p.y,0)/livingPoints.length-centerZ]:[0,-4.8];
  const incomplete=floor.openings.filter(o=>o.height.value===null||o.sill.value===null).length;
  const walk=()=>{if(floor.elevation.value===null||floor.height.value===null){notify('Renseignez altitude et hauteur de l’étage avant la visite.');return;}setAll(false);setCut(false);setMode('walk');};
  return <div className="scene-board">
    <div className="board-overlays"><span className="board-label">{all?'BÂTIMENT ASSEMBLÉ':'MAQUETTE DE L’ÉTAGE'} <span>·</span> {all?'3D':floor.shortName}</span><span className="render-badge"><i/> Temps réel</span></div>
    <SceneBoundary>{supported?<Suspense fallback={<div className="scene-unavailable">Chargement de la maquette…</div>}><Canvas shadows dpr={[1,1.8]} camera={{position:[14,16,17],fov:35,near:.05,far:200}} onPointerMissed={()=>onSelection(null)} gl={{antialias:true,preserveDrawingBuffer:false}}>
      <color attach="background" args={['#e9ede6']}/><ambientLight intensity={.65}/><hemisphereLight args={['#fffdf4','#899787',.8]}/><directionalLight castShadow position={[7,18,5]} intensity={1.8} shadow-mapSize={[2048,2048]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-.001}/>
      <group position={[-centerX,all?0:-(floor.elevation.value??0),-centerZ]}>{floors.map(f=><FloorMesh key={f.id} floor={f} selected={selection} onSelect={s=>chosen(s,f)} clip={cut&&!all?1.1:Infinity} ghost={all&&f.id!==floor.id}/>)}</group>
      <Grid position={[0,all?lowest-.03:-.03,0]} args={[100,100]} cellSize={1} sectionSize={5} cellColor="#c8d0c2" sectionColor="#b9c4b3" cellThickness={.5} sectionThickness={.7} fadeDistance={45} infiniteGrid/>
      <Rig mode={mode} revision={`${floor.id}-${all}-${reset}`} targetY={targetY} frame={[Math.max(1,maxX-minX-3),Math.max(1,highest-lowest),Math.max(1,maxZ-minZ-2.8)]} walkStart={walkStart} walkDirection={project.reference?-1:1}/>
    </Canvas></Suspense>:<div className="scene-unavailable"><Box size={32}/><h3>WebGL 2 requis</h3><p>Le modèle et le plan 2D restent disponibles. Activez l’accélération graphique pour la vue 3D.</p></div>}</SceneBoundary>
    <div className="scene-side-tools"><button title="Vue orbitale" aria-label="Vue orbitale" className={mode==='orbit'?'active':''} onClick={()=>setMode('orbit')}><View size={18}/></button><button title="Vue de dessus" aria-label="Vue de dessus" className={mode==='top'?'active':''} onClick={()=>setMode('top')}><ScanLine size={18}/></button><button title="Visite intérieure" aria-label="Visite intérieure" className={mode==='walk'?'active':''} onClick={walk}><Footprints size={18}/></button><span/><button title="Réinitialiser la caméra" onClick={()=>{setMode('orbit');setReset(n=>n+1);}}><RotateCcw size={16}/></button></div>
    {mode==='walk'&&<div className="walk-help"><button id="enter-walk" className="primary-btn"><Footprints size={14}/> Entrer dans la visite</button><span>ZQSD / WASD · souris · Échap pour sortir</span><small>Œil à 1,65 m · sans collisions ni validation d’accessibilité</small></div>}
    <div className="scene-bottom"><span><Expand size={12}/>{mode==='walk'?'Visite à hauteur humaine':'Glisser pour orbiter · molette pour zoomer'}</span><div><button className={all?'active':''} aria-pressed={all} onClick={()=>{setAll(!all);setMode('orbit');}}><Layers3 size={14}/> Assembler</button><button className={cut&&!all?'active':''} aria-pressed={cut&&!all} onClick={()=>{setCut(!cut);setAll(false);setMode('orbit');}}><Box size={14}/> Coupe</button></div></div>
    {cut&&!all&&mode!=='walk'&&<span className="cut-note">Coupe visuelle à 1,10 m</span>}{project.reference&&incomplete>0&&<span className="reference-3d-note">{incomplete} ouvertures : dimensions verticales inconnues, volumes non découpés</span>}
  </div>;
}
