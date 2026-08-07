# Fix — Étape 3 Facturation (terminer consultation → générer la facture)

Spéc issue de l'audit ergonomique fait après test navigateur du parcours
« consultation terminée → complétion de la facturation » (voir
[FLUX_COMPLET_PATIENT.md](FLUX_COMPLET_PATIENT.md) pour le détail du
test, [FIX_ETAPE_1_SECRETAIRE.md](FIX_ETAPE_1_SECRETAIRE.md) et
[FIX_ETAPE_2_MEDECIN.md](FIX_ETAPE_2_MEDECIN.md) pour les audits des
étapes précédentes). Liste des points validés, à implémenter — pas
encore fait, ce fichier sert de backlog/spéc pour quand on s'y attaque.

Statut global : **à faire**. On ne touche à rien pour l'instant.

---

## Ce qui fonctionne déjà bien (à ne pas casser)

- Handoff par **notification cliquable** : le médecin termine sa
  consultation, la secrétaire reçoit une notification qui l'emmène
  directement sur la bonne facture à compléter
  (`/consultation-completion/:id`) — pas besoin de chercher qui a
  terminé sa consultation. Bon pattern, à réutiliser ailleurs dans
  l'app.
- Page **Complétion de Consultation** compacte, une seule vue
  (Informations / Actes / Ordonnances / Facturation), pas de wizard
  multi-étapes pour une tâche largement automatique.
- **Prix pré-rempli** sur la facturation — réduit la saisie manuelle.

---

## 1. Bug d'affichage "0 FCFA" après génération de la facture

**Constat :** juste après avoir cliqué "Générer la facture", la carte de
confirmation affiche **"Consultation médicale : 0 FCFA"** alors que le
prix affiché juste avant (et le montant réellement enregistré, vérifié
dans `FACTURATION → Factures`) est correct (6 000 FCFA dans le test).
C'est le pire endroit possible pour un affichage trompeur : une action
financière, au moment précis de sa confirmation. Risque concret :
la secrétaire panique, reclique "Générer" en pensant que ça a échoué →
risque de facture en doublon pour un même patient/consultation.

**Fix validé :** corriger l'affichage du montant sur la carte "Facture
générée" pour qu'il reflète le vrai montant enregistré (probablement un
mauvais champ lu côté front après la réponse de génération, la donnée
serveur elle-même est correcte).

**Priorité :** bug à corriger en priorité — action financière, pas juste
de l'UI cosmétique.

---

## 2. Pas de pont visible vers l'étape suivante (encaissement)

**Constat :** après génération de la facture, la seule action proposée
est "Imprimer la facture". Rien n'indique à la secrétaire ce qu'il se
passe ensuite ni qui doit encaisser (rôle Caissier) — alors que le reste
du parcours testé jusqu'ici est plutôt bon pour guider d'une étape à
l'autre (la notification qui amène à cette page en est un bon exemple).

**Fix validé :** ajouter un CTA/lien clair après génération vers l'étape
suivante du parcours (ex. "Voir la facture dans Facturation" ou
indication du statut "En attente d'encaissement").

**Priorité :** impact fort.

---

## 3. Colonnes Statut/Actions cachées par défaut dans la liste des factures

**Constat :** sur `/facturation/factures`, il faut scroller
horizontalement pour voir les colonnes **Statut** et **Actions** —
informations pourtant essentielles (la facture est-elle payée ? que
puis-je faire dessus ?) qui ne sont pas visibles sans ce geste peu
évident.

**Fix validé :** revoir la largeur/priorité des colonnes du tableau pour
que Statut et Actions restent visibles sans scroll horizontal sur une
résolution desktop standard (ou geler ces colonnes en scroll horizontal,
pattern "sticky columns").

**Priorité :** impact fort.

---

## 4. Vocabulaire incohérent + faute d'accent

**Constat :**
- Faute d'accent dans la notification : **"Complèter la facturation"**
  au lieu de "Compléter la facturation".
- Trois formulations différentes pour la même tâche : la notification
  dit "Complèter la facturation", le titre de page dit "Complétion de
  Consultation", le bouton dit "Générer la facture".

**Fix validé :** corriger la faute d'accent, harmoniser le vocabulaire
autour d'une seule formulation pour cette tâche à travers
notification/titre/bouton.

**Priorité :** cosmétique mais utile.

---

## 5. Absence d'étape de relecture avant génération — à trancher en discussion produit

**Constat :** un seul clic sur "Générer la facture", sans récap ni
confirmation — à comparer avec la création de RDV (bien moins
engageante financièrement) qui, elle, a une page de confirmation
dédiée. Dans le test, la consultation s'est terminée avec "Aucun acte
enregistré" : la facture est alors partie sur la seule base du prix de
consultation, sans dernier filet pour vérifier que c'est bien tout ce
qui doit être facturé.

**Statut : pas encore validé comme fix — question ouverte.** Ça dépend
d'une décision produit : est-ce que le risque de sous-facturation (actes
réalisés mais non ajoutés avant la fin de consultation) est réel en
usage courant du cabinet ? Si oui, ajouter une étape de relecture avant
génération devient pertinent. Si le prix de consultation de base couvre
déjà tout par défaut et que les actes additionnels sont rares/exceptionnels,
peut-être pas nécessaire. **À trancher avant d'implémenter quoi que ce
soit ici.**

---

## Récapitulatif priorités

**Bug à corriger en priorité :** 1
**Impact fort :** 2, 3
**Cosmétique mais utile :** 4
**Question ouverte (décision produit à prendre avant fix) :** 5
