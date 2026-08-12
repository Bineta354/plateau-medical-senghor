import React from 'react';
import PropTypes from 'prop-types';
import AppointmentTypeMotifFields from '../common/AppointmentTypeMotifFields';

const ConfirmationDetails = ({ formData, onChange, isEditing }) => {
  return (
    <>
      <AppointmentTypeMotifFields
        typeRdv={formData.type_rdv}
        motif={formData.motif}
        motifAutre={formData.motif_autre}
        priorite={formData.priorite}
        showPriorite
        onChange={(fields) => onChange({ ...formData, ...fields })}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
        <select
          value={formData.statut}
          onChange={(e) => onChange({ ...formData, statut: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
        >
          <option value="confirme">Confirmé</option>
          <option value="en_attente">En attente</option>
          {isEditing && <option value="annule">Annulé</option>}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes additionnelles</label>
        <textarea
          value={formData.notes}
          onChange={(e) => onChange({ ...formData, notes: e.target.value })}
          rows={4}
          placeholder="Instructions particulières, informations utiles..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
        />
      </div>
    </>
  );
};

ConfirmationDetails.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  isEditing: PropTypes.bool,
};

export default ConfirmationDetails;
