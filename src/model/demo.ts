import { measure as m, point as p } from './schema';
import type { Project, Floor, Wall, Room } from './schema';

function demoFloor(id: string, name: string, shortName: string, elevation: number, height: number): Floor {
  const wall = (key: string, name: string, ax: number, ay: number, bx: number, by: number, t: number): Wall => ({ id:`${id}-${key}`,name,start:p(ax,ay),end:p(bx,by),thickness:m(t) });
  const room = (key: string, name: string, x: number, y: number, w: number, h: number, color: string): Room => ({id:`${id}-${key}`,name,points:[p(x,y),p(x+w,y),p(x+w,y+h),p(x,y+h)],color});
  const basement=id==='basement', ground=id==='ground';
  return {
    id,name,shortName,elevation:m(elevation),height:m(height),sourceId:null,sourceVisible:true,sourceOpacity:.45,calibration:null,
    walls:[
      wall('front','Façade avant',0,0,6.6,0,.3),wall('right','Mur mitoyen droit',6.6,0,6.6,10.8,.3),
      wall('rear-right','Façade sur cour',6.6,10.8,3.6,10.8,.3),wall('court','Retour sur cour',3.6,10.8,3.6,12.8,.3),
      wall('rear','Façade arrière',3.6,12.8,0,12.8,.3),wall('left','Mur mitoyen gauche',0,12.8,0,0,.3),
      wall('living','Cloison du séjour',0,4.6,6.6,4.6,.12),wall('kitchen','Cloison cuisine / escalier',4.1,4.6,4.1,7.8,.12),
      wall('bed','Cloison de la chambre',0,7.8,6.6,7.8,.12),wall('bath','Cloison salle d’eau',0,10.8,3.6,10.8,.12),
    ],
    rooms:[
      room('living-room',basement?'Stockage':ground?'Commerce':'Séjour',.15,.15,6.3,4.39,'#e4e9db'),
      room('kitchen-room',basement?'Local technique':ground?'Arrière-boutique':'Cuisine',.15,4.66,3.89,3.08,'#eee9dc'),
      room('hall-room','Circulation',4.16,4.66,2.29,3.08,'#e5e3df'),
      room('bed-room',basement?'Cave':ground?'Réserve':'Chambre',.15,7.86,6.3,2.88,'#e0e7e9'),
      room('bath-room',basement?'Rangement':ground?'Sanitaires':'Salle d’eau',.15,10.86,3.3,1.79,'#dce9e5'),
    ],
    openings:[
      {id:`${id}-window1`,name:ground?'Vitrine avant':'Fenêtre avant gauche',kind:'window',wallId:`${id}-front`,offset:m(.7),width:m(1.55),height:m(basement?1.3:1.7),sill:m(.8)},
      {id:`${id}-window2`,name:'Fenêtre avant droite',kind:'window',wallId:`${id}-front`,offset:m(3.8),width:m(1.55),height:m(basement?1.3:1.7),sill:m(.8)},
      {id:`${id}-rear-window`,name:'Fenêtre arrière',kind:'window',wallId:`${id}-rear-right`,offset:m(.65),width:m(1.4),height:m(1.3),sill:m(1)},
      {id:`${id}-door1`,name:'Porte du séjour',kind:'door',wallId:`${id}-living`,offset:m(4.55),width:m(.85),height:m(2.1),sill:m(0)},
      {id:`${id}-door2`,name:'Porte de la cuisine',kind:'door',wallId:`${id}-kitchen`,offset:m(.45),width:m(.8),height:m(2.1),sill:m(0)},
      {id:`${id}-door3`,name:'Porte de la chambre',kind:'door',wallId:`${id}-bed`,offset:m(4.55),width:m(.85),height:m(2.1),sill:m(0)},
      {id:`${id}-door4`,name:'Porte salle d’eau',kind:'door',wallId:`${id}-bath`,offset:m(2.3),width:m(.8),height:m(2.1),sill:m(0)},
    ],
    stairs:[{id:`${id}-stairs`,name:'Emprise d’escalier',start:p(5.3,4.95),end:p(5.3,7.4),width:m(1.05)}],
  };
}
export function createDemo(): Project {
  return {schemaVersion:1,id:'charleroi-demo',name:'Maison de ville · étude',demonstration:true,
    sources:[{id:'demo',name:'Jeu de démonstration',kind:'demo',description:'Géométrie synthétique, sans lien métrique avec l’immeuble réel. Toutes les valeurs sont fictives et déduites de ce jeu de données.'}],
    floors:[demoFloor('basement','Sous-sol','SS',-2.4,2.4),demoFloor('ground','Rez-de-chaussée','RDC',0,3.2),demoFloor('first','Premier étage','R+1',3.2,2.8),demoFloor('second','Deuxième étage','R+2',6,2.8),demoFloor('third','Troisième étage','R+3',8.8,2.8)]};
}
