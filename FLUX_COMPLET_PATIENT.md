# Flux complet — Arrivée patient → Comptabilité

Document de suivi construit au fil des tests manuels (navigateur) du parcours
patient réel dans l'app, du moment où il arrive au cabinet jusqu'au suivi
comptable de sa facture. Complété étape par étape, vérifié dans le code puis
dans le navigateur.

## Comptes de test

- **Admin** : mot de passe codé en dur par nom de cabinet
  (`getQuickLoginPassword` dans `src/pages/Login.jsx`) :
  - cabinet contenant "plateau" → `Plateau2024!`
  - cabinet contenant "dakar" → `Dakar2024!`
- **Autres rôles** (secrétaire, médecin, caissier, comptabilité...) :
  mot de passe `12345678` (à confirmer/vérifier lors des tests).
- Sélecteur multi-comptes par cabinet : `/cabinet-welcome-public/:tenantId`
  (liste les users du tenant via RPC `get_quick_login_users`).
- Raccourci sur `/login` : `Ctrl+Shift+E` affiche un sélecteur rapide
  (comptes admin uniquement, par cabinet).

---

## Étape 1 — Arrivée du patient au cabinet

**Rôle qui prend la main :** Secrétaire
**Page :** ~~Introduction Patient — `/introduction-patient`~~ **corrigé après
test navigateur** → l'action se fait en réalité directement sur la page
**Prise de Rendez-vous** — `/rendez-vous/prise-rendez-vous`.
`/introduction-patient` n'est **plus utilisée** dans le parcours actuel.

### Cas A — Le patient a un RDV le jour même (cas normal)

1. La secrétaire le repère dans la liste "Rendez-vous du jour" (page Prise
   de Rendez-vous).
2. Elle clique le bouton icône **"Confirmer la présence"** sur la ligne du
   RDV → RPC `secretaire_confirme_patient_presence` → crée automatiquement
   la ligne dans `waiting_queue` + notifie le médecin.
3. Message de succès affiché : *"Patient confirmé présent et ajouté à la
   file d'attente"*. Le statut du RDV passe de `Confirmé` à `Arrivé`.

→ **1 clic.** ✅ Vérifié dans le navigateur (RDV test Samba Sinendiaye,
06/08/2026 13:30, Dr. Habib Diallo).

### Cas B — Le patient arrive sans RDV (walk-in)

1. La secrétaire bascule en mode recherche et tape son nom.
2. Si trouvé → sélection du patient et ajout à la file.
   Si non trouvé → création de la fiche patient d'abord, puis ajout à la file.

→ **2 étapes.** _(pas encore vérifié dans le navigateur)_

### Ensuite (les deux cas convergent)

Le patient apparaît en salle d'attente :
- vue secrétaire : `/salle-attente` ✅ confirmé (menu RENDEZ-VOUS → Salle
  d'attente)
- vue médecin : `/my-waiting-queue` _(pas encore vérifié)_

Sur `/salle-attente`, la carte du patient présent expose 3 actions :
- **"Envoyer le patient au médecin"**
- **"Scanner des documents médicaux"**
- **"Saisir les antécédents médicaux"**

Filtre de statut disponible : Tous / En attente / Présents / Appelés / En
consultation — confirme les statuts `waiting_queue` déjà repérés dans le
code (`src/utils/waitingQueueStatus.js`) :

`waiting` / `en_attente` → `present` / `arrive` → `en_route` / `called`
(appelé vers le médecin) → `in_consultation`.

Note : le patient testé (RDV 13:30, confirmé présent immédiatement après
création) est apparu avec un badge **"Retard"** dans la salle d'attente —
à investiguer (probablement basé sur l'heure du RDV vs. heure de
confirmation de présence).

---

## Étape 2 — Médecin : réception et démarrage de la consultation

**Rôle qui prend la main :** Médecin
**Page :** Tableau de Bord médecin — `/` (dashboard, connecté en médecin)
puis Consultation — `/consultation/:id?from=workflow&waiting_queue_id=:id`

**Connexion testée :** sélecteur multi-comptes par cabinet
(`Ctrl+Shift+E` sur `/login` → carte admin → écran
`/cabinet-welcome-public/:tenantId` → carte **Dr. Habib Diallo
(Médecin)** → mot de passe `12345678`). Confirme la convention de mot de
passe documentée plus haut pour les rôles non-admin.

### Déroulé observé

1. Le patient appelé (statut `Patient appelé`, transition faite côté
   secrétaire — voir Étape 1) apparaît automatiquement dans la carte
   **"Patient Actuel"** du tableau de bord médecin (sélection "Auto (par
   défaut)"), avec motif, type de RDV, heure prévue et un compteur
   "Xmin d'attente".
2. Bouton **"Recevoir ce patient"** (vert) → toast de succès *"Consultation
   démarrée pour [Patient]."* (✅ ici c'est bien un **toast**, pas un
   modal bloquant — contrairement aux actions équivalentes côté
   secrétaire, cf. [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md)
   point 3). Le compteur "En consultation" du dashboard passe à 1, "En
   attente" reste à 0, badge patient → "En consultation".
3. Bouton **"Commencer consultation"** (violet) apparaît alors sur la
   carte → mène à la page Consultation complète :
   `/consultation/:consultationId?from=workflow&waiting_queue_id=:id`.

### Page Consultation

En-tête : nom patient, dossier (âge, sexe), date/heure, statut "En
Cours", motif de consultation.
Actions : Documents, Faire un devis, Modèle, Imprimer, **Terminer
consultation** (bouton rouge).
Onglets : Examen Général, Schéma Dentaire, Antécédents, Constantes,
Appareils, Diagnostics, Actes, Ordonnances, Certificats, Synthèse.

_(contenu des onglets pas encore testé en détail — à faire dans une
prochaine passe)_

### Observation à creuser

Le compteur "Xmin d'attente" affiché sur la carte Patient Actuel
augmente en continu (123min → 124min entre deux captures) alors que le
patient venait d'être confirmé présent puis appelé quelques minutes plus
tôt dans le test. Cohérent avec le badge "Retard" trompeur déjà noté à
l'Étape 1 — probablement la même cause racine (calcul du temps d'attente
basé sur une mauvaise référence temporelle). Voir
[FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) point 5.

---

## Étape 3 — Terminer la consultation → compléter la facturation

**Rôle qui prend la main :** Médecin (termine) puis Secrétaire
(complète la facturation)

### Côté médecin

Consultation remplie puis bouton **"Terminer consultation"** (bouton
rouge, en-tête de la page Consultation) → statut de la consultation
passe à "Terminée" (vérifié dans `CONSULTATION → Consultations`, colonne
Statut). Le dashboard médecin, lui, affiche encore "Terminées : 0" —
bug déjà noté dans
[FIX_ETAPE_2_MEDECIN.md](FIX_ETAPE_2_MEDECIN.md) point 1.

### Côté secrétaire — notification de suivi

Une notification apparaît côté secrétaire (cloche en haut à droite) :
> **"Consultation terminée - Complèter la facturation"**
> *Consultation du patient Samba Sinendiaye terminée. Cliquez pour
> compléter la facturation.*

Clic sur la notification → page **Complétion de Consultation** :
`/consultation-completion/:consultationId`.

Contenu de la page :
- **Informations** : patient, spécialité.
- **Actes de Consultation** : liste des actes (vide ici, "Aucun acte
  enregistré" — aucun acte n'a été ajouté pendant la consultation de
  test).
- **Ordonnances (0)**.
- **Facturation** : prix de la consultation pré-rempli (6 000 FCFA ici,
  probablement le tarif par défaut de la spécialité), récap
  Consultation + Actes, bouton **"Générer la facture"**.

Clic sur "Générer la facture" → carte "Facture générée" (N° facture,
date) + bouton "Imprimer la facture".

**⚠️ Bug d'affichage repéré :** juste après génération, la carte affiche
**"Consultation médicale : 0 FCFA"** alors que le prix affiché juste
avant était 6 000 FCFA. Vérification faite dans
`FACTURATION → Factures` (recherche "Samba") : la facture
**FAC-1786033963799** est bien enregistrée avec le **bon montant, 6 000
FCFA**, statut **"En attente"** (à encaisser). Donc pas de perte de
donnée, juste un affichage trompeur à cet endroit précis — un
secrétaire pourrait croire que la facture a été générée à 0 FCFA et
paniquer inutilement. À corriger (voir fix à ajouter).

### Module Facturation (vue d'ensemble, `/facturation/factures`)

Stats globales observées : Total factures, Chiffre d'affaires, Factures
payées, En attente. Répartition par type : Actes / Examens / Laboratoire
/ Pharmacie. Filtres : Rechercher (n° facture, patient, médecin), Type,
Statut (À encaisser / Payées / Partiellement payées / En attente /
Impayées), Période (Aujourd'hui / Semaine / Mois / Trimestre / Année).
Tableau scrollable horizontalement (colonnes Facture, Patient, Type,
Services, Montant, Statut, Actions — pas toutes visibles sans scroll
horizontal, à noter comme point d'ergonomie potentiel).

---

## Étape 4 — Encaissement du paiement

**Rôle qui prend la main :** Caissier (testé avec Moussa Fall)
**Page :** Caisse — `/caisse` (menu PRINCIPAL du rôle Caissier ; le
menu de ce rôle n'a que PRINCIPAL et SUIVI & RELANCES, pas de
Facturation complète — voir remarque permissions ci-dessous).

### Déroulé observé

1. **Ouverture de caisse obligatoire en début de journée** : tant que la
   caisse est fermée, un cadenas verrouillé s'affiche
   ("Caisse fermée — Ouvrez une session pour commencer"). Bouton
   **"Ouvrir la caisse"** → modal demandant le **fond de caisse (F CFA)**
   (montant initial pour la monnaie, une seule fois par jour). Toast de
   succès : *"Caisse ouverte avec un fond de 20 000 FCFA."* (encore un
   toast, pas un modal — cohérent avec la bonne pratique déjà vue côté
   médecin).
2. Dashboard caisse à jour : Fond de caisse / Total journée / Solde
   actuel (fond + total journée) / Ce mois.
3. Section **"Factures en attente de paiement"** : liste filtrable
   (recherche nom/prénom/n° facture, filtre patient/n°/date/montant).
   Samba Sinendiaye y apparaît avec sa facture FAC-1786033963799, 6 000
   FCFA, statut "En attente". Action **"Payer à la caisse"**.
4. Modal **"Enregistrer un paiement"** : montant pré-rempli (6 000 FCFA
   / 6 000 FCFA), **modes de paiement** proposés : Espèces, Carte
   bancaire, Chèque, Virement, **Orange Money, Wave, Yas** (bonne
   couverture des moyens de paiement mobile locaux), champ Notes
   optionnel (référence chèque/n° transaction). Bouton **"Enregistrer et
   imprimer"**.
5. Après validation : la facture disparaît de la liste "En attente".
   Dashboard caisse mis à jour de façon cohérente — Total journée : 6 000
   FCFA, Solde actuel : 26 000 FCFA (20 000 fond + 6 000), Répartition
   par mode : Espèces 6 000 FCFA. ✅ Aucune incohérence détectée ici,
   contrairement aux étapes précédentes.
6. Notification reçue (même compte caissier) : *"Paiement Effectué —
   Paiement de 6 000 FCFA pour Samba Sinendiaye enregistré par Moussa
   Fall."*

### Remarque permissions (positif)

Test involontaire : navigation directe vers `/facturation/factures` avec
le compte Caissier → page **"Accès refusé"** ("Vous n'avez pas les
permissions nécessaires pour accéder à cette page."). Bon signe : le
contrôle d'accès par rôle fonctionne correctement, le Caissier n'a accès
qu'à son module Caisse, pas à la vue Facturation complète (réservée à la
secrétaire/admin/comptabilité).

### Autres éléments vus sur la page Caisse (non testés)

- **"Fermer la caisse"**, **"Arrêté mensuel"**.
- Section **"Fin de journée"** avec "Vérification fin de journée (vos
  encaissements)".
- Bouton **"Mise à jour caisse"** (pour reprendre une session déjà
  ouverte après coupure/erreur, sans redemander le fond de caisse).

---

### Mise à jour post-refonte (page Caisse restructurée en onglets)

La page Caisse a été restructurée en 3 onglets — **Encaisser** (par
défaut) / **Ma session** / **Fin de journée** — suite à
[AUDIT_STRUCTURE_UI.md](AUDIT_STRUCTURE_UI.md). "Factures en attente de
paiement" est maintenant visible immédiatement à l'arrivée sur la page,
sans scroll. Voir [FIX_ETAPE_4_CAISSE.md](FIX_ETAPE_4_CAISSE.md) point 2
pour le détail. Revérifié dans le navigateur : le flux d'encaissement
(recherche → payer à la caisse → modal paiement → répartition assurance)
fonctionne toujours à l'identique.

---

## Étape 5 — (à compléter)

Reste à tester : fermeture de caisse / arrêté mensuel, vue comptabilité
finale (module FACTURATION consolidé, rapprochement).

---

## Périmètre du test en cours

Étape 1 (arrivée + salle d'attente), Étape 2 (réception médecin +
consultation), Étape 3 (terminer consultation → génération facture) et
Étape 4 (encaissement caisse) vérifiées dans le navigateur. Suite
(fermeture de caisse, comptabilité) à faire étape par étape.

## Observations de test navigateur

- Connexion secrétaire : **Aissatou Ndoye**, Cabinet Dentaire Dakar Centre.
- RDV créé via `/rendez-vous/prise-rendez-vous` → "+ Nouveau rendez-vous"
  (wizard 3 étapes : Patient & contexte → Médecin & disponibilité →
  Confirmation) pour patient existant **Samba Sinendiaye**, Dr. Habib
  Diallo (Dentiste généraliste), 06/08/2026 13:30, statut initial
  "Confirmé".
- Clic "Confirmer la présence" → succès, statut → "Arrivé", patient
  visible dans `/salle-attente` (1 patient en attente).
