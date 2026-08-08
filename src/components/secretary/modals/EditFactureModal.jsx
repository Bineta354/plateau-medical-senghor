import React, { useState } from 'react';
import {   
    X,
    Save
} from 'lucide-react';
import { unifiedNotificationService } from '../../../services/unifiedNotificationService';
import { updateFacture } from '../../../services/paiementService';
import { Receipt } from 'lucide-react';
import PropTypes from 'prop-types';
import { formatMontant } from '../../../utils/currency';
import Dropdown from '../../common/Dropdown';

const EditFactureModal = ({ facture, onClose, onSave }) => {

  const [formData, setFormData] = useState({
    montant_ht: facture?.montant_ht || 0,
    tva: facture?.tva || 0,
    montant_ttc: facture?.montant_ttc || 0,
    montant_paye: facture?.montant_paye || 0,
    statut_paiement: facture?.statut_paiement || 'en_attente',
    mode_paiement: facture?.mode_paiement || '',
    notes: facture?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await updateFacture(facture.id, {
          montant_ht: parseFloat(formData.montant_ht),
          tva: parseFloat(formData.tva),
          montant_ttc: parseFloat(formData.montant_ttc),
          montant_paye: parseFloat(formData.montant_paye),
          statut_paiement: formData.statut_paiement,
          mode_paiement: formData.mode_paiement || null,
          notes: formData.notes || null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      unifiedNotificationService.success('Facture mise à jour avec succès');
      onSave();
    } catch (err) {
      console.error('❌ Erreur mise à jour facture:', err);
      unifiedNotificationService.error('Erreur lors de la mise à jour de la facture');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center">
              <Receipt className="w-5 h-5 mr-2" />
              Éditer la facture
            </h3>
            <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Numéro facture</p>
            <p className="font-semibold text-gray-900">{facture.numero_facture}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant HT (FCFA)</label>
              <input
                type="number"
                value={formData.montant_ht}
                onChange={(e) => {
                  const ht = parseFloat(e.target.value) || 0;
                  const ttc = ht * (1 + formData.tva / 100);
                  setFormData({ ...formData, montant_ht: ht, montant_ttc: ttc });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TVA (%)</label>
              <input
                type="number"
                value={formData.tva}
                onChange={(e) => {
                  const tva = parseFloat(e.target.value) || 0;
                  const ttc = formData.montant_ht * (1 + tva / 100);
                  setFormData({ ...formData, tva, montant_ttc: ttc });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant TTC (FCFA)</label>
              <input
                type="number"
                value={formData.montant_ttc}
                onChange={(e) => setFormData({ ...formData, montant_ttc: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant payé (FCFA)</label>
              <input
                type="number"
                value={formData.montant_paye}
                onChange={(e) => setFormData({ ...formData, montant_paye: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut paiement</label>
              <Dropdown
                value={formData.statut_paiement}
                onChange={(value) => setFormData({ ...formData, statut_paiement: value })}
                options={[
                  { value: 'en_attente', label: 'En attente' },
                  { value: 'partiel', label: 'Partiel' },
                  { value: 'paye', label: 'Payé' },
                  { value: 'impaye', label: 'Impayé' },
                ]}
                size="md"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
              <Dropdown
                value={formData.mode_paiement}
                onChange={(value) => setFormData({ ...formData, mode_paiement: value })}
                options={[
                  { value: '', label: 'Sélectionner' },
                  { value: 'especes', label: 'Espèces' },
                  { value: 'carte', label: 'Carte' },
                  { value: 'cheque', label: 'Chèque' },
                  { value: 'assurance', label: 'Assurance' },
                  { value: 'monnaie_electronique', label: 'Monnaie électronique' },
                ]}
                size="md"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

EditFactureModal.propTypes = {
  facture: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default EditFactureModal;