# Implementation: Système de Notifications Médecin-Secrétaire

## Vue d'ensemble

Ce document décrit l'implémentation du système de notifications en temps réel entre les interfaces médecin et secrétaire pour la gestion des patients en salle d'attente.

## Fonctionnalités Implémentées

### 1. Interface Médecin (MyWaitingQueuePage.jsx)

**Emplacement:** `src/pages/MyWaitingQueuePage.jsx`

**Fonctionnalités:**
- Affichage en temps réel de la liste des patients en attente
- Informations affichées pour chaque patient:
  - Nom et prénom
  - Heure d'arrivée
  - Numéro de dossier
  - Ordre d'arrivée (position)
  - Téléphone
- Bouton "Introduire" à côté de chaque patient en attente
- Le clic sur "Introduire" déclenche une notification automatique vers la secrétaire

**Message de notification envoyé:**
```
"Dr. [Prénom Nom] demande à introduire [Patient Prénom Nom]"
```

**Statut du patient après clic:** `waiting` → `called`

### 2. Interface Secrétaire (IntroductionPatientPage.jsx)

**Emplacement:** `src/pages/IntroductionPatientPage.jsx`

**Composant de notifications:** `src/components/introduction/NotificationPanel.jsx`

**Fonctionnalités:**
- Réception en temps réel des notifications du médecin
- Affichage du message: "Le Dr. X demande à introduire Y"
- Deux options disponibles pour chaque notification:
  1. **Confirmer** (bouton vert) - La secrétaire va chercher le patient
  2. **Reporter** (bouton orange) - Remet le patient en attente

**Actions lors de la confirmation:**
- Marque la notification comme lue
- Met le patient en statut `en_route` (patient appelé vers le médecin)
- Envoie une notification au médecin: "Le patient X est en route"
- Rafraîchit la file d'attente

**Actions lors du report:**
- Marque la notification comme lue
- Remet le patient en statut `waiting` (en attente)
- Rafraîchit la file d'attente

### 3. Transitions de Statut des Patients

```
en_attente (waiting)
    ↓ [Médecin clique "Introduire"]
appelé (called)
    ↓ [Secrétaire clique "Confirmer"]
en_route (en_route)
    ↓ [Patient arrive chez le médecin]
présent (present)
    ↓ [Médecin commence consultation]
en_consultation (in_consultation)
    ↓ [Médecin termine consultation]
terminé (finished)
```

## Architecture Technique

### Base de Données

**Table:** `notifications_medecin_secretaire`

**Colonnes principales:**
- `id` - Identifiant unique
- `medecin_id` - ID du médecin (expéditeur)
- `secretaire_id` - ID de la secrétaire (destinataire)
- `type_notification` - Type de notification ('patient_ready', 'patient_on_way', etc.)
- `message` - Message de notification
- `waiting_queue_id` - ID de l'entrée dans la file d'attente
- `patient_id` - ID du patient
- `lu` - Statut de lecture (true/false)
- `created_at` - Date de création
- `tenant_id` - ID du cabinet (pour multi-tenancy)

### Notifications en Temps Réel

**Technologie:** Supabase Realtime (WebSocket)

**Abonnements:**
- Médecin: Écoute les notifications de type `patient_on_way`
- Secrétaire: Écoute les notifications de type `patient_ready`

**Service de notifications:** `src/lib/notifications.js`

**Types de notifications:**
```javascript
NOTIFICATION_TYPES = {
  PATIENT_READY: 'patient_ready',         // Médecin → Secrétaire
  PATIENT_ON_WAY: 'patient_on_way',       // Secrétaire → Médecin
  CONSULTATION_ENDED: 'consultation_ended',
  FACTURATION_COMPLETE: 'facturation_complete',
  // ...
}
```

## Workflow Complet

### Scénario 1: Flux Normal

1. **Patient arrive** → Ajouté à la file d'attente (statut: `waiting`)
2. **Médecin voit patient** → Clique "Introduire"
3. **Notification envoyée** → "Dr. X demande à introduire Y"
4. **Secrétaire reçoit notification** → Voit message avec 2 options
5. **Secrétaire clique "Confirmer"** → 
   - Patient passe en statut `en_route`
   - Notification envoyée au médecin: "Le patient Y est en route"
6. **Patient arrive chez médecin** → Statut `present`
7. **Médecin commence consultation** → Statut `in_consultation`

### Scénario 2: Report

1. **Patient arrive** → Ajouté à la file d'attente (statut: `waiting`)
2. **Médecin voit patient** → Clique "Introduire"
3. **Notification envoyée** → "Dr. X demande à introduire Y"
4. **Secrétaire reçoit notification** → Voit message avec 2 options
5. **Secrétaire clique "Reporter"** → 
   - Patient reste en statut `waiting`
   - Notification marquée comme lue
6. **Médecin peut réintroduire** plus tard

## Fichiers Modifiés

1. **src/pages/MyWaitingQueuePage.jsx**
   - Changement du bouton "Appeler" → "Introduire"
   - Mise à jour du message de notification avec nom du médecin
   - Ajout du paramètre `medecinName` dans les données de notification

2. **src/lib/notifications.js**
   - Mise à jour de `generateNotificationMessage()` pour inclure le nom du médecin
   - Message: "Dr. X demande à introduire Y" au lieu de "Je reçois le patient Y"

3. **src/components/introduction/NotificationPanel.jsx**
   - Ajout des boutons "Confirmer" et "Reporter"
   - Implémentation de `handleConfirm()` et `handlePostpone()`
   - Amélioration de l'UI avec bordure bleue pour notifications non lues

4. **src/pages/IntroductionPatientPage.jsx**
   - Passage des props additionnelles à NotificationPanel
   - `userProfile`, `waitingQueue`, `onAuthorizePatient`

## Configuration Requise

### Variables d'Environnement

Assurez-vous que les variables Supabase sont configurées dans `.env`:
```
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anonyme
```

### Configuration Supabase

1. **Activer Realtime:**
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE notifications_medecin_secretaire;
   ALTER PUBLICATION supabase_realtime ADD TABLE waiting_queue;
   ```

2. **Vérifier les politiques RLS:**
   - Les utilisateurs doivent pouvoir lire/écrire dans `notifications_medecin_secretaire`
   - Les utilisateurs doivent pouvoir lire/écrire dans `waiting_queue`

## Test du Système

### Test Manuel

1. **Connectez-vous en tant que médecin**
   - Accédez à la page "Ma File d'Attente"
   - Vérifiez que les patients en attente sont affichés
   - Cliquez sur "Introduire" pour un patient

2. **Connectez-vous en tant que secrétaire** (dans un autre navigateur)
   - Accédez à la page "Introduction Patient"
   - Vérifiez que la notification apparaît
   - Testez le bouton "Confirmer"
   - Testez le bouton "Reporter"

3. **Vérifiez les transitions de statut**
   - Le patient doit passer de `waiting` → `called` → `en_route` → `present` → `in_consultation`

### Points de Vérification

- [ ] La notification apparaît instantanément chez la secrétaire
- [ ] Le message contient le nom du médecin et du patient
- [ ] Les boutons "Confirmer" et "Reporter" fonctionnent
- [ ] Le statut du patient se met à jour correctement
- [ ] La notification disparaît après action
- [ ] Le médecin reçoit la notification "patient en route" après confirmation

## Dépannage

### Problème: Notifications ne s'affichent pas

**Solutions:**
1. Vérifiez que Realtime est activé dans Supabase
2. Vérifiez les politiques RLS sur `notifications_medecin_secretaire`
3. Vérifiez la console pour les erreurs WebSocket
4. Assurez-vous que `medecin_id` et `secretaire_id` sont corrects

### Problème: Boutons "Confirmer"/"Reporter" ne fonctionnent pas

**Solutions:**
1. Vérifiez que `waiting_queue_id` est présent dans la notification
2. Vérifiez les permissions sur la table `waiting_queue`
3. Vérifiez la console pour les erreurs

### Problème: Statut du patient ne se met pas à jour

**Solutions:**
1. Vérifiez que la fonction `handleAuthorizePatient` est correctement appelée
2. Vérifiez les triggers sur la table `waiting_queue`
3. Vérifiez que l'abonnement Realtime fonctionne

## Améliorations Futures

1. **Son de notification** - Ajouter un son quand une nouvelle notification arrive
2. **Notification navigateur** - Afficher une notification desktop
3. **Historique** - Afficher l'historique des patients introduits
4. **Priorité** - Permettre de marquer certaines demandes comme urgentes
5. **Multi-secrétaires** - Gérer plusieurs secrétaires avec répartition automatique

## Conclusion

Le système de notifications médecin-secrétaire est maintenant pleinement fonctionnel avec:
- ✅ Interface médecin avec bouton "Introduire"
- ✅ Notifications en temps réel via WebSocket
- ✅ Interface secrétaire avec options Confirmer/Reporter
- ✅ Transitions de statut automatiques
- ✅ Messages personnalisés avec noms

Le workflow est complet et prêt à être utilisé en production.
