# Audit — Cartes KPI natives restant à migrer vers KpiCard

> Suite de `AUDIT_KPI_REDIRECTIONS.md`. Ce rapport ne revérifie pas les redirections : il recense, sur l'ensemble du code, quelles cartes KPI utilisent déjà `src/components/common/KpiCard.jsx` (ou l'ancien `ClickableStatCard.jsx`) et lesquelles sont encore écrites en JSX brut ("**natives**") — donc candidates à la migration.
>
> Méthode : 3 agents d'exploration lancés en parallèle, un par tiers du code (`finance`, `clinique/RDV`, `composants partagés`), lecture seule. Aucune modification de fichier dans cet audit.

---

## 1. Résumé exécutif

**≈153 cartes KPI natives** recensées sur l'ensemble de l'app, réparties sur une quarantaine de fichiers, contre seulement **3 fichiers déjà componentisés** (`AccountingDashboard.jsx`, `Dashboard.jsx`, `ImpayesRelances.jsx`, `Caisse.jsx` — celui-ci partiellement —, `GlobalWaitingQueue.jsx`, `DoctorSpecificQueue.jsx`).

| Périmètre | Cartes natives | Fichiers concernés |
|---|---|---|
| Finance (comptabilité/facturation/caissier) | **61** | 16 fichiers |
| Clinique / RDV / administration | **74** | 19 fichiers |
| Composants partagés (dashboards médecin, calendrier) | **~18** en prod + 3 composants "ad-hoc" dupliqués | 5 fichiers + 3 mini-libs |

**Constat principal** : la quasi-totalité des cartes natives suit *déjà* exactement le pattern que `KpiCard` encapsule (`div/button` blanc, icône Lucide dans un rond coloré, `p.text-sm` libellé + `p.text-2xl.font-bold` valeur) — la migration est mécanique pour la grande majorité des cas, pas une réécriture.

**Trois "mini-composants" ad-hoc dupliquent déjà l'idée de KpiCard** sans le savoir : `src/components/calendar/StatsCards.jsx` (utilisé en prod par `NewCalendar.jsx`), `src/components/common/StatsCard.jsx` et `src/components/archives/ArchiveStatsCard.jsx` — ce sont des candidats à *fusionner dans* `KpiCard` plutôt qu'à migrer carte par carte.

**Code mort suspecté** : `src/components/EnhancedCalendar.jsx` référence une variable `stats` non définie dans le fichier et ne semble importé nulle part — à vérifier avant toute migration (probablement supprimable).

---

## 2. Périmètre Finance (comptabilité / facturation / caissier)

**61 cartes natives**, aucune cliquable (affichage pur) :

| Fichier | Cartes natives | Détail |
|---|---|---|
| `pages/comptabilite/SuiviCaissiers.jsx` | 5 | Total encaissé, Paiements, Ticket moyen, Caissiers actifs, Période |
| `pages/comptabilite/RechercheRapports.jsx` | 5 | Factures trouvées, Total facturé, Encaissé, Reste à encaisser, Taux de recouvrement |
| `pages/comptabilite/EncaissementFactures.jsx` | 5 | Total factures, CA, Encaissé, Reste à encaisser, Factures payées |
| `pages/comptabilite/AssuranceCreanceDetail.jsx` | 1 | "Reste dû" (indicateur d'en-tête hors grille) |
| `pages/caissier/ArreteMensuel.jsx` | 3 | Total fonds de caisse, Total encaissements, Total soldes fin de jour (sans icône) |
| `pages/facturation/Actes.jsx` | 3 | Total Actes, Montant Total, Consultations |
| `pages/facturation/Divers.jsx` | 4 | Par statut (En attente/En cours/Terminée/Annulée), sans icône |
| `pages/facturation/Examens.jsx` | 5 | Total, Prescrits, En Cours, Terminés, Urgents |
| `pages/facturation/Pharmacie.jsx` | 6 | Total, Prescrites, En attente, Dispensées, Annulées, Urgentes (sans icône) |
| `pages/facturation/Labo.jsx` | 7 | Total, Prescrites, Prélevées, En cours, Terminées, Annulées, Urgentes (sans icône) |
| `pages/facturation/FacturationFactures.jsx` | 8 | 4 KPI principaux + 4 "répartition par type" sans icône |
| `pages/facturation/FacturationActes.jsx` | 4 | Total factures, Payées, En attente, CA |
| `pages/facturation/FacturationExamens.jsx` | 5 | Total, Réalisés, Programmés, En cours, CA |
| `pages/facturation/FacturationLabo.jsx` | 4 | Total analyses, Terminées, En cours, CA |
| `pages/facturation/FacturationPharmacie.jsx` | 5 | Total ventes, Délivrées, En préparation, En attente, CA |
| `pages/secretary/Caisse.jsx` | 3 + 2 | Widget "Fermeture de caisse" (Total factures jour, Part patient, Part couverture) + 2 valeurs isolées dans des modales (montant à payer, fond d'ouverture) |

*(`Caisse.jsx` et `ImpayesRelances.jsx` utilisent déjà `KpiCard` ailleurs dans le même fichier — bons gabarits de référence pour migrer le reste.)*

---

## 3. Périmètre Clinique / RDV / Administration

**74 cartes natives** (aucune cliquable), + confirmation que `Dashboard.jsx` et `AccountingDashboard.jsx` sont bien entièrement migrés, et qu'`IntroductionPatientPage.jsx` reste sur `ClickableStatCard` (cf. `AUDIT_KPI_REDIRECTIONS.md`, choix déjà justifié) :

| Fichier | Cartes natives | Détail |
|---|---|---|
| `pages/consultation/Consultations.jsx` | 5 | Total, En consultation, Terminées, Urgentes, Durée moy. |
| `pages/rendez-vous/NotificationsRealtime.jsx` | 4 | Total, Non lues, Urgentes, Aujourd'hui |
| `pages/rendez-vous/RappelsSMS.jsx` | 4 | En attente, Envoyés, Délivrés, Erreurs (sans icône) |
| `pages/rendez-vous/RappelsSmsPage.jsx` | 4 | Total rappels, Envoyés aujourd'hui, Programmés, Taux de réussite |
| `pages/rendez-vous/ScanDocuments.jsx` | 5 | Total, En attente, Validés, Rejetés, Aujourd'hui |
| `pages/rendez-vous/StatistiquesRealtime.jsx` | 4 | Total Patients, Consultations, Temps d'attente moyen, Taux d'occupation |
| `pages/reporting/Reporting.jsx` | ~4 (dynamique) | Grille générée depuis `resumeGlobal[]`, sans icône |
| `pages/administration/GestionAdmins.jsx` | 3 | Total, Actifs, Inactifs (`.card card-medical/-success/-warning`) |
| `pages/administration/GestionCaissiers.jsx` | 3 | Total, Actifs, Inactifs |
| `pages/administration/GestionComptables.jsx` | 3 | Total, Actifs, Inactifs |
| `pages/administration/GestionMedecins.jsx` | 3 | Total, Actifs, Inactifs |
| `pages/administration/GestionSecretaires.jsx` | 3 | Total, Actifs, Inactifs |
| `pages/administration/GestionUtilisateurs.jsx` | 8 | Total, Admins, Médecins, Secrétaires, Comptables, Caissiers, Actifs, Inactifs |
| `pages/administration/PersonnalisationApparence.jsx` | 2 | Widget de prévisualisation de thème (valeurs factices — faible priorité) |
| `pages/Patients.jsx` | 4 | Total Patients, Patients Actifs, Nouveaux ce mois, Consultations — **le fichier ayant inspiré KpiCard, jamais migré** |
| `pages/MyWaitingQueuePage.jsx` | 4 | En attente, Appelés, En consultation, Notifications |
| `pages/WaitingQueuePage.jsx` | 4 | Total attente, En consultation, Temps moyen, Urgences |
| `pages/BcdsPage.jsx` | 4 | Total BCDS, Spécialités, Validées, Consultations |
| `pages/StatisticsPage.jsx` | 14 | Composant local `StatCard` dupliquant KpiCard (10 usages) + 4 "métriques détaillées" sans icône |

`pages/parametrage/**`, `pages/doctor/**` (hors dashboards) et `pages/patients/**` ne contiennent aucune carte KPI.

---

## 4. Périmètre Composants partagés

**Déjà componentisés** : `secretary/GlobalWaitingQueue.jsx`, `secretary/DoctorSpecificQueue.jsx` (4 `KpiCard` chacun).

**Natives (18 en production)** :

| Fichier | Cartes natives | Détail |
|---|---|---|
| `components/doctor/DoctorDashboard.jsx` | 4 | En attente, En consultation, Nouveaux, Terminées |
| `components/doctor/DoctorDashboard_Clean.jsx` | 4 | Mêmes 4, mêmes couleurs — quasi-doublon du précédent |
| `components/doctor/DoctorDashboard_Fixed.jsx` | 4 | Mêmes 4 (fichier activement modifié en parallèle) |
| `components/doctor/DoctorDashboard_AntiSpam.jsx` | 4 | En attente, En consultation, Urgences, Notifications (style `border-l-4`) |
| `components/CustomCalendar.jsx` | 2 | Total RDV, Aujourd'hui — utilisé en prod via `SecretaryDashboard.jsx` |

**Composants ad-hoc à unifier avec KpiCard plutôt qu'à migrer un par un** :
- `components/calendar/StatsCards.jsx` — utilisé en prod par `NewCalendar.jsx`, cliquable via callback.
- `components/common/StatsCard.jsx` — aucun usage détecté actuellement.
- `components/archives/ArchiveStatsCard.jsx` — utilisé par `HistoriquesArchivesPage.jsx`.

**À vérifier avant migration** :
- `components/EnhancedCalendar.jsx` (4 cartes) — référence une variable `stats` non définie, aucun import trouvé ailleurs : probable code mort.
- `components/examples/ResponsiveComponentsExamples.jsx` — composant de démo (`StatisticCard`), non utilisé en dehors de son propre fichier.

---

## 5. Priorisation suggérée pour la migration

1. **Famille `Gestion*.jsx`** (Admins/Caissiers/Comptables/Medecins/Secretaires/Utilisateurs, 23 cartes) — structure identique (Total/Actifs/Inactifs), tons déjà alignés sur `KPI_TONES` (`medical`/`success`/`warning`/`danger`) : migration en série la plus rapide et la plus sûre.
2. **Famille `Facturation*.jsx` + `Actes/Examens/Labo/Pharmacie/Divers.jsx`** (46 cartes) — même pattern mécanique répété 10 fois ; prévoir d'ajouter une icône aux fichiers qui n'en ont pas (Pharmacie, Labo, Divers, ArreteMensuel).
3. **Dashboards médecin** (`DoctorDashboard.jsx`, `_Clean`, `_Fixed`, `_AntiSpam`, 16 cartes) — clarifier d'abord lequel de `DoctorDashboard.jsx`/`_Clean`/`_Fixed` est réellement monté (déjà signalé comme redondant dans `AUDIT_APPELS_DIRECTS_DB.md`) avant de migrer les 3 en parallèle.
4. **`pages/Patients.jsx`** — symbolique : c'est la page modèle de `KpiCard`, jamais migrée elle-même.
5. **`StatisticsPage.jsx`** — supprimer son composant local `StatCard` au profit de `KpiCard` (14 cartes d'un coup).
6. **Composants ad-hoc** (`StatsCards.jsx`, `StatsCard.jsx`, `ArchiveStatsCard.jsx`) — à traiter à part : décider s'ils fusionnent dans `KpiCard` (avec extension éventuelle pour la variante "tendance" de `StatsCards.jsx`) plutôt que migrer leurs appelants un par un.
7. **Nettoyage préalable** : confirmer que `EnhancedCalendar.jsx` est du code mort avant d'y toucher.
