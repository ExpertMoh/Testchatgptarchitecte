import { createDemo } from '../model/demo';
import { createReferenceProject } from '../model/reference';
import { parseProject, STORAGE_KEY } from './files';

export const DEMO_BACKUP_KEY=STORAGE_KEY+':demo-before-reference';
export function loadInitialProject(storage:Pick<Storage,'getItem'|'setItem'>){
  let raw:string|null=null;
  try{
    raw=storage.getItem(STORAGE_KEY);
    if(!raw)return {project:createReferenceProject(),error:'',saveEnabled:true};
    const project=parseProject(raw);
    if(project.id==='charleroi-demo'&&JSON.stringify(project)===JSON.stringify(parseProject(JSON.stringify(createDemo())))){
      if(!storage.getItem(DEMO_BACKUP_KEY))storage.setItem(DEMO_BACKUP_KEY,raw);
      return {project:createReferenceProject(),error:'Le relevé du PDF remplace la démonstration intacte. Celle-ci a été sauvegardée séparément.',saveEnabled:true};
    }
    return {project,error:'',saveEnabled:true};
  }catch{
    if(raw){
      try{if(!storage.getItem(STORAGE_KEY+':unreadable'))storage.setItem(STORAGE_KEY+':unreadable',raw);}
      catch{return{project:createReferenceProject(),error:'La sauvegarde est illisible et n’a pas été écrasée. Exportez vos données avant de changer de projet.',saveEnabled:false};}
    }
    return {project:createReferenceProject(),error:'La sauvegarde locale est illisible. Une copie a été conservée ; le relevé du PDF est affiché.',saveEnabled:true};
  }
}
