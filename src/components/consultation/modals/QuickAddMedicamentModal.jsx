import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Pill, X } from 'lucide-react';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import PropTypes from 'prop-types';

const FORMES_PHARMACEUTIQUES = [
  'Comprimé', 'Gélule', 'Sirop', 'Ampoule', 'Flacon', 'Pommade', 'Crème', 'Gel', 'Suppositoire', 'Collyre', 'Spray', 'Patch'
];

// Ajout rapide d'un médicament absent du référentiel, sans quitter l'ordonnance en cours.
// Ne couvre que les champs essentiels — pour le détail complet (contre-indications,
// interactions, spécialité...), passer par Paramétrage > Médicaments.
const QuickAddMedicamentModal = ({ onClose, onCreated }) => {
  const { showSuccess, showError, showWarning } = useConfirmDialog();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: '',
    forme_pharmaceutique: '',
    dosage: '',
    posologie_defaut: '',
  });

  const handleSave = async () => {
    if (!form.nom.trim()) {
      showWarning('Le nom du médicament est obligatoire');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('medicaments')
        .insert([{
          nom: form.nom.trim(),
          forme_pharmaceutique: form.forme_pharmaceutique || null,
          dosage: form.dosage || null,
          posologie_defaut: form.posologie_defaut || null,
          actif: true,
        }])
        .select()
        .single();

      if (error) throw error;
      onCreated(data);
    } catch (error) {
      // Un médicament du même nom existe déjà (contrainte d'unicité) : au lieu d'afficher
      // une erreur technique, on le retrouve et on le sélectionne directement — c'est
      // très probablement ce que le médecin cherchait à faire.
      if (error.code === '23505') {
        const { data: existant, error: lookupError } = await supabase
          .from('medicaments')
          .select('*')
          .ilike('nom', form.nom.trim())
          .maybeSingle();

        if (!lookupError && existant) {
          showSuccess(`« ${existant.nom} » existe déjà dans la liste — sélectionné automatiquement.`);
          onCreated(existant);
          return;
        }

        showWarning(`Un médicament nommé « ${form.nom.trim()} » existe déjà. Cherchez-le dans le champ "Médicament" ci-dessus.`);
        return;
      }

      console.error('Erreur lors de l\'ajout du médicament:', error);
      showError('Erreur lors de l\'ajout du médicament : ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-start justify-center overflow-y-auto z-[60]">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Pill className="w-5 h-5 text-green-600" />
            Nouveau médicament
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Ajout rapide au référentiel. Pour les contre-indications, interactions ou la
          spécialité, complétez-le ensuite depuis Paramétrage &gt; Médicaments.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Paracétamol"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forme</label>
              <select
                value={form.forme_pharmaceutique}
                onChange={(e) => setForm({ ...form, forme_pharmaceutique: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">—</option>
                {FORMES_PHARMACEUTIQUES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
              <input
                type="text"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 500mg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posologie par défaut</label>
            <input
              type="text"
              value={form.posologie_defaut}
              onChange={(e) => setForm({ ...form, posologie_defaut: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 1 comprimé 3 fois par jour"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Ajout...' : 'Ajouter et utiliser'}
          </button>
        </div>
      </div>
    </div>
  );
};

QuickAddMedicamentModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};

export default QuickAddMedicamentModal;
