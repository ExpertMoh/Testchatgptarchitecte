# CHARLEROI 3D ARCHITECTURE

Atelier web de reconstruction architecturale : plan SVG interactif, maquette Three.js, documents sources et provenance des mesures. Premier prototype fonctionnel, développé en React, TypeScript et Vite.

**Le projet par défaut est désormais un relevé manuel de `Plan (1).pdf`, pages 4 à 8.** Chaque niveau a ses propres contours et un extrait du scan pour comparaison. Le modèle est un tracé à contrôler, sans certification de fidélité à 100 % : coordonnées, surfaces et épaisseurs issues du scan sont déduites ; les dimensions verticales des ouvertures non relevées restent inconnues. Les repères de plancher sont rattachés à la coupe p. 3 et à la façade p. 2. La démonstration fictive reste accessible séparément dans le menu du projet. Le PDF complet n’est pas publié ; seuls les extraits de plans nécessaires à la comparaison sont intégrés.

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

- Cinq niveaux du PDF, tracés indépendamment : sous-sol avec cave arrière et WC ; commerce avec réserve, commun, SAS et escalier ; deux logements avec cuisine et séjour séparés ; troisième étage avec cuisine-séjour ouverte. Les espaces arrière non légendés restent non qualifiés. Une démonstration fictive distincte et les projets vierges restent disponibles.
- Plan SVG avec sélection, déplacement de la vue, zoom, cotations et accrochage facultatif sur une grille de 5 cm.
- Tracé de murs en deux clics ; contours de pièces en plusieurs clics puis Entrée ou double-clic ; emprises d’escalier en deux clics.
- Placement des portes et fenêtres sur un mur hôte, à la position projetée du clic. Largeur, hauteur et seuil restent **inconnus** jusqu’à leur saisie.
- Édition des noms, coordonnées, épaisseurs, dimensions d’ouvertures, altitudes, hauteurs et contours dans le panneau de propriétés. Ouvrir le bouton de provenance à droite de chaque champ pour associer source, statut et justification. Les coordonnées permettent aussi d’aligner précisément les niveaux dans le repère commun.
- Mesure entre deux points, longueurs et surfaces déduites du modèle. Les surfaces correspondent aux contours dessinés, sans certification réglementaire.
- Rendu 3D des mêmes murs et pièces, avec découpe des ouvertures mesurées ; assemblage des niveaux à leurs altitudes ; caméra orbitale et vue de dessus.
- Coupe **visuelle** à 1,10 m pour lire l’intérieur. Elle ne change aucune hauteur du modèle.
- Visite intérieure avec navigation directe dans chaque pièce, plan de localisation, position courante, commandes ZQSD/WASD, souris et commandes tactiles. Les murs et les portes fermées bloquent les déplacements. Les passages incomplets restent bloqués. Échap libère la souris ; E actionne une porte proche dont le mécanisme est documenté. Pas de montée d’escalier ni de validation d’accessibilité.
- Panneau « Explorer les pièces » : sélection et annotation des murs, portes, fenêtres et escaliers proches d’un contour ; filtres de noms et de transparence des murs ; plein écran 3D.
- Portes animées lorsque largeur, hauteur, seuil, gonds, sens et source sont renseignés. La démonstration utilise des mécanismes explicitement fictifs. Aucun gabarit de porte par défaut n’est ajouté au relevé.
- Suivi de correction par pièce ou élément : « À vérifier », « À améliorer », « Traité », observation libre et source. Ces données sont sauvegardées localement et dans le JSON, avec annulation/rétablissement.
- Import PNG, JPG, WebP et d’une page PDF au choix, rendu du PDF dans un worker local. Limite de 20 Mo par fichier ; rendu PDF limité à 2 400 px sur son grand côté ; images limitées à 64 mégapixels.
- Document en fond avec visibilité et opacité ; comparaison Original / Superposition / Tracé. Calibration uniforme, translation et rotation de repère dans le modèle ; le relevé intégré aligne la façade sans redresser arbitrairement les angles du bâtiment. L’outil de recalage interactif demande deux points, une distance vérifiée et sa référence.
- Annuler/rétablir jusqu’à 40 modifications ; sauvegarde locale automatique ; import/export JSON du projet, images et provenance incluses ; export SVG de la vue courante.
- Contrôles des dimensions, sources, identifiants d’éléments, contours croisés, murs dégénérés, ouvertures hors du mur, ouvertures qui se chevauchent et volumes d’étages superposés.

Les murs du relevé possèdent des contours de parements à quatre points, utilisés dans les deux vues ; leur épaisseur moyenne est déduite de la distance entre ces parements hachurés, jamais de l’épaisseur d’un trait. Leur édition recalcule l’axe hôte et l’épaisseur dérivée. Les volumes qui nécessitent une épaisseur de mur, une hauteur ou une altitude inconnue ne sont pas générés en 3D. Un simple trait discontinu ou un repère « ? » en 2D signale une géométrie partielle, sans lui attribuer une dimension réelle. Une ouverture incomplète n’est pas découpée dans le mur en 3D. Consultez les contrôles pour identifier ces éléments.

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

React gère le projet et son historique ; les fonctions géométriques sont pures. La 3D et PDF.js sont chargés à la demande. Les extraits raster du relevé intégré sont inclus dans le projet ; ils augmentent la taille de son chargement et de sa sauvegarde. Le modèle est validé à la lecture par Zod, puis contrôlé géométriquement. Une incohérence géométrique dans un fichier valide est signalée et peut être corrigée dans l’atelier.

## Limites et conservation des données

- Vectorisation manuelle assistée uniquement : pas d’OCR, de détection de murs, de reconnaissance automatique de pièces ni d’interprétation historique.
- Recalage uniforme uniquement : pas de redressement de perspective ni correction de distorsion. Le modèle peut contenir une translation et une rotation de repère ; le relevé intégré les utilise pour sa façade. L’interface interactive ne propose pas encore de déplacement ou de rotation manuels du raster. Préparer les scans, puis aligner la géométrie dans le repère commun. La précision dépend du document, des points cliqués et de la grille active.
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


## Référence intégrée et reprise d’une ancienne session

Le fichier `src/model/reference-data.json` contient les cinq extraits raster, leur page, les points du tracé et les mesures avec leur provenance. Le PDF traité possède huit pages scannées, sans couche de texte ; son SHA-256 est `19dbd04b3234c71b7b1f57c324ce2b30dead8841040cc71a26c6a6da438d9c2e`. Les plans utilisés sont p. 4 (sous-sol), p. 5 (RDC), p. 6 (premier), p. 7 (deuxième) et p. 8 (troisième).

Le fichier `scripts/reference-traces.json` conserve les points manuellement repérés dans le raster à 100 dpi. `scripts/prepare-reference.py` produit les extraits à 220 dpi et transforme les coordonnées dans le repère commun. Il exige Poppler (`pdftoppm`) et Pillow et n’est **pas** une vectorisation automatique : il reproduit le tracé manuel spécifié. Le PDF doit être fourni séparément ; il n’est pas inclus dans Git.

```bash
python scripts/prepare-reference.py '/chemin/vers/Plan (1).pdf'
npm test
npm run build
```

Les repères altimétriques retenus sont −1,90 / 0,00 / 3,95 / 7,23 / 9,77 m. Les hauteurs d’étage sont déduites entre repères ; la limite supérieure 12,28 m est citée à la façade p. 2. Ces différences ne représentent pas des hauteurs libres sous plafond. Les largeurs d’ouverture sont issues du tracé entre tableaux, et ne sont pas des cotes écrites confirmées. Hauteurs et allèges restent vides tant qu’elles n’ont pas été reportées d’une source vérifiée. Les portes sans sens d’ouverture lisible n’ont pas d’arc supposé.

Dans une ancienne session, la démonstration intacte est remplacée après conservation d’une copie sous la clé `charleroi-architecture-v1:demo-before-reference`. Un projet modifié est conservé. Pour ouvrir le nouveau relevé, utiliser **Ouvrir le relevé du PDF** dans le bandeau de démonstration ou **Ouvrir le relevé du PDF fourni** dans le menu du projet. La sélection crée une sauvegarde du projet précédent ; un échec de sauvegarde provoque son export JSON avant le changement. Le bouton Annuler permet aussi de revenir au projet précédent pendant la session.

L’audit de fidélité et les limites de contrôle figurent dans `docs/fidelite-plan-reference.md`. La cohérence mathématique du modèle ne doit pas être présentée comme une validation de fidélité au document ou au bâtiment.

Les cotes indépendantes lues (430/355/218 sur la page 6, 370 sur la page 7 et 275 sur la page 8) sont aussi comparées aux distances du tracé. Les écarts de plus de 5 cm sont affichés comme points à vérifier, dans les propriétés des espaces et dans « Sources & limites ». La tolérance de contrôle ne certifie pas la précision du relevé. Les longueurs longitudinales contrôlées contraignent maintenant le modèle par un ajustement continu suivant les axes mitoyens, sans modification des images. Les facteurs et références de cote sont consignés dans les métadonnées et consultables dans la fenêtre. Les autres coordonnées restent déduites ; une validation métrique complète exige encore le contrôle des cotes non reportées et de l’état réel.

Le relevé courant porte la révision `trace-2`. Une ancienne version conservée dans le navigateur n’est pas écrasée : le bandeau **Ouvrir la version actualisée** permet de charger la nouvelle après sauvegarde ou export de l’ancien projet.


## Visite intérieure et reconstruction fidèle

1. Ouvrir **3D**, puis **Explorer les pièces** (icône de liste sur la vue). Choisir **Commun** pour examiner le couloir du premier étage, ou une autre pièce, puis **Entrer dans cette pièce**. L’accès direct est une téléportation de travail et ne valide pas un chemin praticable.
2. Sur ordinateur, cliquer **Entrer dans la visite** pour capturer la souris. Se déplacer avec ZQSD, WASD ou les flèches ; **E** ouvre ou ferme la porte la plus proche à moins de 1,80 m. **Échap** libère la souris pour utiliser les panneaux. Les boutons à l’écran permettent de marcher et tourner sans capture, notamment sur mobile.
3. Le panneau affiche les ouvertures proches. **Documenter cette porte** sélectionne une porte incomplète : renseigner ses dimensions avec leur provenance, puis les gonds, le sens et la source du mécanisme. Les champs décrivent le mécanisme par rapport à l’axe orienté du mur hôte. Une porte ne devient animable qu’après ces saisies. L’angle animé de 90° est une convention de visualisation, pas une mesure de débattement ; l’épaisseur du vantail n’est pas supposée.
4. Cliquer une pièce ou un élément de la liste pour consulter ses propriétés. Utiliser **Suivi de correction** pour enregistrer une observation et son état. **Traité** est un statut de travail ; il ne confirme pas les dimensions. Les notes et leurs sources suivent le projet lors d’un export/import JSON.
5. **Murs transparents** modifie l’affichage, sans retirer les obstacles. **Noms des pièces** affiche les libellés en vue orbitale ou de dessus. Le mode assemblé montre les niveaux à leurs altitudes ; la visite se fait niveau par niveau.

Le moteur de navigation est dans `src/model/exploration.ts` : recherche de points à l’intérieur des contours concaves, identification de pièce, proximité des éléments, collision avec les parements et les vantaux ouverts, subdivision des déplacements pour empêcher de traverser une cloison mince. Le rendu est calculé à la demande en vue orbitale et suspendu derrière les fenêtres d’import ; la visite utilise un éclairage de lecture qui suit la caméra, sans ombres portées. La position de l’œil (1,65 m), le rayon de déplacement (0,18 m), le dégagement vertical (1,80 m), la vitesse et la portée d’interaction sont des **conventions de navigation**, indépendantes du relevé. Les collisions utilisent le vantail dans sa position finale pendant l’animation. La fermeture est refusée si elle enfermerait la caméra dans le passage. Elles ne simulent ni une personne réglementaire, ni les trémies, ni le balayage du vantail, ni l’accessibilité.

L’inventaire associe les éléments du modèle par proximité géométrique, à vérifier ; il ne prouve pas leur appartenance à une pièce. Aucun meuble, luminaire, radiateur, compteur, canalisation ou équipement absent des sources n’est créé. Les espaces d’usage non attesté ne sont pas proposés comme pièces visitables. Un écart entre le contour et un mur peut empêcher un passage : corriger le modèle plutôt que désactiver les collisions.

Pour aller vers une reconstruction du bâtiment à l’identique, compléter les sources avec :

- des photographies actuelles de chaque pièce et de chaque face du couloir, des portes, fenêtres, plafonds et équipements ;
- les hauteurs libres, épaisseurs de dalle, hauteurs et seuils des ouvertures, ainsi que les sens et positions des gonds ;
- les marches, paliers, trémies et garde-corps mesurés, puis les détails de toiture et de façade ;
- un inventaire localisé des équipements et matériaux, rattaché aux photographies ou au relevé, et une vérification de l’état actuel par rapport aux plans historiques.

Le scan actuel permet de reconstruire une disposition et des contours à contrôler. Il ne permet pas de connaître tout le contenu réel du bâtiment. La simulation présente les informations disponibles et signale les inconnues ; une apparence plus détaillée ne constitue pas une preuve de fidélité.
