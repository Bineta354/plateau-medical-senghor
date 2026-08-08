import React, { useState } from 'react';
import { 
    X,
    Save
} from 'lucide-react';
import { unifiedNotificationService } from '../../../services/unifiedNotificationService';
import { updateCertificat } from '../../../services/consultation/certificatService';
import { Award } from 'lucide-react';
import PropTypes from 'prop-types';
import Dropdown from '../../common/Dropdown';


const EditCertificatModal = ({ certificat, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    duree_jours: certificat?.duree_jours || 0,
    motif: certificat?.motif || '',
    restrictions: certificat?.restrictions || '',
    statut: certificat?.statut || 'actif'
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const dateDebut = new Date(certificat.date_debut);
      const dateFin = new Date(dateDebut);
      dateFin.setDate(dateFin.getDate() + formData.duree_jours);

      const { error } = await updateCertificat(certificat.id, {
          duree_jours: formData.duree_jours,
          motif: formData.motif || null,
          restrictions: formData.restrictions || null,
          date_fin: dateFin.toISOString().split('T')[0],
          statut: formData.statut,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      unifiedNotificationService.success('Certificat mis à jour avec succès');
      onSave();
    } catch (err) {
      console.error('❌ Erreur mise à jour certificat:', err);
      unifiedNotificationService.error('Erreur lors de la mise à jour du certificat');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-yellow-600 to-amber-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center">
              <Award className="w-5 h-5 mr-2" />
              Éditer le certificat
            </h3>
            <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Type de certificat</p>
            <p className="font-semibold text-gray-900">{certificat.types_certificats?.nom || 'Certificat médical'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (jours)</label>
              <input
                type="number"
                value={formData.duree_jours}
                onChange={(e) => setFormData({ ...formData, duree_jours: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <Dropdown
                value={formData.statut}
                onChange={(value) => setFormData({ ...formData, statut: value })}
                options={[
                  { value: 'actif', label: 'Actif' },
                  { value: 'expire', label: 'Expiré' },
                  { value: 'annule', label: 'Annulé' },
                ]}
                size="md"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
            <textarea
              value={formData.motif}
              onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Motif du certificat..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Restrictions</label>
            <textarea
              value={formData.restrictions}
              onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Restrictions éventuelles..."
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

EditCertificatModal.propTypes = {
  certificat: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};


export default EditCertificatModal;