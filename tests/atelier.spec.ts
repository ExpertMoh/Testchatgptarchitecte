import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createDemo } from '../src/model/demo';

async function clickWorld(page:Page,x:number,y:number){
  const screen=await page.locator('#architectural-plan').evaluate((svg,p)=>{const m=(svg as SVGSVGElement).getScreenCTM()!;const q=new DOMPoint(p.x,p.y).matrixTransform(m);return{x:q.x,y:q.y};},{x,y});
  await page.mouse.click(screen.x,screen.y);
}
async function imageFixture(page:Page){
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=1200;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,800,1200);ctx.strokeStyle='#333';ctx.lineWidth=5;ctx.strokeRect(100,100,600,1000);ctx.beginPath();ctx.moveTo(100,600);ctx.lineTo(700,600);ctx.stroke();return c.toDataURL('image/png').split(',')[1];});
  return{ name:'plan-verifie.png',mimeType:'image/png',buffer:Buffer.from(data,'base64') };
}
function pdfFixture(){
  const stream='0.5 w 30 30 200 300 re S BT /F1 18 Tf 40 350 Td (PLAN TEST) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 420] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return{name:'document.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)};
}

test.beforeEach(async({page})=>{const demo=createDemo();demo.id='e2e-demo';await page.addInitScript(p=>{if(!localStorage.getItem('charleroi-architecture-v1'))localStorage.setItem('charleroi-architecture-v1',JSON.stringify(p));},demo);});

test('démarre, affiche un vrai rendu 3D et édite la géométrie partagée',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Premier étage',level:1})).toBeVisible();
  await expect(page.locator('.demo-banner')).toContainText('ne représente pas l’immeuble réel');
  await expect(page.locator('.three-viewport canvas')).toBeVisible();await expect(page.locator('.summary-quality')).toContainText('Géométrie cohérente');
  await clickWorld(page,3.3,0);await expect(page.getByLabel('Épaisseur réelle',{exact:true})).toHaveValue('0.3');
  await page.getByLabel('Épaisseur réelle',{exact:true}).fill('0.42');await page.getByRole('heading',{name:'Premier étage',level:1}).click();
  await expect(page.locator('[data-element-id="first-front"] line').last()).toHaveAttribute('stroke-width','0.42');
  await page.getByRole('button',{name:'Annuler',exact:true}).click();await clickWorld(page,3.3,0);await expect(page.getByLabel('Épaisseur réelle',{exact:true})).toHaveValue('0.3');
  await page.getByRole('button',{name:'Rétablir',exact:true}).click();
  await page.getByRole('button',{name:'Assembler',exact:true}).click();await expect(page.locator('.three-viewport')).toContainText('BÂTIMENT ASSEMBLÉ');
  await page.getByRole('button',{name:'Vue de dessus',exact:true}).click();await page.getByRole('button',{name:'Vue orbitale',exact:true}).click();
  await page.getByRole('button',{name:/Deuxième étage/}).click();await expect(page.getByRole('heading',{name:'Deuxième étage',level:1})).toBeVisible();
  await page.getByRole('button',{name:/Premier étage/}).click();
  await page.screenshot({path:'test-results/atelier-desktop.png',fullPage:true});
  await page.waitForTimeout(750);await page.reload();await clickWorld(page,3.3,0);await expect(page.getByLabel('Épaisseur réelle',{exact:true})).toHaveValue('0.42');
  expect(errors).toEqual([]);
});

test('trace sans inventer une épaisseur, mesure, supprime et annule',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Vue 2D',exact:true}).click();
  await page.getByRole('button',{name:'Mur (M)',exact:true}).click();await clickWorld(page,1,3);await clickWorld(page,3,3);
  await expect(page.getByLabel('Épaisseur réelle',{exact:true})).toHaveValue('');await expect(page.locator('.summary-quality')).toContainText('documenter');
  await expect(page.locator('.inspector')).toContainText('2,00 m');
  await page.getByRole('button',{name:'Mesurer (L)',exact:true}).click();await clickWorld(page,1,3);await clickWorld(page,3,3);
  await expect(page.locator('#architectural-plan')).toContainText('2,00 m · déduit');
  await page.getByRole('button',{name:'Supprimer l’élément',exact:true}).click();await expect(page.locator('.summary-quality')).toContainText('Géométrie cohérente');
  await page.getByRole('button',{name:'Annuler',exact:true}).click();await expect(page.locator('.summary-quality')).toContainText('documenter');
});

test('importe une image, bloque la mesure sans recalage puis préserve les cotes et leurs sources',async({page})=>{
  await page.goto('/');const fixture=await imageFixture(page);
  await page.getByRole('button',{name:'Importer des plans',exact:true}).click();await page.getByLabel('Fichier du plan').setInputFiles(fixture);
  await page.getByRole('button',{name:'Importer le document',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Niveau à documenter',level:1})).toBeVisible();await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('.board-label').first()).toContainText('NON RECALÉ');
  await page.getByRole('button',{name:'Mesurer (L)',exact:true}).click();await clickWorld(page,1,4);await expect(page.getByRole('status')).toContainText('Recalez le document');
  await page.getByRole('button',{name:'Recaler (C)',exact:true}).click();await clickWorld(page,1,4);await clickWorld(page,7,4);
  await page.getByLabel('Distance vérifiée',{exact:true}).fill('6');await page.getByLabel('Référence de la cote',{exact:true}).fill('Cote 6,00 m testée sur la façade');await page.getByRole('button',{name:'Appliquer l’échelle'}).click();
  await expect(page.locator('.board-label').first()).toContainText('PLAN VECTORIEL');
  await page.getByRole('button',{name:'Mur (M)',exact:true}).click();await clickWorld(page,1,6);await clickWorld(page,7,6);
  await expect(page.locator('.inspector')).toContainText('6,00 m');await expect(page.getByLabel('Épaisseur réelle',{exact:true})).toHaveValue('');
  await page.locator('.measure-field').filter({has:page.getByLabel('Épaisseur réelle',{exact:true})}).getByTitle('Provenance de la valeur').click();
  await page.getByLabel('Source : Épaisseur réelle',{exact:true}).selectOption({label:'plan-verifie.png'});
  await page.getByLabel('Épaisseur réelle',{exact:true}).fill('0.25');await page.getByRole('heading',{name:'Niveau à documenter',level:1}).click();
  await page.getByRole('button',{name:'Exporter',exact:true}).click();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Projet complet · JSON'}).click();const dl=await downloadEvent;const stream=await dl.createReadStream();const chunks:Buffer[]=[];for await (const chunk of stream)chunks.push(Buffer.from(chunk));const saved=JSON.parse(Buffer.concat(chunks).toString());
  expect(saved.demonstration).toBe(false);expect(saved.floors[0].height.value).toBeNull();expect(saved.floors[0].walls[0].thickness.value).toBe(.25);expect(saved.floors[0].walls[0].thickness.sourceId).toBe(saved.sources[0].id);expect(saved.floors[0].calibration.distance.status).toBe('confirmed');
});

test('rasterise une page PDF avec son worker local et signale une page absente',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await page.getByRole('button',{name:'Importer des plans',exact:true}).click();await page.getByLabel('Fichier du plan').setInputFiles(pdfFixture());
  await page.getByLabel('Page du PDF',{exact:true}).fill('9');await page.getByRole('button',{name:'Importer le document',exact:true}).click();await expect(page.getByRole('alert')).toContainText('1 page');
  await page.getByLabel('Page du PDF',{exact:true}).fill('1');await page.getByRole('button',{name:'Importer le document',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Niveau à documenter',level:1})).toBeVisible();await expect(page.locator('#architectural-plan image')).toHaveAttribute('href',/^data:image\/png;base64,/);
  expect(errors).toEqual([]);
});

test('restaure un projet JSON, refuse un schéma invalide et exporte le SVG',async({page})=>{
  await page.goto('/');const next=createDemo();next.name='Projet de vérification';next.floors[0].height.value=2.2;
  const input=page.getByLabel('Ouvrir un projet JSON',{exact:true});await input.setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});
  await expect(page.locator('.project-name')).toHaveText('Projet de vérification');await expect(page.locator('.summary-quality')).toContainText('erreur');
  await input.setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":12}')});await expect(page.getByRole('status')).toContainText('Projet incompatible');await expect(page.locator('.project-name')).toHaveText('Projet de vérification');
  await page.getByRole('button',{name:'Exporter',exact:true}).click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Vue du plan · SVG'}).click();expect((await event).suggestedFilename()).toMatch(/\.svg$/);
});

test('reste utilisable sur mobile sans débordement horizontal',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'Premier étage',level:1})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/atelier-mobile.png',fullPage:true});
});

test('dessine une pièce, place portes, fenêtres et emprises sans dimensions implicites',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Vue 2D',exact:true}).click();
  await page.getByRole('button',{name:'Pièce (P)',exact:true}).click();
  for(const p of [[4,11],[6,11],[6,12],[4,12]])await clickWorld(page,p[0],p[1]);
  await page.keyboard.press('Enter');
  // Native pointer positions are quantized to screen pixels, then snapped to the 5 cm grid.
  const drawnArea=Number((await page.locator('.inspector .derived strong').innerText()).replace(' m²','').replace(',','.'));
  expect(Math.abs(drawnArea-2)).toBeLessThan(.15);
  await page.getByLabel('Nom de l’élément',{exact:true}).fill('Pièce de contrôle');await page.getByRole('heading',{level:1}).click();
  await expect(page.locator('#architectural-plan')).toContainText('PIÈCE DE CONTRÔLE');
  await page.getByRole('button',{name:'Porte (D)',exact:true}).click();await clickWorld(page,1,12.8);
  await expect(page.getByLabel('Nom de l’élément',{exact:true})).toHaveValue('Nouvelle porte');
  for(const field of ['Largeur','Hauteur','Allège / seuil'])await expect(page.getByLabel(field,{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Fenêtre (F)',exact:true}).click();await clickWorld(page,0,6);
  await expect(page.getByLabel('Nom de l’élément',{exact:true})).toHaveValue('Nouvelle fenêtre');await expect(page.getByLabel('Largeur',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Escalier (E)',exact:true}).click();await clickWorld(page,4.2,11.3);await clickWorld(page,5.8,11.3);
  await expect(page.getByLabel('Largeur de l’emprise',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:/point\(s\) à documenter/}).click();await expect(page.getByRole('dialog')).toContainText('valeur inconnue');
});

test('active la visite intérieure et contrôle réellement la capture de la souris',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Visite intérieure',exact:true}).click();
  await expect(page.locator('.walk-help')).toContainText('1,65 m');
  await page.getByRole('button',{name:'Entrer dans la visite',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.tagName??null)).toBe('CANVAS');
  const before=await page.locator('.three-viewport canvas').screenshot();
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
  const after=await page.locator('.three-viewport canvas').screenshot();expect(before.equals(after)).toBe(false);
  await page.evaluate(()=>document.exitPointerLock());
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await page.getByRole('button',{name:'Vue orbitale',exact:true}).click();await expect(page.locator('.walk-help')).toHaveCount(0);
  expect(errors).toEqual([]);
});
