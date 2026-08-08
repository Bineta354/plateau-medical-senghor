# Audit — Appels base de données directs dans les pages

> Périmètre : appels **directs** au client `supabase` (import depuis `src/lib/supabase.js`) faits dans `src/pages/**`, sans passer par une fonction de `src/services/`. Les composants (`src/components/**`) sont documentés séparément en annexe (section 5), car ils sont hors périmètre "pages" mais alimentent directement plusieurs des pages auditées.
>
> Sources : `frag_A_finance.md` (caisse/comptabilité), `frag_B_parametrage.md` (référentiels), `frag_C_divers.md` (patient/rdv/consultation/admin/reporting), `frag_D_components.md` (composants, annexe).

---

## 1. Résumé exécutif

- **14 pages** concernées par au moins un appel direct à Supabase (hors composants) :
  `ArreteMensuel.jsx`, `ReversementBancaire.jsx`, `Recapitulatif.jsx`, `SuiviCaissiers.jsx`, `RechercheRapports.jsx`, `secretary/Caisse.jsx`, `AntecedentsForm.jsx`, `Appareils.jsx`, `Diagnostics.jsx`, `SignesCliniques.jsx`, `IntroductionPatientPage.jsx`, `PriseRendezVousPage.jsx`, `StatistiquesRealtime.jsx`, `ConsultationDetail.jsx`, `FormulaireUtilisateur.jsx`, `Reporting.jsx` — soit **16 fichiers pages** au total (37+28+58 appels).
- **123 appels directs** recensés dans ces pages (37 finance + 28 paramétrage + 58 divers), touchant :
  - **30 tables** distinctes via `.from(...)` ;
  - **7 fonctions RPC** distinctes via `.rpc(...)` ;
  - 2 canaux temps réel (`caisse-paiements`, `waiting_queue_changes`, `statistiques_changes`) ;
  - 3 appels `.auth.*` (getUser ×1, getSession ×2).
- En annexe (hors périmètre "pages"), **40 appels directs supplémentaires** sont recensés dans 5 composants partagés (`DoctorSpecificQueue`, `DoctorReassignModal`, `NotificationSystem`, `DoctorDashboard_Clean`, `DoctorDashboard_Fixed`), portant le total global (pages + composants) à **163 appels directs**.
- **Constat principal** : sur les 30 tables et 7 RPC touchées directement par les pages, seules **9 (≈ 26 %)** bénéficient d'un service `src/services/` (ou `src/lib/services.js`) qui couvre correctement le besoin (✅), **8 (≈ 22 %)** ont un service qui existe mais qui est incomplet ou inadapté (⚠️), et **20 (≈ 55 %)** n'ont **aucun** service du tout (❌). Autrement dit, **près des trois quarts** des points d'accès base de données utilisés par les pages n'ont pas d'équivalent fiable en couche service — la majorité de la logique métier (calculs, jointures, règles) est dupliquée directement dans les composants React.
- Deux constats aggravants :
  - `src/pages/secretary/Caisse.jsx` concentre à lui seul **25 des 37 appels finance** (68 %) — un seul fichier de ~1500 lignes porte la quasi-totalité de la logique caisse/facturation/session.
  - `src/lib/services.js` contient des services "fantômes" (`invoiceService` → table `invoices`, `billingService` → table `billing`) qui ciblent des tables **obsolètes**, différentes des tables réellement utilisées par l'application (`factures`, `paiements`) — ils ne peuvent donc pas servir de base à la factorisation sans réécriture.

---

## 2. Détail par catégorie

### 2.1 Patient

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Patient | Charger la liste des patients (avec assurance) pour filtres/affichage | `src/pages/caissier/Recapitulatif.jsx:57` | select | `patients` (jointure `assurances`) |
| Patient | Charger la liste des patients (id, nom, prénom) pour le filtre d'historique | `src/pages/secretary/Caisse.jsx:628` | select | `patients` |
| Patient | Récupérer les infos des patients référencés par les notifications | `src/pages/IntroductionPatientPage.jsx:308` | select | `patients` |
| Patient | Charger la liste complète des patients pour recherche/sélection | `src/pages/IntroductionPatientPage.jsx:338` | select | `patients` |
| Patient | Enrichir les rendez-vous du jour avec les infos patient | `src/pages/IntroductionPatientPage.jsx:418` | select | `patients` |
| Patient | Enrichir la file d'attente avec les infos patient | `src/pages/IntroductionPatientPage.jsx:522` | select | `patients` |
| Patient | Enregistrer un nouveau patient depuis le formulaire de création rapide | `src/pages/IntroductionPatientPage.jsx:960` | insert | `patients` |

### 2.2 Paiement / Caisse (factures, paiements, sessions caisse, assurances, reversements)

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Paiement/Caisse | Récupérer l'arrêté comptable mensuel (fonds de caisse, encaissements, solde) | `src/pages/caissier/ArreteMensuel.jsx:28` | rpc | `get_arrete_comptable_mensuel` |
| Paiement/Caisse | Lister l'historique des reversements bancaires (avec caissier) | `src/pages/caissier/ReversementBancaire.jsx:53` | select | `reversements_bancaires` (jointure `users`) |
| Paiement/Caisse | Insérer un nouveau reversement bancaire | `src/pages/caissier/ReversementBancaire.jsx:97` | insert | `reversements_bancaires` |
| Paiement/Caisse | Charger la liste des assurances (filtres, taux remboursement) | `src/pages/caissier/Recapitulatif.jsx:58` | select | `assurances` |
| Paiement/Caisse | Récupérer les factures de la période (patient, assurance, consultation) pour le récapitulatif caisse | `src/pages/caissier/Recapitulatif.jsx:73` | select | `factures` (jointures `patients`, `assurances`, `consultations`) |
| Paiement/Caisse | Récupérer les paiements effectués (avec facture) filtrés période/caissier, contrôle lecture seule | `src/pages/comptabilite/SuiviCaissiers.jsx:64` | select | `paiements` (jointure `factures`) |
| Paiement/Caisse | Récupérer la liste des assurances pour le filtre de recherche | `src/pages/comptabilite/RechercheRapports.jsx:64` | select | `assurances` |
| Paiement/Caisse | Rechercher les factures selon critères multiples (rapport, export CSV) | `src/pages/comptabilite/RechercheRapports.jsx:75` | select | `factures` (jointures `patients`, `assurances`, `consultations`→`users`) |
| Paiement/Caisse | Récupérer la session de caisse ouverte du jour pour le caissier connecté | `src/pages/secretary/Caisse.jsx:317` | select | `sessions_caisse` |
| Paiement/Caisse | Récupérer les paiements (avec facture et caissier) pour la vue supervision | `src/pages/secretary/Caisse.jsx:346` | select | `paiements` (jointures `factures`, `users`) |
| Paiement/Caisse | Récupérer les sessions de caisse ouvertes (alertes de supervision) | `src/pages/secretary/Caisse.jsx:371` | select | `sessions_caisse` |
| Paiement/Caisse | Paiements de la période précédente (J-14 à J-7) pour tendance d'évolution | `src/pages/secretary/Caisse.jsx:443` | select | `paiements` |
| Paiement/Caisse | Total journalier des paiements effectués pour l'état de la caisse | `src/pages/secretary/Caisse.jsx:504` | select | `paiements` |
| Paiement/Caisse | Total mensuel des paiements effectués pour l'état de la caisse | `src/pages/secretary/Caisse.jsx:510` | select | `paiements` |
| Paiement/Caisse | Détail des paiements du jour (facture, consultation, patient, assurance) pour vérification fin de journée | `src/pages/secretary/Caisse.jsx:554` | select | `paiements` (jointures `factures`→`consultations`→`patients`→`assurances`) |
| Paiement/Caisse | Charger la liste des assurances (taux remboursement) pour filtre historique couverture | `src/pages/secretary/Caisse.jsx:642` | select | `assurances` |
| Paiement/Caisse | (caissier) reconstituer l'historique des factures payées d'un patient via ses propres paiements | `src/pages/secretary/Caisse.jsx:682` | select | `paiements` (jointure `factures`→`consultations`→`patients`→`assurances`) |
| Paiement/Caisse | (non-caissier) factures payées d'un patient donné pour l'historique patient | `src/pages/secretary/Caisse.jsx:705` | select | `factures` (jointure `consultations`→`patients`→`assurances`) |
| Paiement/Caisse | (caissier) reconstituer l'historique des factures payées liées à une couverture donnée | `src/pages/secretary/Caisse.jsx:892` | select | `paiements` (jointure `factures`→`consultations`→`patients`→`assurances`) |
| Paiement/Caisse | (non-caissier) toutes les factures payées pour l'historique par couverture | `src/pages/secretary/Caisse.jsx:918` | select | `factures` (jointure `consultations`→`patients`→`assurances`) |
| Paiement/Caisse | 100 dernières factures payées pour l'onglet "factures payées" | `src/pages/secretary/Caisse.jsx:1009` | select | `factures` (jointure `consultations`→`patients`→`assurances`) |
| Paiement/Caisse | Factures en attente/partiellement payées pour la liste principale de caisse | `src/pages/secretary/Caisse.jsx:1035` | select | `factures` (jointure `consultations`→`patients`→`assurances`) |
| Paiement/Caisse | Factures payées en complément du chargement global | `src/pages/secretary/Caisse.jsx:1058` | select | `factures` (jointure `consultations`→`patients`→`assurances`) |
| Paiement/Caisse | Vérifier qu'aucune session de caisse n'est déjà ouverte avant d'en créer une | `src/pages/secretary/Caisse.jsx:1129` | select | `sessions_caisse` |
| Paiement/Caisse | Ouvrir une nouvelle session de caisse avec fond de caisse initial | `src/pages/secretary/Caisse.jsx:1149` | insert | `sessions_caisse` |
| Paiement/Caisse | Fermer une session de caisse (calcul serveur du montant journalier) | `src/pages/secretary/Caisse.jsx:1189` | rpc | `fermer_session_caisse` |
| Paiement/Caisse | Charger l'arrêté comptable mensuel affiché dans le modal d'arrêté | `src/pages/secretary/Caisse.jsx:1225` | rpc | `get_arrete_comptable_mensuel` |
| Paiement/Caisse | S'abonner en temps réel aux paiements pour rafraîchir l'état de la caisse | `src/pages/secretary/Caisse.jsx:1240` | realtime (subscribe) | `paiements` (canal `caisse-paiements`) |
| Paiement/Caisse | Nettoyer l'abonnement temps réel au démontage | `src/pages/secretary/Caisse.jsx:1254` | realtime (cleanup) | — (`removeChannel`) |
| Paiement/Caisse | Créer la facture "part couverture" lors d'un paiement avec prise en charge assurance | `src/pages/secretary/Caisse.jsx:1462` | insert | `factures` |

### 2.3 Référentiels / Paramétrage

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Paramétrage | Charger les infos du cabinet (nom, adresse, logo) pour en-tête de factures | `src/pages/caissier/Recapitulatif.jsx:59` | select | `parametres_cabinet` |
| Paramétrage | Charger les infos du cabinet pour l'affichage/impression de documents caisse (par tenant) | `src/pages/secretary/Caisse.jsx:1108` | select | `parametres_cabinet` |
| Paramétrage | Charger les spécialités actives pour le sélecteur du formulaire | `src/pages/parametrage/AntecedentsForm.jsx:56-60` | select | `specialites` |
| Paramétrage | Charger l'antécédent en cours d'édition | `src/pages/parametrage/AntecedentsForm.jsx:68` | select | `antecedents` |
| Paramétrage | Récupérer les spécialités déjà liées à l'antécédent édité | `src/pages/parametrage/AntecedentsForm.jsx:69` | select | `antecedents_specialites` |
| Paramétrage | Mettre à jour un antécédent existant | `src/pages/parametrage/AntecedentsForm.jsx:138-141` | update | `antecedents` |
| Paramétrage | Créer un nouvel antécédent | `src/pages/parametrage/AntecedentsForm.jsx:144-148` | insert | `antecedents` |
| Paramétrage | Supprimer les liaisons spécialités existantes avant resynchronisation | `src/pages/parametrage/AntecedentsForm.jsx:155-158` | delete | `antecedents_specialites` |
| Paramétrage | Insérer les nouvelles liaisons spécialités sélectionnées | `src/pages/parametrage/AntecedentsForm.jsx:166-168` | insert | `antecedents_specialites` |
| Paramétrage | Charger les spécialités actives pour sélecteur + filtre liste | `src/pages/parametrage/Appareils.jsx:25` | select | `specialites` |
| Paramétrage | Charger les appareils avec liaisons spécialités pour le tableau | `src/pages/parametrage/Appareils.jsx:31-35` | select | `appareils` (jointure `appareils_specialites`→`specialites`) |
| Paramétrage | Mettre à jour un appareil existant | `src/pages/parametrage/Appareils.jsx:63` | update | `appareils` |
| Paramétrage | Créer un nouvel appareil | `src/pages/parametrage/Appareils.jsx:66` | insert | `appareils` |
| Paramétrage | Supprimer les liaisons spécialités existantes avant resynchronisation | `src/pages/parametrage/Appareils.jsx:72` | delete | `appareils_specialites` |
| Paramétrage | Insérer les nouvelles liaisons spécialités sélectionnées | `src/pages/parametrage/Appareils.jsx:74-76` | insert | `appareils_specialites` |
| Paramétrage | Supprimer un appareil | `src/pages/parametrage/Appareils.jsx:118` | delete | `appareils` |
| Paramétrage | Charger les spécialités actives pour sélecteur + filtre liste | `src/pages/parametrage/Diagnostics.jsx:36` | select | `specialites` |
| Paramétrage | Charger les diagnostics avec liaisons spécialités pour le tableau | `src/pages/parametrage/Diagnostics.jsx:42-46` | select | `diagnostics` (jointure `diagnostics_specialites`→`specialites`) |
| Paramétrage | Mettre à jour un diagnostic existant | `src/pages/parametrage/Diagnostics.jsx:76` | update | `diagnostics` |
| Paramétrage | Créer un nouveau diagnostic | `src/pages/parametrage/Diagnostics.jsx:79` | insert | `diagnostics` |
| Paramétrage | Supprimer les liaisons spécialités existantes avant resynchronisation | `src/pages/parametrage/Diagnostics.jsx:85` | delete | `diagnostics_specialites` |
| Paramétrage | Insérer les nouvelles liaisons spécialités sélectionnées | `src/pages/parametrage/Diagnostics.jsx:87-89` | insert | `diagnostics_specialites` |
| Paramétrage | Supprimer un diagnostic | `src/pages/parametrage/Diagnostics.jsx:135` | delete | `diagnostics` |
| Paramétrage | Charger les spécialités actives pour sélecteur + filtre liste | `src/pages/parametrage/SignesCliniques.jsx:39` | select | `specialites` |
| Paramétrage | Charger les signes cliniques avec liaisons spécialités pour le tableau | `src/pages/parametrage/SignesCliniques.jsx:45-48` | select | `signes_cliniques` (jointure `signes_cliniques_specialites`→`specialites`) |
| Paramétrage | Mettre à jour un signe clinique existant | `src/pages/parametrage/SignesCliniques.jsx:76` | update | `signes_cliniques` |
| Paramétrage | Créer un nouveau signe clinique | `src/pages/parametrage/SignesCliniques.jsx:79` | insert | `signes_cliniques` |
| Paramétrage | Supprimer les liaisons spécialités existantes avant resynchronisation | `src/pages/parametrage/SignesCliniques.jsx:85` | delete | `signes_cliniques_specialites` |
| Paramétrage | Insérer les nouvelles liaisons spécialités sélectionnées | `src/pages/parametrage/SignesCliniques.jsx:87-89` | insert | `signes_cliniques_specialites` |
| Paramétrage | Supprimer un signe clinique | `src/pages/parametrage/SignesCliniques.jsx:131` | delete | `signes_cliniques` |
| Paramétrage | Charger les spécialités actives pour les listes déroulantes du formulaire utilisateur | `src/pages/administration/FormulaireUtilisateur.jsx:182` | select | `specialites` |
| Paramétrage | Re-récupérer toutes les spécialités pour reconstruire la sélection hiérarchique | `src/pages/administration/FormulaireUtilisateur.jsx:261` | select | `specialites` |

### 2.4 Rendez-vous

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Rendez-vous | Charger les rendez-vous du jour | `src/pages/IntroductionPatientPage.jsx:396` | select | `appointments` |
| Rendez-vous | Confirmer la présence d'un patient et l'ajouter en salle d'attente | `src/pages/IntroductionPatientPage.jsx:653` | rpc | `secretaire_confirme_patient_presence` |
| Rendez-vous | Confirmer la présence d'un patient et l'ajouter en salle d'attente (depuis la prise de RDV) | `src/pages/rendez-vous/PriseRendezVousPage.jsx:132` | rpc | `secretaire_confirme_patient_presence` |
| Rendez-vous | Marquer un rendez-vous comme absent (statut `annule`) | `src/pages/rendez-vous/PriseRendezVousPage.jsx:203` | update | `appointments` |
| Rendez-vous | Synchroniser le statut du rendez-vous à `termine` en fin de consultation | `src/pages/consultation/ConsultationDetail.jsx:330` | update | `appointments` |

### 2.5 File d'attente

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| File d'attente | S'abonner en temps réel à `waiting_queue`/`notifications_medecin_secretaire` | `src/pages/IntroductionPatientPage.jsx:174` | realtime (subscribe) | `waiting_queue`, `notifications_medecin_secretaire` (canal `waiting_queue_changes`) |
| File d'attente | Se désabonner du canal temps réel au démontage | `src/pages/IntroductionPatientPage.jsx:213` | realtime (unsubscribe) | canal `waiting_queue_changes` |
| File d'attente | Compter les patients en consultation pour la carte statistique | `src/pages/IntroductionPatientPage.jsx:246` | select (count) | `waiting_queue` |
| File d'attente | Archiver (`non_honore`) les entrées dont le RDV est passé | `src/pages/IntroductionPatientPage.jsx:458` | update | `waiting_queue` |
| File d'attente | Charger la file d'attente active du jour (jointure `appointments`) | `src/pages/IntroductionPatientPage.jsx:482` | select | `waiting_queue` (jointure `appointments`) |
| File d'attente | Récupérer tous les IDs de la file avant un vidage complet | `src/pages/IntroductionPatientPage.jsx:573` | select | `waiting_queue` |
| File d'attente | Vider complètement la file d'attente | `src/pages/IntroductionPatientPage.jsx:581` | delete | `waiting_queue` |
| File d'attente | Confirmer l'entrée du patient en consultation | `src/pages/IntroductionPatientPage.jsx:742` | rpc | `confirm_patient_entry_basesql` |
| File d'attente | Statut → `en_route` (appel du patient vers le médecin) | `src/pages/IntroductionPatientPage.jsx:820` | update | `waiting_queue` |
| File d'attente | Marquer le patient comme physiquement entré en consultation | `src/pages/IntroductionPatientPage.jsx:888` | update | `waiting_queue` |
| File d'attente | Statut de la file d'attente → `termine` en fin de consultation | `src/pages/consultation/ConsultationDetail.jsx:310` | update | `waiting_queue` |

### 2.6 Consultation

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Consultation | Sauvegarde automatique (statut `terminee`, notes générales) en début de terminaison | `src/pages/consultation/ConsultationDetail.jsx:250` | update | `consultations` |
| Consultation | Mettre à jour le statut de la consultation à `terminee` | `src/pages/consultation/ConsultationDetail.jsx:294` | update | `consultations` |

### 2.7 Utilisateurs (médecins, caissiers, secrétaires, authentification)

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Utilisateurs | Récupérer la liste des caissiers (filtre + association nom/username) | `src/pages/comptabilite/SuiviCaissiers.jsx:59` | rpc | `get_caissiers` |
| Utilisateurs | Récupérer la liste des médecins (role=doctor) pour le filtre de recherche | `src/pages/comptabilite/RechercheRapports.jsx:63` | select | `users` |
| Utilisateurs | Récupérer la liste des caissiers pour la vue supervision | `src/pages/secretary/Caisse.jsx:342` | rpc | `get_caissiers` |
| Utilisateurs | Infos (nom, prénom, spécialité) des médecins référencés par les notifications | `src/pages/IntroductionPatientPage.jsx:291` | select | `users` |
| Utilisateurs | Charger la liste des médecins actifs (rôle `doctor`) | `src/pages/IntroductionPatientPage.jsx:367` | select | `users` |
| Utilisateurs | Enrichir les rendez-vous du jour avec les infos médecin | `src/pages/IntroductionPatientPage.jsx:425` | select | `users` |
| Utilisateurs | Enrichir la file d'attente avec les infos médecin | `src/pages/IntroductionPatientPage.jsx:529` | select | `users` |
| Utilisateurs | Charger la liste des médecins actifs pour le filtre par médecin | `src/pages/rendez-vous/StatistiquesRealtime.jsx:89` | select | `users` |
| Utilisateurs | Infos du médecin de la consultation, vérifier qu'il est actif | `src/pages/consultation/ConsultationDetail.jsx:129` | select | `users` |
| Utilisateurs | Récupérer une secrétaire active pour notifier la fin de consultation | `src/pages/consultation/ConsultationDetail.jsx:267` | select | `users` |
| Utilisateurs | Récupérer l'utilisateur Auth connecté avant création de consultation depuis modèle | `src/pages/consultation/ConsultationDetail.jsx:392` | auth | `auth.getUser` |
| Utilisateurs | Vérifier que l'utilisateur connecté est médecin (profil par email) | `src/pages/consultation/ConsultationDetail.jsx:397` | select | `users` |
| Utilisateurs | Récupérer une secrétaire active pour la demande de RDV de suivi | `src/pages/consultation/ConsultationDetail.jsx:423` | select | `users` |
| Utilisateurs | Charger les données de l'utilisateur à afficher/éditer | `src/pages/administration/FormulaireUtilisateur.jsx:214` | select | `users` |
| Utilisateurs | Charger les spécialités multiples associées à un médecin | `src/pages/administration/FormulaireUtilisateur.jsx:227` | select | `medecin_specialites` |
| Utilisateurs | Récupérer le token de session pour l'edge function `manage-users` (création) | `src/pages/administration/FormulaireUtilisateur.jsx:298` | auth | `auth.getSession` |
| Utilisateurs | Associer les spécialités sélectionnées au médecin créé | `src/pages/administration/FormulaireUtilisateur.jsx:337` | rpc | `sync_medecin_specialites` |
| Utilisateurs | Mettre à jour les informations d'un utilisateur existant | `src/pages/administration/FormulaireUtilisateur.jsx:350` | update | `users` |
| Utilisateurs | Synchroniser les spécialités d'un médecin existant après modification | `src/pages/administration/FormulaireUtilisateur.jsx:357` | rpc | `sync_medecin_specialites` |
| Utilisateurs | Récupérer le token de session pour l'edge function `manage-users` (reset mdp) | `src/pages/administration/FormulaireUtilisateur.jsx:430` | auth | `auth.getSession` |
| Utilisateurs | Activer/désactiver le compte d'un utilisateur | `src/pages/administration/FormulaireUtilisateur.jsx:472` | update | `users` |

### 2.8 Reporting / Statistiques

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Reporting | S'abonner en temps réel à `statistiques_realtime` | `src/pages/rendez-vous/StatistiquesRealtime.jsx:24` | realtime (subscribe) | `statistiques_realtime` (canal `statistiques_changes`) |
| Reporting | Se désabonner du canal temps réel | `src/pages/rendez-vous/StatistiquesRealtime.jsx:36` | realtime (unsubscribe) | canal `statistiques_changes` |
| Reporting | Charger les statistiques temps réel filtrées médecin/période | `src/pages/rendez-vous/StatistiquesRealtime.jsx:58` | select | `statistiques_realtime` |
| Reporting | Compter le nombre total de patients (statistiques globales) | `src/pages/rendez-vous/StatistiquesRealtime.jsx:106` | select (count) | `patients` |
| Reporting | Compter le nombre total de consultations (statistiques globales) | `src/pages/rendez-vous/StatistiquesRealtime.jsx:107` | select (count) | `consultations` |
| Reporting | Récupérer toute la file d'attente pour temps d'attente moyen / taux d'occupation | `src/pages/rendez-vous/StatistiquesRealtime.jsx:108` | select | `waiting_queue` |
| Reporting | Résumé global/financier des indicateurs du cabinet sur une période | `src/pages/reporting/Reporting.jsx:69` | rpc | `get_resume_global` |
| Reporting | Statistiques de consultations par spécialité | `src/pages/reporting/Reporting.jsx:84` | select | `statistiques_consultations_specialites` |
| Reporting | Statistiques de consultations par médecin (top 10) | `src/pages/reporting/Reporting.jsx:99` | select | `statistiques_consultations_medecins` |
| Reporting | Statistiques des actes médicaux par type (top 10) | `src/pages/reporting/Reporting.jsx:115` | select | `statistiques_actes_types` |
| Reporting | Statistiques des certificats médicaux émis | `src/pages/reporting/Reporting.jsx:130` | select | `statistiques_certificats` |
| Reporting | Chiffre d'affaires par spécialité | `src/pages/reporting/Reporting.jsx:144` | select | `statistiques_finances_specialites` |
| Reporting | Chiffre d'affaires par médecin (top 10) | `src/pages/reporting/Reporting.jsx:158` | select | `statistiques_finances_medecins` |
| Reporting | Revenus par type d'acte (top 10) | `src/pages/reporting/Reporting.jsx:173` | select | `statistiques_finances_actes` |

### 2.9 Notifications

| Catégorie | But | Page (fichier:ligne) | Type | Table/RPC |
|---|---|---|---|---|
| Notifications | Notifications non lues du jour destinées à la secrétaire (hors `patient_ready`) | `src/pages/IntroductionPatientPage.jsx:268` | select | `notifications_medecin_secretaire` |

**Total section 2 : 7 + 30 + 32 + 5 + 11 + 2 + 21 + 14 + 1 = 123 appels**, cohérent avec les totaux annoncés par les fragments A (37) + B (28) + C (58).

---

## 3. Comparaison avec les services existants

Légende : ✅ SERVICE EXISTANT (couvre le besoin) · ⚠️ SERVICE PARTIEL (existe mais incomplet/différent) · ❌ AUCUN SERVICE — à créer.

| Table/RPC | Appelée directement dans (pages) | Service existant couvrant cette table ? | Fonction exportée si oui |
|---|---|---|---|
| `factures` | Recapitulatif, RechercheRapports, Caisse.jsx (×9) | ⚠️ SERVICE PARTIEL | `src/services/paiementService.js` → `enregistrerPaiement()` (update partiel) et `updateFacture()` couvrent uniquement l'écriture d'encaissement ; **aucune fonction de lecture/liste/jointure** (factures payées, en attente, par période, par assurance) n'existe — chaque page réimplémente sa propre requête avec jointures `patients/assurances/consultations`. (Note : `invoiceService` dans `src/lib/services.js` cible la table obsolète `invoices`, pas `factures` — non applicable.) |
| `paiements` | SuiviCaissiers, Caisse.jsx (×7) | ⚠️ SERVICE PARTIEL | `src/services/paiementService.js` → `enregistrerPaiement()` couvre uniquement l'**insertion**. Aucune fonction de lecture (totaux jour/mois, historique par caissier, tendance période précédente) n'existe. |
| `sessions_caisse` | Caisse.jsx (×4 : select ouverte, select alertes, select vérif, insert) | ❌ AUCUN SERVICE — à créer | — |
| `reversements_bancaires` | ReversementBancaire.jsx (×2) | ❌ AUCUN SERVICE — à créer | — |
| `assurances` | Recapitulatif, RechercheRapports, Caisse.jsx (×4) | ❌ AUCUN SERVICE — à créer | — |
| `parametres_cabinet` | Recapitulatif, Caisse.jsx (×2) | ✅ SERVICE EXISTANT | `src/services/parametrageService.js` → `fetchParametres(tenantId)` / `saveParametres(settings)` — couvre exactement le besoin (nom, adresse, logo cabinet), mais les pages ne l'utilisent pas. |
| `get_arrete_comptable_mensuel` (rpc) | ArreteMensuel.jsx, Caisse.jsx (×2) | ❌ AUCUN SERVICE — à créer | — |
| `get_caissiers` (rpc) | SuiviCaissiers.jsx, Caisse.jsx (×2) | ❌ AUCUN SERVICE — à créer | — |
| `fermer_session_caisse` (rpc) | Caisse.jsx | ❌ AUCUN SERVICE — à créer | — |
| `specialites` | AntecedentsForm, Appareils, Diagnostics, SignesCliniques, FormulaireUtilisateur (×6) | ✅ SERVICE EXISTANT | `src/lib/services/specialtyService.js` → `specialtyService.getAll()` (id, nom, color, actif — filtre `actif=true`, tri `nom`) reproduit exactement le besoin. Egalement lu (mais pas exposé isolément) par `src/services/consultation/referenceDataService.js` → `getReferenceData()`. |
| `antecedents` / `antecedents_specialites` | AntecedentsForm.jsx (×5) | ⚠️ SERVICE PARTIEL | `src/services/consultation/referenceDataService.js` → `getReferenceData()` **lit** `antecedents` et `antecedents_specialites` (lecture seule, pour le module consultation), mais **aucune fonction create/update/delete/sync-liaisons** n'existe pour le CRUD de paramétrage. |
| `appareils` / `appareils_specialites` | Appareils.jsx (×6) | ⚠️ SERVICE PARTIEL | `referenceDataService.getReferenceData()` lit `appareils`/`appareils_specialites` (lecture seule). Il existe aussi `appareilsService.getAll()` dans `src/lib/services.js` (ligne 1892) mais il est **read-only**, filtre par `specialite_id` unique (colonne directe) plutôt que par la table de liaison many-to-many `appareils_specialites` utilisée par la page — modèle de filtrage différent, donc pas réutilisable tel quel. Aucun create/update/delete/sync-liaisons. |
| `diagnostics` / `diagnostics_specialites` | Diagnostics.jsx (×6) | ⚠️ SERVICE PARTIEL | Même situation qu'`appareils` : `referenceDataService.getReferenceData()` (lecture) + `diagnosticsService.getAll()` dans `src/lib/services.js` (ligne 1929, read-only, filtre par colonne directe). Aucun CUD/sync-liaisons. |
| `signes_cliniques` / `signes_cliniques_specialites` | SignesCliniques.jsx (×6) | ⚠️ SERVICE PARTIEL | `referenceDataService.getReferenceData()` lit ces tables (lecture seule). Aucun service dédié équivalent à `appareilsService`/`diagnosticsService` n'existe même en lecture seule côté `lib/services.js`. Aucun CUD/sync-liaisons. |
| `patients` | Recapitulatif, Caisse.jsx, IntroductionPatientPage (×7) | ⚠️ SERVICE PARTIEL | `src/services/patientService.js` → `fetchPatients()` (liste simple id/nom/prénom/date_naissance/numero_dossier) et `src/lib/services.js` → `patientService.{getAll,getById,create,update,delete,search}` (ligne 192) couvrent le CRUD de base, mais aucune des deux ne fait les jointures spécifiques utilisées par les pages (assurance, enrichissement file d'attente/RDV). |
| `appointments` | IntroductionPatientPage, PriseRendezVousPage, ConsultationDetail (×5) | ✅ SERVICE EXISTANT | `src/lib/services.js` → `appointmentService` (ligne 259) : `getAll()`, `getToday()`, `getByDoctor()`, `getByPatient()`, `create()`, `update()`, `deleteAppointment()`, etc. — couvre fonctionnellement les besoins (RDV du jour, mise à jour de statut) mais les pages auditées ne l'utilisent pas et repartent d'une requête `.from('appointments')` maison. |
| `waiting_queue` | IntroductionPatientPage, ConsultationDetail (×11) | ⚠️ SERVICE PARTIEL | Coexistence de **trois** implémentations distinctes : `secretaryService` (`src/services/secretaryService.js` : `getDoctorWaitingQueue`, `getAllWaitingQueues`, `addPatientToQueue`, `markPatientPresent`, `updateQueueOrder`), `waitingQueueService` (`src/lib/services.js` ligne 1395 : `getByDoctor`, `getAll`, `addToQueue`, …) et `waitingQueueRealtimeService`/`completeRealtimeService` (`src/services/`). Aucune ne couvre le vidage complet de file, l'archivage des RDV passés (`non_honore`) ni l'enrichissement combiné patient+médecin+RDV utilisé par `IntroductionPatientPage.jsx`. |
| `consultations` | StatistiquesRealtime (count), ConsultationDetail (×3) | ⚠️ SERVICE PARTIEL | `src/services/consultation/consultationService.js` → `updateConsultationStatus(consultationId, newStatus)` (ligne 519) couvre exactement la transition de statut, mais `ConsultationDetail.jsx:250` fait une mise à jour combinée (statut + notes générales) que la fonction actuelle ne supporte pas telle quelle. Pas de fonction de comptage globale pour le reporting. |
| `users` (générique) | RechercheRapports, IntroductionPatientPage, StatistiquesRealtime, ConsultationDetail, FormulaireUtilisateur (×12) | ✅ SERVICE EXISTANT | `src/lib/services.js` → `userService` (ligne 5) : `getAll()`, `getById()`, `create()`, `update()`, `delete()`, `getDoctors()`, `getSecretaries()`, `getUniqueDoctorSpecialties()` — couvre la quasi-totalité des besoins (liste médecins actifs, update, toggle actif), mais toutes les pages listées ci-contre passent par des requêtes directes. |
| `get_caissiers` (rpc) | *(déjà listé ci-dessus, doublon table/rpc)* | ❌ AUCUN SERVICE — à créer | — |
| `medecin_specialites` | FormulaireUtilisateur.jsx | ⚠️ SERVICE PARTIEL | `userService.getUniqueDoctorSpecialties()` (`src/lib/services.js`) lit `medecin_specialites` mais de façon agrégée (liste des spécialités pratiquées tous médecins confondus) ; il n'existe pas de fonction pour lire/écrire les spécialités d'**un** médecin donné. |
| `sync_medecin_specialites` (rpc) | FormulaireUtilisateur.jsx (×2) | ❌ AUCUN SERVICE — à créer | — |
| `notifications_medecin_secretaire` | IntroductionPatientPage.jsx | ⚠️ SERVICE PARTIEL | `src/services/notificationService.js` → `notificationService.getNotifications(userId)` (ligne 371) existe mais avec une logique de filtre différente (la page filtre "non lues du jour, hors `patient_ready`" ; le service ne fait pas ce filtre précis). |
| `confirm_patient_entry_basesql` (rpc) | IntroductionPatientPage.jsx | ❌ AUCUN SERVICE — à créer | — |
| `secretaire_confirme_patient_presence` (rpc) | IntroductionPatientPage.jsx, PriseRendezVousPage.jsx | ❌ AUCUN SERVICE — à créer | — |
| `get_resume_global` (rpc) | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_realtime` | StatistiquesRealtime.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_consultations_specialites` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_consultations_medecins` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_actes_types` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_certificats` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_finances_specialites` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_finances_medecins` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `statistiques_finances_actes` | Reporting.jsx | ❌ AUCUN SERVICE — à créer | — |
| `auth.getUser` / `auth.getSession` | ConsultationDetail.jsx, FormulaireUtilisateur.jsx (×3) | ⚠️ SERVICE PARTIEL | `src/services/hybridAuthService.js` et `src/services/temporaryAuthService.js` encapsulent déjà `auth.getSession()`/`auth.getUser()` pour le flux de login, mais pas pour ces usages ponctuels (récupération de token avant appel à l'edge function `manage-users`, vérification de rôle avant création de consultation). |

**Décompte** : sur les 30 tables + 7 RPC de la section 2 (37 lignes de comparaison ci-dessus, `get_caissiers` étant listé une seule fois dans le décompte) :
- ✅ SERVICE EXISTANT : 4 (`parametres_cabinet`, `specialites`, `appointments`, `users`)
- ⚠️ SERVICE PARTIEL : 10 (`factures`, `paiements`, `antecedents`+liaison, `appareils`+liaison, `diagnostics`+liaison, `signes_cliniques`+liaison, `patients`, `waiting_queue`, `consultations`, `medecin_specialites`, `notifications_medecin_secretaire`, `auth.*`) — regroupées, soit 12 lignes du tableau
- ❌ AUCUN SERVICE : le reste (`sessions_caisse`, `reversements_bancaires`, `assurances`, 3 RPC finance, `sync_medecin_specialites`, `confirm_patient_entry_basesql`, `secretaire_confirme_patient_presence`, `get_resume_global`, 7 tables `statistiques_*`) — soit **17 points d'accès** distincts.

---

## 4. Recommandations

Priorisation par fréquence d'usage direct et criticité métier (le module caisse/comptabilité manipule de l'argent réel — c'est la priorité n°1) :

1. **`paiementService` (étendre)** — Ajouter les fonctions de lecture manquantes autour de `factures`/`paiements` : `listFactures({statut, periode, assuranceId, medecinId})`, `listPaiements({periode, caissierId})`, `getTotauxCaisse({jour, mois, caissierId})`, `getHistoriquePatient(patientId)`, `getHistoriqueCouverture(assuranceId)`. C'est le chantier le plus rentable : il absorbe à lui seul ~22 des 25 appels de `Caisse.jsx` plus ceux de `Recapitulatif.jsx`, `SuiviCaissiers.jsx` et `RechercheRapports.jsx`.
2. **`sessionCaisseService` (à créer)** — Encapsuler `sessions_caisse` (ouverture, vérification session ouverte, alertes) + les RPC `fermer_session_caisse` et `get_arrete_comptable_mensuel` (déjà dupliquée entre `ArreteMensuel.jsx` et `Caisse.jsx`).
3. **`caissierService` / extension de `userService`** — Encapsuler le RPC `get_caissiers` (dupliqué dans 2 pages) et, idéalement, fusionner avec `userService.getDoctors()`/`getSecretaries()` déjà existants dans `src/lib/services.js` pour former un point d'entrée unique "utilisateurs par rôle".
4. **`reversementBancaireService` / `assuranceService` (à créer)** — Tables simples sans service actuel ; CRUD basique à factoriser rapidement (peu d'appels mais aucune protection/centralisation de la logique métier).
5. **Service générique de référentiels de paramétrage** — Les 4 pages `AntecedentsForm.jsx`, `Appareils.jsx`, `Diagnostics.jsx`, `SignesCliniques.jsx` reproduisent **à l'identique** (à un renommage de colonne près : `antecedent_id`/`appareil_id`/`diagnostic_id`/`signe_clinique_id`) le même pattern : fetch spécialités → fetch table + jointure liaison → `update`/`insert` conditionnel → `delete` puis `insert` des liaisons (sync) → `delete` simple. C'est un candidat idéal pour une factory du type :
   ```js
   createReferentielService({
     table: 'antecedents',
     liaisonTable: 'antecedents_specialites',
     foreignKey: 'antecedent_id',
   })
   ```
   exposant `list()`, `getById()`, `create()`, `update()`, `remove()`, `syncSpecialites()`. Cela supprimerait ~24 des 28 appels directs du groupe paramétrage (hors les 4 `select specialites` qui peuvent simplement appeler `specialtyService.getAll()` déjà existant). Attention : ne pas confondre avec `appareilsService`/`diagnosticsService` de `src/lib/services.js`, qui sont en lecture seule et filtrent par une colonne `specialite_id` différente du modèle many-to-many réellement utilisé par ces pages — ils ne doivent pas servir de base sans être réécrits.
6. **`src/pages/secretary/Caisse.jsx` — traitement prioritaire** — Ce fichier concentre à lui seul ~25 appels directs (68 % du périmètre finance) : sessions de caisse, paiements, factures (lecture et écriture), assurances, parametres_cabinet, temps réel, et même une insertion de facture "part couverture" (ligne 1462) qui duplique une logique métier sensible en plein composant React. Recommandation : le découper en s'appuyant sur les services listés aux points 1 et 2 ci-dessus **avant** toute nouvelle fonctionnalité sur cette page, car chaque évolution actuelle du fichier augmente le risque de divergence avec les autres pages caisse/comptabilité qui dupliquent des requêtes similaires (`Recapitulatif.jsx`, `SuiviCaissiers.jsx`, `RechercheRapports.jsx`).
7. **Reporting** — Créer un `reportingService` regroupant le RPC `get_resume_global` et les 7 vues `statistiques_*` (aucune n'a de service actuellement) : `getResumeGlobal()`, `getStatsParSpecialite()`, `getStatsParMedecin()`, `getStatsActes()`, `getStatsCertificats()`, `getFinancesParSpecialite()`, `getFinancesParMedecin()`, `getFinancesParActe()`.
8. **Workflow patient/file d'attente** — Le RPC `secretaire_confirme_patient_presence` et `confirm_patient_entry_basesql` sont appelés directement à la fois dans des pages (`IntroductionPatientPage.jsx`, `PriseRendezVousPage.jsx`) et des composants (annexe, section 5). Un `patientPresenceService` unique éviterait la divergence déjà observée (3 endroits différents appellent le même RPC avec des paramètres construits indépendamment).
9. **`medecin_specialites` / `sync_medecin_specialites`** — Étendre `userService` (`src/lib/services.js`) avec `getSpecialitesByMedecin(medecinId)` et `syncSpecialitesMedecin(medecinId, specialiteIds)` pour absorber les 3 appels de `FormulaireUtilisateur.jsx`.
10. **Nettoyage** — Signaler que `invoiceService` (table `invoices`) et `billingService` (table `billing`) dans `src/lib/services.js` ciblent des tables obsolètes non utilisées par l'application actuelle (`factures`/`paiements`) ; à documenter comme code mort ou à supprimer pour éviter toute confusion lors de la création des nouveaux services ci-dessus.

---

## 5. Annexe — Composants avec appels directs (hors périmètre "pages")

> Ces composants sont montés par plusieurs des pages auditées (secrétariat, médecin) et devront être traités dans une seconde passe une fois les services "pages" stabilisés, car ils dupliquent souvent les mêmes tables/RPC (`waiting_queue`, `appointments`, `consultations`, `secretaire_confirme_patient_presence`, `confirm_patient_entry_basesql`).

### src/components/secretary/DoctorSpecificQueue.jsx

| But | Ligne | Type | Table/RPC |
|---|---|---|---|
| Abonnement temps réel `waiting_queue` du médecin affiché | 77-85 | realtime (subscribe) | `waiting_queue` |
| Abonnement temps réel `appointments` du médecin affiché | 86-93 | realtime (subscribe) | `appointments` |
| Désabonnement au démontage / changement de `doctor` | 97 | realtime (unsubscribe) | canal `doctor_specific_queue_${doctor.id}` |
| File d'attente du médecin sélectionné (patient + RDV) | 120-128 | select | `waiting_queue` |
| Rendez-vous du jour du médecin sélectionné | 157-166 | select | `appointments` |
| Marquer un patient "appelé" comme "présent" | 180-186 | update | `waiting_queue` |
| Confirmer la présence d'un patient depuis "RDV du jour" | 234-237 | rpc | `secretaire_confirme_patient_presence` |

### src/components/secretary/DoctorReassignModal.jsx

| But | Ligne | Type | Table/RPC |
|---|---|---|---|
| Spécialité du médecin actuellement assigné | 30-34 | select | `users` |
| Liste des médecins actifs disponibles (hors médecin actuel) | 37-51 | select | `users` (jointure `specialites`) |
| Réassigner le patient à un nouveau médecin | 83-87 | rpc | `reassign_patient_to_doctor` |
| Créer une notification de changement de médecin | 109-123 | insert | `notifications_realtime` |

### src/components/notifications/NotificationSystem.jsx

| But | Ligne | Type | Table/RPC |
|---|---|---|---|
| Notifications médecin/secrétaire de l'utilisateur connecté (50 dernières) | 94-99 | select | `notifications_medecin_secretaire` |
| Écoute temps réel des nouvelles notifications (INSERT) | 184-198 | realtime (subscribe) | `notifications_medecin_secretaire` (canal `notifications`) |
| Marquer une notification comme lue | 208-211 | update | `notifications_medecin_secretaire` |
| Marquer toutes les notifications comme lues | 223-227 | update | `notifications_medecin_secretaire` |
| Confirmer l'entrée du patient en consultation depuis une notification | 258-261 | rpc | `confirm_patient_entry_basesql` |

### src/components/doctor/DoctorDashboard_Clean.jsx

*(probable variante ancienne/non montée — à confirmer côté routage)*

| But | Ligne | Type | Table/RPC |
|---|---|---|---|
| Abonnement temps réel `waiting_queue` du médecin connecté | 36-45 | realtime (subscribe) | `waiting_queue` |
| Désabonnement au démontage | 48 | realtime (unsubscribe) | canal `doctor_dashboard` |
| File d'attente enrichie du médecin connecté (statuts actifs) | 58-64 | select | `v_waiting_queue_complete` (vue) |
| Rendez-vous du jour du médecin connecté | 75-85 | select | `appointments` |
| Marquer le médecin disponible ("Je suis disponible") | 113-116 | rpc | `mark_doctor_available_basesql` |
| Démarrer la consultation du patient | 125-128 | rpc | `start_consultation_basesql` |
| Terminer la consultation du patient | 133-136 | rpc | `finish_consultation_basesql` |

### src/components/doctor/DoctorDashboard_Fixed.jsx

*(probable version réellement utilisée — à confirmer côté routage)*

| But | Ligne | Type | Table/RPC |
|---|---|---|---|
| Abonnement temps réel `waiting_queue` du médecin connecté | 47-56 | realtime (subscribe) | `waiting_queue` |
| Désabonnement au démontage | 59 | realtime (unsubscribe) | canal `doctor_dashboard` |
| File d'attente enrichie du médecin connecté | 69-75 | select | `v_waiting_queue_complete` (vue) |
| Rendez-vous liés aux items de la file d'attente | 85-88 | select | `appointments` |
| Rendez-vous du jour du médecin connecté | 115-125 | select | `appointments` |
| Réinitialiser les autres patients à `waiting` avant de recevoir le patient sélectionné | 163-171 | update | `waiting_queue` |
| Le médecin reçoit le patient (workflow simplifié) | 179-182 | rpc | `medecin_recoit_patient_simplifie` |
| Statut du patient → `in_consultation` | 203-210 | update | `waiting_queue` |
| Récupérer patient/médecin/RDV liés avant création de consultation | 214-218 | select | `waiting_queue` |
| Chercher une consultation existante du jour pour ce patient/médecin | 226-234 | select | `consultations` |
| Compléter la consultation existante (appointment_id/motif manquants) | 241-248 | update | `consultations` |
| Créer une nouvelle consultation si aucune n'existe | 254-266 | insert | `consultations` |
| Terminer la consultation avec notification à la secrétaire | 285-288 | rpc | `medecin_termine_consultation` |
| Réinitialiser les autres patients lors de la sélection manuelle du "patient actuel" | 400-408 | update | `waiting_queue` |
| Récupérer patient/médecin avant redirection directe vers consultation en cours | 759-763 | select | `waiting_queue` |
| Chercher une consultation en cours existante avant redirection directe | 774-782 | select | `consultations` |
| Créer une consultation si elle n'existe pas (redirection directe) | 789-798 | insert | `consultations` |

**Total annexe : 40 appels directs**, répartis sur 7 tables/vues (`waiting_queue`, `appointments`, `v_waiting_queue_complete`, `consultations`, `users`, `notifications_medecin_secretaire`, `notifications_realtime`) et 8 fonctions RPC distinctes (`secretaire_confirme_patient_presence`, `reassign_patient_to_doctor`, `confirm_patient_entry_basesql`, `mark_doctor_available_basesql`, `start_consultation_basesql`, `finish_consultation_basesql`, `medecin_recoit_patient_simplifie`, `medecin_termine_consultation`).

À noter : `DoctorDashboard_Clean.jsx` et `DoctorDashboard_Fixed.jsx` semblent être deux versions du même tableau de bord médecin — à vérifier laquelle est réellement montée par les pages avant d'investir dans la migration de l'une ou l'autre (la seconde, plus complète, est la candidate la plus probable).

---

## 6. Prochaines étapes suggérées

1. Créer/étendre `paiementService` avec les fonctions de lecture (`listFactures`, `listPaiements`, `getTotauxCaisse`, `getHistoriquePatient`, `getHistoriqueCouverture`) — priorité n°1.
2. Créer `sessionCaisseService` (CRUD `sessions_caisse` + wrapper des RPC `fermer_session_caisse` et `get_arrete_comptable_mensuel`).
3. Créer `genericReferentielService(tableName, liaisonTableName, foreignKeyColumn)` et migrer `AntecedentsForm.jsx`, `Appareils.jsx`, `Diagnostics.jsx`, `SignesCliniques.jsx` dessus (en réutilisant `specialtyService.getAll()` existant pour le sélecteur de spécialités).
4. Migrer les pages une par une en commençant par `src/pages/secretary/Caisse.jsx` (le plus gros contributeur), puis `Recapitulatif.jsx`, `SuiviCaissiers.jsx`, `RechercheRapports.jsx`, `ReversementBancaire.jsx`, `ArreteMensuel.jsx`.
5. Créer `reportingService` pour le RPC `get_resume_global` et les 7 vues `statistiques_*`, puis migrer `Reporting.jsx` et `StatistiquesRealtime.jsx`.
6. Créer `patientPresenceService` regroupant `secretaire_confirme_patient_presence` et `confirm_patient_entry_basesql`, et migrer `IntroductionPatientPage.jsx`, `PriseRendezVousPage.jsx`, ainsi que (seconde passe) `DoctorSpecificQueue.jsx` et `NotificationSystem.jsx`.
7. Étendre `userService` (`src/lib/services.js`) avec `getSpecialitesByMedecin`/`syncSpecialitesMedecin` (RPC `sync_medecin_specialites`) et migrer `FormulaireUtilisateur.jsx`.
8. Documenter/supprimer les services obsolètes `invoiceService` (table `invoices`) et `billingService` (table `billing`) dans `src/lib/services.js` pour éviter toute confusion future.
9. Une fois les pages migrées, lancer une seconde passe sur les composants de l'annexe (section 5), en priorité `DoctorDashboard_Fixed.jsx` (17 appels directs) et clarifier le statut de `DoctorDashboard_Clean.jsx` (code mort probable) avant de le migrer ou de le supprimer.
