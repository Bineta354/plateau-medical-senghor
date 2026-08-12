import React, { useState } from 'react';
import { 
    X,
    Save
} from 'lucide-react';
import { unifiedNotificationService } from '../../../services/unifiedNotificationService';
import { updateAnalyse } from '../../../services/consultation/analyseService';
import { Database } from 'lucide-react';
import PropTypes from 'prop-types';
import Dropdown from '../../common/Dropdown';


const EditAnalyseModal = ({ analyse, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    type_analyse: analyse?.type_analyse || '',
    description: analyse?.description || '',
    statut: analyse?.statut || 'prescrit',
    urgence: analyse?.urgence || false
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await updateAnalyse(analyse.id, {
          type_analyse: formData.type_analyse,
          description: formData.description || null,
          statut: formData.statut,
          urgence: formData.urgence,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      unifiedNotificationService.success('Analyse mise à jour avec succès');
      onSave();
    } catch (err) {
      console.error('❌ Erreur mise à jour analyse:', err);
      unifiedNotificationService.error('Erreur lors de la mise à jour de l\'analyse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Éditer l&pos;analyse
            </h3>
            <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d&apos;analyse</label>
            <input
              type="text"
              value={formData.type_analyse}
              onChange={(e) => setFormData({ ...formData, type_analyse: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Bilan sanguin, Analyse d'urine..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Description détaillée de l'analyse..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <Dropdown
                value={formData.statut}
                onChange={(value) => setFormData({ ...formData, statut: value })}
                options={[
                  { value: 'prescrit', label: 'Prescrit' },
                  { value: 'en_cours', label: 'En cours' },
                  { value: 'termine', label: 'Terminé' },
                  { value: 'annule', label: 'Annulé' },
                ]}
                size="md"
                className="w-full"
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.urgence}
                  onChange={(e) => setFormData({ ...formData, urgence: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Urgent</span>
              </label>
            </div>
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

EditAnalyseModal.propTypes = {
  analyse: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default EditAnalyseModal;