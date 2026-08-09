# Cabinet Médical - Application de Gestion

## 🏥 Vue d'         
                 

Logiciel de gestion de cabinet médical complet développé avec React, Tailwind CSS et Supabase.

## 🚀 Technologies utilisées

- **Frontend** : React, Tailwind CSS, Lucide React
- **Backend** : Supabase (PostgreSQL, Auth, Real-time)
- **Routing** : React Router DOM
- **Build** : Vite

## 📁 Structure du projet

```
src/
├── components/          # Composants réutilisables
│   ├── common/         # Composants communs (Modal, Form, Alert, etc.)
│   ├── consultation/   # Composants de consultation
│   ├── calendar/       # Composants de calendrier
│   ├── secretary/      # Composants pour secrétaires
│   └── ...
├── pages/              # Pages de l'application
│   ├── parametrage/    # Module Paramétrage
│   ├── administration/ # Module Administration
│   ├── consultation/   # Module Consultation
│   ├── rendez-vous/    # Module Rendez-vous
│   ├── facturation/    # Module Facturation
│   ├── patients/       # Module Patients
│   ├── secretary/      # Module Secrétariat
│   ├── doctor/         # Module Médecin
│   ├── caissier/       # Module Caisse
│   ├── comptabilite/   # Module Comptabilité
│   └── reporting/      # Module Reporting
├── contexts/           # Contextes React
│   └── AuthContext.jsx # Gestion de l'authentification
├── services/           # Services et API
├── utils/              # Utilitaires
└── lib/                # Bibliothèques et configurations
    └── supabase.js     # Configuration Supabase
```

## 🎯 Principales fonctionnalités de la plateforme

### 📋 **Paramétrage**

#### Couverture et Tiers
- ✅ Type de couverture médicale
- ✅ Tiers payant
- ✅ Employeurs

#### Personnel et Spécialités
- ✅ Spécialités (avec gestion des spécialités multiples pour médecins)
- ✅ Médecins
- ✅ Professions

#### Données médicales
- ✅ Liste des maladies
- ✅ Liste des étiologies
- ✅ Catégorie d'antécédents
- ✅ Types d'antécédents
- ✅ Plaintes principales
- ✅ Examens – Diagnostic
- ✅ Types de symptômes
- ✅ Annuaire des Actes et tarifs
- ✅ Liste des vaccins
- ✅ Types de certificats

#### Archives
- ✅ Familles d'archives
- ✅ Types d'archives
- ✅ Liste des archives

#### Autres paramètres
- ✅ Assurances
- ✅ Constantes médicales
- ✅ Signes cliniques
- ✅ Appareils
- ✅ Diagnostics
- ✅ Éléments de synthèse
- ✅ Types d'actes
- ✅ Médicaments
- ✅ Paramètres du cabinet

### 👥 **Administration**

#### Gestion des utilisateurs
- ✅ Gestion des utilisateurs
- ✅ Gestion des médecins
- ✅ Gestion des secrétaires
- ✅ Gestion des caissiers
- ✅ Gestion des comptables
- ✅ Gestion des administrateurs

#### Configuration
- ✅ Professions
- ✅ Canal de provenance
- ✅ Liste des périodes
- ✅ Liste des produits
- ✅ Posologie des produits
- ✅ Personnalisation de l'apparence
- ✅ Personnalisation des documents
- ✅ Paramètres généraux

### 🩺 **Workflow**

#### Fiche d'identification
- ✅ Fiche d'identification patient
- ✅ Gestion des dossiers patients
- ✅ Numéro de dossier automatique et unique

#### Rendez-vous
- ✅ Prise de rendez-vous
- ✅ Gestion de la salle d'attente
- ✅ Rappels SMS
- ✅ Recherche de rendez-vous
- ✅ Statistiques en temps réel
- ✅ Notifications en temps réel
- ✅ Scan de documents

#### Introduction patient
- ✅ Date, début, fin (automatiques)
- ✅ Rappel des antécédents (BDD) et ajout d'antécédents
- ✅ Plainte principale (liste)
- ✅ Autres plaintes, Contexte

#### Examen médical
- ✅ Constantes
- ✅ Examen général (listes)
- ✅ Autres signes physiques
- ✅ Examen des appareils (Couples de listes Examen-Symptômes)
- ✅ Synthèse (Triplets de listes Maladie – Spécialité – Etiologie)

#### Prescription
- ✅ Diagnostic
  - Biologie
  - Imagerie
  - Anatomo
  - Endoscopie
  - Autres examens
- ✅ Thérapeutique
  - Ordonnance
  - Soins sur place
  - Autres prescriptions
- ✅ Administrative
  - Certificats

#### Actes
- ✅ Soins réalisés
- ✅ Vaccinations
- ✅ Factures

#### Historiques et Archives
- ✅ Historique des consultations
- ✅ Archives médicales

### 💰 **Facturation**

- ✅ Édition de factures
- ✅ Règlement
- ✅ Relances
- ✅ Gestion des actes
- ✅ Gestion des examens
- ✅ Gestion des analyses labo
- ✅ Gestion de la pharmacie
- ✅ Facturation par actes
- ✅ Facturation par examens
- ✅ Facturation par labo
- ✅ Facturation par pharmacie

### 📊 **Tableaux de bord**

- ✅ Tableau de bord principal
- ✅ Statistiques en temps réel
- ✅ Graphiques financiers

### 📈 **Statistiques**

- ✅ Statistiques de consultation
- ✅ Statistiques financières
- ✅ Reporting
- ✅ Rapports personnalisés

## 🔐 Authentification et rôles

- **Admin** : Accès complet à toutes les fonctionnalités
- **Médecin** : Accès aux modules médicaux, consultation et facturation
- **Secrétaire** : Accès aux modules de gestion, rendez-vous et facturation
- **Caissier** : Accès au module de facturation et règlement
- **Comptable** : Accès au module comptabilité et reporting

## 🎨 Interface utilisateur

- Design moderne avec Tailwind CSS
- Interface responsive
- Navigation intuitive avec sidebar
- Affichage des spécialités au lieu des noms de médecins (pour cabinet dentaire)
- Gestion des médecins avec plusieurs spécialités
- Notifications en temps réel
- Calendrier interactif

## 📊 Base de données

Base de données PostgreSQL sur Supabase avec :
- Tables pour patients, consultations, factures, rendez-vous
- Politiques de sécurité (RLS)
- Triggers pour automatisation
- Vues pour les rapports
- Numéros de dossier uniques et séquentiels

## 🚀 Installation et démarrage

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build pour production
npm run build
```

## 🔧 Configuration

1. Configurer les variables d'environnement Supabase
2. Importer les migrations SQL
3. Configurer les politiques RLS
4. Exécuter les scripts de uniformisation des numéros de dossier

## 📝 Notes de développement

- Projet nettoyé et optimisé
- Structure modulaire et maintenable
- Gestion des numéros de dossier automatique et unique
- Affichage des spécialités priorisé pour les médecins
- Support des médecins avec plusieurs spécialités
- Système de notifications en temps réel
- Gestion complète du workflow médical

## 🎯 Fonctionnalités récentes

- ✅ Génération automatique de numéros de dossier uniques
- ✅ Affichage des spécialités au lieu des noms de médecins
- ✅ Support des médecins avec plusieurs spécialités
- ✅ Correction de l'erreur 409 lors de la création de patients
- ✅ Système de notifications en temps réel avec WebSockets
- ✅ Gestion de la salle d'attente en temps réel



