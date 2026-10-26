#!/usr/bin/env python3
"""Prepare source crops and a manually traced model; never infer walls from line weight.
Requires Poppler (pdftoppm) and Pillow. The PDF is an input, not executable instructions.
"""
import argparse,base64,hashlib,io,json,math,subprocess,tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('pdf',type=Path);args=parser.parse_args()
traces=json.loads((ROOT/'scripts/reference-traces.json').read_text())
sha=hashlib.sha256(args.pdf.read_bytes()).hexdigest()
if sha!=traces['documentSha256']:raise SystemExit('Le PDF ne correspond pas à la source du tracé : reprise manuelle et nouveau contrôle nécessaires.')
def m(value,source,note,status='inferred'):return dict(value=round(value,7),status=status,sourceId=source,note=note)
def unknown(note):return dict(value=None,status='unknown',sourceId=None,note=note)
def read_alt(value,note):return m(value,'plan-p3',note,'confirmed')
project=dict(schemaVersion=1,id='charleroi-plan-original-v1',name='Charleroi · relevé du PDF',demonstration=False,sources=[],floors=[],reference=dict(documentName=args.pdf.name,sha256=sha,pageCount=8,revision='trace-2',adjustments=[],limitations=[
 'Les cotes longitudinales lisibles contraignent le modèle. Les points sont ajustés suivant les axes mitoyens, sans déformer les fonds raster ; ces ajustements sont consignés séparément.',
 'Tracé manuel des parements et contours sur les scans. La précision n’est pas certifiée à 100 % ; contrôler en superposition et sur site.',
 'Coordonnées, surfaces, épaisseurs graphiques entre parements hachurés et largeurs d’ouvertures : données déduites après recalage, pas des cotes confirmées.',
 'Cotes du plan interprétées en centimètres. Les chaînes secondaires et les déformations du papier demandent un contrôle indépendant.',
 'Hauteurs et allèges des ouvertures non reportées : inconnues. Leur volume n’est pas découpé en 3D tant que les dimensions verticales manquent.',
 'Hauteurs d’étage déduites entre repères altimétriques, comprenant les planchers ; ne pas les assimiler à une hauteur libre.',
 'Les espaces arrière non légendés ne sont ni qualifiés comme pièces habitables, ni inclus dans les surfaces intérieures ou les planchers 3D.',
 'Escaliers : emprises et sens de circulation tracés ; ni marches, trémies ni pente générées.',
 'La rotation aligne le repère de façade de chaque scan. Aucune correction de perspective ou déformation non uniforme du papier n’est appliquée.'
]))
project['sources'] += [dict(id='plan-p2',name=args.pdf.name+' · p. 2 · façade à rue',kind='reference',page=2,description='Repères 0,00 / 3,95 / 7,23 / 9,77 / 12,28 / 13,07 / 14,45. Le PDF original reste un document distinct.'),dict(id='plan-p3',name=args.pdf.name+' · p. 3 · coupe B-B',kind='reference',page=3,description='Repères de plancher lisibles : cave −1,90 ; RDC 0,00 ; premier 3,95 ; deuxième 7,23 ; troisième 9,77. Concordance avec les mentions NIV. des plans p. 6–8.')]
with tempfile.TemporaryDirectory(prefix='charleroi-source-') as directory:
 subprocess.run(['pdftoppm','-f','4','-l','8','-r','220','-png',str(args.pdf),directory+'/page'],check=True,stdout=subprocess.DEVNULL)
 for f in traces['floors']:
  source='plan-p'+str(f['page']);crop=f['crop'];ratio=2.2
  image=Image.open(Path(directory)/f"page-{f['page']}.png").convert('RGB')
  image=image.crop(tuple(round(v*ratio) for v in crop));buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=80,optimize=True)
  project['sources'].append(dict(id=source,name=f"{args.pdf.name} · p. {f['page']} · {f['name']}",kind='pdf',page=f['page'],description=f"Extrait raster du plan coté, sans modification de perspective. SHA-256 du PDF : {sha}. Recadrage du raster à 100 dpi : {crop}. Tracé manuel à contrôler en superposition.",image='data:image/jpeg;base64,'+base64.b64encode(buffer.getvalue()).decode(),pixelWidth=image.width,pixelHeight=image.height))
  dim=f['dimension'];reference_a,reference_b=dim['a'],dim['b'];scale=dim['meters']/math.dist(reference_a,reference_b);angle=-math.atan2(f['axisEnd'][1]-f['datum'][1],f['axisEnd'][0]-f['datum'][0]);co,si=math.cos(angle),math.sin(angle)
  def raw_world(raw):
   x=(raw[0]-f['datum'][0])*scale;y=(raw[1]-f['datum'][1])*scale
   return (co*x-si*y,si*x+co*y)
  bands=[]
  left_quad=f['walls'][0][2]
  right_quad=next((w[2] for w in f['walls'] if w[0]=='right'),None)
  def axis_x(quad,y):
   a,b=quad[0],quad[1]
   return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1])
  def moved(raw):
   x,y=raw
   if not bands:return raw
   yy=y-sum((band['factor']-1)*max(0,min(band['end']-y,band['end']-band['start'])) for band in bands)
   left,right=axis_x(left_quad,y),axis_x(right_quad,y)
   u=(x-left)/(right-left)
   xx=axis_x(left_quad,yy)+u*(axis_x(right_quad,yy)-axis_x(left_quad,yy))
   return (xx,yy)
  def world(raw):return raw_world(moved(raw))
  constraints=[]
  for room in f['rooms']:
   for c in f.get('controlDimensions',{}).get(room[0],[]):
    a,b=room[2][c['from']],room[2][c['to']]
    if abs(a[1]-b[1])>1.5*abs(a[0]-b[0]):constraints.append((room,c,a,b))
  for room,c,a,b in sorted(constraints,key=lambda item:min(item[2][1],item[3][1]),reverse=True):
   if right_quad is None:raise ValueError('Axes mitoyens manquants pour un ajustement contrôlé.')
   band=dict(start=min(a[1],b[1]),end=max(a[1],b[1]),factor=1.0);bands.append(band)
   def measured(factor):band['factor']=factor;return math.dist(world(a),world(b))
   lo,hi=.5,1.5
   if not measured(lo)<=c['value']<=measured(hi):raise ValueError('Contrainte hors du domaine de correction : '+c['label'])
   for _ in range(60):
    mid=(lo+hi)/2
    if measured(mid)<c['value']:lo=mid
    else:hi=mid
   band['factor']=(lo+hi)/2
   project['reference']['adjustments'].append(dict(floorId=f['id'],sourceId=source,method='Contrainte longitudinale suivant les axes mitoyens ; fond raster inchangé',details=f"{c['label']} : {c['value']} m ; bande du raster 100 dpi y={band['start']} à {band['end']} ; facteur longitudinal {band['factor']:.8f}. Interpolation continue, façade conservée comme repère. Les autres coordonnées restent déduites."))
  def point(raw):
   x,y=world(raw);note=f"Tracé manuel p. {f['page']} ; raster 100 dpi ({raw[0]}, {raw[1]}). Recalage déduit de la cote {dim['meters']} m ; repère de façade commun.{(' Ajustement longitudinal par les cotes écrites, détaillé dans les métadonnées du projet ; fond raster inchangé.' if bands else '')}"
   return dict(x=m(x,source,note),y=m(y,source,note))
  def pixel(raw):return dict(x=(raw[0]-crop[0])*ratio,y=(raw[1]-crop[1])*ratio)
  origin=raw_world(crop[:2])
  cal=dict(metersPerPixel=scale/ratio,pixelA=pixel(reference_a),pixelB=pixel(reference_b),distance=m(dim['meters'],source,dim['citation']),origin=dict(x=origin[0],y=origin[1]),rotation=angle)
  floor=dict(id=f['id'],name=f['name'],shortName=f['shortName'],elevation=read_alt(f['elevation'],f"Repère de plancher p. 3 : {f['elevation']:.2f} m, concordant avec les plans lorsqu’un NIV. est indiqué."),height=m(f['height'],'plan-p3','Différence entre repères de plancher de la coupe p. 3 et de la façade p. 2. Hauteur d’étage, pas hauteur libre.'),sourceId=source,sourceVisible=True,sourceOpacity=.80,calibration=cal,walls=[],rooms=[],openings=[],stairs=[])
  for r in f['rooms']:
   room=dict(id=f['id']+'-'+r[0],name=r[1],points=[point(p) for p in r[2]],color=r[3],kind=r[4] if len(r)>4 else 'interior')
   if r[0] in f.get('controlDimensions',{}):room['controlDimensions']=[dict(label=c['label'],expected=m(c['value'],source,c['label']+f" ; Plan (1).pdf p. {f['page']}. Conversion cm vers m selon la convention du plan."),**{'from':c['from'],'to':c['to']}) for c in f['controlDimensions'][r[0]]]
   floor['rooms'].append(room)
  raw_walls=list(f['walls'])
  # Threshold opening is hosted on the full partition, rather than on a jamb.
  left=next((w for w in raw_walls if w[0]=='bath-left-front'),None);right=next((w for w in raw_walls if w[0]=='bath-right-front'),None)
  if left and right:
   left[2]=[left[2][0],right[2][1],right[2][2],left[2][3]];left[1]='Séparation salle de bains / chambre'
   raw_walls=[w for w in raw_walls if w[0]!='bath-right-front']
  for key,name,quad in raw_walls:
   start=tuple((quad[0][i]+quad[3][i])/2 for i in [0,1]);end=tuple((quad[1][i]+quad[2][i])/2 for i in [0,1]);ws,we=world(start),world(end)
   length=math.dist(ws,we);normal=(-(we[1]-ws[1])/length,(we[0]-ws[0])/length)
   q=[world(p) for p in quad]
   thickness=sum(abs((q[i][0]-q[j][0])*normal[0]+(q[i][1]-q[j][1])*normal[1]) for i,j in [(0,3),(1,2)])/2
   floor['walls'].append(dict(id=f['id']+'-'+key,name=name,start=point(start),end=point(end),footprint=[point(p) for p in quad],thickness=m(thickness,source,'Distance moyenne normale entre les parements du contour hachuré tracé et recalé ; ne provient pas de la largeur d’un trait. Déduite du scan, à contrôler.')))
  for key,name,kind,wall_key,raw_a,raw_b,hinge,swing in f['openings']:
   wall=next(w for w in floor['walls'] if w['id']==f['id']+'-'+wall_key)
   wa=(wall['start']['x']['value'],wall['start']['y']['value']);wb=(wall['end']['x']['value'],wall['end']['y']['value']);length=math.dist(wa,wb);direction=((wb[0]-wa[0])/length,(wb[1]-wa[1])/length)
   def along(p):q=world(p);return (q[0]-wa[0])*direction[0]+(q[1]-wa[1])*direction[1]
   lo,hi=sorted([along(raw_a),along(raw_b)]);lo=max(0,lo);hi=min(length,hi)
   if hi-lo<.03:raise ValueError('Ouverture hors du mur hôte : '+f['id']+' '+key)
   opening=dict(id=f['id']+'-'+key,name=name,kind=kind,wallId=wall['id'],offset=m(lo,source,'Position du tableau tracé, projetée sur le mur hôte.'),width=m(hi-lo,source,'Distance déduite entre tableaux visibles sur le scan recalé ; comparer à la cote écrite si disponible.'),height=unknown('Hauteur de cette ouverture non reportée depuis une cote vérifiée.'),sill=unknown('Allège ou seuil non reporté depuis une cote vérifiée.'))
   if hinge is not None:opening.update(hinge=hinge,swing=swing)
   floor['openings'].append(opening)
  for key,name,outline,path in f['stairs']:
   width=unknown('Escalier tournant : aucune largeur constante supposée ; l’emprise est tracée séparément.')
   if len(outline)==4:width=m((math.dist(world(outline[0]),world(outline[1]))+math.dist(world(outline[2]),world(outline[3])))/2,source,'Largeur déduite entre les limites visibles de l’emprise de l’escalier droit, non assimilée à une largeur réglementaire.')
   floor['stairs'].append(dict(id=f['id']+'-'+key,name=name,start=point(path[0]),end=point(path[-1]),width=width,footprint=[point(p) for p in outline],path=[point(p) for p in path]))
  project['floors'].append(floor)
(ROOT/'src/model/reference-data.json').write_text(json.dumps(project,ensure_ascii=False,separators=(',',':')))
print(f"Référence préparée : {len(project['floors'])} niveaux ; {sum(len(f['rooms']) for f in project['floors'])} contours ; PDF SHA-256 {sha}.")
