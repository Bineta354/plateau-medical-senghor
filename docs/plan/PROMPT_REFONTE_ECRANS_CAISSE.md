# Prompt — Refonte visuelle des écrans Caisse

> À copier-coller tel quel dans une session Claude dédiée au design (ex. avec le skill `frontend-design`). Autonome : ne suppose aucune connaissance préalable de la conversation qui l'a produit.

---

## Contexte

Tu travailles sur l'application **Cabinet Médical** (React + Tailwind CSS, cabinet dentaire au Sénégal, devise F CFA, interface entièrement en français). L'app gère patients, rendez-vous, consultations, facturation et caisse. Le style visuel actuel : cartes blanches arrondies (`rounded-xl shadow`), fond gris clair, couleurs d'accent par catégorie (jaune=fond de caisse, vert=encaissé, bleu=solde, violet=mensuel, orange=alertes/actions de fermeture), icônes Heroicons.

Le persona concerné est le **caissier** (parfois secrétaire ou comptable qui utilisent le même écran) : il encaisse des patients au comptoir toute la journée, plusieurs dizaines de fois, dans un rythme parfois pressé (file d'attente physique). L'écran principal qu'il utilise s'appelle `Caisse.jsx` — 2 478 lignes, un seul fichier qui cumule : encaissement, historiques (par patient / par couverture), fin de journée, arrêté mensuel, et une vue "supervision" pour l'admin/comptable.

## Ce qu'on te demande

Proposer une **refonte visuelle et d'interaction** (wireframes/maquettes décrites, pas de code obligatoire — des descriptions de layout précises suffisent, ou du HTML/JSX si tu préfères illustrer) pour les écrans suivants, en résolvant les 8 problèmes ergonomiques listés ci-dessous, confirmés par audit du code réel.

### Problèmes à résoudre

1. **Le blocage "caisse fermée" arrive trop tard.** Aujourd'hui, un caissier peut chercher un patient, sélectionner sa facture, ouvrir le formulaire de paiement, choisir un mode, taper un montant — et ce n'est qu'au clic final "Valider" qu'il découvre que la caisse n'est pas ouverte. → Il faut empêcher ou signaler ça dès l'entrée sur la page.

2. **Aucun signal visuel de paiement partiel pendant la saisie.** Le formulaire d'encaissement ne montre jamais, en temps réel, ce qu'il restera à devoir après ce paiement. → Il faut un retour immédiat ("il restera X F CFA à charge") pendant que le caissier tape le montant, avec une distinction visuelle claire entre "solde soldé" et "paiement partiel, solde restant".

3. **Hiérarchie visuelle plate entre actions de fréquence très différente.** "Mise à jour caisse" (plusieurs fois/jour), "Fermer la caisse" (1×/jour, action à conséquence), "Arrêté mensuel" (1×/mois) sont trois boutons au même niveau visuel en haut de l'écran. → Il faut une hiérarchie qui reflète fréquence et gravité.

4. **Le raccourci de fermeture contourne la vérification recommandée.** Un bouton "Fermer la caisse" est cliquable directement, en parallèle d'un panneau "Fin de journée" qui recommande de vérifier les totaux avant de fermer — rien n'oblige à passer par cette vérification. → Proposer un flux où la vérification est intégrée au chemin de fermeture plutôt que contournable.

5. **Une seule page fait tout, en permanence visible.** Encaissement + historique par patient + historique par couverture + fin de journée + arrêté mensuel + vue supervision, tout empilé sur un seul écran. → Proposer une séparation (onglets, sous-navigation, ou pages distinctes) qui met la tâche la plus fréquente (encaisser) au premier plan et relègue le reste.

6. **Le reçu de paiement n'est pas fiable.** Il s'ouvre dans une nouvelle fenêtre via `window.open`, sans repli visible si le navigateur bloque les popups — le caissier peut croire que le reçu est parti alors que rien ne s'est passé. → Proposer une interaction de confirmation/reçu plus robuste visuellement (ex. état de confirmation explicite dans l'UI elle-même, pas seulement une fenêtre externe).

7. **"Total journée" et "Ce mois" se ressemblent trop.** Deux échelles de temps très différentes affichées comme deux cartes identiques dans la même grille — risque de confusion en lecture rapide, en situation de forte affluence. → Différencier clairement (position, taille, traitement visuel).

8. **Sur l'écran "Récapitulatif" (page satellite) : une ligne peut afficher "Payé" en toutes lettres alors qu'un montant "Reste" positif est juste à côté**, sans que rien ne signale la contradiction. → Proposer un traitement visuel qui rend cette incohérence immédiatement visible (c'est un filet de sécurité, en attendant que la cause côté logique soit corrigée).

### Écrans à livrer

- **Écran principal de caisse** (encaissement) — priorité n°1, c'est la tâche répétée toute la journée.
- **Modale/flux de paiement**, avec le retour temps réel sur le solde restant (point 2).
- **Flux "Fin de journée → Fermeture de caisse"** intégrant la vérification (points 3 et 4).
- **Traitement visuel de l'incohérence "payé mais reste > 0"** sur l'écran Récapitulatif (point 8), transposable à d'autres tableaux du module.

### Contraintes

- Rester cohérent avec le système visuel existant (cartes blanches, Tailwind, palette de couleurs par catégorie) plutôt que de tout réinventer — c'est une refonte d'ergonomie et de hiérarchie, pas un rebranding.
- Interface en français, montants en F CFA.
- Le caissier travaille souvent vite, parfois avec un patient en face de lui — optimiser pour la rapidité d'exécution et la réduction du risque d'erreur, pas pour la densité d'information.
- Ne pas supposer que le modèle de données a déjà changé (le calcul automatique du statut, par exemple, est un chantier séparé) — la refonte visuelle doit fonctionner avec les données telles qu'elles sont aujourd'hui, tout en réservant la place pour le comportement cible une fois la logique corrigée.

### Ce qu'on attend de toi en retour

Pour chaque écran : une description de layout (zones, hiérarchie, comportement au clic/à la saisie), pas juste une liste de recommandations générales. Si tu produis du HTML/JSX illustratif, garde-le cohérent avec Tailwind CSS.
