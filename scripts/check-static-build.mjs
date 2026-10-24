import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const html = await readFile('dist/index.html', 'utf8');
if (!html.includes('Charleroi 3D')) throw new Error('Titre de l’application absent.');
const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
if (!assets.some(asset => asset.endsWith('.js'))) throw new Error('Point d’entrée JavaScript absent.');
for (const asset of assets) {
  if (!asset.startsWith('./assets/')) throw new Error(`Chemin de ressource non portable : ${asset}`);
  const file = path.resolve('dist', asset);
  if (!(await stat(file)).isFile()) throw new Error(`Ressource absente : ${asset}`);
}
console.log('Site statique vérifié : titre, JavaScript, CSS et chemins relatifs.');
