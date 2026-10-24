# CHARLEROI 3D ARCHITECTURE

Atelier web de reconstruction architecturale : plan SVG interactif, maquette Three.js, documents sources et provenance des mesures. Premier prototype fonctionnel, développé en React, TypeScript et Vite.

**La maquette fournie est une démonstration entièrement fictive. Elle ne représente pas l’immeuble de la planche jointe à la demande. Aucune cote ni proportion de cet immeuble n’a été supposée.** La planche jointe n’est pas embarquée dans le dépôt : importez le fichier original dans l’application pour commencer un relevé réel. L’échelle « 1/100 » d’une image redimensionnée ne constitue pas une calibration.

## Démarrage

Prérequis : Node.js 22.12+ ou 24 LTS, npm et un navigateur récent. WebGL 2 est nécessaire pour la 3D ; le plan et les données restent utilisables sans lui. Aucun compte, serveur métier, service externe, jeton ou variable secrète n’est nécessaire.

```bash
cd /workspace/Testchatgptarchitecte
npm ci --cache /tmp/charleroi-npm-cache
npm run dev
```

Le serveur utilise le port 5173 par défaut. Ouvrez l’application par le mécanisme d’accès de votre environnement. Dans un autre poste, adaptez le chemin du dépôt. Les polices, le worker PDF et les bibliothèques sont servis localement ; aucun CDN n’est requis à l’exécution.

```bash
npm run build     # Vérification TypeScript et compilation de production dans dist/
npm run preview   # Démarrage du build de production
npm test          # Tests du modèle et de la géométrie
npm run test:e2e  # Tests Chromium des fonctions de l’atelier
```

Pour les tests navigateur, Chromium est déjà disponible dans cet environnement à `/usr/bin/chromium`. Sur un autre système, indiquez son exécutable :

```bash
CHROMIUM_PATH=/chemin/vers/chromium npm run test:e2e
```

Playwright démarre et arrête son serveur automatiquement. Pour tester le build compilé plutôt que Vite en développement :

```bash
npm run build
E2E_PREVIEW=1 npm run test:e2e
```

## Fonctions du prototype

- Cinq niveaux fictifs indépendants, panneau des étages et ajout de niveaux sans altitude ni hauteur implicites.
- Plan SVG avec sélection, déplacement de la vue, zoom, cotations et accrochage facultatif sur une grille de 5 cm.
- Tracé de murs en deux clics ; contours de pièces en plusieurs clics puis Entrée ou double-clic ; emprises d’escalier en deux clics.
- Placement des portes et fenêtres sur un mur hôte, à la position projetée du clic. Largeur, hauteur et seuil restent **inconnus** jusqu’à leur saisie.
- Édition des noms, coordonnées, épaisseurs, dimensions d’ouvertures, altitudes, hauteurs et contours dans le panneau de propriétés. Ouvrir le bouton de provenance à droite de chaque champ pour associer source, statut et justification. Les coordonnées permettent aussi d’aligner précisément les niveaux dans le repère commun.
- Mesure entre deux points, longueurs et surfaces déduites du modèle. Les surfaces correspondent aux contours dessinés, sans certification réglementaire.
- Rendu 3D des mêmes murs et pièces, avec découpe des ouvertures mesurées ; assemblage des niveaux à leurs altitudes ; caméra orbitale et vue de dessus.
- Coupe **visuelle** à 1,10 m pour lire l’intérieur. Elle ne change aucune hauteur du modèle.
- Visite intérieure à hauteur de caméra 1,65 m, ZQSD/WASD ou flèches et souris. Cliquer « Entrer dans la visite » ; Échap libère la souris. Pas de collisions, de circulation entre étages ou de validation d’accessibilité.
- Import PNG, JPG, WebP et d’une page PDF au choix, rendu du PDF dans un worker local. Limite de 20 Mo par fichier ; rendu PDF limité à 2 400 px sur son grand côté ; images limitées à 64 mégapixels.
- Document en fond avec visibilité et opacité ; calibration uniforme sur deux points et une distance vérifiée avec sa référence.
- Annuler/rétablir jusqu’à 40 modifications ; sauvegarde locale automatique ; import/export JSON du projet, images et provenance incluses ; export SVG de la vue courante.
- Contrôles des dimensions, sources, identifiants d’éléments, contours croisés, murs dégénérés, ouvertures hors du mur, ouvertures qui se chevauchent et volumes d’étages superposés.

Les volumes qui nécessitent une épaisseur de mur, une hauteur ou une altitude inconnue ne sont pas générés en 3D. Un simple trait discontinu ou un repère « ? » en 2D signale une géométrie partielle, sans lui attribuer une dimension réelle. Une ouverture incomplète n’est pas découpée dans le mur en 3D. Consultez les contrôles pour identifier ces éléments.

## Intégrer les documents réels

1. **Conserver les originaux.** Inventorier les plans, leurs dates, versions, pages, photographies et relevés. Dropbox n’est pas connecté dans cette version ; télécharger les documents puis utiliser l’import local. Ne pas transmettre de secrets dans les fichiers JSON.
2. **Créer un relevé distinct.** « Importer des plans » propose par défaut un nouveau projet sans données fictives. Exporter préalablement le projet courant si vous souhaitez le conserver ; le navigateur ne sauvegarde automatiquement que le projet actif. L’annulation permet de revenir à l’état précédent pendant la session.
3. **Préparer les plans.** Pour une planche avec plusieurs niveaux, recadrer chaque plan dans un fichier séparé, conserver le fichier original comme référence et noter la page. Rectifier la perspective et orienter les plans en amont si nécessaire. L’import d’une page complète reste possible, mais le prototype ne segmente pas automatiquement la planche.
4. **Recaler chaque document.** Cliquer les deux extrémités d’une cote lisible ou de la barre graphique, saisir la distance vérifiée en mètres et sa référence. Vérifier une seconde cote indépendante avec l’outil de mesure. Ne pas considérer l’épaisseur graphique d’un trait comme une épaisseur de mur. Un recalage sur un étage déjà tracé est refusé pour éviter de rendre incohérents le fond et la géométrie : utiliser un nouvel étage de relevé vide.
5. **Redessiner les éléments attestés.** Tracer murs, contours de pièces, portes, fenêtres et emprises d’escalier. Corriger les coordonnées dans les propriétés si nécessaire. Le tracé donne des coordonnées **déduites**, rattachées au document ; il ne constitue pas une cote confirmée. Désactiver l’accrochage si le document exige une précision différente.
6. **Documenter les valeurs.** Choisir une source avant de saisir une valeur. Ne confirmer une mesure qu’après vérification documentaire ou relevé. Ajouter sa justification. Une mesure manquante reste `null` avec le statut `unknown`. L’origine et les axes doivent être communs à tous les niveaux ; utiliser les coordonnées pour assurer leur alignement, sans supposer que les bords des scans coïncident.
7. **Renseigner les niveaux.** Vérifier pour chaque étage l’altitude du plancher et la hauteur retenue. Le prototype utilise cette hauteur pour les volumes des murs ; les détails de structure et les épaisseurs de dalle ne sont pas déduits.
8. **Contrôler et exporter.** Corriger les incohérences signalées, comparer visuellement chaque étage au document, assembler en 3D et exporter régulièrement le projet JSON. Conserver les PDF originaux et photographies séparément : seule la page rasterisée est intégrée pour un import PDF.

La confirmation est un statut saisi par l’utilisateur, pas une certification automatique. Les photographies peuvent apporter des indices visuels, mais ne deviennent pas métriques par simple import. Les éléments non documentés (toiture, fondations, détails des escaliers, structure, matériaux réels, etc.) ne sont pas reconstitués automatiquement.

## Architecture

```text
src/
  App.tsx                    Projet actif, historique, sauvegarde, import/export et interface
  components/
    PlanEditor.tsx           Vue SVG et interactions de tracé/recalage
    BuildingScene.tsx        Géométrie Three.js, découpe des murs et caméras
    Inspector.tsx            Propriétés d’étage et d’élément, documents sources
    MeasureField.tsx         Saisie des valeurs et de leur provenance
  model/
    schema.ts                Schéma Zod versionné et types TypeScript
    demo.ts                  Géométrie synthétique explicitement identifiée
    geometry.ts              Calculs métriques et contrôles indépendants du rendu
    geometry.test.ts         Tests des calculs et des règles de provenance
  lib/
    files.ts                 Validation JSON, lecture des images, rendu PDF et téléchargements
tests/
  atelier.spec.ts            Parcours navigateur et vérification mobile
```

Le JSON est l’unique modèle géométrique. Le plan ne contient pas une copie distincte des murs. Le rendu 3D transforme les mêmes coordonnées `(x, y)` en `(x, altitude, y)`, à raison d’une unité pour un mètre. Les positions des ouvertures sont des distances depuis le départ du mur hôte ; elles suivent sa direction, y compris pour un mur oblique. Les murs sont décomposés en rectangles autour des ouvertures, sans calcul CSG opaque. Les pièces sont des polygones plans ; aucune épaisseur de dalle n’est inventée.

Chaque coordonnée et dimension architecturale est une valeur sourcée :

```json
{
  "value": null,
  "status": "unknown",
  "sourceId": null,
  "note": "À mesurer sur une source vérifiée."
}
```

`status` vaut `confirmed`, `inferred` ou `unknown`. Une valeur connue exige un identifiant de source ; une valeur inconnue doit être vide. Les longueurs et surfaces affichées sont dérivées des coordonnées. La calibration stocke les deux points en pixels, la distance sourcée et le facteur mètres/pixel. Les données de démonstration utilisent exclusivement la source `demo` et ne sont pas des mesures confirmées.

React gère le projet et son historique ; les fonctions géométriques sont pures. La 3D et PDF.js sont chargés à la demande. Le modèle est validé à la lecture par Zod, puis contrôlé géométriquement. Une incohérence géométrique dans un fichier valide est signalée et peut être corrigée dans l’atelier.

## Limites et conservation des données

- Vectorisation manuelle assistée uniquement : pas d’OCR, de détection de murs, de reconnaissance automatique de pièces ni d’interprétation historique.
- Recalage uniforme uniquement : pas de redressement de perspective, correction de distorsion, rotation ou translation du raster dans l’interface. Préparer les scans, puis aligner la géométrie dans le repère commun. La précision dépend du document, des points cliqués et de la grille active.
- Pas de validation structurelle, énergétique ou réglementaire ; pas de calcul de charges, de raccord topologique complet, de détection exhaustive des intersections/recouvrements entre pièces ou de contrôle de surfaces habitables.
- Escaliers limités à une emprise et une flèche : ni nombre de marches, pente, hauteur de marche, palier ou trémie ne sont supposés. Les symboles de mobilier de démonstration sont illustratifs, sans métrique de relevé.
- Pas d’IFC, DXF, DWG, GLB, backend, comptes, synchronisation ou collaboration. Le JSON permet de poursuivre le développement d’exports spécialisés.
- La sauvegarde utilise `localStorage`, limitée par le navigateur et liée à l’origine web. Si le quota est dépassé, l’interface signale l’échec : **exporter le JSON avant de quitter**. L’export JSON est limité à 40 Mo à l’import. Effacer les données du navigateur supprime la sauvegarde locale. Les documents ne sont envoyés à aucun serveur par l’application.
- Le SVG exporte le cadrage et les options visibles. Il indique le statut du projet ; son échelle d’impression n’est pas garantie.

## Validation

Les tests unitaires couvrent la cohérence des cinq niveaux fictifs, la provenance obligatoire, le refus de valeurs inconnues renseignées, l’aller-retour JSON, les distances et surfaces, la projection sur un mur oblique, le volume des murs découpés et les cas de géométrie invalide.

Les tests navigateur couvrent le démarrage et le canvas WebGL, l’édition partagée, l’annulation et le rétablissement, la persistance après rechargement, le changement d’étage, l’assemblage, les caméras, le tracé et la mesure, l’import d’image et le recalage, le PDF et une page inexistante, l’export/import JSON et SVG, les principaux outils et l’absence de débordement horizontal sur mobile. Les captures sont générées dans `test-results/` (ignoré par Git).


## Mise en ligne sur GitHub Pages

Le site compilé est statique et ne requiert aucun serveur applicatif. Les chemins de ressources sont relatifs pour fonctionner aussi bien à la racine d’un domaine que sous `/Testchatgptarchitecte/`. Le worker PDF et le module 3D restent locaux au site.

Le workflow `.github/workflows/pages.yml` compile et teste le projet à chaque push sur `main`, puis publie `dist/` avec le jeton éphémère GitHub Actions. Il peut aussi être déclenché manuellement. Les actions n’ont aucune clé d’hébergeur à stocker dans le code. Le compte du dépôt doit disposer de GitHub Pages pour sa visibilité et son abonnement ; la visibilité du dépôt ne doit pas être modifiée pour contourner cette condition.

L’activation initiale de Pages doit utiliser la source **GitHub Actions** dans les paramètres Pages du dépôt. La création et le suivi du déploiement depuis cet environnement requièrent l’accès réseau à `api.github.com` ; la vérification du site requiert `expertmoh.github.io`. La connexion Git HTTPS fournie par la plateforme ne prouve pas que le jeton dispose des droits d’administration Pages ou de modification des workflows : ces capacités doivent être vérifiées séparément.

Après publication réussie, utiliser l’URL **renvoyée par le déploiement**, puis vérifier la page, le chargement 3D, les imports PDF et la persistance. Une URL attendue ou un workflow créé ne prouve pas que le site est publié.

Vérification du paquet statique :

```bash
npm run build
node scripts/check-static-build.mjs
```

Pour une publication manuelle chez un autre hébergeur de sites statiques, déposer **le contenu de `dist/`**, avec `index.html` à la racine, sans le dossier du dépôt, sans `node_modules` et sans données de navigateur.
