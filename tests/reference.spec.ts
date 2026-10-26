import {expect,test} from '@playwright/test';
import {createDemo} from '../src/model/demo';

test('ouvre le relevé source, compare original et tracé et distingue les cinq niveaux',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.project-name')).toHaveText('Charleroi · relevé du PDF');
 await expect(page.locator('.reference-banner')).toContainText('Plan (1).pdf');await expect(page.locator('.demo-banner')).toHaveCount(0);
 await expect(page.locator('.save-state')).toContainText('Enregistré localement');
 await expect(page.locator('.three-viewport canvas')).toBeVisible();
 await page.getByRole('button',{name:'Voir le document original',exact:true}).click();await expect(page.locator('.plan-vectors')).toHaveAttribute('opacity','0');
 await expect(page.locator('#architectural-plan image')).toHaveAttribute('href',/^data:image\/jpeg;base64,/);
 await page.getByRole('button',{name:'Voir le tracé seul',exact:true}).click();await expect(page.locator('.plan-vectors')).toHaveAttribute('opacity','1');await expect(page.locator('#architectural-plan image')).toHaveCount(0);
 await expect(page.locator('#architectural-plan .room-name')).toContainText(['SÉJOUR','CUISINE','COMMUN','CHAMBRE','SALLE DE BAINS','ESPACE ARRIÈRE']);
 await page.getByRole('button',{name:'Voir la superposition',exact:true}).click();await expect(page.locator('#architectural-plan image')).toHaveCount(1);
 await page.screenshot({path:'test-results/releve-premier-etage.png',fullPage:true});
 await page.locator('.floor-list').getByRole('button',{name:/Rez-de-chaussée/}).click();await expect(page.locator('#architectural-plan .room-name')).toContainText(['RÉSERVE','COMMERCE','COMMUN','SAS','CAGE D’ESCALIER']);
 await page.locator('.floor-list').getByRole('button',{name:/Sous-sol/}).click();await expect(page.locator('#architectural-plan .room-name')).toContainText(['CAVE · STOCK COMMERCE','CAVE ARRIÈRE','WC']);
 await page.locator('.floor-list').getByRole('button',{name:/Troisième étage/}).click();await expect(page.locator('#architectural-plan .room-name')).toContainText(['CUISINE-SÉJOUR','CHAMBRE','SALLE DE BAINS','ESPACE ARRIÈRE']);
 await page.screenshot({path:'test-results/releve-troisieme-etage.png',fullPage:true});
 await page.getByRole('button',{name:'Sources & limites',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Hauteurs et allèges');await page.getByRole('button',{name:'Comparer au document'}).click();
 expect(errors).toEqual([]);
});

test('migre l’ancienne démonstration intacte et conserve sa sauvegarde',async({page})=>{
 const demo=createDemo();await page.addInitScript(p=>{if(!localStorage.getItem('charleroi-architecture-v1'))localStorage.setItem('charleroi-architecture-v1',JSON.stringify(p));},demo);
 await page.goto('/');await expect(page.locator('.project-name')).toHaveText('Charleroi · relevé du PDF');
 const backup=await page.evaluate(()=>localStorage.getItem('charleroi-architecture-v1:demo-before-reference'));expect(JSON.parse(backup!)).toEqual(demo);
});

test('préserve un projet modifié et permet d’ouvrir le relevé source avec une copie de sauvegarde',async({page})=>{
 const demo=createDemo();demo.name='Mon travail à conserver';await page.addInitScript(p=>{if(!localStorage.getItem('charleroi-architecture-v1'))localStorage.setItem('charleroi-architecture-v1',JSON.stringify(p));},demo);
 await page.goto('/');await expect(page.locator('.project-name')).toHaveText('Mon travail à conserver');
 await page.getByRole('button',{name:'Ouvrir le relevé du PDF',exact:true}).click();await expect(page.locator('.project-name')).toHaveText('Charleroi · relevé du PDF');
 const backup=await page.evaluate(()=>localStorage.getItem('charleroi-architecture-v1:backup:charleroi-demo'));expect(JSON.parse(backup!)).toEqual(demo);
 await page.getByRole('button',{name:'Annuler',exact:true}).click();await expect(page.locator('.project-name')).toHaveText('Mon travail à conserver');
});

test('conserve les contrôles et la comparaison sur mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('button',{name:'Voir le document original',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
