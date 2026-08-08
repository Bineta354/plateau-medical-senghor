import React, { useState } from 'react';
import {  
    X,
    Save
} from 'lucide-react';
import { unifiedNotificationService } from '../../../services/unifiedNotificationService';
import { updateOrdonnance } from '../../../services/consultation/ordonnanceService';
import
{ Pill } from 'lucide-react';
import PropTypes from 'prop-types';
import Dropdown from '../../common/Dropdown';

const EditOrdonnanceModal = ({ ordonnance, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    instructions_generales: ordonnance?.instructions_generales || '',
    statut: ordonnance?.statut || 'active'
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await updateOrdonnance(ordonnance.id, {
          instructions_generales: formData.instructions_generales || null,
          statut: formData.statut,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      unifiedNotificationService.success('Ordonnance mise à jour avec succès');
      onSave();
    } catch (err) {
      console.error('❌ Erreur mise à jour ordonnance:', err);
      unifiedNotificationService.error('Erreur lors de la mise à jour de l\'ordonnance');
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
              <Pill className="w-5 h-5 mr-2" />
              Éditer l&apos;ordonnance
            </h3>
            <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Numéro ordonnance</p>
            <p className="font-semibold text-gray-900">{ordonnance.numero_ordonnance || `ORD-${ordonnance.id}`}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions générales</label>
            <textarea
              value={formData.instructions_generales}
              onChange={(e) => setFormData({ ...formData, instructions_generales: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Instructions générales pour le patient..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <Dropdown
              value={formData.statut}
              onChange={(value) => setFormData({ ...formData, statut: value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'terminee', label: 'Terminée' },
                { value: 'annulee', label: 'Annulée' },
              ]}
              size="md"
              className="w-full"
            />
          </div>
          {ordonnance.lignes_ordonnance && ordonnance.lignes_ordonnance.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Médicaments prescrits</p>
              <div className="space-y-2">
                {ordonnance.lignes_ordonnance.map((ligne, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900">{ligne.medicaments?.nom || 'Médicament'}</p>
                    <p className="text-sm text-gray-600">Posologie: {ligne.posologie}</p>
                    <p className="text-sm text-gray-600">Quantité: {ligne.quantite} - Durée: {ligne.duree_traitement} jours</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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

EditOrdonnanceModal.propTypes = {
  ordonnance: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};
export default EditOrdonnanceModal;