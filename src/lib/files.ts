import { ProjectSchema } from '../model/schema';
import type { Project, Source } from '../model/schema';
const MAX_FILE = 20 * 1024 * 1024;
export const STORAGE_KEY = 'charleroi-architecture-v1';
export function parseProject(text: string): Project {
  if(text.length > 40*1024*1024) throw new Error('Le projet dépasse la limite de 40 Mo.');
  const result = ProjectSchema.safeParse(JSON.parse(text));
  if(!result.success) throw new Error(`Projet incompatible : ${result.error.issues[0]?.message ?? 'schéma invalide'}`);
  return result.data;
}
export function download(name: string, contents: string, type: string) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function readDataURL(file: File): Promise<string> {
  return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Lecture du fichier impossible.'));reader.readAsDataURL(file); });
}
export async function importDocument(file: File, page: number): Promise<Source> {
  if(file.size>MAX_FILE) throw new Error('Document trop volumineux : maximum 20 Mo.');
  if(file.type==='application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs=await import('pdfjs-dist');
    const worker=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc=worker;
    const task=pdfjs.getDocument({data:await file.arrayBuffer()});
    try {
      const doc=await task.promise;
      if(!Number.isInteger(page)||page<1||page>doc.numPages) throw new Error(`Ce PDF contient ${doc.numPages} page(s). Choisissez une page entre 1 et ${doc.numPages}.`);
      const sheet=await doc.getPage(page);
      const base=sheet.getViewport({scale:1});
      const viewport=sheet.getViewport({scale:Math.min(2,2400/Math.max(base.width,base.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Rendu PDF indisponible.');
      await sheet.render({canvasContext:ctx,canvas,viewport}).promise;
      return {id:crypto.randomUUID(),name:`${file.name} · p. ${page}`,kind:'pdf',description:`Page ${page}, rasterisée localement. Aucune extraction automatique de cotes.`,image:canvas.toDataURL('image/png'),pixelWidth:canvas.width,pixelHeight:canvas.height,page};
    } finally { await task.destroy(); }
  }
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Format accepté : PDF, PNG, JPG ou WebP.');
  const data=await readDataURL(file);
  const img=new Image();img.src=data; await img.decode();
  if(img.naturalWidth>40000||img.naturalHeight>40000||img.naturalWidth*img.naturalHeight>64000000) throw new Error('Image trop grande : maximum 64 mégapixels et 40 000 px par côté.');
  return {id:crypto.randomUUID(),name:file.name,kind:'image',description:'Document importé localement. Échelle et dimensions à vérifier.',image:data,pixelWidth:img.naturalWidth,pixelHeight:img.naturalHeight};
}
