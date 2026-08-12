import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * Dropdown — menu déroulant custom (pas un <select> natif) dans le design de l'app,
 * pour que le menu ouvert soit stylé par nous au lieu d'être rendu par l'OS/navigateur.
 * `options`: [{ value, label, icon? }]. `value` vide/null sélectionne le premier `option`.
 *
 * Le menu est rendu via un portail dans `document.body` et positionné en `fixed` d'après
 * la position réelle du bouton déclencheur — sinon un ancêtre `overflow-hidden`/`overflow-auto`
 * (modale scrollable, tableau, panneau `max-h-* overflow-y-auto`...) le tronquerait ou le
 * masquerait au lieu de le laisser flotter par-dessus le reste de la page.
 */
// 'sm' = taille compacte d'origine (ex: sélecteur inline DoctorDashboard_Fixed.jsx).
// 'md' = même gabarit que SearchableSelect (label/padding/texte), pour cohabiter
// dans une même grille de filtres (ex: Recapitulatif.jsx) sans détonner visuellement.
const SIZES = {
  sm: {
    label: 'text-xs font-medium text-gray-700 mb-1.5',
    trigger: 'text-xs pl-2.5 pr-2 py-1.5 min-w-[180px]',
    chevron: 'w-3.5 h-3.5',
    menuItem: 'text-xs',
    check: 'w-3.5 h-3.5',
  },
  md: {
    label: 'text-sm font-medium text-gray-700 mb-1',
    trigger: 'text-sm px-3 py-2',
    chevron: 'w-4 h-4',
    menuItem: 'text-sm',
    check: 'w-4 h-4',
  },
};

const MENU_MAX_HEIGHT = 256; // doit rester cohérent avec la classe Tailwind max-h-64 ci-dessous
const MENU_MIN_WIDTH = 220; // doit rester cohérent avec la classe Tailwind min-w-[220px] ci-dessous
const VIEWPORT_MARGIN = 8;

const Dropdown = ({
  value,
  onChange,
  options,
  disabled = false,
  title,
  label,
  size = 'sm',
  searchable = false,
  searchPlaceholder = 'Rechercher...',
  noResultsLabel = 'Aucun résultat',
  className = '',
  wrapperClassName = '',
  menuClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuPos, setMenuPos] = useState(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const sizeStyle = SIZES[size] || SIZES.sm;

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < MENU_MAX_HEIGHT + VIEWPORT_MARGIN && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, MENU_MIN_WIDTH);
    // le menu est centré sur le déclencheur (comme l'ancien positionnement `left-1/2 -translate-x-1/2`),
    // sans jamais dépasser les bords du viewport.
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN);

    setMenuPos({
      left,
      width,
      openUpward,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      maxHeight: openUpward
        ? Math.max(spaceAbove - VIEWPORT_MARGIN * 2, 120)
        : Math.max(spaceBelow - VIEWPORT_MARGIN * 2, 120),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updateMenuPosition();

    // phase de capture : reçoit aussi les scroll d'un ancêtre scrollable (modale, panneau
    // overflow-y-auto...), pas seulement celui de `window` lui-même.
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      const inContainer = containerRef.current && containerRef.current.contains(event.target);
      const inMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!inContainer && !inMenu) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }
    if (searchable) searchInputRef.current?.focus();
  }, [isOpen, searchable]);

  const normalizedValue = value ?? '';
  const selected = options.find((option) => option.value === normalizedValue) || options[0];

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const query = searchTerm.trim().toLowerCase();
    return options.filter((option) => String(option.label).toLowerCase().includes(query));
  }, [options, searchable, searchTerm]);

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      {label && (
        <label className={`block ${sizeStyle.label}`}>{label}</label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setIsOpen((open) => !open)}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg shadow-sm transition-colors ${sizeStyle.trigger} ${
          disabled
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
        } ${isOpen ? 'ring-2 ring-medical-primary border-transparent' : ''} ${className}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected?.icon}
          <span className="truncate">{selected?.label}</span>
        </span>
        <ChevronDown
          className={`${sizeStyle.chevron} text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !disabled && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuPos.left,
            width: menuPos.width,
            top: menuPos.top,
            bottom: menuPos.bottom,
            maxHeight: Math.min(MENU_MAX_HEIGHT, menuPos.maxHeight),
          }}
          className={`z-[9999] flex flex-col bg-white border border-gray-200 rounded-xl shadow-lg ${menuClassName}`}
        >
          {searchable && (
            <div className="relative px-2 pt-2 pb-1.5 border-b border-gray-100 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className={`w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent ${sizeStyle.menuItem}`}
              />
            </div>
          )}
          <div className="overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className={`px-3 py-2 text-gray-400 ${sizeStyle.menuItem}`}>{noResultsLabel}</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === normalizedValue;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value || null);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 transition-colors ${sizeStyle.menuItem} ${
                      isSelected
                        ? 'bg-medical-primary/10 text-medical-primary font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.icon}
                    <span className="truncate flex-1">{option.label}</span>
                    {isSelected && <Check className={`${sizeStyle.check} flex-shrink-0`} />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Dropdown;
