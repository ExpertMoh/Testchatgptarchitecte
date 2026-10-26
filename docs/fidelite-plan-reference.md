# État du relevé et contrôles de fidélité

Le projet intégré utilise maintenant le document réel `Plan (1).pdf`, composé de huit pages scannées. Son empreinte SHA-256 est `19dbd04b3234c71b7b1f57c324ce2b30dead8841040cc71a26c6a6da438d9c2e`.

Les cinq niveaux ont des données distinctes. La démonstration technique de `demo.ts` reste séparée et n’est plus le projet proposé par défaut.

## Documents et disposition reprise

| Niveau | Page | Disposition tracée |
| --- | --- | --- |
| Sous-sol | 4 | Grande cave de stock commerce, cave arrière distincte, passage, WC dans la partie centrale droite, emprise d’escalier à droite et retours de maçonnerie côté rue. |
| Rez-de-chaussée | 5 | Réserve arrière avec pan coupé, commerce, cage d’escalier latérale, commun séparé du commerce et SAS côté rue. |
| Premier étage | 6 | Séjour côté rue ; cuisine à gauche et commun avec escalier tournant à droite ; chambre à l’arrière de cette zone ; salle de bains au fond à gauche. L’emprise arrière droite n’a pas de libellé d’usage attesté dans cet extrait. |
| Deuxième étage | 7 | Organisation comparable au premier, mais contours, ouvertures et emprise d’escalier tracés depuis cette page, sans duplication de géométrie. |
| Troisième étage | 8 | Une pièce cuisine-séjour ouverte, avec niches latérales et escalier droit à droite ; chambre séparée et salle de bains au fond. L’emprise arrière droite reste non qualifiée. |

Les plans conservent les contours obliques du scan. La rotation du repère aligne la façade de chaque niveau ; ce n’est pas une correction de perspective et cela ne suppose pas que les murs soient orthogonaux.

Les extraits raster de ces pages permettent une comparaison **Original / Superposition / Tracé**. Le PDF complet et ses autres pages ne sont pas publiés comme documents originaux. Les références aux coupes et à la façade restent consultables dans le PDF fourni par l’utilisateur.

## Statut des valeurs

- **Confirmé au document** : repères de plancher lisibles à la coupe p. 3 : −1,90 / 0,00 / 3,95 / 7,23 / 9,77 m ; concordance avec les mentions NIV. des plans p. 6–8. Cela ne certifie pas un état actuel relevé sur site.
- **Déduit** : coordonnées issues du tracé raster et du recalage ; surfaces des contours ; largeurs entre tableaux d’ouvertures ; axes et épaisseurs moyennes entre parements hachurés. Ce sont les limites de la zone figurant le mur qui sont tracées, pas la largeur du trait d’encre.
- **Déduit** : hauteurs d’étage calculées entre repères, comprenant les planchers. La limite supérieure du troisième étage est rattachée au repère 12,28 de la façade p. 2. Les hauteurs libres ne doivent pas être assimilées à ces valeurs.
- **Inconnu** : hauteurs et allèges des ouvertures non reportées depuis une cote vérifiée, ainsi que les dimensions et détails non établis des escaliers. Les volumes d’ouverture incomplets ne sont pas découpés arbitrairement en 3D.
- **Non qualifié** : l’usage des trois emprises arrière droites sans libellé lisible. Elles ne sont pas comptées comme surfaces intérieures et aucun plancher 3D n’est supposé pour elles.

Les mesures de recalage sont conservées avec leur page et leur justification. Les cotes écrites sont interprétées selon la convention centimétrique du dessin ; les chaînes secondaires restent à vérifier. La calibration est une donnée déduite, pas une certification de précision.

## Vérifications réalisées par les tests

- Validité du schéma, provenance et aller-retour JSON avec les extraits raster.
- Organisations par niveau : sous-sol, commerce, logements et cuisine-séjour ouverte au troisième étage.
- Absence de cloison entre deux points du séjour et de la cuisine du troisième étage.
- Repères altimétriques et maintien des inconnues dans les ouvertures.
- Absence de contour de pièce ou de parement croisé dans les données intégrées.
- Utilisation du même contour de mur pour les tracés 2D et les volumes 3D.
- Transformation réversible pixels/mètres avec translation et rotation ; mise à jour des axes lors de l’édition des parements.
- Conservation des projets déjà modifiés et de l’ancienne démonstration avant migration.

Ces contrôles ne constituent **pas** une certification à 100 % de la fidélité géométrique.

## Vérifications encore nécessaires pour une validation métrique complète

1. Recontrôler les points de tracé en superposition à fort grossissement et ajuster les tableaux, retours et décrochements fins.
2. Vérifier une seconde cote indépendante par niveau et les chaînes secondaires. Un écart peut venir du tracé, de la lecture d’une cote ou de la déformation du papier ; ne pas l’attribuer automatiquement au scan et ne pas le masquer.
3. Prioriser les cotes écrites vérifiées si elles divergent d’une distance graphique. Une correction non uniforme du scan exigerait plusieurs points de contrôle et une transformation explicitement documentée.
4. Reporter les hauteurs et allèges ouverture par ouverture ; ne pas généraliser la cote d’une porte à toutes les autres.
5. Contrôler l’alignement des niveaux sur un même repère architectural. La simple coïncidence du coin de façade des scans ne prouve pas leur superposition exacte.
6. Compléter les escaliers, trémies, dalles et toiture uniquement à partir de documents ou relevés suffisants.
7. Comparer aux mesures de l’état actuel si l’objectif est la fidélité au bâtiment plutôt qu’au document historique.

Le fichier `scripts/reference-traces.json` conserve les points manuellement relevés et les références de recalage. Le script de préparation est reproductible à partir du PDF original ; il ne reconnaît pas automatiquement les murs et ne traite pas les textes du document comme des instructions.

## Écarts numériques effectivement exposés

Des cotes indépendantes ont été lues pour la longueur du séjour au premier étage (430), la longueur de la chambre au premier (355), au deuxième (370) et au troisième (275), ainsi que la largeur au fond de la salle de bains du premier (218). Leur conversion en mètres est explicitement sourcée.

Ces valeurs sont comparées aux segments correspondants du tracé. La révision `trace-2` ajuste les longueurs longitudinales à 4,30 / 3,55 / 3,70 / 2,75 m par contraintes suivant les axes mitoyens, sans imposer d’angles droits aux pièces. La largeur de salle de bains est contrôlée dans la tolérance affichée. Les autres positions restent déduites. Les différences supérieures à 5 cm (tolérance de contrôle de l’interface, pas une précision architecturale garantie) apparaissent dans le panneau de propriétés et dans les contrôles de cohérence. La fenêtre « Sources & limites » les récapitule. Les cotes ne sont pas remplacées silencieusement par les distances du raster, et le scan n’est pas déformé pour masquer les différences.

**La fidélité métrique complète reste à valider.** Les quatre longueurs longitudinales reportées sont maintenant respectées par le modèle. Les facteurs d’ajustement continu sont documentés, et les fonds scannés restent inchangés pour que la comparaison demeure honnête. D’autres cotes, tableaux ou détails fins peuvent nécessiter un tracé plus précis, une meilleure lecture des extrémités de cotation ou un recalage local contrôlé. Ils ne doivent pas être assimilés automatiquement à une erreur du document. Le projet est livré comme relevé visuel et géométrique à contrôler, avec ses limites visibles.
