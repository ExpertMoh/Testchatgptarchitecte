import {expect,test} from '@playwright/test';
import {createDemo} from '../src/model/demo';

test('visite le commun du PDF, inspecte ses éléments et conserve une correction sans inventer de porte',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explorer les pièces',exact:true}).click();
 const panel=page.getByRole('complementary',{name:'Exploration des pièces'});
 await panel.getByLabel('Pièce à examiner').selectOption({label:'Commun'});
 await panel.getByRole('button',{name:'Entrer dans cette pièce',exact:true}).click();
 await expect(page.locator('.walk-location')).toContainText('Commun');
 await expect(panel).toContainText('Hauteur et seuil à documenter');
 await expect(panel.getByRole('button',{name:/^Ouvrir ·/})).toHaveCount(0);
 await panel.getByRole('button',{name:'Annoter la pièce',exact:true}).click();
 await page.getByLabel('État de révision',{exact:true}).selectOption('to-improve');
 await page.getByLabel('Observation / amélioration',{exact:true}).fill('Photographier les équipements du couloir et vérifier les revêtements.');
 await page.getByLabel('Source de l’observation',{exact:true}).selectOption({index:1});
 await expect(page.locator('.save-state')).toContainText('Enregistré localement');
 await page.screenshot({path:'test-results/visite-commun-pdf.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'Explorer les pièces',exact:true}).click();
 await panel.getByLabel('Pièce à examiner').selectOption({label:'Commun'});
 await expect(page.getByLabel('Observation / amélioration',{exact:true})).toHaveValue('Photographier les équipements du couloir et vérifier les revêtements.');
 await panel.getByRole('button',{name:'Entrer dans cette pièce',exact:true}).click();
 await panel.getByRole('button',{name:/Documenter cette porte/}).first().click();
 await expect(page.getByLabel('Hauteur',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Source du mécanisme',{exact:true})).toHaveValue('');
 expect(errors).toEqual([]);
});

test('anime une porte fictive, traverse un passage ouvert et identifie la pièce visitée',async({page})=>{
 test.setTimeout(90000);
 const demo=createDemo();demo.id='e2e-exploration';
 await page.addInitScript(p=>localStorage.setItem('charleroi-architecture-v1',JSON.stringify(p)),demo);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explorer les pièces',exact:true}).click();
 const panel=page.getByRole('complementary',{name:'Exploration des pièces'});
 await panel.getByLabel('Pièce à examiner').selectOption({label:'Circulation'});
 await panel.getByRole('button',{name:'Entrer dans cette pièce',exact:true}).click();
 await expect(page.locator('.walk-location')).toContainText('Circulation');
 await panel.getByRole('button',{name:'Ouvrir · Porte du séjour',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Fermer · Porte du séjour',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Entrer dans la visite',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.tagName)).toBe('CANVAS');
 await expect(page.locator('.walk-help')).toHaveClass(/is-locked/);
 // Align with the doorway using the real position shown by the minimap.
 await page.keyboard.down('KeyD');
 await expect.poll(async()=>Number(await page.locator('.walk-minimap circle').getAttribute('cx')),{timeout:10000,intervals:[10,20,25]}).toBeLessThan(5.08);
 await page.keyboard.up('KeyD');
 // From the hall, the bedroom door is in front (+Y). It must stop movement until opened.
 await page.keyboard.down('KeyW');
 try{await expect.poll(async()=>Number(await page.locator('.walk-minimap circle').getAttribute('cy')),{timeout:20000,intervals:[50,100]}).toBeGreaterThan(7.45);}finally{await page.keyboard.up('KeyW');}
 await expect(page.locator('.walk-location')).toContainText('Circulation');
 await page.keyboard.press('KeyE');
 await page.keyboard.down('KeyW');
 try{await expect(page.locator('.walk-location')).toContainText('Chambre',{timeout:15000});}finally{await page.keyboard.up('KeyW');}
 await page.evaluate(()=>document.exitPointerLock());
 await page.screenshot({path:'test-results/visite-porte-interactive.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('explore sur mobile avec les commandes tactiles et les filtres sans débordement',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Explorer les pièces',exact:true}).click();
 const panel=page.getByRole('complementary',{name:'Exploration des pièces'});
 await panel.getByRole('button',{name:'Murs transparents',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Murs transparents',exact:true})).toHaveAttribute('aria-pressed','true');
 await panel.getByRole('button',{name:'Entrer dans cette pièce',exact:true}).click();
 await expect(page.getByRole('button',{name:'Avancer',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/visite-mobile.png',fullPage:true});
});
