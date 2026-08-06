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
**Page :** Introduction Patient — `/introduction-patient`

### Cas A — Le patient a un RDV le jour même (cas normal)

1. La secrétaire le repère dans la liste "Rendez-vous du jour".
2. Elle clique **"Confirmer présence"** → RPC `secretaire_confirme_patient_presence`
   → crée automatiquement la ligne dans `waiting_queue` + notifie le médecin.

→ **1 clic.**

### Cas B — Le patient arrive sans RDV (walk-in)

1. La secrétaire bascule en mode recherche et tape son nom.
2. Si trouvé → sélection du patient et ajout à la file.
   Si non trouvé → création de la fiche patient d'abord, puis ajout à la file.

→ **2 étapes.**

### Ensuite (les deux cas convergent)

Le patient apparaît en salle d'attente :
- vue secrétaire : `/salle-attente`
- vue médecin : `/my-waiting-queue`

Statuts `waiting_queue` observés dans le code
(`src/utils/waitingQueueStatus.js`) :

`waiting` / `en_attente` → `present` / `arrive` → `en_route` / `called`
(appelé vers le médecin) → `in_consultation`.

---

## Étape 2 — (à compléter après test navigateur)

---

## Périmètre du test en cours

Décision : on se limite pour l'instant à **l'action de la secrétaire** à
l'arrivée du patient (Étape 1 ci-dessus) — pas encore la suite (salle
d'attente, appel médecin, consultation...). On avance étape par étape.

## Observations de test navigateur

_(rempli au fur et à mesure des tests réels dans Chrome)_
