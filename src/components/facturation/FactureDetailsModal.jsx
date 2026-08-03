import React from 'react';
import { X, Download, Printer } from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const FactureDetailsModal = ({ facture, onClose, onDownload, onPrint }) => {
  if (!facture) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Détails de la facture {facture.numero}
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
            </div>
          </div>
          
          {/* Actes facturés */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Actes facturés</h4>
            <div className="space-y-1">
              {facture.actes.map((item, index) => (
                <div key={index} className="bg-gray-50 p-2 rounded flex justify-between text-sm">
                  <span>{item.acte.libelle} (x{item.quantite})</span>
                  <span className="font-medium">{formatMontant(item.tarifUnitaire * item.quantite)}</span>
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
            className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Télécharger PDF
          </button>
          <button 
            onClick={() => onPrint(facture)}
            className="flex items-center px-3 py-1.5 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark text-sm"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
};

export default FactureDetailsModal;
