# Rapport de Refactorisation : `ConsultationDetail.jsx`

## 1. Résumé des Changements

Le composant `ConsultationDetail.jsx`, qui était un fichier monolithique de plus de 5000 lignes, a été entièrement refactorisé. L'objectif était d'extraire la logique de récupération de données et la logique métier dans des modules dédiés (services et hooks) afin d'améliorer la lisibilité, la maintenabilité et la séparation des préoccupations.

Comme vous l'avez noté, la taille du composant principal a été drastiquement réduite, passant de plus de 5000 lignes à environ **700 lignes**.

## 2. Approche de Refactorisation

La stratégie a consisté à :

1.  **Créer des Services :** Isoler toutes les interactions avec la base de données (appels à Supabase) dans des fonctions dédiées, regroupées par domaine fonctionnel.
2.  **Créer un Hook Personnalisé :** Mettre en place un hook React (`useConsultationData`) pour orchestrer l'appel de ces services, gérer les états de chargement (`loading`), les erreurs, et fournir les données au composant de manière simple et réactive.
3.  **Simplifier les Composants :** Le composant `ConsultationDetail.jsx` et ses sous-composants ont été nettoyés de leur logique de récupération de données pour ne conserver que la logique de présentation et de gestion des interactions UI.

## 3. Structure des Fichiers

### Fichier Principal Modifié

| Fichier                                             | Lignes (Avant) | Lignes (Après) | Réduction |
| --------------------------------------------------- | :------------: | :------------: | :-------: |
| `src/pages/consultation/ConsultationDetail.jsx` |      5171      |      699       | **-86%**  |

### Nouveaux Fichiers Créés (Logique)

La logique extraite a été répartie dans les nouveaux fichiers suivants :

| Fichier                                                      | Lignes | Rôle                                                                                                   |
| ------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------ |
| `src/hooks/consultation/useConsultationData.js`              |  163   | Hook principal qui centralise la récupération et la gestion d'état de toutes les données.                |
| `src/services/consultation/consultationService.js`           |  172   | Gère les appels liés aux données directes de la consultation (signes, actes, diagnostics...).          |
| `src/services/consultation/dossierMedicalService.js`         |  119   | Gère la récupération de l'historique du patient (anciennes consultations, documents...).               |
| `src/services/consultation/referenceDataService.js`          |  127   | Charge les données de référence (listes de médicaments, types de certificats, modèles...).             |
| `src/services/consultation/workflowService.js`               |   66   | Gère les actions complexes du workflow, comme la finalisation d'une consultation.                    |
| **Total des nouvelles lignes (logique)**                     | **647**  |                                                                                                        |

## 4. Bilan de la Refactorisation

-   **Taille totale avant :** **5171 lignes**
-   **Taille totale après (logique + vue principale) :** 699 (composant) + 647 (hooks & services) = **1346 lignes**

La refactorisation a permis une **réduction nette de 3825 lignes de code (-74%)** pour la logique principale, tout en améliorant considérablement l'organisation et la clarté du code. Chaque module a désormais une responsabilité unique.

## 5. Analyse de l'Architecture des Vues (Sous-Composants)

Le composant `ConsultationDetail.jsx` agit comme un conteneur pour des sous-composants d'affichage (`...Tab.jsx`). Ces composants sont principalement responsables de l'affichage des données. La logique de modification et d'ajout de données est quant à elle encapsulée dans des **composants de modale** (`...Modal.jsx`), qui sont appelés par les `...Tab.jsx`.

### Principe de Refactorisation Appliqué

Suivant la même logique que pour le composant parent, les appels directs à la base de données depuis les modales ont été extraits vers les services. Cette approche a été appliquée à :
- `AntecedentsMedicaux.jsx`
- `ExamenMedicaux.jsx` (et sa modale `ExamenModal.jsx`)

Cette approche garantit une architecture propre et maintenable et devrait être généralisée à tous les sous-composants.

### Taille des Sous-Composants (`...Tab.jsx`)

| Fichier                                                        | Lignes | Note                                                              |
| -------------------------------------------------------------- | :----: | ----------------------------------------------------------------- |
| `src/components/consultation/SyntheseTab.jsx`                  |  791   | Composant volumineux qui pourrait bénéficier d'une refactorisation. |
| `src/components/consultation/CertificatsTab.jsx`               |  189   |                                                                   |
| `src/components/consultation/AntecedentsMedicaux.jsx`          |  158   | *Refactorisé pour utiliser un service.*                           |
| `src/components/consultation/ExamenMedicaux.jsx`               |  147   | *Refactorisé pour utiliser un service. Typo corrigée.*            |
| `src/components/consultation/AppareilsTab.jsx`                 |  146   |                                                                   |
| `src/components/consultation/OrdonnancesTab.jsx`               |  137   |                                                                   |
| `src/components/consultation/ActesTab.jsx`                     |  103   |                                                                   |
| `src/components/consultation/DiagnosticsTab.jsx`               |   89   |                                                                   |
| **Total des lignes (Tabs)**                                    | **1760** |                                                                   |

## 6. Analyse des Modals

Voici la taille des composants de modale qui contiennent la logique de saisie et de modification des données.

| Fichier                                                      | Lignes | Note                                                              |
| ------------------------------------------------------------ | :----: | ----------------------------------------------------------------- |
| `src/components/consultation/modals/OrdonnancesModal.jsx`    |  423   | Le plus grand, gère la complexité des prescriptions.                |
| `src/components/consultation/modals/ActesModal.jsx`          |  317   |                                                                   |
| `src/components/consultation/modals/ExamenModal.jsx`         |  242   | *Refactorisé pour utiliser un service.*                           |
| `src/components/consultation/modals/CertificatsModal.jsx`    |  185   |                                                                   |
| `src/components/consultation/modals/AppareilsModal.jsx`      |  155   |                                                                   |
| `src/components/consultation/modals/DiagnosticsModal.jsx`    |  134   |                                                                   |
| `src/components/consultation/modals/AntecedentModal.jsx`     |  125   |                                                                   |
| `src/components/consultation/modals/SyntheseModal.jsx`       |  121   |                                                                   |
| **Total des lignes (Modals)**                                | **1702** |                                                                   |

