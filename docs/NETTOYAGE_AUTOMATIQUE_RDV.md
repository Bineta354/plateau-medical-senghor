# Nettoyage Automatique des Rendez-vous en Fin de Journée

## Vue d'ensemble

Ce système automatise le nettoyage des rendez-vous non consultés à la fin de chaque journée. Il garantit qu'aucun rendez-vous ne reste "actif" avec une date passée.

## Fonctionnalités

### 1. Statuts de Rendez-vous

Les rendez-vous peuvent avoir les statuts suivants:
- `confirme` - Rendez-vous confirmé (actif)
- `en_attente` - En attente de confirmation
- `annule` - Annulé par le patient ou le cabinet
- `termine` - Consultation terminée normalement
- `absent` - Patient absent (non présent)
- `reporte` - Rendez-vous reporté (nouveau RDV créé)
- `consulte` - Patient consulté (même que termine mais plus explicite)

### 2. Fonction de Nettoyage Automatique

**Fonction PostgreSQL:** `cleanup_appointments_end_of_day()`

Cette fonction:
- Identifie tous les rendez-vous avec statut `confirme` ou `en_attente` avant la date limite
- Par défaut, marque ces rendez-vous comme `absent`
- Exclut les rendez-vous qui ont une consultation associée
- Met à jour les métadonnées de traitement automatique

**Date limite de traitement:**
- Si l'heure actuelle est après l'heure de fermeture du cabinet (défaut: 20h): traite les RDV d'aujourd'hui
- Sinon: traite les RDV d'hier

### 3. Fonctions de Gestion Manuelle

#### Reporter un Rendez-vous
```sql
SELECT reporter_rendez_vous(
  p_appointment_id => 123,
  p_nouvelle_date => '2026-06-05 10:00:00',
  p_motif_report => 'Patient malade'
);
```
- Crée un nouveau rendez-vous
- Marque l'ancien comme `reporte`
- Lie le nouveau RDV à l'original via `appointment_original_id`

#### Annuler un Rendez-vous
```sql
SELECT annuler_rendez_vous(
  p_appointment_id => 123,
  p_motif_annulation => 'Patient a annulé'
);
```

#### Marquer comme Consulté
```sql
SELECT marquer_rdv_consulte(p_appointment_id => 123);
```

## Configuration

### Heure de Fermeture du Cabinet

L'heure de fermeture est configurée dans la table `parametres_cabinet`:
```sql
UPDATE public.parametres_cabinet
SET heure_fermeture = '20:00'::TIME;
```

## Installation

### 1. Appliquer la Migration

```bash
# Via Supabase CLI
supabase db push

# Ou via psql
psql -h your-host -U your-user -d your-db -f supabase/migrations/20260604000000_end_of_day_appointment_cleanup.sql
```

### 2. Déployer la Edge Function

```bash
supabase functions deploy cleanup-appointments
```

### 3. Configurer le Cron Job

#### Option A: Supabase Cron Jobs (pg_cron)

```sql
-- Activer l'extension pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Planifier l'exécution tous les jours à 20h30
SELECT cron.schedule(
  'cleanup-appointments-daily',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cleanup-appointments',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-service-role-key"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

#### Option B: Cron Job Externe (recommandé pour la production)

Ajouter dans votre crontab:
```bash
# Exécuter tous les jours à 20h30
30 20 * * * curl -X POST https://your-project.supabase.co/functions/v1/cleanup-appointments \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json"
```

#### Option C: GitHub Actions

Créer `.github/workflows/cleanup-appointments.yml`:
```yaml
name: Cleanup Appointments
on:
  schedule:
    - cron: '30 20 * * *'  # Tous les jours à 20h30 UTC
  workflow_dispatch:      # Permet l'exécution manuelle

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Execute cleanup
        run: |
          curl -X POST https://your-project.supabase.co/functions/v1/cleanup-appointments \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

## Surveillance

### Vue des Rendez-vous à Traiter

```sql
SELECT * FROM rendez_vous_a_traiter;
```

Cette vue affiche:
- Les rendez-vous expirés (date passée)
- Les rendez-vous du jour
- Les informations patient/médecin
- Le niveau d'urgence

### Vérifier les Traitements Automatiques

```sql
SELECT 
  id,
  date_heure,
  statut,
  traite_automatiquement,
  date_traitement_automatique,
  appointment_original_id
FROM public.appointments
WHERE traite_automatiquement = TRUE
ORDER BY date_traitement_automatique DESC
LIMIT 50;
```

### Statistiques de Nettoyage

```sql
SELECT * FROM cleanup_appointments_end_of_day();
```

Retourne:
- `appointments_traites` - Nombre total de RDV traités
- `nouveaux_rdv_crees` - Nombre de nouveaux RDV créés
- `rdv_absents` - Nombre de RDV marqués absents
- `rdv_reportes` - Nombre de RDV reportés
- `rdv_annules_auto` - Nombre de RDV annulés automatiquement

## Personnalisation

### Modifier le Comportement par Défaut

Par défaut, tous les RDV non consultés sont marqués comme `absent`. Pour personnaliser:

1. **Basé sur la priorité:**
```sql
-- Marquer les RDV urgents comme à traiter manuellement
UPDATE public.appointments
SET statut = 'en_attente_traitement_manuel'
WHERE 
  priorite IN ('urgente', 'tres_urgente')
  AND statut IN ('confirme', 'en_attente')
  AND DATE(date_heure) <= CURRENT_DATE;
```

2. **Basé sur l'historique du patient:**
```sql
-- Si le patient a souvent des absences, marquer comme absent
-- Sinon, laisser en attente de traitement manuel
```

3. **Basé sur des règles métier spécifiques:**
Modifier la fonction `cleanup_appointments_end_of_day()` pour inclure votre logique.

## Tests

### Test Manuel

```bash
# Exécuter la fonction manuellement
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-appointments \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json"
```

### Test avec Données de Test

```sql
-- Créer des rendez-vous de test
INSERT INTO public.appointments (patient_id, medecin_id, date_heure, motif, statut)
VALUES 
  (1, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', 'Test RDV expiré', 'confirme'),
  (1, 2, CURRENT_TIMESTAMP - INTERVAL '1 day', 'Test RDV hier', 'confirme'),
  (1, 2, CURRENT_TIMESTAMP, 'Test RDV aujourd''hui', 'confirme');

-- Exécuter le nettoyage
SELECT * FROM cleanup_appointments_end_of_day();

-- Vérifier les résultats
SELECT id, date_heure, statut, traite_automatiquement 
FROM public.appointments 
WHERE statut IN ('absent', 'reporte', 'annule');
```

## Dépannage

### Problème: Les RDV ne sont pas traités

**Vérifications:**
1. Le cron job est-il actif?
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'cleanup-appointments-daily';
   ```
2. L'Edge Function est-elle déployée?
   ```bash
   supabase functions list
   ```
3. Les logs de la fonction:
   ```bash
   supabase functions logs cleanup-appointments
   ```

### Problème: RDV marqués incorrectement

**Solution:**
- Vérifier l'heure de fermeture du cabinet
- Ajuster la logique dans `cleanup_appointments_end_of_day()`
- Exécuter manuellement avec des données de test

### Problème: Nouveaux RDV non créés pour les reports

**Solution:**
- Vérifier que la fonction `reporter_rendez_vous()` est appelée correctement
- Vérifier les permissions sur la table `appointments`
- Consulter les logs pour les erreurs

## Bonnes Pratiques

1. **Surveillance:** Mettre en place des alertes pour les échecs du cron job
2. **Logs:** Conserver les logs de la fonction pour audit
3. **Tests:** Tester régulièrement avec des données de test
4. **Communication:** Informer l'équipe des changements de statut automatiques
5. **Rollback:** Avoir un script pour annuler les traitements si nécessaire

## Sécurité

- La fonction utilise `SUPABASE_SERVICE_ROLE_KEY` pour les permissions élevées
- Ne jamais exposer cette clé dans le frontend
- Limiter l'accès à l'Edge Function via les headers d'authentification
- Utiliser des variables d'environnement pour les configurations sensibles

## Évolutions Futures

1. **Notifications:** Envoyer des notifications aux patients pour les RDV reportés
2. **Règles avancées:** Permettre la configuration de règles métier personnalisées
3. **Historique:** Conserver un historique détaillé des traitements
4. **Rapports:** Générer des rapports de statistiques de nettoyage
5. **Interface UI:** Créer une interface pour gérer les RDV à traiter manuellement

## Support

Pour toute question ou problème:
1. Consulter les logs de la fonction
2. Vérifier la documentation Supabase
3. Contacter l'équipe technique
