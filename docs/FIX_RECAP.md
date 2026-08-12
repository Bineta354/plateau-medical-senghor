# Anomalies à corriger — Récapitulatif caissier

## Re-analyse du 2026-08-08 (après redesign visuel de la page)

La page a reçu une refonte visuelle/UX (cartes arrondies, thème `medical-primary`, filtre période avec pastille réinitialisable, section « Facturation » à onglets **Par couverture / Liste des factures**, et surtout une vraie pagination (`Pagination`, 10/page) qui remplace l'ancien plafond silencieux à 200 lignes). Les blocs « Filtre par Patient » et « Filtre par Couverture », auparavant dupliqués, sont fusionnés en une seule carte « Facture — {filtre} ».

- **Bug trouvé et corrigé** : les 3 cartes KPI (Total TTC / Total payé / Total restant) et l'encart couverture patient affichaient `{formatMontant(...)} F CFA` — mais `formatMontant()` ajoute déjà `FCFA` ([currency.js:16](../src/utils/currency.js#L16)), d'où un doublon visible « 831 900 FCFA F CFA » à l'écran. Corrigé en retirant le suffixe redondant (4 endroits).
- **Points 1, 2 et 3 ci-dessous : toujours présents, inchangés.** Le redesign n'a touché que l'habillage et la pagination, pas le calcul des données — `resumeCouverture` exclut toujours les restes négatifs alors que `facturesParCouverture` les compense (point 1), `statut_paiement` n'est toujours pas recalculé (point 2), `excludeCouverture: true` exclut toujours les factures `-C` (point 3).
- **Changement de comportement mineur (pas un bug)** : `facturesParCouverture` n'est plus masqué quand `filterCouverture` est actif — avant, filtrer par une couverture cachait entièrement la carte « Facture par couverture » ; maintenant l'onglet « Par couverture » reste visible et affiche une ligne unique (redondante avec le panneau « Reste à payer par couverture » au-dessus dans ce cas précis).
- Le point 4 (export CSV) reste valide tel quel avec la nouvelle UI — les boutons CSV ont été replacés dans les nouveaux en-têtes de carte sans changement de logique.

Page concernée : `#/caissier/recapitulatif` → [src/pages/caissier/Recapitulatif.jsx](../src/pages/caissier/Recapitulatif.jsx)

Constatées le 2026-08-08 sur données réelles (17 factures, dev). Aucun correctif appliqué — document de suivi.

## 1. Incohérence des totaux « reste dû » par couverture

Deux widgets affichent un montant différent pour la même compagnie d'assurance quand une facture est en trop-perçu (paiement > montant TTC, `montant_restant` négatif) :

- « Reste à payer par couverture » (haut de page) — [Recapitulatif.jsx:112-133](../src/pages/caissier/Recapitulatif.jsx#L112-L133) — **exclut** toute facture dont le reste est ≤ 0 (`if (restant <= 0) return;`, ligne 116).
- « Facture par couverture » (`facturesParCouverture`, bas de page) — [Recapitulatif.jsx:206-220](../src/pages/caissier/Recapitulatif.jsx#L206-L220) — **additionne tout**, trop-perçus compris (les compense).

Écart observé sur les données du 2026-08-08 :

| Couverture | Widget du haut | Widget du bas | Écart |
|---|---|---|---|
| AXA Santé | 113 600 FCFA | 61 363 FCFA | 52 237 FCFA |
| Harmonie Mutuelle | 10 800 FCFA | 4 500 FCFA | 6 300 FCFA |

**À faire** : harmoniser les deux calculs sur la même règle (probablement : compenser, et faire apparaître le trop-perçu comme une ligne explicite plutôt que de le faire disparaître silencieusement).

## 2. Badge « Statut » non fiable

`getStatusLabel` ([src/utils/factureStatus.js:29](../src/utils/factureStatus.js#L29)) affiche `statut_paiement` tel que stocké en base, sans le recalculer via `computeStatutPaiement` (existe dans le même fichier, [factureStatus.js:39-45](../src/utils/factureStatus.js#L39-L45), mais n'est appelée nulle part dans `Recapitulatif.jsx`).

Sur les 17 factures observées, **toutes** affichent le badge vert « Payée », y compris des factures manifestement partielles (ex. `FAC-1785721057622` : TTC 106 000 / payé 84 800 / reste 21 200) et les deux factures en trop-perçu.

**À faire** : soit fiabiliser l'écriture de `statut_paiement` en base au moment du paiement, soit recalculer l'affichage du badge côté client via `computeStatutPaiement(montant_paye, montant_ttc)` plutôt que de faire confiance à la colonne stockée.

## 3. Tableaux « par patient » / « par couverture » redondants — part assurance manquante

`listFactures` est appelé avec `excludeCouverture: true` ([Recapitulatif.jsx:88](../src/pages/caissier/Recapitulatif.jsx#L88) → `paiementService.js:218`, `is('facture_parent_id', null)`), ce qui exclut les factures enfants `type='couverture'` (les `-C` du modèle documenté dans `CLAUDE.md`) — c'est-à-dire exactement les factures qui portent la part que l'assurance doit payer.

Conséquence : le tableau « par couverture » ne calcule pas ce que l'assurance doit réellement — il reprend le reste dû du **patient** (facture parent) et le réétiquette avec le nom de son assureur ([Recapitulatif.jsx:118](../src/pages/caissier/Recapitulatif.jsx#L118), `effectiveCouverture`). Quand chaque patient n'a qu'un seul assureur sur la période, « par patient » et « par couverture » affichent donc mécaniquement les mêmes totaux, juste réagrégés sous une autre clé (constaté avec Anna Diao/Harmonie Mutuelle = 10 800 FCFA, SALIMATA AGNE/AXA Santé = 113 600 FCFA, Aminata Cabral/Crédit Agricole = 39 130 FCFA).

**À faire** :
- Ne plus exclure les factures `type='couverture'` (retirer `excludeCouverture: true` ou faire un second appel `type: 'couverture'`).
- Tableau « par patient » : ajouter une colonne « Part assurance restant due » = somme des `montant_restant` des factures `-C` liées à ce patient (source autoritaire du split, pas une estimation via `taux_remboursement`).
- Tableau « par couverture » : le recalculer à partir de ces mêmes factures `-C` (regroupées par `assurance_id`) plutôt que depuis les factures patient — il deviendrait un vrai « ce que chaque assureur doit encore », complémentaire du tableau patient au lieu d'un doublon.

## 4. Export CSV par tableau — ✅ fait, et généralisé à toute l'app

Implémenté le 2026-08-08 :
- [ExportUtils.exportToCSV](../src/utils/ExportUtils.js) accepte maintenant un paramètre `columns` (`{key, label}`), ajoute un BOM UTF-8, et sépare les colonnes par `;` (pas `,` — cohérent avec Excel en locale fr-FR).
- 4 boutons CSV ajoutés sur `Recapitulatif.jsx` (par patient, par couverture, facture par couverture, table détaillée complète — pas seulement les 200 lignes affichées).
- Les 3 autres implémentations dupliquées du repo ont été remplacées par `ExportUtils.exportToCSV` : [Caisse.jsx](../src/pages/secretary/Caisse.jsx) (3 exports : état caisse jour, historique patient, historique couverture), [RechercheRapports.jsx](../src/pages/comptabilite/RechercheRapports.jsx), [SuiviCaissiers.jsx](../src/pages/comptabilite/SuiviCaissiers.jsx). `ExportUtils` est désormais la seule source d'export CSV de l'app.
- Testé en direct dans le navigateur sur les 4 pages : BOM présent dans les octets, séparateur `;`, montants en valeur numérique brute, aucune erreur console.

<details><summary>Ancien texte de la proposition</summary>



Aucun export n'existe sur cette page. Utile au moins pour la table détaillée des factures (plafonnée à 200 lignes affichées, [Recapitulatif.jsx:513](../src/pages/caissier/Recapitulatif.jsx#L513)) et pour les 3 tableaux de synthèse (par patient, par couverture, par couverture détaillé).

État de l'existant dans le repo :
- [src/utils/ExportUtils.js](../src/utils/ExportUtils.js) — `exportToCSV(data, filename)` générique, mais **inutilisé nulle part**.
- [src/pages/comptabilite/SuiviCaissiers.jsx:178-195](../src/pages/comptabilite/SuiviCaissiers.jsx#L178-L195) — une 2ᵉ implémentation inline avec en-têtes français personnalisés, dupliquée au lieu de réutiliser `ExportUtils`.

**À faire** :
- Étendre `ExportUtils.exportToCSV` pour accepter des en-têtes personnalisés (au lieu de `Object.keys(data[0])` brut) — reprendre le pattern de `SuiviCaissiers.jsx` sans le dupliquer une 3ᵉ fois.
- Exporter les montants en valeur numérique brute (pas `formatMontant()` avec suffixe « FCFA », qu'Excel lirait comme du texte).
- Ajouter un BOM UTF-8 au blob généré (absent dans les deux implémentations actuelles) pour que les accents s'affichent correctement à l'ouverture dans Excel.
- Boutons « Exporter CSV » sur : Reste à payer par patient, Reste à payer par couverture, Facture par couverture, table détaillée des factures.

</details>

## Hors périmètre — récap par médecin

Discuté et jugé non pertinent d'ajouter sur cette page : « Chiffre d'Affaires par Médecin » et « Consultations par Médecin » existent déjà dans [src/pages/reporting/Reporting.jsx:407-587](../src/pages/reporting/Reporting.jsx#L407-L587) (vue `statistiques_finances_medecins`). Le filtre médecin de `Recapitulatif.jsx` sert un usage différent (isoler les factures d'un médecin pour éditer une facture ciblée), pas à produire un récap agrégé — un « reste à payer par médecin » n'aurait de toute façon pas de sens sémantique ici (le médecin ne doit rien au cabinet).
