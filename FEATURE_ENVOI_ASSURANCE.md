# Feature — Suivi de l'envoi des dossiers aux assurances

Statut global : **en discussion, rien codé**. On reprend cette conversation
plus tard — pas de migration, pas de code tant que ce fichier n'est pas
mis à jour avec une décision.

Fait suite au travail sur les créances assurance (voir
[Caisse.jsx](src/pages/secretary/Caisse.jsx) pour le split patient/assurance,
[ImpayesRelances.jsx](src/pages/comptabilite/ImpayesRelances.jsx) et
[AssuranceCreanceDetail.jsx](src/pages/comptabilite/AssuranceCreanceDetail.jsx)
pour le suivi des factures `-C` impayées).

---

## Le trou identifié

Une facture `type='couverture'` (`-C`) passe aujourd'hui directement de
« créée » à « payée » (`statut_paiement`). **Rien ne trace le fait qu'un
dossier a réellement été transmis à l'assureur.** Impossible de distinguer :
- un dossier pas encore envoyé (rien n'a été fait côté cabinet),
- un dossier envoyé, en attente normale de règlement,
- un dossier envoyé depuis des mois sans réponse (à relancer auprès de
  l'assureur, pas auprès du patient).

## Le cycle réel (tiers payant), tel que compris jusqu'ici

1. Patient assuré paie sa part à la caisse → facture `-C` créée pour la part
   assurance (déjà en place).
2. Le cabinet transmet le dossier à l'assureur — **format et fréquence à
   confirmer avec l'utilisateur** (bordereau papier ? email ? portail en
   ligne de l'assureur ? au fil de l'eau ou en lot à date fixe ?).
3. L'assureur traite (délai courant 30-90j), peut payer en totalité,
   partiellement, ou rejeter.
4. L'assureur règle par **virement bancaire groupé** — un virement pour
   potentiellement des dizaines de factures d'un coup, accompagné d'un
   **relevé de règlement** listant quelles factures sont couvertes.
5. Le cabinet rapproche le relevé reçu avec ses factures `-C` en attente.

Étapes 4-5 (enregistrement du paiement reçu) ont été discutées dans la
conversation précédente à celle-ci mais pas encore actées non plus —
probablement un écran de rapprochement en lot (un virement → plusieurs
factures cochées), par opposition au flux actuel facture-par-facture de
[EncaissementFactures.jsx](src/pages/comptabilite/EncaissementFactures.jsx)
("Corrections comptables") qui permet déjà techniquement d'encaisser une
facture `-C` mais une par une, sans lien avec un relevé.

## Proposition faite (pas encore validée)

**Schéma** — 2 colonnes nullable sur `factures` (pertinentes seulement pour
`type='couverture'`) :
- `date_envoi_assurance` (timestamp) — remplie quand le dossier part.
- `reference_envoi` (texte) — n° de bordereau, si le cabinet en utilise un.

Ne remplace pas `statut_paiement` : "envoyé" et "payé" sont deux dimensions
orthogonales (un dossier peut être envoyé et pas encore payé — le cas
normal — mais jamais payé sans avoir été envoyé).

**UI** — sur `AssuranceCreanceDetail.jsx` :
- Badge par ligne : "À envoyer" (gris) vs "Envoyé le JJ/MM" (bleu).
- Filtre : À envoyer / Envoyé, en attente / Tous.
- Sélection multiple + bouton "Marquer comme envoyé(es)" (action de lot,
  cohérente avec le fait qu'un envoi groupe plusieurs dossiers).

## Questions ouvertes avant de coder quoi que ce soit

- Sous quelle forme part le dossier vers l'assureur (papier/bordereau,
  email + pièces jointes, portail en ligne propre à chaque assureur) ?
- L'envoi se fait-il au fil de l'eau (facture par facture, dès qu'elle est
  prête) ou en lot à date fixe (ex. tous les vendredis) ?
- Est-ce que ça varie selon l'assureur (AXA vs les autres) ?
- Qui envoie concrètement (comptabilité ? secrétariat ?) — ça influe sur
  qui doit avoir accès au bouton "Marquer comme envoyé".
- Le rapprochement du relevé de paiement (étapes 4-5) : le relevé arrive-t-il
  dans un format exploitable (Excel avec numéros de facture) ou faut-il
  pointer à la main ?
