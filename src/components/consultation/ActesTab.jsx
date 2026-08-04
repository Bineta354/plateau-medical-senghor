import React, { useState } from 'react';
import { Plus, Stethoscope } from 'lucide-react';
import PropTypes from 'prop-types';
import ActesModal from './modals/ActesModal';
import { formatMontant } from '../../utils/currency';


export default function ActesTab(
  { actes, fetchActes, actesRef, setActesRef, id, patient, consultation, isTerminated = false }
) {
  // Handlers détectés et injectés automatiquement
  const [showActeModal, setShowActeModal] = useState(false)

  const handleAddActe = () => {
    setShowActeModal(true);
  };


  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Actes médicaux</h2>
          {!isTerminated && (
            <button 
              onClick={handleAddActe}
              className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </button>
          )}
        </div>
    
        {actes.length > 0 ? (
          <div className="space-y-3">
            {actes.map((acte) => (
              <div key={acte.id} className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Stethoscope className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-gray-900">
                            {acte.types_actes?.nom}
                          </h3>
                          {acte.dent_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                              🦷 Dent {acte.dent_id}
                              {acte.dent_nom && (
                                <span className="font-normal text-blue-500">— {acte.dent_nom}</span>
                              )}
                            </span>
                          )}
                        </div>
                        {acte.types_actes?.description && (
                          <p className="text-xs text-gray-500">
                            {acte.types_actes.description}
                          </p>
                        )}
                        {acte.notes && (
                          <p className="text-xs text-gray-400 italic mt-0.5">📝 {acte.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Qté:</span>
                      <span className="font-medium text-gray-900">{acte.quantite}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-xs text-gray-500 block">
                        {formatMontant(acte.tarif_unitaire || 0)} × {acte.quantite}
                      </span>
                      <span className="text-lg font-bold text-purple-600">
                        {formatMontant(acte.montant_total || (acte.tarif_unitaire * acte.quantite) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total des actes:</span>
                <span className="text-xl font-bold text-purple-600">
                  {formatMontant(actes.reduce((sum, acte) => sum + parseFloat(acte.montant_total || (acte.tarif_unitaire * acte.quantite) || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Stethoscope className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun acte</h3>
            <p className="mt-1 text-sm text-gray-500">
              Aucun acte médical n&apos;a été enregistré lors de cette consultation.
            </p>
          </div>
        )}
      </div>
      { showActeModal && (
        <ActesModal
          setShowActeModal={setShowActeModal}
          fetchActes={fetchActes}
          actesRef={actesRef}
          id={id}
          setActesRef={setActesRef}
        />
      ) }

      </>
    )}

ActesTab.propTypes = {
  actes: PropTypes.array.isRequired,
  fetchActes: PropTypes.func.isRequired,
  actesRef: PropTypes.array.isRequired, 
  setActesRef: PropTypes.func.isRequired,
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  patient: PropTypes.object,
  consultation: PropTypes.object,
};

