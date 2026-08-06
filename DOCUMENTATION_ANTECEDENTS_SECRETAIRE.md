# Documentation : Saisie des antécédents médicaux par la secrétaire

## Contexte et objectif

Avant cette fonctionnalité, les antécédents médicaux d'un patient (allergies, maladies chroniques, etc.) ne pouvaient être saisis que par le médecin, pendant la consultation.

Or, en pratique, un patient arrive souvent avec un **carnet de santé** (papier, ou d'un autre cabinet) contenant déjà ces informations. L'objectif est de permettre à la secrétaire de les retranscrire dès l'accueil, pour que le médecin les retrouve automatiquement à l'ouverture de la consultation — sans que le patient ait à tout répéter.

## Principe technique : une seule source de vérité

Les antécédents sont stockés dans la table `antecedents_patients`, rattachés au **patient** (`patient_id`), pas à une consultation précise (`consultation_id` est optionnel, souvent `NULL` quand c'est la secrétaire qui saisit).

La fonctionnalité ne crée **aucun nouveau composant de saisie** : elle réutilise exactement les mêmes composants que ceux déjà utilisés côté médecin dans la consultation :

- `src/components/consultation/AntecedentsMedicaux.jsx` — liste des antécédents + bouton "Ajouter"
- `src/components/consultation/modals/AntecedentModal.jsx` — formulaire d'ajout (antécédent, date de découverte, commentaires)

Ces deux composants ne dépendent que de `patient` et `antecedentsRef` (le référentiel des antécédents possibles, configuré dans Paramétrage) — ils n'ont jamais eu besoin d'une consultation. C'est ce qui rend leur réutilisation possible sans duplication de code.

Comme la lecture se fait toujours via `getAntecedents(patient.id)` (`src/services/consultation/consultationService.js`), **tout ce qui est saisi par la secrétaire est automatiquement visible par le médecin**, dès l'ouverture de la consultation de ce patient — pas de transfert ni de synchronisation à gérer.

## Nouveau composant

### `src/components/secretary/PatientAntecedentsModal.jsx`

Fenêtre modale destinée à la secrétaire. Wrapper léger autour d'`AntecedentsMedicaux` :

- Charge les antécédents existants du patient (`getAntecedents`) et le référentiel des antécédents possibles (table `antecedents`, une seule fois par ouverture via un `useRef` pour éviter de le recharger inutilement).
- Affiche un spinner pendant le chargement.
- Délègue tout l'affichage/l'ajout à `AntecedentsMedicaux`.

**Props :**
| Prop | Type | Description |
|---|---|---|
| `patient` | objet | Le patient concerné (doit avoir `id`, `nom`, `prenom`) |
| `onClose` | fonction | Appelée à la fermeture de la modale |

**Limite connue :** si la requête Supabase échoue (réseau, etc.), aucun message d'erreur n'est affiché à la secrétaire — la modale s'ouvre simplement avec une liste vide. À améliorer si ça pose problème en usage réel.

## Points d'entrée (où la secrétaire trouve la fonctionnalité)

Un bouton **"Antécédents"** (icône `ClipboardList`, fond teal) a été ajouté à 3 endroits :

1. **`src/components/secretary/AddPatientModal.jsx`** — sur l'écran "Dossier créé !" qui s'affiche juste après la création d'un patient, à côté de "Mettre en salle d'attente" et "Planifier un rendez-vous". C'est le point d'entrée le plus direct : pas besoin de rendez-vous ni de passage en salle d'attente.
2. **`src/components/secretary/DoctorSpecificQueue.jsx`** — sur la ligne de chaque patient, dans la vue "par médecin" du tableau de bord secrétaire (à côté du bouton "Scanner").
3. **`src/pages/SalleAttentePage.jsx`** — sur la ligne de chaque patient présent en salle d'attente.

> Le bouton n'existe **pas** dans la "Vue Globale" (`GlobalWaitingQueue.jsx`, tableau récapitulatif tous médecins) : cette vue a été refondue en tableau agrégé par médecin (sans ligne par patient), donc il n'y a plus d'endroit pertinent pour une action par patient à cet écran. Il faut passer par la vue "par médecin" ou par l'écran de création de patient.

## Comment tester

1. Se connecter en tant que secrétaire.
2. **Chemin direct :** Tableau de bord → "Inscrire Patient" → remplir le formulaire → sur l'écran "Dossier créé !", cliquer "Saisir les antécédents".
3. **Chemin file d'attente :** avoir un patient dans la file d'attente d'un médecin (vue "par médecin" ou Salle d'attente) → cliquer "Antécédents" sur sa ligne.
4. Ajouter un antécédent (sélectionner dans la liste, date optionnelle, commentaire optionnel) → "Ajouter".
5. Se reconnecter en tant que médecin, ouvrir une consultation pour ce même patient → onglet "Antécédents médicaux" → l'antécédent ajouté par la secrétaire doit apparaître.

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/components/secretary/PatientAntecedentsModal.jsx` | Nouveau — modale secrétaire |
| `src/components/secretary/AddPatientModal.jsx` | Bouton + rendu conditionnel de la modale |
| `src/components/secretary/DoctorSpecificQueue.jsx` | Bouton + rendu conditionnel de la modale |
| `src/pages/SalleAttentePage.jsx` | Bouton + rendu conditionnel de la modale |
| `src/components/consultation/AntecedentsMedicaux.jsx` | Réutilisé tel quel (déjà utilisé côté médecin) |
| `src/components/consultation/modals/AntecedentModal.jsx` | Réutilisé tel quel (déjà utilisé côté médecin) |
| `src/services/consultation/consultationService.js` | `getAntecedents()` / `toggleAntecedentStatus()` — logique de lecture/écriture, non modifiée |

## Bug annexe corrigé pendant cette implémentation

En testant ce point d'entrée, l'ajout d'un patient existant à la file d'attente (`AddPatientModal.jsx`, bouton "Ajouter à la file d'attente") a été trouvé cassé : le code envoyait un champ `notes` inexistant dans la vraie table `waiting_queue` (qui a `notes_secretaire`/`notes_medecin`/`secretary_notes`/`doctor_notes`, mais pas de colonne `notes` générique). Corrigé en retirant ce champ de l'insertion — le texte reste enregistré via `motif_consultation`, colonne qui existe bien.
