# Spécifications Complètes - Application de Gestion de Cabinet Médical

## Vue d'ensemble

Plateforme web de gestion de cabinet médical multi-tenancy avec support de plusieurs spécialités et plusieurs médecins. L'application permet la gestion complète des patients, rendez-vous, consultations, facturations et reporting.

**Technologies** : React 19, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Real-time)

---

## Modules et Profils

### 1. Module Paramétrage (Profil Administrateur)

#### 1.1 Gestion des Spécialités
- **SpécialitésForm.jsx** : Création et modification des spécialités médicales
- **Specialites.jsx** : Liste des spécialités avec gestion hiérarchique (parent/enfant)
- Support des spécialités dentaires (Dentiste, Chirurgien buccal, Endodontiste, Orthodontiste, Parodontiste, Pédodontiste, Prosthodontiste, Dentiste généraliste)
- Filtrage par spécialité pour les cabinets dentaires

#### 1.2 Gestion des Médecins
- **Medecins.jsx** : Liste des médecins avec filtres
- **MedecinsForm.jsx** : Formulaire de création/modification de médecins
- Association de plusieurs spécialités par médecin
- Génération automatique du nom d'utilisateur (prenom.nom)
- Gestion des statuts (actif/inactif)

#### 1.3 Gestion des Utilisateurs (FormulaireUtilisateur.jsx)
- **Profils** : Administrateur, Médecin, Secrétaire, Caissier, Comptabilité
- Formulaire réorganisé en 4 sections :
  - Informations Personnelles (Prénom, Nom, Email, Téléphone)
  - Informations de Compte (Nom d'utilisateur, Rôle, Mot de passe)
  - Spécialités (pour médecins uniquement)
  - Statut (Utilisateur actif)
- Filtrage des spécialités dentaires pour les médecins
- Empêcher la sélection de la spécialité principale comme spécialité additionnelle

#### 1.4 Tables de Paramétrage

**Antécédents Médicaux**
- **Antecedents.jsx** : Gestion des antécédents médicaux
- **AntecedentsForm.jsx** : Formulaire d'antécédents
- **CategoriesAntecedents.jsx** : Catégories d'antécédents
- **TypesAntecedents.jsx** : Types d'antécédents

**Constantes et Signes Cliniques**
- **Constantes.jsx** : Table des constantes (tension, température, poids, taille, etc.)
- **SignesCliniques.jsx** : Table des signes cliniques
- **PlaintesPrincipales.jsx** : Plaintes principales des patients
- **TypesSymptomes.jsx** : Types de symptômes

**Examens et Appareils**
- **Appareils.jsx** : Table des appareils pour les consultations
- **ExamenMedicalPage.jsx** : Page d'examen médical complet

**Synthèse et Diagnostics**
- **ElementsSynthese.jsx** : Éléments de synthèse de consultation
- **Diagnostics.jsx** : Table des diagnostics possibles

**Médicaments et Prescriptions**
- **Medicaments.jsx** : Table des médicaments avec posologie par défaut
- **PrescriptionsPage.jsx** : Gestion des prescriptions

**Certificats Médicaux**
- **TypesCertificats.jsx** : Types de certificats médicaux avec durée par défaut

**Actes Médicaux**
- **TypesActes.jsx** : Table des types d'actes médicaux avec tarifs
- Association des actes aux spécialités
- Nettoyage des doublons d'actes

**Assurances et Couvertures**
- **Assurances.jsx** : Table des assurances acceptées
- **TypeCouvertureMedicale.jsx** : Types de couverture médicale
- **TiersPayant.jsx** : Gestion des tiers payants
- **Employeurs.jsx** : Gestion des employeurs

**Autres Paramètres**
- **ParametresCabinet.jsx** : Configuration du cabinet (nom, logo, coordonnées, horaires)
- **ToothStatesPage.jsx** : États des dents (pour cabinets dentaires)
- **FamillesArchives.jsx** : Familles d'archives
- **ListeArchives.jsx** : Liste des archives
- **TypesArchives.jsx** : Types d'archives
- **ListeEtiologies.jsx** : Liste des étiologies

#### 1.5 Gestion Administrative
- **ParametragePage.jsx** : Page principale de paramétrage
- **GestionAdmins.jsx** : Gestion des administrateurs
- **GestionSecretaires.jsx** : Gestion des secrétaires
- **GestionMedecins.jsx** : Gestion des médecins
- **GestionCaissiers.jsx** : Gestion des caissiers
- **GestionComptables.jsx** : Gestion des comptables
- **GestionUtilisateurs.jsx** : Gestion globale des utilisateurs
- **PersonnalisationMain.jsx** : Personnalisation de l'application
- **PersonnalisationGeneral.jsx** : Informations administratives
- **PersonnalisationApparence.jsx** : Apparence de l'application
- **PersonnalisationDocuments.jsx** : Personnalisation des documents
- **CanalProvenance.jsx** : Canaux de provenance des patients
- **Professions.jsx** : Professions des patients
- **ListeProduits.jsx** : Liste des produits
- **PosologieProduits.jsx** : Posologie des produits
- **ListePeriodes.jsx** : Liste des périodes

---

### 2. Module Rendez-vous (Profil Secrétaire/Assistante)

#### 2.1 Fiche Patient
- **FichePatient.jsx** : Fiche patient simplifiée
- **FichePatientRdv.jsx** : Fiche patient pour rendez-vous
- **IntroductionPatientPage.jsx** : Page d'introduction du patient
- **FicheIdentificationPage.jsx** : Fiche d'identification
- **PatientForm.jsx** : Formulaire patient
- **Patients.jsx** : Liste des patients
- **MesPatients.jsx** : Mes patients (pour médecins)

**Informations du patient** :
- Identification (nom, prénom, date de naissance, sexe)
- Contacts (téléphone, email, adresse)
- Antécédents médicaux
- Allergies
- Assurance mutuelle
- Génération automatique du numéro de dossier

#### 2.2 Prise de Rendez-vous
- **PriseRendezVous.jsx** : Prise de rendez-vous
- **PriseRendezVousPage.jsx** : Page de prise de rendez-vous
- **RechercheRendezVousPage.jsx** : Recherche de rendez-vous
- **GlobalCalendar.jsx** : Calendrier global

**Fonctionnalités** :
- Choix de la spécialité et du mois
- Tableau affichant les dates en ligne et les médecins en colonne
- Affichage des rendez-vous déjà calés aux intersections
- Clic sur les intersections libres pour définir un nouveau rendez-vous
- Indication du patient et des raisons de la demande
- Validation du rendez-vous

#### 2.3 Rappels SMS
- **RappelsSMS.jsx** : Gestion des rappels SMS
- **RappelsSmsPage.jsx** : Page de rappels SMS
- Tableau des rendez-vous du jour et de la veille
- Possibilité d'envoyer un SMS de rappel aux patients

#### 2.4 Salle d'Attente
- **SalleAttente.jsx** : Gestion de la salle d'attente
- **WaitingQueuePage.jsx** : File d'attente principale
- **MyWaitingQueuePage.jsx** : File d'attente du médecin
- **SalleAttentePage.jsx** : Page de salle d'attente

**Fonctionnalités** :
- Indication de l'arrivée du patient par l'accueil
- Notification automatique au médecin concerné
- Scan et chargement des documents d'analyses ou d'imagerie dans le dossier patient
- Notification de disponibilité du médecin
- Réception de l'information par l'accueil pour faire entrer le patient

#### 2.5 Notifications en Temps Réel
- **NotificationsRealtime.jsx** : Notifications en temps réel
- **StatistiquesRealtime.jsx** : Statistiques en temps réel

---

### 3. Module Consultation (Profil Médecin)

#### 3.1 Consultations
- **Consultations.jsx** : Liste des consultations
- **ConsultationDetail.jsx** : Détails de la consultation
- **ExamenMedicalPage.jsx** : Page d'examen médical

#### 3.2 Antécédents
- Visualisation des antécédents du patient
- Ajout d'antécédents à partir de la table des antécédents possibles
- Gestion des catégories d'antécédents

#### 3.3 Examen Médical

**Constantes**
- Prise des constantes du patient (tension, température, poids, taille, etc.)
- Enregistrement des mesures prises

**Examen Général**
- Examen général du patient
- Consultation des résultats d'analyse ou d'imagerie
- Enregistrement des signes cliniques constatés

**Examen des Appareils**
- Auscultation des appareils du patient
- Enregistrement des constats pour chaque appareil

**Synthèse**
- Synthèse de la consultation
- Enregistrement des signes cliniques justifiant la consultation

**Autres Signes**
- Enregistrement de commentaires pour mémoire

#### 3.4 Prescriptions

**Diagnostic (Maladies)**
- Description et enregistrement du diagnostic
- Sélection d'un ou plusieurs éléments de la table des diagnostics
- Commentaire pour chaque élément sélectionné

**Thérapeutique (Ordonnance)**
- Prescription de l'ordonnance thérapeutique
- Sélection des médicaments à partir de la table des médicaments
- Posologie par défaut proposée (modifiable)
- Quantité par défaut de 1 (modifiable)

**Administrative (Certificats Médicaux)**
- Attribution de certificats médicaux
- Sélection dans la liste de la table des certificats médicaux
- Durée par défaut affichée (modifiable)

#### 3.5 Historique et Archives
- **HistoriquesArchivesPage.jsx** : Page des historiques et archives
- **MedicalRecordsPage.jsx** : Dossiers médicaux
- **BcdsPage.jsx** : Page BCDs

---

### 4. Module Facturation (Profil Comptable/Caissier)

#### 4.1 Actes Médicaux
- **Actes.jsx** : Gestion des actes médicaux
- **FacturationActes.jsx** : Facturation des actes
- Indication des types d'actes pratiqués lors de la consultation
- Restriction à la spécialité de la consultation
- Tarif défini pour chaque acte

#### 4.2 Examens Complémentaires
- **Examens.jsx** : Gestion des examens
- **FacturationExamens.jsx** : Facturation des examens
- Prescription des examens complémentaires à réaliser

#### 4.3 Analyses de Laboratoire
- **Labo.jsx** : Gestion des analyses labo
- **FacturationLabo.jsx** : Facturation des analyses
- Prescription des analyses complémentaires

#### 4.4 Pharmacie
- **Pharmacie.jsx** : Gestion de la pharmacie
- **FacturationPharmacie.jsx** : Facturation de la pharmacie
- Prescription des produits pharmaceutiques

#### 4.5 Divers
- **Divers.jsx** : Gestion des instructions diverses
- Instructions textuelles à traiter par l'accueil
- Prise de prochain rendez-vous

#### 4.6 Factures
- **Factures.jsx** : Gestion des factures
- **FacturationFactures.jsx** : Facturation principale
- Génération de facture sur la base des actes inscrits
- Tarif défini pour l'acte
- Quantité par défaut de 1

#### 4.7 Paiement
- Indication du montant payé
- Édition de la facture
- Cachet avec mention PAYEE
- Remise au patient
- Modes de paiement :
  - Espèces
  - Assurance (sélection parmi la table des assurances)
  - Carte (numéro de carte)
  - Monnaie électronique (émetteur)
  - Chèque
  - Virement

#### 4.8 Gestion de Caisse (Secrétaire)
- **Caisse.jsx** : Gestion complète de la caisse
- Enregistrement des paiements
- Suivi des écarts de caisse
- Gestion des devis
- Impression de reçus
- Notifications caissier (paiement effectué, consultation terminée, écart caisse)

#### 4.9 Fonctionnalités Caissier
- **ArreteMensuel.jsx** : Arrêté mensuel
- **Recapitulatif.jsx** : Récapitulatif
- **Relances.jsx** : Relances
- **ReversementBancaire.jsx** : Reversement bancaire

---

### 5. Module Reporting (Profil Gestionnaire)

#### 5.1 Statistiques
- **StatisticsPage.jsx** : Page de statistiques
- **Reporting.jsx** : Rapports principaux

**Statistiques Consultations**
- Nombre de consultations par spécialité
- Nombre de consultations par médecin
- Nombre d'actes par type d'actes
- Durée moyenne des consultations par type d'acte
- Durée moyenne des consultations par médecin
- Nombre de certificats médicaux

#### 5.2 Finances
- Montant des consultations par spécialité
- Montant de consultations par médecin
- Montant des actes par type d'actes

#### 5.3 Rapports Comptables
- **RapportsFinanciers.jsx** : Rapports financiers
- **TableauBordComptable.jsx** : Tableau de bord comptable
- **EncaissementFactures.jsx** : Encaissement des factures
- **AlertesImpayes.jsx** : Alertes impayés
- **RechercheAvancee.jsx** : Recherche avancée
- **SuiviCaissiers.jsx** : Suivi des caissiers
- **HistoriquePatient.jsx** : Historique patient

---

### 6. Fonctionnalités Supplémentaires

#### 6.1 Multi-Tenancy (Single Database)
- Support de plusieurs cabinets indépendants dans une **seule base de données**
- Filtrage des données par tenant_id pour isoler les données de chaque cabinet
- Configuration par cabinet (parametres_cabinet)
- Gestion des utilisateurs par cabinet
- Politiques de sécurité (RLS) pour garantir l'isolation des données

#### 6.2 Notifications
- **Notifications en temps réel** via Supabase Real-time
- Filtrage par rôle (médecins, secrétaires, caissiers)
- Filtrage par tenant_id
- Types de notifications :
  - Nouveau rendez-vous
  - Patient arrivé
  - Consultation terminée
  - Paiement effectué
  - Écart de caisse
  - Notification médecin-secrétaire

#### 6.3 Authentification et Sécurité
- **Login.jsx** : Page de connexion
- **Register.jsx** : Page d'inscription
- **ResetPassword.jsx** : Réinitialisation du mot de passe
- **Profile.jsx** : Profil utilisateur
- Gestion des rôles et permissions
- Politiques de sécurité (RLS) Supabase
- Edge functions pour la gestion des utilisateurs

#### 6.4 Dashboard
- **Dashboard.jsx** : Tableau de bord principal
- **AccountingDashboard.jsx** : Dashboard comptabilité
- **CabinetWelcome.jsx** : Page d'accueil du cabinet
- **CabinetWelcomePublic.jsx** : Page d'accueil publique

#### 6.5 Gestion des Patients
- **Patients.jsx** : Liste des patients
- **PatientForm.jsx** : Formulaire patient
- **FicheIdentificationPage.jsx** : Fiche d'identification
- **IntroductionPatientPage.jsx** : Introduction du patient
- Génération automatique du numéro de dossier (format séquentiel XXXXXX)
- Historique médical complet

#### 6.6 Impression et Documents
- Impression d'ordonnances
- Impression de certificats médicaux
- Impression de factures
- Impression de devis
- Impression de rapports
- Personnalisation des documents (logo, en-tête, couleurs)

#### 6.7 Calendrier
- **GlobalCalendar.jsx** : Calendrier global
- **AppointmentsPage.jsx** : Page des rendez-vous
- Gestion des créneaux horaires
- Vue mensuelle/semaine/jour

#### 6.8 Spécifique Dentaire
- **DentalChartPage.jsx** : Page du dentaire (charte dentaire)
- **DentalChartPageV2.jsx** : Version 2 de la charte dentaire
- **ToothStatesPage.jsx** : États des dents
- Gestion des spécialités dentaires
- Filtrage par spécialité dentaire

#### 6.9 Scan de Documents
- **ScanDocuments.jsx** : Scan de documents
- Chargement des résultats d'analyses
- Chargement des scans d'imagerie
- Stockage dans le dossier patient

#### 6.10 Gestion des Consultations Terminées
- **ConsultationCompletion.jsx** : Finalisation des consultations
- **ConsultationsTerminees.jsx** : Liste des consultations terminées

---

## Rôles et Permissions

### Administrateur
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs
- Configuration du cabinet
- Paramétrage complet
- Accès aux rapports et statistiques

### Médecin (Doctor)
- Gestion des consultations
- Prescription de médicaments
- Création d'ordonnances
- Accès au dossier patient
- Facturation
- Visualisation de sa file d'attente
- Notifications de rendez-vous et patients

### Secrétaire
- Gestion des rendez-vous
- Gestion de la salle d'attente
- Création de factures
- Gestion des patients
- Gestion de la caisse
- Notifications (médecin-secrétaire)

### Caissier
- Enregistrement des paiements
- Gestion de la caisse
- Notifications de paiement
- Impression de reçus
- Suivi des écarts de caisse
- Arrêté mensuel

### Comptabilité
- Accès aux rapports financiers
- Gestion des factures
- Suivi des paiements
- Export des données
- Tableau de bord comptable
- Alertes impayés

---

## Base de Données

### Architecture
- **Single Database** : Une seule base de données PostgreSQL hébergeant tous les cabinets
- **Multi-Tenancy** : Isolation des données par tenant_id
- **Politiques de sécurité (RLS)** : Garantissent que chaque cabinet n'accède qu'à ses propres données

### Tables Principales
- **users** : Utilisateurs avec authentification et tenant_id
- **patients** : Dossiers patients avec tenant_id
- **consultations** : Consultations médicales avec tenant_id
- **actes_medicaux** : Actes pratiqués avec tenant_id
- **factures** : Factures avec tenant_id
- **lignes_facture** : Lignes de facture
- **rendez_vous** : Rendez-vous avec tenant_id
- **specialites** : Spécialités médicales (partagées)
- **types_actes** : Types d'actes avec association aux spécialités
- **medicaments** : Médicaments
- **antecedents** : Antécédents
- **signes_cliniques** : Signes cliniques
- **diagnostics** : Diagnostics
- **certificats** : Certificats médicaux
- **assurances** : Assurances
- **parametres_cabinet** : Configuration du cabinet (inclut tenant_id)
- **parametres_plateforme** : Configuration de la plateforme (globale)
- **notifications_medecin_secretaire** : Notifications avec tenant_id
- **medecin_specialites** : Association médecins-spécialités
- **types_actes_specialites** : Association actes-spécialités

### Fonctionnalités Avancées
- Politiques de sécurité (RLS) pour l'isolation multi-tenancy
- Triggers pour automatisation
- Vues pour les rapports
- Fonctions RPC (sync_medecin_specialites, etc.)

---

## Déploiement

- **Frontend** : Vercel
- **Backend** : Supabase
- **Base de données** : PostgreSQL sur Supabase
- **Authentification** : Supabase Auth
- **Real-time** : Supabase Real-time
- **Stockage** : Supabase Storage (documents, images)

---

## Fonctionnalités Non Présentes dans le Document Original

1. **Multi-Tenancy** : Support de plusieurs cabinets indépendants
2. **Notifications en temps réel** : Système de notifications avancé
3. **Gestion de la caisse** : Module complet de gestion de caisse pour les secrétaires
4. **Module Caissier** : Rôle spécifique pour les caissiers avec fonctionnalités dédiées
5. **Scan de documents** : Numérisation et stockage de documents médicaux
6. **Charte dentaire** : Module spécifique pour les cabinets dentaires
7. **Personnalisation avancée** : Personnalisation de l'apparence et des documents
8. **Gestion des archives** : Système d'archivage des dossiers
9. **Tableau de bord comptable** : Dashboard spécifique pour la comptabilité
10. **Alertes impayés** : Système d'alertes pour les factures impayées
11. **Suivi des caissiers** : Monitoring des opérations des caissiers
12. **Arrêté mensuel** : Fonctionnalité de clôture mensuelle
13. **Reversement bancaire** : Gestion des reversements
14. **Relances** : Système de relance des patients
15. **Calendrier global** : Vue globale des rendez-vous
16. **Génération automatique du numéro de dossier** : Numérotation séquentielle
17. **Filtrage par spécialité** : Filtrage automatique des données par spécialité
18. **Gestion des tiers payants** : Support des tiers payants
19. **Gestion des employeurs** : Suivi des employeurs des patients
20. **États des dents** : Gestion détaillée de l'état dentaire

---

## Conclusion

L'application de gestion de cabinet médical offre une solution complète et moderne pour la gestion des cabinets médicaux et dentaires. Elle intègre toutes les fonctionnalités décrites dans le cahier des charges initial, tout en ajoutant de nombreuses fonctionnalités avancées pour améliorer l'expérience utilisateur et la gestion quotidienne du cabinet.

L'architecture multi-tenancy permet de gérer plusieurs cabinets indépendamment, tandis que le système de notifications en temps réel assure une communication fluide entre les différents acteurs du cabinet. La personnalisation avancée permet d'adapter l'application à l'identité de chaque cabinet.
