// Plafond de sécurité pour les requêtes de créances "couverture" (factures assurance
// impayées, type='couverture'). Partagé entre ImpayesRelances (vue globale tous
// assureurs confondus) et AssuranceCreanceDetail (vue détaillée par assureur) pour
// qu'un plafond atteint sur l'un ne produise jamais un total différent de l'autre.
export const COUVERTURE_FETCH_LIMIT = 2000;

// Une réponse dont la taille égale le plafond demandé signifie que la requête a été
// tronquée (il pourrait y avoir plus de lignes au-delà) : les totaux calculés côté client
// à partir de cette liste ne sont alors plus fiables et l'appelant doit prévenir l'utilisateur.
export const isCouvertureListTruncated = (rows, limit = COUVERTURE_FETCH_LIMIT) =>
  (rows || []).length >= limit;
