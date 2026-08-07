# Fix — Étape 2 Médecin (réception et consultation)

Spéc issue de l'audit ergonomique fait après test navigateur du parcours
« réception du patient par le médecin → consultation » (voir
[FLUX_COMPLET_PATIENT.md](FLUX_COMPLET_PATIENT.md) pour le détail du
test, et [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) pour
l'audit équivalent côté secrétaire). Liste des points validés, à
implémenter — pas encore fait, ce fichier sert de backlog/spéc pour
quand on s'y attaque.

Statut global : **à faire**. On ne touche à rien pour l'instant.

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

---

## Récapitulatif priorités

**Bug à corriger en priorité :** 1
**Impact fort :** 2, 5 (bug, lié à [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) point 5)
**Cosmétique mais utile :** 3
**Non retenu (besoin métier) :** 4
