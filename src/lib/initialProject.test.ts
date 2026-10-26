import {describe,it,expect} from 'vitest';
import {createDemo} from '../model/demo';
import {DEMO_BACKUP_KEY,loadInitialProject} from './initialProject';
import {STORAGE_KEY} from './files';
function storage(raw?:string){const values=new Map<string,string>();if(raw)values.set(STORAGE_KEY,raw);return{values,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};}
describe('Ouverture du relevé sans perte des travaux existants',()=>{
 it('ouvre le relevé source pour un nouveau navigateur',()=>{const result=loadInitialProject(storage());expect(result.project.reference?.documentName).toBe('Plan (1).pdf');expect(result.project.demonstration).toBe(false);});
 it('remplace seulement la démonstration intacte en conservant une copie exacte',()=>{const raw=JSON.stringify(createDemo()),s=storage(raw),result=loadInitialProject(s);expect(result.project.reference).toBeDefined();expect(s.getItem(DEMO_BACKUP_KEY)).toBe(raw);});
 it('préserve la démonstration dès qu’un utilisateur l’a modifiée',()=>{const demo=createDemo();demo.floors[0].name='Ma cave corrigée';const s=storage(JSON.stringify(demo));expect(loadInitialProject(s).project).toEqual(demo);expect(s.getItem(DEMO_BACKUP_KEY)).toBeNull();});
 it('préserve les autres projets et archive une sauvegarde illisible sans la présenter comme valide',()=>{const p=createDemo();p.id='mon-projet';p.name='Travail conservé';expect(loadInitialProject(storage(JSON.stringify(p))).project).toEqual(p);const s=storage('{invalid');const result=loadInitialProject(s);expect(result.error).toContain('illisible');expect(s.getItem(STORAGE_KEY+':unreadable')).toBe('{invalid');});
});
