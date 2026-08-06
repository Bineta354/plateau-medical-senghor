 Plan: Dents Réalistes pour le Dental Chart

 Résumé

 Améliorer le système de sélection de dents pour que les dents ressemblent à la réalité en forme et design, en remplaçant les formes géométriques     
 basiques (rectangles, triangles, ellipses) par des courbes de Bézier anatomiquement précises.

 Niveau de détail choisi: TRÈS DÉTAILLÉ
 - Formes anatomiques précises avec courbes de Bézier
 - Fissures et sillons visibles
 - Cuspides avec surbrillance
 - Détails internes (mamelons sur incisives, crêtes sur canines)
 - Dégradés et ombres pour effet 3D

 État Actuel

 Les dents sont dessinées avec des formes très simples dans drawingUtils.js:
 - Incisives: Rectangles (ctx.rect)
 - Canines: Triangles simples (3 points)
 - Prémolaires: Ellipses (ctx.ellipse)
 - Molaires: Carrés (ctx.rect)

 Approche Recommandée: Courbes de Bézier Canvas

 Cette approche offre:
 - Rendu natif Canvas sans dépendances
 - Excellente performance
 - Détection de clic précise avec isPointInPath()
 - Contrôle total sur l'anatomie des dents

 ---
 Fichiers à Modifier

 1. src/components/dental-chart/toothPaths.js (NOUVEAU)

 Créer les définitions de chemins normalisés (coordonnées 0-1) pour chaque type de dent:

 export const TOOTH_PATHS = {
   incisor: {
     outline: (ctx, w, h) => {
       ctx.moveTo(w * 0.15, 0);
       ctx.bezierCurveTo(w * 0.35, -h * 0.03, w * 0.65, -h * 0.03, w * 0.85, 0);
       ctx.bezierCurveTo(w * 0.95, h * 0.1, w * 0.98, h * 0.4, w * 0.92, h * 0.7);
       ctx.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.08, h * 0.7);
       ctx.bezierCurveTo(w * 0.02, h * 0.4, w * 0.05, h * 0.1, w * 0.15, 0);
     }
   },
   canine: { /* cusp pointu avec courbes labiales */ },
   premolar: { /* forme ovale avec 2 cuspides */ },
   molar: { /* forme carrée arrondie avec 4 cuspides */ }
 };

 2. src/components/dental-chart/drawingUtils.js (RÉÉCRIRE)

 Remplacer les fonctions de dessin avec des courbes de Bézier réalistes:

 Incisive - Forme de pelle avec bord incisif plat:
 export const drawIncisor = (ctx, toothId, x, y, width, height, state, isUpper) => {
   ctx.beginPath();
   ctx.moveTo(x + width * 0.15, y);
   // Bord incisif légèrement courbé
   ctx.bezierCurveTo(x + width * 0.35, y - height * 0.03,
                      x + width * 0.65, y - height * 0.03,
                      x + width * 0.85, y);
   // Surface labiale convexe
   ctx.bezierCurveTo(x + width * 0.95, y + height * 0.1,
                      x + width * 0.98, y + height * 0.4,
                      x + width * 0.92, y + height * 0.7);
   // Ligne cervicale
   ctx.quadraticCurveTo(x + width * 0.5, y + height * 0.95,
                         x + width * 0.08, y + height * 0.7);
   // Retour au début
   ctx.bezierCurveTo(x + width * 0.02, y + height * 0.4,
                      x + width * 0.05, y + height * 0.1,
                      x + width * 0.15, y);
   ctx.closePath();
   // Dégradé pour effet 3D
   const gradient = ctx.createRadialGradient(...);
   ctx.fill();
   ctx.stroke();
 };

 Canine - Cuspide proéminente avec crête labiale:
 export const drawCanine = (ctx, toothId, x, y, width, height, state) => {
   ctx.beginPath();
   ctx.moveTo(x + width * 0.5, y);  // Pointe du cusp
   // Pente droite depuis le cusp
   ctx.bezierCurveTo(x + width * 0.65, y + height * 0.08,
                      x + width * 0.85, y + height * 0.2,
                      x + width * 0.9, y + height * 0.35);
   // Renflement labial droit
   ctx.bezierCurveTo(x + width * 0.95, y + height * 0.5,
                      x + width * 0.92, y + height * 0.7,
                      x + width * 0.85, y + height * 0.85);
   // Ligne cervicale
   ctx.quadraticCurveTo(x + width * 0.5, y + height,
                         x + width * 0.15, y + height * 0.85);
   // Côté gauche symétrique
   // ...
 };

 Prémolaire - Forme ovale avec 2 cuspides:
 export const drawPremolar = (ctx, toothId, x, y, width, height, state) => {
   // Contour ovale avec courbes de Bézier
   // Détails: fissure centrale, contours des cuspides
 };

 Molaire - Forme large avec 4 cuspides et fissures:
 export const drawMolar = (ctx, toothId, x, y, width, height, state) => {
   // Contour carré-arrondi
   // Détails: fissures en croix, 4 cuspides avec surbrillance
 };

 3. src/components/dental-chart/toothMap.js (METTRE À JOUR)

 Ajouter la propriété isUpper et ajuster les proportions:

 export const toothMap = {
   // Quadrant 1 (Haut Droit)
   18: { id: 18, type: 'molar', x: 380, y: 80, width: 28, height: 32, rotation: -20, isUpper: true },
   16: { id: 16, type: 'molar', x: 320, y: 45, width: 30, height: 34, rotation: -10, isUpper: true }, // 1ère molaire plus grande
   13: { id: 13, type: 'canine', x: 230, y: 30, width: 20, height: 32, rotation: -3, isUpper: true },
   11: { id: 11, type: 'incisor', x: 170, y: 40, width: 18, height: 24, rotation: 0, isUpper: true },
   // ...
   // Quadrant 3 (Bas Gauche) - isUpper: false
   31: { id: 31, type: 'incisor', x: 140, y: 200, width: 15, height: 25, rotation: 0, isUpper: false },
   // ...
 };

 4. src/components/dental-chart/MouthCanvas.jsx (METTRE À JOUR)

 Synchroniser la détection de clic avec les nouveaux chemins:

 // Utiliser les mêmes chemins de Bézier pour la détection
 const getToothHitPath = (ctx, toothData) => {
   // Appeler les mêmes fonctions de chemin que pour le dessin
 };

 ---
 Améliorations Visuelles

 Dégradés pour Effet 3D

 const createToothGradient = (ctx, x, y, width, height, baseColor) => {
   const gradient = ctx.createRadialGradient(
     x + width * 0.3, y + height * 0.3, 0,
     x + width * 0.5, y + height * 0.5, width * 0.7
   );
   gradient.addColorStop(0, lightenColor(baseColor, 20));
   gradient.addColorStop(0.5, baseColor);
   gradient.addColorStop(1, darkenColor(baseColor, 15));
   return gradient;
 };

 Ombres Subtiles

 ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
 ctx.shadowBlur = 3;
 ctx.shadowOffsetX = 2;
 ctx.shadowOffsetY = 2;

 Détails Anatomiques par Type de Dent

 Incisives:
 - Mamelons (3 petites crêtes sur le bord incisif)
 - Lignes de développement subtiles
 - Surface labiale convexe avec reflet

 Canines:
 - Crête labiale centrale proéminente
 - Pentes mésiale et distale depuis la cuspide
 - Surface plus bombée

 Prémolaires:
 - 2 cuspides (buccale plus grande)
 - Fissure centrale mésio-distale
 - Contours de cuspides visibles

 Molaires:
 - Fissures en croix (centrale)
 - 4 cuspides avec surbrillance individuelle
 - Fosse centrale plus sombre
 - Crêtes marginales

 ---
 Séquence d'Implémentation

 1. Créer toothPaths.js - Définitions des chemins normalisés
 2. Réécrire drawIncisor() - Forme réaliste d'incisive
 3. Réécrire drawCanine() - Forme réaliste de canine
 4. Réécrire drawPremolar() - Forme réaliste de prémolaire
 5. Réécrire drawMolar() - Forme réaliste de molaire
 6. Ajouter fonctions utilitaires - Dégradés, ombres, couleurs
 7. Mettre à jour toothMap.js - Proportions et isUpper
 8. Synchroniser MouthCanvas.jsx - Détection de clic

 ---
 Vérification

 - Les 32 dents s'affichent correctement
 - Chaque type de dent est visuellement distinct
 - Les dents du haut vs bas sont différenciées
 - La détection de clic fonctionne sur toutes les dents
 - Les couleurs d'état s'appliquent correctement
 - Pas de régression de performance
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌