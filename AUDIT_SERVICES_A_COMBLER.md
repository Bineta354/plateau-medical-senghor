# Audit — Services créés pour combler les appels directs (carte de migration)

> Contexte : `AUDIT_APPELS_DIRECTS_DB.md` a recensé 123 appels directs au client `supabase` dans les pages (`src/pages/**`), dont ~75 % ne bénéficiaient d'aucun service fiable en `src/services/`. Suite à cet audit, 8 fichiers de services ont été créés ou étendus (plus `userService` dans `src/lib/services.js`) pour couvrir ces besoins.
>
> Ce document est la **carte de migration** entre ces services et les appels natifs qu'ils remplacent. **Mise à jour** : la migration a commencé (branche `refactor/services-caisse-caissier`, 7 commits) — chaque ligne des tableaux ci-dessous porte désormais une colonne **Statut** : ✅ Migré (la page appelle le service, vérifié par build + test manuel connecté dans le navigateur), ⏳ Pas encore migré (la page appelle toujours Supabase directement), ou 🚫 Hors périmètre (exclusion volontaire — flux secrétaire/médecin non touché sur demande explicite, ou fichier avec du travail en cours non lié qu'on ne voulait pas perturber). Voir la section 0 pour le résumé et la section "Prochaine étape" pour ce qu'il reste à faire.
>
> Pour chaque service, un tableau détaille : la page et la ligne de l'appel natif (d'origine — certaines ont bougé depuis la migration, la page elle-même fait foi), le but métier de cet appel, pourquoi il devait être remplacé par le service, et ce que faisait concrètement la requête native (table/RPC, filtres, jointures, écriture) — de quoi vérifier que la fonction de service correspondante est un remplacement fidèle.
>
> Méthode initiale : chaque fichier de service a été lu intégralement, puis chaque site d'appel natif cité dans ses commentaires a été retrouvé et confirmé par grep dans la page correspondante. Sources : `AUDIT_APPELS_DIRECTS_DB.md` section 3 (comparaison service existant/manquant, ~L200-245) et section 4 (recommandations de priorisation, ~L249-270).

---

## 0. Résumé de l'état de la migration

| Service | Pages migrées | Pages restantes | Statut |
|---|---|---|---|
| `paiementService` (étendu) | `Caisse.jsx` (10/11 sites — `fetchDetailsJournee` volontairement laissé natif), `Recapitulatif.jsx` | `RechercheRapports.jsx`, `EncaissementFactures.jsx`, `SuiviCaissiers.jsx` (paiements) | 🟡 Partiel |
| `sessionCaisseService` | `Caisse.jsx` (100%), `ArreteMensuel.jsx` (100%) | — | ✅ Complet |
| `caissierService` | `Caisse.jsx` | `SuiviCaissiers.jsx` | 🟡 Partiel |
| `reversementBancaireService` | `ReversementBancaire.jsx` (100%) | — | ✅ Complet |
| `assuranceService` | `Recapitulatif.jsx`, `Caisse.jsx` | `RechercheRapports.jsx` | 🟡 Partiel |
| `referentielService` | `Antecedents.jsx`, `AntecedentsForm.jsx`, `Appareils.jsx`, `Diagnostics.jsx`, `SignesCliniques.jsx` (100%) | — | ✅ Complet |
| `reportingService` | — | `Reporting.jsx`, `StatistiquesRealtime.jsx` | ⏳ Non commencé |
| `patientPresenceService` | — | `IntroductionPatientPage.jsx`, `PriseRendezVousPage.jsx` | 🚫 Hors périmètre (flux secrétaire, exclusion explicite utilisateur) |
| `userService` (ext. médecin) | — | `FormulaireUtilisateur.jsx` | ⏳ Non commencé |

**Hors périmètre initial de cet audit, fait dans le même chantier** : `src/services/acteConsultationService.js` (nouveau) pour `facturation/Actes.jsx` — voir section 10 — et extension de `patientService` (`getByIdWithAssurance`) pour `PatientDetailsPage.jsx`/`PatientEditPage.jsx` — voir section 11.

**3 bugs préexistants trouvés et corrigés en testant** (sans lien avec la migration elle-même, détails dans l'historique git de la branche, commit `7a83fc7`) : route `/parametrage/antecedents/form/:id` manquante (déconnexion visible au clic "Modifier"), clé React dupliquée dans `ArreteMensuel.jsx`, et liste masquée en permanence dans `Appareils.jsx`/`SignesCliniques.jsx` (bug du composant `ParametrageLayout`, contourné au niveau des 2 pages sans toucher au composant partagé).

**Point de donnée signalé (non corrigé, hors périmètre)** : `Recapitulatif.jsx` affiche des factures avec `montant_paye > montant_ttc` — incohérence dans les données de test elles-mêmes (lue telle quelle depuis `factures`), pas un bug introduit par la migration.

---

## 1. `src/services/paiementService.js` (étendu)

Nouvelles fonctions de lecture : `listFactures`, `listPaiements`, `getTotauxCaisse`, `getHistoriquePatient`, `getHistoriqueCouverture`. C'est le chantier le plus rentable de l'audit (recommandation n°1) : il absorbe la majorité des ~25 appels directs de `Caisse.jsx` plus ceux de `Recapitulatif.jsx`, `SuiviCaissiers.jsx`, `RechercheRapports.jsx` et `EncaissementFactures.jsx`. Les fonctions d'écriture existantes (`enregistrerPaiement`, `updateFacture`) ne sont pas nouvelles et ne sont pas reprises dans ce tableau.

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/secretary/Caisse.jsx:1062-1082` (`fetchFactures`, bloc "en attente") | Charger les factures en attente/partielles pour la liste principale de caisse | Une des ~9 requêtes `factures` quasi identiques dupliquées dans ce seul fichier ; risque de divergence de forme (colonnes/jointures) à chaque modif isolée | `select` sur `factures` avec jointure `consultations(date_consultation, patient_id, patients(id, nom, prenom, numero_secu, assurance_id, assurances(...)))`, filtre `.or('statut_paiement.eq.en_attente,statut_paiement.eq.partiel')`, tri `created_at desc`, `limit(1000)` | ✅ `listFactures({statut:'outstanding'})` |
| `src/pages/secretary/Caisse.jsx:1092-1096` (`fetchFactures`, bloc "enfants couverture") | Savoir si une facture patient a déjà été scindée (facture -C existante) pour afficher/masquer le flag "à réclamer à l'assurance" | Requête étroite (colonnes minimales, filtre `type='couverture'`) dupliquant le même accès à `factures` ; à faire vérifier lors de la migration que `listFactures` couvre bien ce filtre par `type`, sinon paramètre à ajouter | `select('id, facture_parent_id, montant_ttc, statut_paiement')` sur `factures`, filtre `.eq('type', 'couverture').not('facture_parent_id', 'is', null)` (pas de jointure) | ✅ `listFactures({type:'couverture'})` — param `type` ajouté à cette occasion |
| `src/pages/secretary/Caisse.jsx:1104-1116` (`fetchFactures`, bloc "payées") | Charger les factures payées en complément du chargement global | Même pattern dupliqué une 3ᵉ fois dans la même fonction | `select` sur `factures` avec jointure `consultations(date_consultation, patients(id, nom, prenom, assurances(nom, taux_remboursement)))`, filtre `.eq('statut_paiement', 'paye')`, tri `date_paiement desc`, `limit(100)` | ✅ `listFactures({statut:'paye'})` |
| `src/pages/secretary/Caisse.jsx:1038-1052` (`fetchFacturesPayees`) | 100 dernières factures payées pour l'onglet "factures payées" | Requête quasiment identique à celle de `fetchFactures` (payées) ci-dessus, dupliquée dans une fonction séparée | Même `select`/jointure que ci-dessus, `.eq('statut_paiement', 'paye')`, tri `date_paiement desc`, `limit(100)` | ✅ `listFactures({statut:'paye'})` |
| `src/pages/caissier/Recapitulatif.jsx:73-91` (`fetchRecap`) | Récupérer les factures de la période (patient, assurance, consultation→médecin) pour le récapitulatif caisse | Jointure imbriquée `consultations.medecin` propre à cette page, dupliquée nulle part ailleurs à l'identique — mais même table/besoin de lecture que `listFactures` | `select` sur `factures` (colonnes montant/statut) avec jointures `patients(...assurances)`, `assurances`, `consultations(id, medecin_id, medecin:medecin_id(id, nom, prenom))`, filtre `.is('facture_parent_id', null)`, filtre optionnel période (`date_facture` gte/lte) et `patient_id` | ✅ `listFactures({excludeCouverture:true,...})` — alias médecin devenu `consultations.users` (pas `.medecin`), tous les points de lecture de la page mis à jour |
| `src/pages/comptabilite/RechercheRapports.jsx:76-96` (`chargerFactures`) | Rechercher les factures selon critères multiples (rapport, export CSV) | Filtre médecin non faisable côté serveur (medecin_id vit sur `consultations`) → filtré en JS après coup, comme documenté dans le code lui-même (commentaire ligne ~105-106) ; `listFactures` centralise ce même contournement | `select` sur `factures` avec jointures `patients`, `assurances`, `consultations(medecin_id, users(...))`, filtres optionnels `date_facture` gte/lte, `statut_paiement`, `assurance_id`, `mode_paiement`, tri `date_facture desc`, `limit(500)` | ⏳ Pas encore migré |
| `src/pages/comptabilite/EncaissementFactures.jsx:63-97` (`fetchFactures`) | Charger les factures pour l'écran de corrections comptables (encaissement manuel) | Page hors périmètre des 14 pages listées par `AUDIT_APPELS_DIRECTS_DB.md` mais repère le même pattern dupliqué une 7ᵉ fois — signalé par les auteurs du service comme cible supplémentaire | `select` sur `factures` avec jointures `patients`, `consultations(medecin_id, users(...))`, filtre `statut_paiement` (dont raccourci `outstanding` = en_attente+partiel) et filtre période (today/week/month) sur `date_facture` | ⏳ Pas encore migré |
| `src/pages/comptabilite/SuiviCaissiers.jsx:65-84` (`fetchData`) | Récupérer les paiements effectués (avec facture) filtrés période/caissier, pour le contrôle lecture seule des caissiers | Même besoin (paiements + jointure facture) que 3 autres endroits de `Caisse.jsx` ; sans service, chaque page réécrit sa propre forme de jointure | `select` sur `paiements` (`id, date_paiement, montant, mode_paiement, statut, caissier_id`) jointure `factures(id, numero_facture, montant_ttc)`, filtre `.eq('statut', 'effectue')`, période optionnelle sur `date_paiement`, filtre `caissier_id`, tri desc, `limit(2000)` | ⏳ Pas encore migré |
| `src/pages/secretary/Caisse.jsx:376-391` (`fetchSupervisionData`) | Récupérer les paiements (avec facture et caissier) pour la vue supervision (admin) | Doublon quasi identique de `SuiviCaissiers.jsx` ci-dessus, avec jointure `users` en plus | `select` sur `paiements` (`*`) jointure `factures(numero_facture, montant_ttc)` + `users!paiements_caissier_id_fkey(nom, prenom)`, filtre `statut='effectue'`, période et `caissier_id` optionnels | ✅ `listPaiements(...)` |
| `src/pages/secretary/Caisse.jsx:474-479` (`calculateTrend`) | Paiements de la période précédente (J-14 à J-7) pour calculer la tendance d'évolution affichée en supervision | Requête `paiements` en lecture simple, dupliquée en forme avec les autres lectures `paiements` du fichier | `select('montant')` sur `paiements`, filtre `statut='effectue'`, `date_paiement` entre J-14 et J-7 (`gte`/`lt`) | ✅ `listPaiements({periode:{debut,fin}})` |
| `src/pages/secretary/Caisse.jsx:585-606` (`fetchDetailsJournee`) | Détail des paiements du jour (facture, consultation, patient, assurance) pour la vérification de fin de journée | Jointure profonde (`paiements→factures→consultations→patients→assurances`) dupliquée avec les fonctions d'historique ci-dessous | `select` sur `paiements` avec jointure imbriquée `factures(id, numero_facture, montant_ttc, consultations(date_consultation, patients(id, nom, prenom, numero_secu, assurances(...))))`, filtre `statut='effectue'`, borné à la journée (`date_paiement` gte/lte), filtre `caissier_id` optionnel, tri asc | 🚫 Laissé natif volontairement (non demandé lors de la migration Caisse.jsx, cf commit `eda98d3`) |
| `src/pages/secretary/Caisse.jsx:522-544` (`fetchEtatCaisse`) | Total journalier et mensuel des paiements effectués pour l'état de la caisse (solde affiché) | Deux requêtes quasi identiques (jour/mois) codées en dur dans la page ; `getTotauxCaisse` les factorise en une seule fonction avec répartition par mode de paiement en prime | Deux `select('*')` sur `paiements`, filtre `statut='effectue'`, l'une bornée au jour courant (`gte` début de journée), l'autre au mois courant (`gte` 1er du mois), filtre `caissier_id` optionnel sur les deux | ✅ `getTotauxCaisse({caissierId})` — testé en navigateur (total mensuel réel affiché) |
| `src/pages/secretary/Caisse.jsx:702-750` (`fetchHistoriquePatient`, branche caissier) | (caissier) reconstituer l'historique des factures payées d'un patient via ses propres paiements | Logique de reconstruction "dédupliquer par facture_id à partir des paiements du caissier" dupliquée à l'identique dans `fetchHistoriqueCouverture` juste en dessous (même fichier) | `select` sur `paiements` (`id, date_paiement, mode_paiement, montant, facture_id`) jointure `factures(..., consultations(date_consultation, patients(..., assurances(...))))`, filtre `caissier_id`, tri desc, `limit(500)`, puis filtrage/dédup en JS sur `patient_id` | ✅ `getHistoriquePatient(id, {caissierId})` |
| `src/pages/secretary/Caisse.jsx:736-749` (`fetchHistoriquePatient`, branche non-caissier) | (non-caissier) factures payées d'un patient donné pour l'historique patient | Même besoin métier que la branche caissier ci-dessus, chemin de requête différent (direct sur `factures`) — les deux branches doivent rester cohérentes, raison de plus pour les centraliser | `select('*')` sur `factures` jointure `consultations(date_consultation, patients(..., assurances(...)))`, filtre `statut_paiement='paye'`, `patient_id`, `facture_parent_id is null`, tri desc, `limit(500)` | ✅ `getHistoriquePatient(id, {caissierId:null})` |
| `src/pages/secretary/Caisse.jsx:913-947` (`fetchHistoriqueCouverture`, branche caissier) | (caissier) reconstituer l'historique des factures payées liées à une couverture (assurance) donnée | Quasi copier-coller de `fetchHistoriquePatient` (branche caissier) avec `assurance_id` à la place de `patient_id` — duplication directe dans le même fichier | `select` sur `paiements` jointure `factures(..., consultations(date_consultation, patients(..., assurance_id, assurances(...))))`, filtre `caissier_id`, tri desc, `limit(1000)`, dédup + filtre `assurance_id` en JS | ✅ `getHistoriqueCouverture(id, {caissierId})` |
| `src/pages/secretary/Caisse.jsx:948-959` (`fetchHistoriqueCouverture`, branche non-caissier) | (non-caissier) toutes les factures payées pour l'historique par couverture | Quasi copier-coller de `fetchHistoriquePatient` (branche non-caissier) | `select('*')` sur `factures` jointure `consultations(date_consultation, patients(..., assurance_id, assurances(...)))`, filtre `statut_paiement='paye'`, `facture_parent_id is null`, tri desc, `limit(1000)`, filtre `assurance_id` en JS | ✅ `getHistoriqueCouverture(id, {caissierId:null})` |

---

## 2. `src/services/sessionCaisseService.js` (nouveau)

Encapsule `sessions_caisse` (ouverture, vérification de session ouverte, alertes) et les RPC `fermer_session_caisse` / `get_arrete_comptable_mensuel`, jusqu'ici dupliquées entre `Caisse.jsx` et `ArreteMensuel.jsx` (recommandation n°2).

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/secretary/Caisse.jsx:344-367` (`fetchSessionCaisse`) | Récupérer la session de caisse ouverte du jour pour le caissier connecté (ou session sans caissier pour le secrétariat) | Même requête refaite deux fois dans le fichier (ici et avant l'ouverture, voir ligne suivante) ; `getSessionOuverte` unifie les deux | `select('*')` sur `sessions_caisse`, filtre `date_session=aujourd'hui`, `statut='ouverte'`, `caissier_id` = valeur donnée ou `is(null)` si absent, `.maybeSingle()` | ✅ Migré + testé (ouverture de caisse en navigateur) |
| `src/pages/secretary/Caisse.jsx:1174-1185` (`handleOpenCaisse`, vérification) | Vérifier qu'aucune session de caisse n'est déjà ouverte avant d'en créer une | Duplique exactement `fetchSessionCaisse` ci-dessus (mêmes filtres) — deux implémentations à maintenir en synchronisation manuelle | `select('id')` sur `sessions_caisse`, mêmes filtres que `fetchSessionCaisse` (`date_session`, `statut='ouverte'`, `caissier_id`), `.maybeSingle()` | ✅ Migré (fusionné dans `ouvrirSession`, erreur `SESSION_DEJA_OUVERTE`) |
| `src/pages/secretary/Caisse.jsx:401-405` (`fetchSupervisionData`) | Récupérer les sessions de caisse ouvertes (alertes de supervision, admin) | Aucun service ne couvrait cette lecture avant `getAlertes` | `select('*')` sur `sessions_caisse`, filtre `.eq('statut', 'ouverte')` (toutes, sans filtre caissier) | ✅ Migré |
| `src/pages/secretary/Caisse.jsx:1194-1204` (`handleOpenCaisse`, insert) | Ouvrir une nouvelle session de caisse avec fond de caisse initial | `ouvrirSession` combine la vérification (ligne 1174 ci-dessus) et l'insert dans une seule fonction transactionnelle côté appelant, évitant la race déjà présente (vérifier puis insérer en deux appels séparés) | `insert` dans `sessions_caisse` (`date_session`, `fond_caisse`, `caissier_id`, `statut: 'ouverte'`), `.select().single()` | ✅ Migré + testé (ouverture réussie, 50 000 FCFA) |
| `src/pages/secretary/Caisse.jsx:1235-1237` (`handleCloseCaisse`) | Fermer une session de caisse (calcul serveur du montant journalier) | RPC simple sans wrapper avant ; centralisé pour rester cohérent avec `getArreteComptableMensuel` qui lit le résultat de ces fermetures | `rpc('fermer_session_caisse', { p_session_id })` | ✅ Migré |
| `src/pages/secretary/Caisse.jsx:1271-1274` (`fetchArreteMensuel`) | Charger l'arrêté comptable mensuel affiché dans le modal d'arrêté (accessible depuis Caisse) | Même RPC appelée à l'identique dans `ArreteMensuel.jsx` (page dédiée) — deux implémentations indépendantes du même appel | `rpc('get_arrete_comptable_mensuel', { p_annee, p_mois })` | ✅ Migré + testé (9 jours de caisse affichés) |
| `src/pages/caissier/ArreteMensuel.jsx:29-32` (`fetchArrete`) | Récupérer l'arrêté comptable mensuel (fonds de caisse, encaissements, solde) pour la page dédiée "Arrêté mensuel" | Duplique exactement l'appel de `Caisse.jsx` ci-dessus — même RPC, mêmes paramètres, deux fichiers | `rpc('get_arrete_comptable_mensuel', { p_annee, p_mois })` | ✅ Migré + testé. Bug trouvé et corrigé au passage : clé React dupliquée (`key={row.date_session}`) quand plusieurs sessions le même jour |

---

## 3. `src/services/caissierService.js` (nouveau)

Encapsule le RPC `get_caissiers`, dupliqué à l'identique dans 2 pages (recommandation n°3).

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/comptabilite/SuiviCaissiers.jsx:60` (`fetchData`) | Récupérer la liste des caissiers (filtre + association nom/username) pour le suivi | RPC appelée sans aucun wrapper, dupliquée à l'identique avec `Caisse.jsx` | `rpc('get_caissiers')`, sans paramètre | ⏳ Pas encore migré |
| `src/pages/secretary/Caisse.jsx:373` (`fetchSupervisionData`) | Récupérer la liste des caissiers pour la vue supervision (admin) | Même RPC, même absence de paramètre, deuxième copie du même appel | `rpc('get_caissiers')`, sans paramètre | ✅ Migré |

---

## 4. `src/services/reversementBancaireService.js` (nouveau)

CRUD basique sur `reversements_bancaires`, table simple sans service avant ce chantier (recommandation n°4) — peu d'appels mais aucune centralisation.

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/caissier/ReversementBancaire.jsx:53-72` (`fetchReversements`) | Lister l'historique des reversements bancaires (avec le caissier qui les a enregistrés) | Aucun service n'existait pour cette table ; seule page qui la lit, mais logique de filtrage période (`gte`/`lte` sur `date_reversement`) qui mérite d'être testée une fois centralisée | `select` sur `reversements_bancaires` (`id, date_reversement, montant, mode, reference_banque, banque_nom, compte_iban, notes, caissier_id`) jointure `users(prenom, nom)`, filtre période optionnel, tri `date_reversement desc`, `limit(500)` | ✅ Migré + testé en navigateur |
| `src/pages/caissier/ReversementBancaire.jsx:97-106` (`handleSubmit`) | Insérer un nouveau reversement bancaire (versement de la caisse vers le compte du cabinet) | Écriture financière sans centralisation ni validation partagée (montant positif, etc.) avant `createReversement` | `insert` dans `reversements_bancaires` (`date_reversement`, `montant`, `mode`, `reference_banque`, `banque_nom`, `compte_iban`, `notes`, `caissier_id`) | ✅ Migré + testé en navigateur (création réelle d'un reversement 15 000 FCFA, ré-apparu dans la liste) |

---

## 5. `src/services/assuranceService.js` (nouveau)

Lecture (et CRUD ajouté en prévision d'un futur écran de paramétrage) sur `assurances`, table sans service avant ce chantier — actuellement lue en dur à 3 endroits avec des colonnes légèrement différentes (recommandation n°4).

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/caissier/Recapitulatif.jsx:58` (chargement initial) | Charger la liste des assurances (filtres, taux remboursement) pour le récapitulatif | Même table lue avec un jeu de colonnes différent à chaque site — `listAssurances({ fields })` normalise via un paramètre plutôt que 3 requêtes divergentes | `select('id, nom, taux_remboursement')` sur `assurances`, tri `nom` | ✅ Migré |
| `src/pages/comptabilite/RechercheRapports.jsx:65` (chargement initial) | Récupérer la liste des assurances pour le filtre de recherche | Idem, colonnes réduites à `id, nom` seulement | `select('id, nom')` sur `assurances`, tri `nom` | ⏳ Pas encore migré |
| `src/pages/secretary/Caisse.jsx:671-683` (`fetchAssurancesList`) | Charger la liste des assurances (taux remboursement) pour le filtre historique couverture | Idem `Recapitulatif.jsx`, 3ᵉ copie de la même lecture | `select('id, nom, taux_remboursement')` sur `assurances`, tri `nom` | ✅ Migré |

*Aucune des pages auditées ne fait de create/update/delete sur `assurances` à ce jour ; `createAssurance`/`updateAssurance`/`deleteAssurance`/`getAssuranceById` n'ont donc pas de site d'appel natif à migrer — ils préparent un futur écran de paramétrage des couvertures qui n'existe pas encore.*

---

## 6. `src/services/referentielService.js` (nouveau — factory)

Factory `createReferentielService({ table, liaisonTable, foreignKey })` + 4 instances (`antecedentsRefService`, `appareilsRefService`, `diagnosticsRefService`, `signesCliniquesRefService`), chacune exposant `list/getById/create/update/remove/syncSpecialites`. Remplace le pattern dupliqué à l'identique (à un renommage de colonne près) dans 4 paires de pages liste+formulaire (recommandation n°5). Attention : distinct de `appareilsService`/`diagnosticsService` (lecture seule, `src/lib/services.js`) qui filtrent par colonne directe `specialite_id` — modèle différent, non réutilisable ici.

**Statut global : ✅ Migration complète des 5 pages (Antecedents/AntecedentsForm/Appareils/Diagnostics/SignesCliniques), testée en navigateur (listes + édition avec sauvegarde réelle testée sur un antécédent).**

### Antécédents (`antecedentsRefService`, table `antecedents` / liaison `antecedents_specialites` / clé `antecedent_id`)

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/parametrage/Antecedents.jsx:66-88` (`fetchAntecedents`) | Charger les antécédents avec leurs spécialités liées pour le tableau de liste | `list()` factorise cette jointure, identique en forme à `appareils`/`diagnostics`/`signes_cliniques` à un nom de table près | `select('*, antecedents_specialites(specialite_id, specialites(id, nom))')` sur `antecedents`, tri `ordre_affichage asc` | ✅ Migré + testé (25 antécédents affichés) |
| `src/pages/parametrage/Antecedents.jsx:98-112` (`handleDelete`) | Supprimer un antécédent | `remove()` factorise ce delete simple, identique en forme aux 3 autres pages | `delete` sur `antecedents`, filtre `.eq('id', id)` | ✅ Migré |
| `src/pages/parametrage/AntecedentsForm.jsx:64-70` (`fetchAntecedent`) | Charger l'antécédent en cours d'édition + récupérer les spécialités déjà liées | `getById()` factorise les 2 requêtes parallèles (`Promise.all`) en une seule fonction | `select('*')` sur `antecedents` filtré par `id` (`.single()`) en parallèle avec `select('specialite_id')` sur `antecedents_specialites` filtré par `antecedent_id` | ✅ Migré + testé (formulaire pré-rempli correctement) |
| `src/pages/parametrage/AntecedentsForm.jsx:137-150` (`handleSubmit`, create/update) | Créer ou mettre à jour un antécédent | `create()`/`update()` remplacent le `if (isEditing) {...} else {...}` dupliqué à l'identique dans les 3 autres pages | `update(dataToSave).eq('id', id)` si édition, sinon `insert([dataToSave]).select('id').single()` sur `antecedents` | ✅ Migré + testé (sauvegarde réelle réussie) |
| `src/pages/parametrage/AntecedentsForm.jsx:154-169` (`handleSubmit`, sync liaisons) | Resynchroniser les spécialités liées à l'antécédent (delete puis insert) | `syncSpecialites()` factorise ce pattern "delete tout, réinsère la sélection" identique dans les 3 autres pages | `delete` sur `antecedents_specialites` filtré `antecedent_id`, puis (si sélection non vide) `insert` des nouvelles paires `{antecedent_id, specialite_id}` | ✅ Migré + testé |

### Appareils (`appareilsRefService`, table `appareils` / liaison `appareils_specialites` / clé `appareil_id`)

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/parametrage/Appareils.jsx:32-43` (chargement liste) | Charger les appareils avec liaisons spécialités pour le tableau | `list()` — même besoin/forme qu'`antecedents`, `diagnostics`, `signes_cliniques` | `select('*, appareils_specialites(specialite_id, specialites(id, nom))')` sur `appareils`, tri `ordre_affichage asc` | ✅ Migré + testé (42 appareils affichés) |
| `src/pages/parametrage/Appareils.jsx:63-66` (`handleSubmit`, create/update) | Mettre à jour un appareil existant / créer un nouvel appareil | `update()`/`create()` — même pattern dupliqué | `update(dataToSave).eq('id', editingId)` si édition, sinon `insert([dataToSave]).select('id').single()` sur `appareils` | ✅ Migré |
| `src/pages/parametrage/Appareils.jsx:72-76` (`handleSubmit`, sync liaisons) | Supprimer puis réinsérer les liaisons spécialités sélectionnées | `syncSpecialites()` — même pattern dupliqué | `delete` sur `appareils_specialites` filtré `appareil_id`, puis `insert` des nouvelles paires | ✅ Migré |
| `src/pages/parametrage/Appareils.jsx:118` (`handleDelete`) | Supprimer un appareil | `remove()` — même pattern dupliqué | `delete` sur `appareils`, filtre `.eq('id', id)` | ✅ Migré |

*Bug préexistant trouvé et corrigé sur cette page : la liste (recherche + tableau) était placée à l'intérieur de `<ParametrageLayout>`, qui ne rend ses enfants que si `showForm` est vrai → liste invisible en permanence sauf pendant l'édition. Sortie du composant (voir commit `7a83fc7`), sans toucher au composant partagé `ParametrageLayout.jsx` (dont `Medecins.jsx`/`Specialites.jsx` dépendent avec un contrat différent).*

### Diagnostics (`diagnosticsRefService`, table `diagnostics` / liaison `diagnostics_specialites` / clé `diagnostic_id`)

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/parametrage/Diagnostics.jsx:43-54` (chargement liste) | Charger les diagnostics avec liaisons spécialités pour le tableau | `list()` — même besoin/forme que les 3 autres référentiels | `select('*, diagnostics_specialites(specialite_id, specialites(id, nom))')` sur `diagnostics`, tri `ordre_affichage asc` | ✅ Migré + testé (41 diagnostics affichés — cette page utilisait déjà `ParametrageList`, pas de bug d'affichage) |
| `src/pages/parametrage/Diagnostics.jsx:76-79` (`handleSubmit`, create/update) | Mettre à jour / créer un diagnostic | `update()`/`create()` — même pattern dupliqué | `update(dataToSave).eq('id', editingId)` si édition, sinon `insert([dataToSave]).select('id').single()` sur `diagnostics` | ✅ Migré |
| `src/pages/parametrage/Diagnostics.jsx:85-89` (`handleSubmit`, sync liaisons) | Supprimer puis réinsérer les liaisons spécialités sélectionnées | `syncSpecialites()` — même pattern dupliqué | `delete` sur `diagnostics_specialites` filtré `diagnostic_id`, puis `insert` des nouvelles paires | ✅ Migré |
| `src/pages/parametrage/Diagnostics.jsx:135` (`handleDelete`) | Supprimer un diagnostic | `remove()` — même pattern dupliqué | `delete` sur `diagnostics`, filtre `.eq('id', id)` | ✅ Migré |

### Signes cliniques (`signesCliniquesRefService`, table `signes_cliniques` / liaison `signes_cliniques_specialites` / clé `signe_clinique_id`)

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/parametrage/SignesCliniques.jsx:46-56` (chargement liste) | Charger les signes cliniques avec liaisons spécialités pour le tableau | `list()` — même besoin/forme que les 3 autres référentiels ; c'est le seul des 4 qui n'avait même pas d'équivalent lecture seule dans `lib/services.js` | `select('*, signes_cliniques_specialites(specialite_id, specialites(id, nom))')` sur `signes_cliniques`, tri `ordre_affichage asc` | ✅ Migré + testé |
| `src/pages/parametrage/SignesCliniques.jsx:76-79` (`handleSubmit`, create/update) | Mettre à jour / créer un signe clinique | `update()`/`create()` — même pattern dupliqué | `update(dataToSave).eq('id', editingId)` si édition, sinon `insert([dataToSave]).select('id').single()` sur `signes_cliniques` | ✅ Migré |
| `src/pages/parametrage/SignesCliniques.jsx:85-89` (`handleSubmit`, sync liaisons) | Supprimer puis réinsérer les liaisons spécialités sélectionnées | `syncSpecialites()` — même pattern dupliqué | `delete` sur `signes_cliniques_specialites` filtré `signe_clinique_id`, puis `insert` des nouvelles paires | ✅ Migré |
| `src/pages/parametrage/SignesCliniques.jsx:131` (`handleDelete`) | Supprimer un signe clinique | `remove()` — même pattern dupliqué | `delete` sur `signes_cliniques`, filtre `.eq('id', id)` | ✅ Migré |

*Même bug d'affichage que `Appareils.jsx` (liste masquée par `<ParametrageLayout>`) trouvé et corrigé sur cette page — voir commit `7a83fc7`.*

*Les 4 `select('id, nom') sur 'specialites'` utilisés par ces pages pour peupler le sélecteur (`AntecedentsForm.jsx:56-60`, `Antecedents.jsx:57-63`, `Appareils.jsx:25`, `Diagnostics.jsx:36`, `SignesCliniques.jsx:39`) ne sont pas couverts par cette factory — ✅ migrés vers `specialtyService.getAll()` (déjà existant) sur les 5 pages.*

---

## 7. `src/services/reportingService.js` (nouveau)

Regroupe le RPC `get_resume_global` et les 7 vues `statistiques_*` (aucune n'avait de service) ainsi que la table `statistiques_realtime` (recommandation n°7).

**Statut global : ⏳ Service créé, mais aucune des 2 pages consommatrices n'a encore été migrée.**

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/reporting/Reporting.jsx:70-73` (`chargerResumeGlobal`) | Résumé global/financier des indicateurs du cabinet sur une période | Aucun service ne couvrait ce RPC avant `getResumeGlobal` | `rpc('get_resume_global', { date_debut, date_fin })` | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:84-89` (`chargerConsultationsSpecialites`) | Statistiques de consultations par spécialité | Aucun service ne couvrait cette vue avant `getStatsParSpecialite` | `select('*')` sur `statistiques_consultations_specialites`, filtre `premiere_consultation` gte / `derniere_consultation` lte | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:99-105` (`chargerConsultationsMedecins`) | Statistiques de consultations par médecin (top 10) | Aucun service ne couvrait cette vue avant `getStatsParMedecin` | `select('*')` sur `statistiques_consultations_medecins`, même filtre de période, `limit(10)` | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:115-119` (`chargerActesTypes`) | Statistiques des actes médicaux par type (top 10) | Aucun service ne couvrait cette vue avant `getStatsActes` | `select('*')` sur `statistiques_actes_types`, filtre `nombre_actes > 0`, `limit(10)` | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:130-133` (`chargerCertificats`) | Statistiques des certificats médicaux émis | Aucun service ne couvrait cette vue avant `getStatsCertificats` | `select('*')` sur `statistiques_certificats`, filtre `nombre_certificats > 0` | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:144-148` (`chargerFinancesSpecialites`) | Chiffre d'affaires par spécialité | Aucun service ne couvrait cette vue avant `getFinancesParSpecialite` | `select('*')` sur `statistiques_finances_specialites`, filtre `nombre_consultations > 0` | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:158-162` (`chargerFinancesMedecins`) | Chiffre d'affaires par médecin (top 10) | Aucun service ne couvrait cette vue avant `getFinancesParMedecin` | `select('*')` sur `statistiques_finances_medecins`, filtre `nombre_consultations > 0`, `limit(10)` | ⏳ Pas encore migré |
| `src/pages/reporting/Reporting.jsx:174-178` (`chargerFinancesActes`) | Revenus par type d'acte (top 10) | Aucun service ne couvrait cette vue avant `getFinancesParActe` | `select('*')` sur `statistiques_finances_actes`, filtre `nombre_actes > 0`, `limit(10)` | ⏳ Pas encore migré |
| `src/pages/rendez-vous/StatistiquesRealtime.jsx:59-84` (`fetchStatistiques`) | Charger les statistiques temps réel filtrées médecin/période | Aucun service ne couvrait cette table avant `getStatistiquesRealtime`, qui reproduit aussi les 3 raccourcis de période (aujourd'hui/semaine/mois) codés en dur dans la page | `select('*')` sur `statistiques_realtime`, tri `date_statistique desc`, filtre optionnel `medecin_id`, filtre optionnel période (`aujourd_hui`/`semaine`/`mois`) traduit en bornes `date_statistique` | ⏳ Pas encore migré |

*Non couverts par ce service (pas de fonction dédiée créée) : l'abonnement temps réel au canal `statistiques_changes` (`StatistiquesRealtime.jsx:25-36`), et les 3 comptages `patients`/`consultations`/`waiting_queue` de `StatistiquesRealtime.jsx:106-108` utilisés pour le temps d'attente moyen — restent des appels natifs à traiter séparément si besoin.*

---

## 8. `src/services/patientPresenceService.js` (nouveau)

Wrapper autour des RPC `secretaire_confirme_patient_presence` et `confirm_patient_entry_basesql`, appelées de façon dupliquée à l'identique à 4 endroits distincts — 2 pages (périmètre de cet audit) + 2 composants partagés (annexe de `AUDIT_APPELS_DIRECTS_DB.md` section 5, hors périmètre "pages" mais même RPC/mêmes paramètres) (recommandation n°8).

**Statut global : 🚫 Hors périmètre de cette migration.** Les 2 pages consommatrices (`IntroductionPatientPage.jsx`, `PriseRendezVousPage.jsx`) font partie du flux secrétaire/prise de RDV que l'utilisateur a explicitement demandé de ne pas toucher (avec `salle-attente`, `secretary`, `dashboard`, `consultation`/`consultation-completion`). Service prêt, migration à faire dans un futur chantier séparé si ce flux est un jour rouvert.

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/IntroductionPatientPage.jsx:653-656` (`handleConfirmPatientPresence`) | Confirmer la présence d'un patient et l'ajouter en salle d'attente | RPC identique appelée à 3 autres endroits (page ci-dessous + 2 composants) avec des paramètres reconstruits indépendamment à chaque fois — risque de divergence déjà réel | `rpc('secretaire_confirme_patient_presence', { p_appointment_id, p_secretaire_id })` | 🚫 Hors périmètre (flux secrétaire) |
| `src/pages/rendez-vous/PriseRendezVousPage.jsx:132-135` (`handleConfirmPatientPresence`) | Confirmer la présence d'un patient et l'ajouter en salle d'attente, depuis l'écran de prise de RDV | Même RPC, mêmes paramètres, 2ᵉ copie du même appel | `rpc('secretaire_confirme_patient_presence', { p_appointment_id, p_secretaire_id })` | 🚫 Hors périmètre (flux secrétaire, `prise-rendez-vous` explicitement exclu) |
| `src/pages/IntroductionPatientPage.jsx:742-745` (`handleConfirmPatientEntry`) | Confirmer l'entrée en consultation d'un patient déjà en file d'attente | RPC identique appelée aussi par `NotificationSystem.jsx` (composant partagé, hors périmètre "pages") | `rpc('confirm_patient_entry_basesql', { p_waiting_queue_id, p_secretaire_id })` | 🚫 Hors périmètre (flux secrétaire) |
| *(hors périmètre "pages", pour mémoire — annexe)* `src/components/secretary/DoctorSpecificQueue.jsx:296` | Confirmer la présence d'un patient depuis le panneau "RDV du jour" du composant de file d'attente médecin | Même RPC/paramètres que `IntroductionPatientPage.jsx:653` et `PriseRendezVousPage.jsx:132` — 3ᵉ copie, à traiter dans la seconde passe "composants" une fois les pages migrées | `rpc('secretaire_confirme_patient_presence', { p_appointment_id, p_secretaire_id })` | 🚫 Hors périmètre |
| *(hors périmètre "pages", pour mémoire — annexe)* `src/components/notifications/NotificationSystem.jsx:258` | Confirmer l'entrée du patient en consultation depuis une notification cliquée | Même RPC/paramètres que `IntroductionPatientPage.jsx:742` — 2ᵉ copie, à traiter dans la seconde passe "composants" | `rpc('confirm_patient_entry_basesql', { p_waiting_queue_id, p_secretaire_id })` | 🚫 Hors périmètre |

---

## 9. `src/lib/services.js` → `userService` (étendu)

Nouvelles fonctions `getSpecialitesByMedecin(medecinId)` et `syncSpecialitesMedecin(medecinId, specialiteIds)`, ajoutées au `userService` déjà existant (recommandation n°9) pour couvrir la lecture/écriture des spécialités **d'un** médecin donné — `getUniqueDoctorSpecialties()` (préexistant) lit la même table `medecin_specialites` mais de façon agrégée tous médecins confondus, ce qui ne répond pas au besoin du formulaire utilisateur.

**Statut global : ⏳ Extension de service prête, page consommatrice pas encore migrée** (non demandé dans ce chantier — `FormulaireUtilisateur.jsx` n'est ni caisse/caissier ni patient/consultation/actes/bcds/paramétrage-référentiel).

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/administration/FormulaireUtilisateur.jsx:226-229` (`fetchUtilisateur`) | Charger les spécialités multiples déjà associées à un médecin, pour préremplir le formulaire d'édition | Aucune fonction de `userService` ne lisait les spécialités d'un médecin unique avant `getSpecialitesByMedecin` | `select('specialite_id, specialites:specialite_id(id, nom)')` sur `medecin_specialites`, filtre `.eq('medecin_id', id)` | ⏳ Pas encore migré |
| `src/pages/administration/FormulaireUtilisateur.jsx:337-340` (`handleSubmit`, création) | Associer les spécialités sélectionnées au médecin qui vient d'être créé | RPC appelée sans wrapper, dupliquée avec le site de modification ci-dessous | `rpc('sync_medecin_specialites', { p_medecin_id, p_specialite_ids })` | ⏳ Pas encore migré |
| `src/pages/administration/FormulaireUtilisateur.jsx:357-360` (`handleSubmit`, modification) | Synchroniser les spécialités d'un médecin existant après modification du formulaire | Même RPC, mêmes paramètres, 2ᵉ copie du même appel dans la même fonction `handleSubmit` | `rpc('sync_medecin_specialites', { p_medecin_id, p_specialite_ids })` | ⏳ Pas encore migré |

---

## 10. `src/services/acteConsultationService.js` (nouveau, hors périmètre initial de cet audit)

Créé pour migrer `src/pages/facturation/Actes.jsx` (table `actes_consultation` + `tarifs_actes` + liste `consultations` pour le formulaire). ⚠️ **Ne pas confondre** avec `src/services/consultation/acteService.js` (préexistant, cible la table différente `actes_medicaux`, non touché).

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/facturation/Actes.jsx` (`fetchData`, consultations) | Peupler le sélecteur de consultations du formulaire | Aucun service ne couvrait `actes_consultation`/`tarifs_actes` | `select` sur `consultations` avec jointures `patients(nom, prenom)`, `users(nom, prenom)`, tri `date_consultation desc` | ✅ Migré (code) — ⚠️ page **orpheline**, voir note ci-dessous |
| `src/pages/facturation/Actes.jsx` (`fetchData`, tarifs) | Charger les tarifs actifs pour le calcul automatique du montant | idem | `select('*')` sur `tarifs_actes`, filtre `.eq('actif', true)` | ✅ Migré (code) |
| `src/pages/facturation/Actes.jsx` (`fetchActes`) | Lister les actes de consultation facturés (jointures patient/médecin/type d'acte) | idem | `select` sur `actes_consultation` avec jointures `consultations(...)`, `types_actes(nom, description)`, tri `created_at desc` | ✅ Migré (code) |
| `src/pages/facturation/Actes.jsx` (`handleSubmit`) | Créer/modifier un acte de consultation facturé | idem | `insert`/`update` sur `actes_consultation` | ✅ Migré (code) |
| `src/pages/facturation/Actes.jsx` (`handleDelete`) | Supprimer un acte de consultation | idem | `delete` sur `actes_consultation`, filtre `.eq('id', id)` | ✅ Migré (code) |

**⚠️ Non vérifiable en navigateur** : `src/pages/facturation/Actes.jsx` est importé dans `App.jsx` (`const ActesPage = lazy(...)`) mais **n'est mappé à aucune `<Route>`** — page orpheline, déjà signalée dans `AUDIT_KPI_NATIFS.md` (liste des fichiers "importés mais jamais montés"). La migration a été vérifiée uniquement par relecture de code (fidélité des select/filtres/jointures à l'original) et par `npm run build` (aucune erreur de compilation), pas par test manuel connecté.

---

## 11. `src/lib/services.js` → `patientService` (étendu, hors périmètre initial de cet audit)

Nouvelle méthode additive `getByIdWithAssurance(id)` ; `getById(id)`/`update(id, data)` existaient déjà et ont juste été branchés là où ils manquaient.

| Page | But | Pourquoi | Ce que faisait l'appel natif | Statut |
|---|---|---|---|---|
| `src/pages/patients/PatientEditPage.jsx` (`loadPatient`) | Charger un patient pour pré-remplir le formulaire d'édition | Correspondance directe avec `patientService.getById()` déjà existant, jamais branché sur cette page | `select('*')` sur `patients`, filtre `.eq('id', id)`, `.single()` | ✅ Migré + testé (formulaire pré-rempli, nom "SALIMATA AGNE" affiché) |
| `src/pages/patients/PatientEditPage.jsx` (`handleSubmit`) | Sauvegarder les modifications d'un patient | Correspondance directe avec `patientService.update()` déjà existant | `update(normalizedFormData)` sur `patients`, filtre `.eq('id', id)` | 🟡 Migré (code) — sauvegarde non exercée de bout en bout : bloquée par une validation client (`validatePatientForm`, format téléphone) sur les données de test du patient utilisé pour le test, sans lien avec la migration (validation préexistante, jamais atteinte côté service) |
| `src/pages/patients/PatientDetailsPage.jsx` (`loadPatient`) | Charger un patient + sa jointure assurance pour la fiche détail | `getById()` existant ne fait pas la jointure `assurances` requise ici → nouvelle méthode additive `getByIdWithAssurance()` | `select` sur `patients` avec jointure `assurances(id, nom, type_assurance, taux_remboursement, description)`, filtre `.eq('id', id)`, `.single()` | ✅ Migré + testé (assurance "AXA Santé 80%" affichée correctement) |

---

## Rappel — nettoyage signalé (non traité par ce chantier)

Comme documenté dans `AUDIT_APPELS_DIRECTS_DB.md` (section 4, recommandation n°10, ~L270) : `invoiceService` (table `invoices`) et `billingService` (table `billing`) dans `src/lib/services.js` ciblent des tables **obsolètes**, différentes de celles réellement utilisées par l'application (`factures`, `paiements`). Ce sont des services fantômes, sans rapport avec `paiementService` ci-dessus. Ce point reste un suivi en attente — aucune action n'a été prise dessus dans ce chantier, il est seulement rappelé ici pour ne pas être perdu de vue lors d'un futur nettoyage.

---

## Prochaine étape

**Fait** (branche `refactor/services-caisse-caissier`, 7 commits, `npm run build` vérifié à chaque étape, testé en navigateur connecté admin/caissier) : `Caisse.jsx`, `Recapitulatif.jsx`, `ArreteMensuel.jsx` (page + modal dans Caisse.jsx), `ReversementBancaire.jsx`, les 4 pages de référentiels de paramétrage (`Antecedents(Form).jsx`, `Appareils.jsx`, `Diagnostics.jsx`, `SignesCliniques.jsx`), plus hors périmètre initial : `facturation/Actes.jsx` (code migré, page orpheline non routée — non testable) et `PatientDetailsPage.jsx`/`PatientEditPage.jsx`.

**Reste à faire**, par priorité décroissante (reprend la logique de `AUDIT_APPELS_DIRECTS_DB.md` section 4, ajustée à ce qui est déjà fait) :
1. `RechercheRapports.jsx` et `EncaissementFactures.jsx` — dernières pages `factures` du module comptabilité encore natives (`paiementService.listFactures`, `assuranceService` pour la première).
2. `SuiviCaissiers.jsx` — `paiementService.listPaiements` + `caissierService.getCaissiers`, dernière page caisse/caissier encore native.
3. `Reporting.jsx` / `StatistiquesRealtime.jsx` — `reportingService`, aucune des 2 pages migrée.
4. `FormulaireUtilisateur.jsx` — extension `userService` (spécialités médecin), non demandée dans ce chantier.
5. `IntroductionPatientPage.jsx` / `PriseRendezVousPage.jsx` (+ seconde passe composants `DoctorSpecificQueue.jsx`/`NotificationSystem.jsx`) — `patientPresenceService`, **volontairement exclu** du périmètre (flux secrétaire/RDV que l'utilisateur a demandé de ne pas toucher) ; à ne reprendre que sur demande explicite.
6. `DoctorDashboard_Fixed.jsx` (annexe, 17 appels directs) — hors périmètre également, même raison (flux médecin/dashboard exclu) ; utilise en partie les mêmes RPC que `patientPresenceService` (`medecin_recoit_patient_simplifie`/`medecin_termine_consultation` n'ont eux aucun service dédié à ce jour).
