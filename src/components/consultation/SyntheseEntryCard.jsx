import React from 'react';
import PropTypes from 'prop-types';
import { Edit, Trash2 } from 'lucide-react';

// Doit rester cohérent avec les types définis dans ElementsSynthese.jsx / ListesReference.jsx
// (contrainte CHECK(type_element IN (...)) sur elements_synthese).
export const TYPE_META = {
  observation: { label: 'Observation', badge: 'bg-blue-100 text-blue-700', accent: 'border-l-blue-400' },
  prescription: { label: 'Prescription', badge: 'bg-orange-100 text-orange-700', accent: 'border-l-orange-400' },
  recommandation: { label: 'Recommandation', badge: 'bg-green-100 text-green-700', accent: 'border-l-green-400' },
  conclusion: { label: 'Conclusion', badge: 'bg-purple-100 text-purple-700', accent: 'border-l-purple-400' },
};
export const DEFAULT_TYPE_META = { label: 'Autre', badge: 'bg-gray-100 text-gray-700', accent: 'border-l-gray-300' };
export const TYPE_ORDER = ['observation', 'prescription', 'recommandation', 'conclusion'];

// Regroupe une liste d'éléments de synthèse par type_element, dans un ordre fixe, pour un
// affichage organisé par catégorie plutôt qu'en vrac.
export const groupByType = (items, getType) => {
  const groups = TYPE_ORDER
    .map((type) => ({ type, items: items.filter((item) => (getType(item) || 'observation') === type) }))
    .filter((g) => g.items.length > 0);
  const known = new Set(TYPE_ORDER);
  const autres = items.filter((item) => !known.has(getType(item)));
  if (autres.length > 0) groups.push({ type: null, items: autres });
  return groups;
};

// Carte réutilisée pour afficher un élément de synthèse — dans la consultation (onglet
// Synthèse, avec actions Modifier/Supprimer) comme dans le dossier patient (lecture seule)
// — évite d'avoir plusieurs styles de carte différents pour la même donnée.
const SyntheseEntryCard = ({ nom, description, type, commentaires, createdAt, onEdit, onDelete }) => {
  const meta = TYPE_META[type] || DEFAULT_TYPE_META;
  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${meta.accent} rounded-lg p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900">{nom}</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>{meta.label}</span>
          </div>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && (
              <button onClick={onEdit} className="text-blue-600 hover:text-blue-800" title="Modifier">
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="text-red-600 hover:text-red-800" title="Supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {commentaires && (
        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{commentaires}</p>
      )}
      {createdAt && (
        <p className="text-xs text-gray-400 mt-2">
          {new Date(createdAt).toLocaleDateString('fr-FR')} à {new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
};

SyntheseEntryCard.propTypes = {
  nom: PropTypes.string,
  description: PropTypes.string,
  type: PropTypes.string,
  commentaires: PropTypes.string,
  createdAt: PropTypes.string,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};

export default SyntheseEntryCard;
