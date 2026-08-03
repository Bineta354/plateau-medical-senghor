import React from 'react';
import { Eye, Edit, Download, Printer, Trash2 } from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const FactureCard = ({ facture, onView, onEdit, onDownload, onPrint, onDelete }) => {
  const getStatusColor = (statut) => {
    switch (statut) {
      case 'payee': return 'bg-green-100 text-green-800';
      case 'en_attente': return 'bg-yellow-100 text-yellow-800';
      case 'impayee': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (statut) => {
    switch (statut) {
      case 'payee': return 'Payée';
      case 'en_attente': return 'En attente';
      case 'impayee': return 'Impayée';
      default: return statut;
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 whitespace-nowrap">
        <div>
          <div className="text-xs font-medium text-gray-900">{facture.numero}</div>
          <div className="text-xs text-gray-500">{new Date(facture.date).toLocaleDateString('fr-FR')}</div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div>
          <div className="text-xs font-medium text-gray-900">
            {facture.patient.prenom} {facture.patient.nom}
          </div>
          <div className="text-xs text-gray-500">{facture.patient.assurance}</div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-gray-900">
          {facture.actes.map((item, index) => (
            <div key={index} className="mb-0.5">
              {item.acte.libelle} (x{item.quantite})
            </div>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div>
          <div className="text-xs font-medium text-gray-900">
            {formatMontant(facture.total)}
          </div>
          <div className="text-xs text-gray-500">
            Patient: {formatMontant(facture.montantPatient)}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(facture.statut)}`}>
          {getStatusText(facture.statut)}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
        <div className="flex space-x-1">
          <button 
            onClick={() => onView(facture)}
            className="text-blue-600 hover:text-blue-900 p-1"
            title="Voir détails"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onEdit(facture)}
            className="text-medical-primary hover:text-medical-primary-dark p-1"
            title="Modifier"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onDownload(facture)}
            className="text-green-600 hover:text-green-900 p-1"
            title="Télécharger PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onPrint(facture)}
            className="text-blue-600 hover:text-blue-900 p-1"
            title="Imprimer"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onDelete(facture)}
            className="text-red-600 hover:text-red-900 p-1"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default FactureCard;
