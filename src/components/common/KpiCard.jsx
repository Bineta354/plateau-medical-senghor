import React from 'react';

/**
 * KpiCard — carte d'indicateur (KPI) 100% présentationnelle ("dumb component").
 *
 * Ce composant ne connaît RIEN du sens métier de ce qu'il affiche : ni la
 * couleur/tonalité, ni la donnée elle-même, ni l'icône, ni le message affiché
 * au survol. Tout est fourni par la page qui l'utilise, via props. Le
 * composant se contente de la mise en page (icône + libellé + valeur) et de
 * l'état interactif (cliquable ou non, skeleton de chargement).
 *
 * @param {React.ComponentType} icon        - Icône à afficher (ex: un composant lucide-react). Choisie par la page.
 * @param {string} label                    - Libellé du KPI. Fourni par la page.
 * @param {string|number} value             - Valeur du KPI. Fournie par la page.
 * @param {string} [hint]                   - Sous-texte optionnel sous la valeur. Fourni par la page.
 * @param {string} [hoverMessage]           - Message affiché au survol (attribut `title`). Fourni par la page.
 * @param {() => void} [onClick]            - Si fourni, la carte devient un bouton cliquable (redirection ou autre action décidée par la page).
 * @param {boolean} [loading]               - Affiche un skeleton à la place de la valeur.
 * @param {string} [className]              - Classes CSS du conteneur de la carte (fond, bordure, couleur...) — entièrement décidées par la page.
 * @param {string} [iconClassName]          - Classes CSS appliquées à l'icône (couleur...) — entièrement décidées par la page.
 */
const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
  hoverMessage,
  onClick,
  loading = false,
  className = '',
  iconClassName = '',
}) => {
  const interactive = typeof onClick === 'function';
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      title={hoverMessage}
      className={`w-full text-left ${interactive ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-600 truncate">{label}</p>
          {loading ? (
            <div className="h-7 w-16 mt-1 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
          {hint && !loading && (
            <p className="text-xs text-gray-500 mt-1">{hint}</p>
          )}
        </div>
        {Icon && <Icon className={`w-8 h-8 flex-shrink-0 ${iconClassName}`} />}
      </div>
    </Wrapper>
  );
};

export default KpiCard;
