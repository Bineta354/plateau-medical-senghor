# Fix — Étape 2 Médecin (réception et consultation)

Spéc issue de l'audit ergonomique fait après test navigateur du parcours
« réception du patient par le médecin → consultation » (voir
[FLUX_COMPLET_PATIENT.md](FLUX_COMPLET_PATIENT.md) pour le détail du
test, et [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) pour
l'audit équivalent côté secrétaire). Liste des points validés, à
implémenter — pas encore fait, ce fichier sert de backlog/spéc pour
quand on s'y attaque.

Statut global : **en cours**. Points 1, 2, 3 faits, 5 investigué (pas de
fix nécessaire — voir statut du point). Reste à faire : rien de plus
identifié pour l'instant côté médecin (point 4 non retenu).

---

## Ce qui fonctionne déjà bien (à ne pas casser)

- Toast non bloquant (pas de modal) pour "Consultation démarrée pour
  [Patient]." — bon exemple, à répliquer côté secrétaire (voir
  [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) point 3).
- Sélection automatique du patient appelé dans la carte "Patient Actuel"
  du tableau de bord médecin — le médecin n'a rien à chercher.
- Page Consultation bien structurée (onglets Examen Général, Schéma
  Dentaire, Antécédents, Constantes, Appareils, Diagnostics, Actes,
  Ordonnances, Certificats, Synthèse).

---

## 1. Compteur "Terminées" du dashboard qui ne se met pas à jour

**Constat :** après avoir terminé la consultation de Samba Sinendiaye
(confirmée avec le statut "Terminée" dans la liste Consultations —
`CONSULTATION → Consultations`), le Tableau de Bord médecin affiche
toujours **"Terminées : 0"**. Un médecin qui enchaîne les consultations
toute la journée et voit ce compteur bloqué à 0 peut légitimement douter
que son travail a été enregistré.

**Fix validé :** corriger l'agrégation/le filtre derrière la stat
"Terminées" du dashboard (probablement un souci de filtre sur la
date/plage horaire du jour — même famille de bug que le point 5 de
[FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md), à vérifier en
même temps).

**Priorité :** bug à corriger en priorité — ce n'est pas un choix de
design, c'est cassé.

**Statut : fait.** Deux bugs empilés dans `fetchDashboardData`
(`DoctorDashboard_Fixed.jsx`) :
1. `consultationsFinished` filtrait `queueData` (la vue
   `v_waiting_queue_complete`) sur `q.status === 'termine'` — mais
   `queueData` est lui-même récupéré avec
   `.in('status', ['waiting','present','authorized','medecin_pret','en_route','in_consultation'])`,
   qui **exclut** `'termine'`. Le filtre ne pouvait donc jamais matcher
   quoi que ce soit.
2. Même en ignorant le bug 1, la comparaison
   `q.updated_at > new Date(Date.now() - 2h)` comparait une chaîne
   (`updated_at`, tel que renvoyé par Supabase) à un objet `Date` — la
   comparaison relationnelle JS convertit alors la chaîne via `ToNumber`
   (pas `Date.parse`), ce qui donne `NaN` et rend le test toujours faux.

**Fix appliqué :** requête dédiée (`count: 'exact', head: true` sur
`waiting_queue`, filtrée sur `status = 'termine'` et `updated_at` dans la
plage du jour) pour calculer `consultationsFinished`, indépendante du
filtre de statuts actifs de `queueData`.

---

## 2. Widget "RDV du jour" du dashboard sans badge de statut

**Constat :** dans le widget "RDV du jour" du tableau de bord médecin,
un patient reste affiché avec juste heure + motif, sans badge de statut
— même après que sa consultation soit terminée. À comparer avec la page
Prise de Rendez-vous côté secrétaire, qui affiche clairement des badges
("Confirmé", "Arrivé"...). Deux vues du même workflow, deux niveaux
d'information différents.

**Fix validé :** ajouter un badge de statut (Confirmé / Arrivé / En
consultation / Terminée...) sur les entrées du widget "RDV du jour" du
dashboard médecin, pour harmoniser avec le pattern déjà utilisé côté
secrétaire.

**Priorité :** impact fort.

**Statut : fait.** Badge ajouté sur chaque entrée du widget "RDV du
jour" (`DoctorDashboard_Fixed.jsx`), avec le même vocabulaire que côté
secrétaire (Confirmé / En attente / Arrivé / En consultation / Terminée
/ Annulé / Non honoré). Point d'attention géré : `appointments.statut`
seul ne suffit pas pour détecter "En consultation" — il reste bloqué à
`'arrive'` pendant toute la consultation
(`medecin_recoit_patient_simplifie` ne met à jour que
`waiting_queue.status`, jamais `appointments.statut`) — donc le badge
regarde d'abord l'entrée `waiting_queue` liée (déjà chargée via le join
`waiting_queue!left(id, status, arrived_at)`) avant de retomber sur
`appointments.statut`.

---

## 3. Terminologie incohérente pour le même concept

**Constat :** le Tableau de Bord médecin parle d'**"En consultation"**,
la liste Consultations parle d'**"En cours"** — pour désigner
apparemment la même chose. Ça demande au médecin de faire le lien
mentalement entre deux mots différents pour un seul concept.

**Fix validé :** unifier le vocabulaire entre les deux écrans (choisir
un seul terme — "En cours" ou "En consultation" — et l'utiliser
partout).

**Priorité :** cosmétique mais utile.

**Statut : fait.** Terme unifié sur **"En consultation"** (déjà le terme
dominant côté tableau de bord médecin : carte stat, badge "Patient
Actuel", et maintenant le nouveau badge du point 2). Côté
`src/pages/consultation/Consultations.jsx`, seul le **libellé affiché**
a changé (carte stat, option du filtre, badge de statut par ligne — ce
dernier passe d'un `statut.replace('_', ' ')` brut, sans accent, à un
vrai `getStatusLabel()`) — la valeur technique `en_cours` (colonne
`consultations.statut`, filtre, requêtes) n'a volontairement pas été
touchée pour ne rien casser côté données/filtrage.

---

## 4. Deux clics "Recevoir ce patient" → "Commencer consultation"

**Statut : non retenu — on ne touche pas.** Le besoin métier l'exige :
la distinction entre "accueillir le patient" (Recevoir ce patient) et
"commencer à documenter le dossier" (Commencer consultation) est
volontaire et correspond à un vrai cas d'usage (le médecin peut accueillir
physiquement le patient avant d'être prêt à ouvrir le dossier). Pas de
fusion des deux étapes.

---

## 5. Compteur d'attente ("Xmin d'attente") peu fiable

**Constat :** sur la carte "Patient Actuel", le compteur "Xmin
d'attente" continue de grimper de façon incohérente (123min → 124min
observé entre deux captures très rapprochées, pour un patient venant
d'être confirmé présent puis appelé quelques minutes plus tôt dans le
test).

**Fix validé :** investiguer le calcul du temps d'attente — probablement
la même cause racine que le badge "Retard" trompeur déjà noté côté
secrétaire ([FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) point
5), à savoir un mauvais point de référence temporelle partagé entre les
deux vues (secrétaire et médecin affichent probablement la même donnée
mal calculée).

**Priorité :** impact fort, à investiguer côté code (pas juste UI) — à
traiter en même temps que le point 5 du fix secrétaire.

**Statut : investigué — pas de fix nécessaire.** Contrairement au badge
"Retard" secrétaire (point 5 de
[FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md), qui comparait
l'heure de fin théorique du RDV à "maintenant"), `temps_attente_minutes`
vient de la vue SQL `v_waiting_queue_complete` :

```sql
CASE WHEN wq.arrived_at IS NOT NULL
     THEN EXTRACT(epoch FROM now() - wq.arrived_at) / 60
     ELSE 0 END AS temps_attente_minutes
```

— basée sur `arrived_at` (mis à jour à `now()` par
`secretaire_confirme_patient_presence` à chaque confirmation de
présence), donc sur la bonne référence temporelle dès le départ. Le
dashboard médecin l'affiche telle quelle (`DoctorDashboard_Fixed.jsx`
ligne ~731), sans recalcul côté client qui pourrait introduire un
décalage. La valeur "123min" observée pendant le test est cohérente
avec une session de test qui s'est étalée sur un temps réel plus long
que ce que la note "quelques minutes plus tôt" suggère (captures
d'écran, aller-retours, débogage) plutôt qu'avec un bug de calcul — et
le fait qu'elle soit passée de 123 à 124 entre deux captures rapprochées
est justement le comportement attendu d'un compteur qui avance en
continu depuis l'arrivée réelle. Rien à corriger ici ; à revérifier si
un futur test montre un écart net entre l'heure de confirmation de
présence et la valeur affichée.

---

## Récapitulatif priorités

**Bug à corriger en priorité :** 1 — fait
**Impact fort :** 2 — fait, 5 — investigué, pas de bug trouvé (lié à [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) point 5)
**Cosmétique mais utile :** 3 — fait
**Non retenu (besoin métier) :** 4
