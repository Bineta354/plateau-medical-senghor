# Audit — Structure UI/UX transversale (squelette de page)

Contrairement aux fichiers `FIX_ETAPE_*.md` (qui documentent des points
ergonomiques propres à une étape précise du parcours patient), ce
fichier porte sur un problème **transversal** : l'absence de règle
cohérente pour organiser le contenu à l'intérieur d'une page, observée
en comparant plusieurs pages testées pendant l'audit du parcours patient
(voir [FLUX_COMPLET_PATIENT.md](FLUX_COMPLET_PATIENT.md) et les fichiers
`FIX_ETAPE_1` à `FIX_ETAPE_4`).

Statut global : **point 1 appliqué** sur la page Caisse
(`src/pages/secretary/Caisse.jsx`) — refonte en 3 onglets (Encaisser /
Ma session / Fin de journée), zone haute réduite à titre + statut + 1
ligne de KPI. Vérifié dans le navigateur (rôle Caissier, Moussa Fall) :
compile sans erreur, "Factures en attente de paiement" visible sans
scroll par défaut, modal de paiement et calcul de répartition
assurance intacts.

**Même refonte appliquée au Dashboard Secrétaire**
(`src/components/secretary/SecretaryDashboard.jsx`, page `/secretary`) :
l'empilement "En-tête" → carte "Navigation des vues" (toggle Vue
Globale/Spécifique) → carte "Filtres et recherche" → carte "Contenu
principal" (4 blocs stackés avant tout contenu utile) remplacé par
zone haute (titre + notifs + "Patient arrivé" + Actualiser, 1 ligne) +
une seule carte à onglets **File d'attente / Calendrier**, avec la
barre d'outils (vue globale/spécifique, recherche, filtre statut,
Inscrire Patient) compactée en une ligne dans l'onglet File d'attente.
Header global de l'app (`src/components/Header.jsx`, dans `Layout.jsx`)
également resserré : logo 64px→40px, padding vertical 16px→10px.
Compile sans erreur (`vite build`) — **pas encore revérifié dans le
navigateur** (accès Chrome indisponible pendant cette session).

Ajustements suite au retour utilisateur : "Calendrier" remis en action
rapide (bouton dans la zone haute, bascule directe) plutôt qu'en onglet
dans le contenu — c'était son usage d'origine. "Inscrire Patient" retiré
de la barre d'outils, puis reposé en zone haute sous le nom **"Créer
fiche patient"** (→ `/patients/create`, la page dédiée) après vérification
des 4 capacités attendues de l'espace secrétaire (consulter/créer RDV,
créer fiche patient, gérer la file) — "créer une fiche patient" n'était
plus couvert du tout après le retrait initial.

Points 2, 3, 4 du reste de l'audit encore à faire.

---

## Ce qui est solide (le macro-squelette, à ne pas casser)

La structure globale est cohérente sur toutes les pages testées :
- Sidebar collapsible à gauche, menu qui change selon le rôle connecté.
- Header fixe : logo/nom du cabinet, recherche (⌘K), notifications,
  compte utilisateur (nom, rôle, avatar).
- Zone de contenu à droite avec titre de page + sous-titre.

Ce n'est pas le problème. Le problème est **à l'intérieur** de la zone
de contenu.

---

## 1. Deux façons opposées d'organiser une page à concerns multiples, sans règle apparente pour choisir laquelle

**Constat :**
- La page **Consultation** (`/consultation/:id`) utilise des **onglets**
  (Examen Général / Schéma Dentaire / Antécédents / Constantes /
  Appareils / Diagnostics / Actes / Ordonnances / Certificats /
  Synthèse) pour séparer des concerns différents. Bon réflexe : chaque
  onglet est un contexte à part, l'utilisateur ne voit que ce dont il a
  besoin au moment donné.
- La page **Caisse** (`/caisse`), à l'inverse, empile **tout
  verticalement dans un seul scroll continu** : État de la caisse →
  Répartition par mode → Fin de journée → Rechercher une facture →
  Factures en attente de paiement. Ce sont pourtant des concerns aussi
  distincts que ceux de la page Consultation (gérer ma session de caisse
  / clôturer ma journée / traiter un paiement), mais rien ne les sépare
  visuellement — juste un empilement de cards qui se ressemblent toutes.

**Conséquence concrète vécue pendant le test :** pour arriver à
"Factures en attente de paiement" — l'action probablement **la plus
fréquente de la journée** pour un caissier — il faut scroller à travers
deux écrans de contenu (état de caisse, fin de journée) qui, eux, ne
servent qu'une ou deux fois par jour. La hiérarchie visuelle est
inversée par rapport à la fréquence d'usage réelle.

**Fix validé :** définir une règle explicite pour choisir entre onglets
et scroll vertical selon la nature du contenu (concerns indépendants et
consultés séparément → onglets ; contenu qui se lit en continu et se
complète progressivement → scroll), puis appliquer cette règle à Caisse
en priorité (voir gabarit proposé en fin de fichier).

**Priorité :** impact fort — touche une page à très haute fréquence
d'usage.

---

## 2. Toutes les cards se ressemblent visuellement, rien ne hiérarchise l'importance

**Constat :** même fond blanc, même ombre, même traitement visuel pour
"Fond de caisse : 20 000 FCFA" (info de référence, consultée rarement)
et pour "Factures en attente de paiement" (la tâche du jour, répétée
des dizaines de fois). Un utilisateur qui scanne la page rapidement n'a
aucun signal visuel pour savoir où regarder en premier. Ce problème
n'est pas propre à Caisse — le même empilement de cards uniformes se
retrouve sur les dashboards Secrétaire et Médecin.

**Fix validé :** introduire une hiérarchie visuelle explicite (poids de
carte, couleur d'accent, taille, position) qui distingue "contenu
d'action principale" de "contenu de référence/secondaire", de façon
cohérente sur toutes les pages du même type.

**Priorité :** impact fort.

---

## 3. Asymétrie de la page d'atterrissage selon le rôle

**Constat :** Secrétaire et Médecin arrivent sur une page
**"Tableau de bord [rôle]"** — une couche de synthèse avec KPIs et
raccourcis vers les vraies pages d'action. Le Caissier, lui, atterrit
**directement** sur la page opérationnelle "Caisse", sans couche
dashboard intermédiaire. Ce n'est pas forcément un défaut (le métier de
caissier est plus étroit que celui de médecin/secrétaire), mais ça
casse le modèle mental "chaque rôle a un tableau de bord" construit en
testant les deux premiers rôles.

**Fix validé :** clarifier si c'est un choix assumé (le caissier n'a
qu'une seule tâche donc pas besoin de couche dashboard) ou un oubli de
cohérence. Si c'est un choix assumé, le documenter explicitement quelque
part (design system / convention d'équipe) pour que ça ne soit pas
perçu comme une incohérence lors de futurs développements.

**Priorité :** cosmétique/documentation, mais utile pour la cohérence
future.

---

## 4. Le gabarit "bandeau de KPIs en haut" est appliqué uniformément, même quand il dessert la tâche principale

**Constat :** le pattern "bandeau de stats en haut de page" est
cohérent partout (bon point de constance en soi), mais sur une page
transactionnelle à haute fréquence comme Caisse, appliquer ce même
gabarit "dashboard" pousse mécaniquement la vraie tâche vers le bas de
la page. Le gabarit qui convient à une page de lecture ponctuelle
(dashboard de synthèse) ne convient pas à une page d'exécution
répétitive (traiter des paiements toute la journée).

**Fix validé :** faire dépendre la position/taille du bandeau de KPIs de
la fréquence d'usage de la page : pages de synthèse → KPIs en haut, en
évidence ; pages d'exécution répétitive → KPIs réduits à une ligne
courte ou déplacés en périphérie, contenu actionnable toujours au-dessus
du pli.

**Priorité :** impact fort, lié directement au point 1.

---

## Gabarit de page proposé (à appliquer de façon cohérente)

Un gabarit à 3 zones, à utiliser comme référence pour toute nouvelle
page ou refonte de page existante :

1. **Zone haute (fixe/courte)** : titre + au maximum 1 ligne de KPIs.
   Jamais plus.
2. **Zone principale (toujours au-dessus du pli)** : la tâche la plus
   fréquente de cette page. Sur Caisse, ce serait directement "Factures
   en attente de paiement". Sur un dashboard de synthèse, ça peut rester
   les KPIs eux-mêmes si c'est la vraie fonction de la page.
3. **Zone secondaire (onglet séparé ou section repliable, pas dans le
   scroll principal imposé)** : gestion de session, fin de journée,
   historique, paramétrage — accessible mais pas imposée à chaque
   visite de la page.

Concrètement pour Caisse : reprendre le réflexe déjà bon de la page
Consultation (onglets pour séparer les concerns) plutôt que de laisser
chaque page inventer sa propre organisation. Onglets proposés : **"Encaisser"**
(factures en attente, en zone principale) / **"Ma session"** (état de
caisse, ouverture/fermeture) / **"Fin de journée"** (vérification,
arrêté mensuel).

---

---

## 5. Sidebar non responsive — bloque toute page sur mobile (constat, hors périmètre pour l'instant)

**Constat :** `src/components/Sidebar.jsx` fait 256px de large en dur
(`flex-shrink-0`, pas de breakpoint mobile, pas de tiroir/hamburger).
Sur un viewport mobile (375px), la sidebar écrase le contenu de
n'importe quelle page à ~113-119px de large — illisible, quel que soit
le soin apporté au responsive de la page elle-même. Repéré en auditant
le responsive de la page Caisse (voir
[FIX_ETAPE_4_CAISSE.md](FIX_ETAPE_4_CAISSE.md)).

**Décision :** laissé explicitement de côté pour l'instant — la
demande portait sur la page Caisse, pas sur le layout global. Le
responsive de Caisse.jsx lui-même a été corrigé et vérifié
indépendamment (en masquant temporairement la sidebar pour le test).

**Priorité :** impact fort mais différé — touche toutes les pages, pas
seulement Caisse. À reprendre en tant que chantier séparé.

---

## Récapitulatif priorités

**Impact fort :** 1, 2, 4
**Cosmétique/documentation :** 3
**Constat différé (hors périmètre actuel) :** 5 (sidebar non responsive)
