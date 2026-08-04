import React, { useState } from 'react';
import { 
    Activity,   
    X,
    Save
} from 'lucide-react';
import { unifiedNotificationService } from '../../../services/unifiedNotificationService';
import { updateActe } from '../../../services/consultation/acteService';
import PropTypes from 'prop-types';
import { formatMontant } from '../../../utils/currency';

const EditActeModal = ({ acte, onClose, onSave }) => {

  const [formData, setFormData] = useState({
    quantite: acte?.quantite || 1,
    tarif_unitaire: acte?.tarif_unitaire || acte?.types_actes?.tarif_defaut || 0,
    notes: acte?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  // Calculer le montant total
  const montantTotal = formData.quantite * formData.tarif_unitaire;

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error } = await updateActe(acte.id, {
          quantite: formData.quantite,
          tarif_unitaire: parseFloat(formData.tarif_unitaire),
          montant_total: montantTotal,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      unifiedNotificationService.success('Acte mis à jour avec succès');
      onSave();
    } catch (err) {
      console.error('❌ Erreur mise à jour acte:', err);
      unifiedNotificationService.error('Erreur lors de la mise à jour de l\'acte');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Éditer l&apos;acte
            </h3>
            <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Type d&apos;acte</p>
            <p className="font-semibold text-gray-900">{acte.types_actes?.nom || 'Acte'}</p>
            {acte.types_actes?.description && (
              <p className="text-sm text-gray-600 mt-1">{acte.types_actes.description}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
              <input
                type="number"
                min="1"
                value={formData.quantite}
                onChange={(e) => setFormData({ ...formData, quantite: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarif unitaire (FCFA)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.tarif_unitaire}
                onChange={(e) => setFormData({ ...formData, tarif_unitaire: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Montant total</span>
              <span className="text-lg font-bold text-blue-700">
                {formatMontant(montantTotal)}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {formData.quantite} × {formatMontant(formData.tarif_unitaire)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Notes supplémentaires sur cet acte..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};
EditActeModal.propTypes = {
  acte: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
};


export default EditActeModal;