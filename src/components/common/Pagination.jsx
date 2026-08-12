import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Sélecteur autonome "Afficher [N] par page", destiné à être placé en haut
 * d'une liste (à côté de son titre/compteur), séparément de la nav de pagination
 * du bas rendue par <Pagination>.
 * @param {number} value - Nombre d'éléments par page actuellement sélectionné
 * @param {function} onChange - Callback au changement (reçoit un Number)
 * @param {number[]} [options] - Options disponibles
 * @param {string} [label] - Libellé affiché avant le select
 */
export const ItemsPerPageSelector = ({ value, onChange, options = [10, 25, 50, 100], label = 'Afficher' }) => {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-7 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      par page
    </label>
  );
};

/**
 * Composant de Pagination simple.
 * @param {number} currentPage - Page actuelle (1-indexée)
 * @param {number} totalPages - Nombre total de pages
 * @param {function} onPageChange - Callback au changement de page
 * @param {number} [itemsPerPage] - Nombre d'éléments par page (optionnel, utilisé pour le texte "Affichage de A à B")
 * @param {number} [totalItems] - Nombre total d'éléments (optionnel, pour afficher "X résultats")
 */
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}) => {
  if (totalPages <= 1 && totalItems == null) return null;

  const pages = [];
  // Logique simple pour afficher les pages : 1 ... prev current next ... last
  // Pour l'instant, on affiche une plage simple autour de la page courante
  
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (currentPage <= 3) {
    endPage = Math.min(5, totalPages);
  }
  if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 sm:px-6">
      {totalPages > 1 && (
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Précédent
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Suivant
        </button>
      </div>
      )}

      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-700">
            {totalItems != null ? (
              <>
                Affichage de{' '}
                <span className="font-medium">
                  {totalItems === 0 ? 0 : (currentPage - 1) * (itemsPerPage || 0) + 1}
                </span>{' '}
                à{' '}
                <span className="font-medium">
                  {Math.min(currentPage * (itemsPerPage || totalItems), totalItems)}
                </span>{' '}
                sur <span className="font-medium">{totalItems}</span> résultats
              </>
            ) : (
              <>
                Page <span className="font-medium">{currentPage}</span> sur <span className="font-medium">{totalPages}</span>
              </>
            )}
          </p>
        </div>
        {totalPages > 1 && (
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Première</span>
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Précédent</span>
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {pages.map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  currentPage === page
                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Suivant</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Dernière</span>
              <ChevronsRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
        )}
      </div>
    </div>
  );
};

export default Pagination;
