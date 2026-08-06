# Documentation des Utilisateurs de Test

## 🏥 Application de Gestion de Cabinet Médical

### Présentation
Application de gestion complète pour cabinet médical et dentaire développée avec React 19, TypeScript, Tailwind CSS et Supabase. L'application supporte le multi-tenancy pour gérer plusieurs cabinets indépendamment.

### Fonctionnalités Principales

#### 📋 Gestion des Patients
- Création et modification de dossiers patients
- Génération automatique des numéros de dossier
- Historique médical complet
- Gestion des assurances mutuelles

#### 👨‍⚕️ Gestion des Consultations
- Création de consultations médicales
- Ajout d'actes médicaux
- Prescription de médicaments
- Gestion des examens et analyses
- Rapports et synthèses

#### 💰 Facturation
- Création de factures
- Gestion des paiements
- Suivi des écarts de caisse
- Impressions de factures et devis

#### 📅 Rendez-vous
- Prise de rendez-vous
- Gestion de la salle d'attente
- Calendrier interactif
- Notifications automatiques

#### 🔔 Notifications
- Notifications en temps réel
- Filtrage par rôle (médecins, secrétaires, caissiers)
- Notifications spécifiques par cabinet

#### ⚙️ Paramétrage
- Gestion des médecins et spécialités
- Configuration des tarifs d'actes
- Gestion des assurances
- Configuration du cabinet

---

## 👥 Utilisateurs de Test par Cabinet

### Cabinet Dentaire Dakar Centre
**Tenant ID**: `d1d62ea1-ca84-4693-ba4d-3d6c67719873`

#### Administrateur
- **Email**: `admin@cabinet-dakar.com`
- **Nom**: Diallo Mamadou
- **Rôle**: Admin
- **Mot de passe**: À définir

#### Caissiers
- **Email**: `moussa.fall@cabinet-dakar.com`
- **Nom**: Fall Moussa
- **Rôle**: Caissier
- **Mot de passe**: `12345678`

#### Médecins (Dentistes)
- **Email**: `dr.habib.diallo@cabinet.com`
- **Nom**: Diallo Habib
- **Rôle**: Médecin
- **Spécialité**: Dentiste généraliste
- **Mot de passe**: `12345678`

- **Email**: `dr.mariama.diallo@cabinet-dakar.com`
- **Nom**: Diallo Mariama
- **Rôle**: Médecin
- **Spécialité**: Orthodontiste
- **Mot de passe**: `12345678`

- **Email**: `dr.ibou.ndiaye@cabinet-dakar.com`
- **Nom**: Ndiaye Ibou
- **Rôle**: Médecin
- **Spécialité**: Chirurgien buccal
- **Mot de passe**: `12345678`

#### Secrétaires
- **Email**: `aissatou.ndoye@cabinet.com`
- **Nom**: Ndoye Aissatou
- **Rôle**: Secrétaire
- **Mot de passe**: `12345678`

#### Comptabilité
- **Email**: `comptabilite@cabinet.com`
- **Nom**: Service Comptabilité
- **Rôle**: Comptabilité
- **Mot de passe**: `12345678`

---

### Cabinet Dentaire Plateau
**Tenant ID**: `a9b69401-8d44-4921-9154-81b4135254f4`

#### Administrateur
- **Email**: `admin@cabinet-plateau.com`
- **Nom**: Ndiaye Fatou
- **Rôle**: Admin
- **Mot de passe**: À définir

#### Caissiers
- **Email**: `aminata.diallo@cabinet-plateau.com`
- **Nom**: Diallo Aminata
- **Rôle**: Caissier
- **Mot de passe**: `12345678`

#### Médecins (Dentistes)
- **Email**: `dr.aicha.ndiaye@cabinet.com`
- **Nom**: Ndiaye Aicha
- **Rôle**: Médecin
- **Spécialité**: Parodontiste
- **Mot de passe**: `12345678`

- **Email**: `dr.aminata.sow@cabinet-plateau.com`
- **Nom**: Sow Aminata
- **Rôle**: Médecin
- **Spécialité**: Endodontiste
- **Mot de passe**: `12345678`

#### Secrétaires
- **Email**: `khadija.diop@cabinet.com`
- **Nom**: Diop Khadija
- **Rôle**: Secrétaire
- **Mot de passe**: `12345678`

---

### Cabinet Médical (Général)
**Tenant ID**: Non configuré (cabinet de test)

#### Administrateurs
- **Email**: `admin@cabinet.com`
- **Nom**: Administrateur System
- **Rôle**: Admin
- **Mot de passe**: À définir

- **Email**: `alice.admin@cabinet.local`
- **Nom**: Admin Alice
- **Rôle**: Admin
- **Mot de passe**: À définir

#### Caissiers
- Jeu réduit: utilisez de préférence les caissiers des cabinets ci-dessus.

#### Médecins
- Jeu réduit: utilisez de préférence les médecins des cabinets ci-dessus.

#### Secrétaires
- Jeu réduit: utilisez de préférence les secrétaires des cabinets ci-dessus.

#### Comptabilité
- **Email**: `comptabilite@cabinet.com`
- **Nom**: Comptabilité Service
- **Rôle**: Comptabilité
- **Mot de passe**: `12345678`

---

## 🔐 Configuration des Mots de Passe

Pour définir les mots de passe des utilisateurs de test, vous pouvez :

1. **Via Supabase Dashboard** :
   - Allez dans Authentication > Users
   - Sélectionnez l'utilisateur
   - Cliquez sur "Reset Password"

2. **Via le script de création d'utilisateurs** :
   ```bash
   npm run create-auth-users
   ```

3. **Mot de passe par défaut utilisé** :
   - Pour les médecins, secrétaires, caissiers et comptables : `12345678`
   - À changer après la première connexion

---

## 🎯 Rôles et Permissions

### Admin
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs
- Configuration du cabinet
- Accès aux rapports et statistiques

### Médecin (Doctor)
- Gestion des consultations
- Prescription de médicaments
- Création d'ordonnances
- Accès au dossier patient
- Facturation

### Secrétaire
- Gestion des rendez-vous
- Gestion de la salle d'attente
- Création de factures
- Gestion des patients
- Notifications

### Caissier
- Enregistrement des paiements
- Gestion de la caisse
- Notifications de paiement
- Impression de reçus

### Comptabilité
- Accès aux rapports financiers
- Gestion des factures
- Suivi des paiements
- Export des données

---

## 📝 Notes Importantes

- L'application utilise le multi-tenancy : chaque cabinet a ses propres données isolées
- Les notifications sont filtrées par rôle et par cabinet
- Les caissiers ne voient que les notifications qui leur sont destinées
- Le filtrage par spécialité est activé pour les cabinets dentaires
- Les mots de passe doivent être sécurisés et changés régulièrement

---

## 🚀 Déploiement

L'application est déployée sur Vercel :
- URL de production : À configurer
- Base de données : Supabase
- Authentification : Supabase Auth

Pour plus d'informations sur le déploiement, consultez le README.md principal.
