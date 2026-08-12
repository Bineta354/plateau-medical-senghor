import React from 'react';
import { Eye, Clock, Stethoscope } from 'lucide-react';
import PropTypes from 'prop-types';
import { getConsultationMotif } from '../../utils/consultationUtils';

const ConsultationsTable = ({ consultations, loading, onViewDetails, searchTerm }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Clock className="w-8 h-8 text-gray-400 animate-spin mb-2" />
        <p className="text-gray-500">Chargement des consultations...</p>
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Stethoscope className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Aucune consultation terminée trouvée</p>
        <p className="text-sm text-gray-400 mt-1">
          {searchTerm ? 'Essayez de modifier votre recherche' : 'Aucune consultation terminée pour le moment'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[380px]">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Médecin</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motif</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {consultations.map((consultation) => (
            <tr key={consultation.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {new Date(consultation.date_consultation).toLocaleDateString('fr-FR')}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(consultation.date_consultation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{consultation.patients?.prenom} {consultation.patients?.nom}</div>
                <div className="text-sm text-gray-500">{consultation.patients?.numero_dossier}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">Dr. {consultation.users?.prenom} {consultation.users?.nom}</div>
                <div className="text-sm text-gray-500">{consultation.users?.specialite}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 max-w-xs truncate">
                  {getConsultationMotif(consultation) || consultation.type_consultation || consultation.notes_generales || 'Non spécifié'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onClick={() => onViewDetails(consultation)} className="text-blue-600 hover:text-blue-900" title="Voir détails">
                  <Eye className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

ConsultationsTable.propTypes = {
    consultations: PropTypes.array.isRequired,
    loading: PropTypes.bool.isRequired,
    onViewDetails: PropTypes.func.isRequired,
    searchTerm: PropTypes.string.isRequired

};



export default ConsultationsTable;