# Fix — Étape 1 Secrétaire (arrivée patient)

Spéc issue de l'audit ergonomique fait après test navigateur du parcours
« arrivée du patient au cabinet » (voir [FLUX_COMPLET_PATIENT.md](FLUX_COMPLET_PATIENT.md)
pour le détail du test). Liste des points validés, à implémenter — pas encore fait,
ce fichier sert de backlog/spéc pour quand on s'y attaque.

Statut global : **en cours**. Points 1, 2, 3, 9 (tier "vite fait / fort
impact") implémentés — voir statut par point ci-dessous. Reste à faire :
4, 5, 6, 7, 8, 11.

---

## 1. Navigation dashboard → RDV

**Constat :** aujourd'hui la secrétaire doit chercher "Rendez-vous" dans la
sidebar quand un patient arrive.

**Fix validé :** ajouter un bouton bien visible sur le tableau de bord
(ex. "Patient arrivé") qui mène directement à la page Prise de
Rendez-vous (`/rendez-vous/prise-rendez-vous`). Idéalement avec un badge
indiquant le nombre de RDV du jour pas encore confirmés présents.

**Priorité :** vite fait / fort impact.

**Statut : fait (partiellement).** Correctif initial posé au mauvais
endroit — `src/pages/Dashboard.jsx` n'est en réalité affiché que pour
le rôle `admin` (et fallback) : `SmartDashboard` (`src/App.jsx`)
redirige un compte `secretary` de `/` vers `/secretary`, qui rend
`SecretaryDashboard.jsx`. Le bouton **"Patient arrivé"** (→
`/rendez-vous/prise-rendez-vous`) a donc été ajouté dans l'en-tête de
`src/components/secretary/SecretaryDashboard.jsx` (à côté de "Voir
calendrier"/"Actualiser"), en plus de celui déjà posé sur
`Dashboard.jsx` (conservé, inoffensif pour le fallback admin). Le badge
de comptage des RDV pas encore confirmés présents **n'est pas encore
fait** — laissé pour une prochaine passe (nécessite une requête
dédiée).

---

## 2. Route morte `/introduction-patient`

**Constat :** cette page n'est plus utilisée dans le parcours actuel (le
"Confirmer la présence" a migré sur la page Prise de Rendez-vous), mais
elle existe toujours et ne redirige nulle part. Une secrétaire qui y
accède (ancien favori, vieux réflexe) atterrit sur une impasse.

**Fix validé :** supprimer la route, ou au minimum rediriger
automatiquement vers `/rendez-vous/prise-rendez-vous`.

**Priorité :** vite fait / fort impact.

**Statut : fait.** La route `/introduction-patient` (`src/App.jsx`)
redirige maintenant automatiquement vers
`/rendez-vous/prise-rendez-vous` (`<Navigate replace />`) au lieu de
rendre `IntroductionPatientPage`. Choix : redirection plutôt que
suppression complète, car la route est encore ciblée ailleurs (clic sur
notification "doctor_request"/"demande_autorisation" dans
`Header.jsx`, entrée `pagesConfig.js`) — ces points d'entrée continuent
de fonctionner, ils rebondissent simplement vers la nouvelle page.

---

## 3. Modales "Succès" bloquantes → toasts

**Constat :** chaque action (création RDV, confirmation de présence)
ouvre un modal "Succès" qu'il faut fermer manuellement (clic sur OK).
Pour une action répétée des dizaines de fois par jour, ça fait beaucoup
de clics inutiles. Un toast auto-disparaissant existe déjà ailleurs dans
l'app (vu lors de la création du RDV) — à généraliser.

**Fix validé :** remplacer les modales de succès par des toasts non
bloquants sur les actions à haute fréquence (confirmation de présence en
particulier).

**Priorité :** vite fait / fort impact.

**Statut : fait (sur Prise de Rendez-vous).** Dans
`PriseRendezVousPage.jsx`, les 3 messages de succès/info déclenchés
depuis la liste "Rendez-vous du jour" (confirmation de présence,
suppression, marquage absent) utilisent maintenant
`unifiedNotificationService` (le système de toast react-toastify déjà
utilisé côté médecin/caisse) au lieu de la modale bloquante `useAlert`.
Les messages d'**erreur** restent en modale (need d'attention, pas une
action répétée) — non touchés. Le formulaire de création/édition de RDV
avait déjà son propre toast local (`showSuccessToast`), inchangé.

---

## 4. Bouton "Confirmer la présence" mal isolé

**Constat :** sur la liste des RDV, l'action est une icône sans libellé,
au même niveau visuel que "Modifier" (crayon) et **"Supprimer" (poubelle
rouge)** — une action destructive juste à côté d'une action positive
répétée en continu. Risque de mis-clic.

**Fix validé :** séparer visuellement l'action "Confirmer la présence"
(bouton plus large, libellé visible et/ou couleur dédiée) des actions
d'édition/suppression. Éventuellement déplacer "Supprimer" dans un menu
secondaire (« ... ») pour réduire le risque de clic accidentel.

**Priorité :** impact fort, un peu de code.

**Statut : fait.** "Confirmer la présence" est maintenant un bouton
plein, libellé ("Confirmer présence"), vert, nettement plus large que
les icônes voisines. "Modifier" et "Supprimer" sont sortis de la ligne
principale et regroupés dans un menu secondaire (icône « ⋮ », menu au
clic, fermeture au clic extérieur) — la suppression n'est plus un clic
voisin de l'action répétée à longueur de journée.

---

## 5. Badge "Retard" trompeur

**Constat :** un patient confirmé présent pile à l'heure de son RDV s'est
retrouvé immédiatement affiché avec un badge "Retard" en salle d'attente.
Signal faux envoyé dès la première seconde à la secrétaire/au médecin.

**Fix validé :** investiguer le calcul (fuseau horaire ? comparaison de
dates mal faite ? logique de seuil mal calibrée ?) et corriger. C'est
avant tout un bug, pas juste un souci d'ergonomie.

**Priorité :** impact fort, à investiguer côté code (pas juste UI).

---

## 6. Spécialités hors-sujet dans le formulaire de RDV

**Constat :** cabinet dentaire, mais le menu déroulant "Spécialité"
liste aussi Cardiologie, Gynécologie, Neurologie, Pédiatrie,
Ophtalmologie, rhumatologie... Le menu "Médecin" est lui bien filtré sur
les 3 praticiens réels du cabinet — incohérence.

**Fix validé :** filtrer la liste des spécialités selon l'activité
réelle du cabinet/tenant, comme c'est déjà fait pour la liste des
médecins.

**Priorité :** cosmétique mais utile.

---

## 7. Layout shift au choix du créneau horaire

**Constat :** au clic sur un horaire dans le wizard de création de RDV,
un bandeau date apparaît en haut du modal et pousse la grille de
créneaux vers le bas — après le clic. Un clic rapide juste après tombe
sur la mauvaise case (vécu pendant le test : créneau 13:30 obtenu au
lieu de celui visé).

**Fix validé :** réserver l'espace du bandeau date dès l'ouverture de
l'étape (ou l'afficher ailleurs) pour que la grille de créneaux ne bouge
pas suite à une interaction utilisateur.

**Priorité :** cosmétique mais utile.

---

## 8. Libellés tronqués en salle d'attente

**Constat :** les 3 actions sur la carte patient ("Envoyer le patient au
médecin", "Scanner des documents médicaux", "Saisir les antécédents
médicaux") sont des icônes dont le texte s'affiche tronqué
("Scanne...").

**Fix validé :** revoir le layout (icônes seules + tooltip complet, ou
libellés courts qui ne débordent pas) pour que l'action soit
compréhensible sans avoir à deviner.

**Priorité :** cosmétique mais utile.

---

## 9. Bouton "Gestion salle d'attente" depuis la page RDV

**Constat :** aujourd'hui il faut repasser par la sidebar pour aller de
"Prise de Rendez-vous" à "Salle d'attente".

**Fix validé :** ajouter un bouton/lien croisé directement sur la page
Prise de Rendez-vous vers `/salle-attente`, pour rester dans le flux sans
redescendre dans le menu.

**Priorité :** vite fait / fort impact.

**Statut : fait.** Bouton secondaire **"Salle d'attente"** ajouté dans
l'en-tête de `PriseRendezVousPage.jsx`, à côté de "Nouveau
rendez-vous", menant à `/salle-attente`.

---

## 10. Liste "Rendez-vous du jour" en onglets Présents / Pas encore arrivés

**Statut : non retenu — on ne touche pas.** Décision explicite de garder
la page Prise de Rendez-vous telle qu'elle est aujourd'hui (une seule
liste "Rendez-vous du jour", pas d'onglets Présents/Pas encore arrivés).

**Constat de départ (pour mémoire) :** pour savoir qui est déjà en salle
d'attente, il faut changer de page (Salle d'attente). L'idée d'onglets
"Présents" / "Pas encore arrivés" avait été évoquée comme version light
d'une fusion des deux pages, mais **la décision finale est de laisser le
comportement actuel inchangé** — seul le lien croisé (point 9) est
retenu pour faciliter le passage d'une page à l'autre.

**Explicitement écarté (les deux options) :**
- fusionner complètement la page Salle d'Attente dans la page RDV ;
- transformer la liste "Rendez-vous du jour" en onglets Présents/Pas
  encore arrivés.

Salle d'Attente reste une page dédiée pour la gestion temps réel (appel
médecin, scan documents, antécédents, timers d'attente), et Prise de
Rendez-vous reste une page de planification classique (liste simple,
recherche/filtre sur plusieurs jours). Le lien croisé (point 9) suffit
pour naviguer entre les deux.

---

## 11. Confirmation de présence pour un nouveau patient

**Proposition initiale (rejetée) :** confirmer automatiquement la
présence d'un nouveau patient créé quand son RDV est le jour même.

**Pourquoi rejeté :** ça déduit "patient physiquement présent" à partir
de "RDV créé aujourd'hui", ce qui n'est pas toujours vrai. Cas concret :
la secrétaire crée un nouveau patient et lui prend un RDV le jour même
au téléphone pour plus tard (ex. 17h) — le patient n'est pas encore
là. Une auto-confirmation baserait un faux statut "présent"/"en salle
d'attente" sur une simple coïncidence de date, faussant le compteur de
salle d'attente pour le médecin.

**Fix validé (alternative) :** garder une intention explicite plutôt
qu'une déduction implicite sur la date :
- Dans le flux **"Patient arrivé"** lancé depuis le bouton dashboard
  (point 1) — donc un contexte où on *sait* que le patient est
  physiquement devant la secrétaire — la création du patient propose une
  case à cocher **"Confirmer la présence immédiatement"**, cochée par
  défaut mais décochable.
- Dans le flux de prise de RDV classique (téléphone, RDV futur ou même
  jour mais pas immédiat), cette case n'apparaît pas ou n'est pas cochée
  par défaut.
- L'intention vient donc de **quel bouton/flux la secrétaire a
  utilisé au départ**, jamais d'une déduction automatique sur la date du
  RDV.

**Priorité :** impact fort, demande de distinguer les deux flux
d'entrée (dashboard "Patient arrivé" vs. prise de RDV classique).

---

## Récapitulatif priorités

**Vite fait / fort impact :** 1, 2, 3, 9
**Impact fort / un peu de code :** 4, 5 (bug), 11
**Cosmétique mais utile :** 6, 7, 8
**Non retenu (statu quo) :** 10
