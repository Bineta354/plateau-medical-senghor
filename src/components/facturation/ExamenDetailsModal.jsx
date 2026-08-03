import React from 'react';
import { X, Download, CheckCircle } from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const ExamenDetailsModal = ({ facture, onClose, onDownload }) => {
  if (!facture) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Détails de l'examen {facture.numero}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Informations patient */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Informations patient</h4>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm"><span className="font-medium">Nom :</span> {facture.patient.prenom} {facture.patient.nom}</p>
              <p className="text-sm"><span className="font-medium">Assurance :</span> {facture.patient.assurance}</p>
              <p className="text-sm"><span className="font-medium">Médecin :</span> {facture.medecin}</p>
              <p className="text-sm"><span className="font-medium">Date :</span> {new Date(facture.dateRealisation).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          
          {/* Examens programmés */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Examens programmés</h4>
            <div className="space-y-1">
              {facture.examens.map((item, index) => (
                <div key={index} className="bg-gray-50 p-2 rounded flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{item.examen.libelle}</span>
                    <span className="text-xs text-gray-500 block">{item.examen.categorie} - {item.examen.duree}min</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{formatMontant(item.tarifUnitaire)}</span>
                    {item.realise && <CheckCircle className="w-4 h-4 text-green-500" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Détails financiers */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Détails financiers</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Sous-total :</span>
                <span>{formatMontant(facture.sousTotal)}</span>
              </div>
              {facture.remise > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Remise :</span>
                  <span>-{formatMontant(facture.remise)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Part assurance :</span>
                <span>{formatMontant(facture.montantAssurance)}</span>
              </div>
              <div className="flex justify-between">
                <span>Part patient :</span>
                <span>{formatMontant(facture.montantPatient)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total :</span>
                <span>{formatMontant(facture.total)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            Fermer
          </button>
          <button 
            onClick={() => onDownload(facture)}
            className="flex items-center px-3 py-1.5 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark text-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamenDetailsModal;
