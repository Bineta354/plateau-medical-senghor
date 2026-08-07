# Audit — KPI du code : recensement et vérification des redirections

> Périmètre : tous les indicateurs chiffrés (cartes "KPI"/statistiques) affichés dans `src/pages/**` et `src/components/**`. Pour chacun, on vérifie s'il est cliquable et, si oui, si la redirection déclenchée mène bien vers une page qui remplit le "but" annoncé par le libellé (même filtre, même période).
>
> Méthode : lecture directe du code (recherche des patterns `getStatCard`, `StatCard`, `ClickableStatCard`, cartes JSX valeur+icône, puis traçage de chaque `navigate(...)` jusqu'à la page cible et sa logique de filtrage). Aucune modification de code effectuée.

---

## 1. Résumé exécutif

**42 indicateurs KPI recensés**, répartis en 3 catégories :

| Catégorie | Nombre | Comportement au clic |
|---|---|---|
| **KPI redirigeants** (changent de page) | **15** fixes + N dynamiques (lignes facture/patient) | `navigate('/autre-page?...')` |
| **KPI filtrants locaux** (restent sur la même page) | **12** | `onClick` → filtre l'affichage courant, pas de `navigate` |
| **KPI informationnels** (non cliquables) | **15** | Aucun `onClick` |

- **Seul `src/pages/AccountingDashboard.jsx` fait redirigier des KPI vers d'autres pages.** Tous les autres tableaux de bord (`Dashboard.jsx`, `ImpayesRelances.jsx`, `Caisse.jsx`) affichent des KPI purement informatifs, et les files d'attente (`DoctorSpecificQueue.jsx`, `GlobalWaitingQueue.jsx`, `IntroductionPatientPage.jsx`) n'utilisent le clic que pour filtrer sur place via `ClickableStatCard`.
- **Constat principal (bug transversal) : la période sélectionnée dans `AccountingDashboard.jsx` (semaine/mois/trimestre/année) n'est jamais transmise à la page de destination `/facturation/factures`.** Cette dernière a son propre filtre de période, avec sa **propre définition du "mois"** (mois calendaire depuis le 1er, contre 30 jours glissants côté dashboard). Résultat : le chiffre affiché sur la carte KPI ne correspond jamais exactement à ce que l'utilisateur voit une fois redirigé, même quand les deux pages affichent "mois" par défaut.
- **Anomalie plus grave** : les 3 KPI "Priorité relances" (`0-7j`, `8-30j`, `31j+`, `AccountingDashboard.jsx:345-360`) redirigent tous les trois vers **la même URL** `/facturation/factures?status=outstanding` — la page cible ne sait pas filtrer par ancienneté de créance, donc cliquer sur "31j+" (urgent) ou "0-7j" produit exactement le même résultat. Le but (prioriser les relances par urgence) n'est pas atteint.
- **KPI "Total facturé" et "Taux de recouvrement"** (`AccountingDashboard.jsx:391,394`) redirigent vers `/comptabilite/recherche-rapports`, page qui n'a **aucune lecture de query string** (`location.search` jamais utilisé dans ce fichier) : elle s'ouvre avec des dates vides et affiche 0 résultat tant que l'utilisateur ne relance pas une recherche manuelle. Le clic amène donc sur le bon module, mais pas sur le chiffre attendu.
- Les KPI restants (statuts de facture, "Reste à encaisser", lignes "Top restes à encaisser", table "Factures récentes") sont correctement câblés : route existante et filtre cohérent avec le libellé.

---

## 2. Détail — KPI redirigeants (`src/pages/AccountingDashboard.jsx`)

| KPI (libellé) | Fichier:ligne | Cible (`navigate`) | Route existe ? | Filtre cohérent avec le but ? | Verdict |
|---|---|---|---|---|---|
| Total Factures | `AccountingDashboard.jsx:286` | `/facturation/factures` | ✅ (`App.jsx:1104`) | ⚠️ Liste non bornée à la période du dashboard (le compteur, lui, est calculé sur `dateRange`) | ⚠️ Chiffre non reconstitué |
| Factures Payées | `AccountingDashboard.jsx:287` | `/facturation/factures?status=paye` | ✅ | ✅ `selectedStatus === 'paye'` filtre bien `statut === 'paye'` | ✅ OK (hors période, cf. ci-dessus) |
| En Attente | `AccountingDashboard.jsx:288` | `/facturation/factures?status=en_attente` | ✅ | ✅ | ✅ OK |
| Impayées | `AccountingDashboard.jsx:289` | `/facturation/factures?status=impaye` | ✅ | ✅ | ✅ OK |
| Répartition des statuts (4 boutons : Payées/Partielles/En attente/Impayées) | `AccountingDashboard.jsx:322-336` | `/facturation/factures?status=${s.key}` | ✅ | ✅ mapping direct `key` → `selectedStatus` | ✅ OK |
| Priorité relances — "0-7j" | `AccountingDashboard.jsx:345-360` | `/facturation/factures?status=outstanding` | ✅ | ❌ Aucun paramètre d'ancienneté transmis ; `FacturationFactures.jsx` n'a pas de filtre "jours de retard" | ❌ Redirection identique pour les 3 tranches |
| Priorité relances — "8-30j" | idem | idem | ✅ | ❌ idem | ❌ idem |
| Priorité relances — "31j+" | idem | idem | ✅ | ❌ idem | ❌ **Cas le plus grave** : l'urgence n'est pas différenciée |
| Total facturé | `AccountingDashboard.jsx:391` | `/comptabilite/recherche-rapports` | ✅ (`App.jsx:492`) | ❌ `RechercheRapports.jsx` ne lit aucun query param (`dateDebut`/`dateFin` vides à l'arrivée) | ❌ Redirige vers le bon module, pas vers le bon chiffre |
| Encaissements | `AccountingDashboard.jsx:392` | `/facturation/factures?status=paye` | ✅ | ⚠️ "Encaissements" = somme `montant_paye` ; la cible liste les factures au statut `paye`, pas les paiements eux-mêmes (une facture "partiel" a aussi un encaissement partiel non représenté) | ⚠️ Approximatif |
| Reste à encaisser | `AccountingDashboard.jsx:393` | `/facturation/factures?status=outstanding` | ✅ | ✅ `isOutstanding()` couvre bien `en_attente`/`partiel`/`impaye` (`FacturationFactures.jsx:329-330`) | ✅ OK (hors période) |
| Taux de recouvrement | `AccountingDashboard.jsx:394` | `/comptabilite/recherche-rapports` | ✅ | ❌ Même problème que "Total facturé" : la page affiche bien un "Taux de recouvrement" (`RechercheRapports.jsx:206`) mais recalculé sur ses propres filtres vides, pas sur la période cliquée | ❌ |
| Top restes à encaisser — "Voir tout" | `AccountingDashboard.jsx:404` | `/comptabilite/impayes` | ✅ | ✅ page dédiée aux impayés/relances | ✅ OK |
| Top restes à encaisser — ligne patient (dynamique, ×N) | `AccountingDashboard.jsx:422` | `/facturation/factures?status=outstanding&q=<nom>` | ✅ | ✅ `q` est bien lu comme terme de recherche (`FacturationFactures.jsx:68,74`) | ✅ OK |
| Factures récentes — action "Voir" (dynamique, ×N) | `AccountingDashboard.jsx:571-583` | `/facturation/factures?status=<statut>&q=<nom>` | ✅ | ✅ | ✅ OK |

---

## 3. KPI filtrants locaux (pas de redirection — `ClickableStatCard`)

Ces cartes sont cliquables mais ne changent pas de page : elles appliquent un filtre sur la liste affichée dans le même composant. La notion de "redirection" ne s'applique donc pas ; elles sont listées pour le décompte total.

| Page/Composant | Nombre de KPI | Comportement |
|---|---|---|
| `src/components/secretary/DoctorSpecificQueue.jsx:425-459` | 4 (Patients actifs, En salle, En consultation, Rendez-vous) | `onClick={() => handleStatCardClick(...)}` → filtre `statFilter` local |
| `src/components/secretary/GlobalWaitingQueue.jsx` | 4 | Même pattern `ClickableStatCard` |
| `src/pages/IntroductionPatientPage.jsx` | 4 | Même pattern `ClickableStatCard` |

---

## 4. KPI informationnels (non cliquables)

| Page | Nombre de KPI | Détail |
|---|---|---|
| `src/pages/Dashboard.jsx:207-290` | 5 | Total Patients, En Attente, Consultations, Revenus (FCFA), Utilisateurs |
| `src/pages/comptabilite/ImpayesRelances.jsx:440-501` | 6 | Onglet Patients : Patients concernés / Situations critiques / Montant total dû ; Onglet Assurance : Assureurs concernés / Factures en attente / Montant total dû |
| `src/pages/secretary/Caisse.jsx:1811-1832` | 4 | Fond de caisse, Total journée, Solde actuel, Ce mois |

---

## 5. Anomalies priorisées

1. **`AccountingDashboard.jsx:345-360`** — Les 3 tranches d'ancienneté "Priorité relances" redirigent vers la même URL sans paramètre d'ancienneté : le tri par urgence affiché au dashboard est perdu au clic. → Ajouter un paramètre (ex. `?status=outstanding&minDays=31`) et le lire dans `FacturationFactures.jsx`, ou a minima ouvrir un tri par ancienneté côté page cible.
2. **`AccountingDashboard.jsx:391,394`** — "Total facturé" et "Taux de recouvrement" redirigent vers `/comptabilite/recherche-rapports` qui démarre sans filtre de date (`dateDebut`/`dateFin` vides, `RechercheRapports.jsx` ne lit pas `location.search`). → Soit propager `startDate`/`now` en query string et les lire côté `RechercheRapports.jsx`, soit changer la cible vers une vue qui affiche déjà le total/le taux pour la période choisie.
3. **Toutes les cartes de `AccountingDashboard.jsx`** — Le `dateRange` (semaine/mois/trimestre/année) sélectionné n'est jamais transmis à `/facturation/factures`, et même le cas par défaut ("mois") diverge : dashboard = 30 jours glissants (`AccountingDashboard.jsx:71-74`), page factures = mois calendaire depuis le 1er (`FacturationFactures.jsx:348-350`). → Harmoniser la définition de "mois" entre les deux pages et propager le `dateRange` via query string.
4. **`AccountingDashboard.jsx:392`** — "Encaissements" redirige vers les factures au statut `paye`, mais des paiements partiels (statut `partiel`) contribuent aussi à `kpis.collected` sans apparaître dans cette liste. → Documenter la limite ou pointer vers une vue "paiements" plutôt que "factures".

---

## 6. Pages sans KPI redirigeant identifié

Recherche effectuée sur l'ensemble de `src/` (patterns `navigate(` combinés à une carte valeur+icône) : aucun autre tableau de bord (`Dashboard.jsx`, `SecretaryDashboard.jsx`, `DoctorDashboard_Fixed.jsx`, `Consultations.jsx`, `ConsultationCompletion.jsx`, `AssuranceCreanceDetail.jsx`, `StatisticsPage.jsx`, `Caisse.jsx`) ne fait naviguer un KPI chiffré vers une autre page — leurs `navigate(...)` servent uniquement à des boutons d'action (créer un RDV, ouvrir un formulaire, retour arrière), pas à des indicateurs.
