import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

const SpecialiteSelect = ({ value, onChange, options }) => {
  const orderedOptions = useMemo(() => {
    const parents = options
      .filter((s) => !s.parent_id)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }));

    const result = [];
    parents.forEach((parent) => {
      result.push(parent);
      const children = options
        .filter((s) => s.parent_id === parent.id)
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }));
      result.push(...children);
    });
    return result;
  }, [options]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité *</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
      >
        <option value="">Sélectionner une spécialité</option>
        {orderedOptions.map((specialite) => (
          <option key={specialite.id} value={specialite.id}>
            {specialite.parent_id ? `— ${specialite.nom}` : specialite.nom}
          </option>
        ))}
      </select>
    </div>
  );
};

SpecialiteSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      nom: PropTypes.string.isRequired,
      parent_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
};

export default SpecialiteSelect;
