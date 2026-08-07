import React from 'react';

/**
 * KPI_TONES — SOURCE UNIQUE des couleurs de carte KPI utilisées par KpiCard.
 *
 * Toutes les pages qui affichent des KpiCard colorées doivent passer une
 * `tone` de cette liste plutôt que ré-écrire des classes Tailwind à la main.
 * Changer une valeur ici (ex: la teinte de "red") se répercute automatiquement
 * sur TOUTES les cartes de l'app qui utilisent `tone="red"`, sans avoir à
 * chercher les usages un par un.
 */
export const KPI_TONES = {
  blue: {
    container: 'bg-blue-50',
    icon: 'text-blue-600',
    value: 'text-blue-600',
    label: 'text-blue-700',
  },
  green: {
    container: 'bg-green-50',
    icon: 'text-green-600',
    value: 'text-green-600',
    label: 'text-green-700',
  },
  yellow: {
    container: 'bg-yellow-50',
    icon: 'text-yellow-600',
    value: 'text-yellow-600',
    label: 'text-yellow-700',
  },
  red: {
    container: 'bg-red-50',
    icon: 'text-red-600',
    value: 'text-red-600',
    label: 'text-red-600',
  },
  purple: {
    container: 'bg-purple-50',
    icon: 'text-purple-600',
    value: 'text-purple-600',
    label: 'text-purple-700',
  },
  gray: {
    container: 'bg-gray-50',
    icon: 'text-gray-500',
    value: 'text-gray-900',
    label: 'text-gray-600',
  },
};

// Habillage commun à toutes les tons (forme, espacement, ombre au survol).
const BASE_CONTAINER_CLASS = 'rounded-lg p-4';

/**
 * KpiCard — carte d'indicateur (KPI) présentationnelle.
 *
 * Le composant ne connaît ni la donnée, ni l'icône, ni le message de survol :
 * tout ça vient de la page appelante via props. En revanche, la couleur passe
 * désormais par une palette centralisée (`KPI_TONES` ci-dessus, prop `tone`)
 * au lieu de classes Tailwind libres — pour que toutes les cartes KPI de
 * l'app restent visuellement cohérentes et se mettent à jour ensemble.
 * `className`/`iconClassName`/`valueClassName`/`labelClassName` restent
 * disponibles pour les cas particuliers qui doivent s'écarter de la palette
 * commune ; s'ils sont fournis, ils prennent le pas sur `tone`.
 *
 * @param {React.ComponentType} icon        - Icône à afficher (ex: un composant lucide-react). Choisie par la page.
 * @param {string} label                    - Libellé du KPI. Fourni par la page.
 * @param {string|number} value             - Valeur du KPI. Fournie par la page.
 * @param {string} [hint]                   - Sous-texte optionnel sous la valeur. Fourni par la page.
 * @param {string} [hoverMessage]           - Message affiché au survol (attribut `title`). Retombe sur `label` si absent.
 * @param {string} [ariaLabel]              - Libellé accessible du bouton. Retombe sur `"label : value"` si absent (cartes cliquables uniquement).
 * @param {() => void} [onClick]            - Si fourni, la carte devient un bouton cliquable (redirection ou autre action décidée par la page).
 * @param {boolean} [loading]               - Affiche un skeleton à la place de la valeur.
 * @param {boolean} [active]                - Anneau de mise en évidence (ex: filtre actuellement appliqué). Sans effet si non cliquable.
 * @param {boolean} [disabled]              - Désactive le clic et grise la carte.
 * @param {keyof KPI_TONES} [tone='gray']   - Teinte de la carte, puisée dans la palette commune `KPI_TONES`. Ignorée pour un attribut donné si son override explicite (`className`, etc.) est fourni.
 * @param {string} [className]              - Override du fond/de la bordure du conteneur — remplace la classe dérivée de `tone`.
 * @param {string} [iconClassName]          - Override de la couleur de l'icône — remplace la classe dérivée de `tone`.
 * @param {string} [valueClassName]         - Override de la couleur de la valeur — remplace la classe dérivée de `tone`.
 * @param {string} [labelClassName]         - Override de la couleur du libellé — remplace la classe dérivée de `tone`.
 */
const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
  hoverMessage,
  ariaLabel,
  onClick,
  loading = false,
  active = false,
  disabled = false,
  tone = 'gray',
  className,
  iconClassName,
  valueClassName,
  labelClassName,
}) => {
  const interactive = typeof onClick === 'function' && !disabled;
  const Wrapper = interactive ? 'button' : 'div';
  const toneStyle = KPI_TONES[tone] || KPI_TONES.gray;

  const containerClassName =
    className ?? `${BASE_CONTAINER_CLASS} ${toneStyle.container} hover:shadow-md`;
  const resolvedIconClassName = iconClassName ?? toneStyle.icon;
  const resolvedValueClassName = valueClassName ?? toneStyle.value;
  const resolvedLabelClassName = labelClassName ?? toneStyle.label;

  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={interactive ? disabled : undefined}
      title={hoverMessage || label}
      aria-label={interactive ? (ariaLabel || `${label} : ${value}`) : undefined}
      className={`w-full text-left transition-shadow ${
        interactive
          ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-medical-primary'
          : ''
      } ${active ? 'ring-2 ring-medical-primary shadow-md' : ''} ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${containerClassName}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${resolvedLabelClassName}`}>{label}</p>
          {loading ? (
            <div className="h-7 w-16 mt-1 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${resolvedValueClassName}`}>{value}</p>
          )}
          {hint && !loading && (
            <p className="text-xs text-gray-500 mt-1">{hint}</p>
          )}
        </div>
        {Icon && <Icon className={`w-8 h-8 flex-shrink-0 ${resolvedIconClassName}`} />}
      </div>
    </Wrapper>
  );
};

export default KpiCard;
