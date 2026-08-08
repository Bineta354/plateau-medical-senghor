import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save } from 'lucide-react';
import { useToothStates } from '../../hooks/useToothStates';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

const ToothIcon = ({ className, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5.5c-1.5-1.8-4-2.3-6-1-2 1.3-2.6 4-1.5 6.3.9 1.9 2.7 4.7 4.2 7 .8 1.2 1.2 1.9 1.8 2.2.5.2 1 .2 1.5 0 .6-.3 1-.9 1.8-2.2 1.5-2.3 3.3-5.1 4.2-7 1.1-2.3.5-5-1.5-6.3-2-1.3-4.5-.8-6 1Z" />
  </svg>
);

const initialFormState = {
  code: '',
  name: '',
  color: '#ffffff',
  border_color: '#000000',
  is_system: false,
  order_index: 0
};

const ToothStatesPage = () => {
  const { states, loading, error, createState, updateState, deleteState } = useToothStates();
  const { dialogState, showConfirm, closeDialog } = useConfirmDialog();

  const [isEditing, setIsEditing] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleEdit = (state) => {
    setEditingState(state);
    setFormData({ ...state });
    setFormError(null);
    setIsEditing(true);
  };

  const handleCreate = () => {
    setEditingState(null);
    setFormData(initialFormState);
    setFormError(null);
    setIsEditing(true);
  };

  const handleCloseModal = () => {
    setIsEditing(false);
    setFormError(null);
  };

  const handleDelete = (id) => {
    showConfirm({
      title: 'Supprimer cet état ?',
      message: 'Êtes-vous sûr de vouloir supprimer cet état dentaire ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      type: 'danger',
      onConfirm: async () => {
        await deleteState(id);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const result = editingState
      ? await updateState(editingState.id, formData)
      : await createState(formData);
    setSaving(false);

    if (result.success) {
      handleCloseModal();
    } else {
      setFormError(result.error?.message || "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  if (loading && !states.length) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-none">
            <ToothIcon className="text-violet-700" size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">États dentaires</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configurez les états possibles pour le schéma dentaire</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors"
        >
          <Plus size={16} />
          Nouvel état
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg text-red-700 text-sm">
          Erreur: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-20">Aperçu</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nom</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Code</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Couleurs</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-28">Type</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {states.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    Aucun état dentaire configuré pour le moment.
                  </td>
                </tr>
              ) : (
                states.map((state) => (
                  <tr key={state.id} className="group hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div
                        className="w-8 h-8 rounded-full border-2"
                        style={{ backgroundColor: state.color, borderColor: state.border_color }}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] font-medium text-gray-900">{state.name}</td>
                    <td className="px-5 py-3.5 text-[13px] text-gray-500 font-mono">{state.code}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[11px]">Fond: {state.color}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[11px]">Bord: {state.border_color}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {state.is_system ? (
                        <span className="inline-flex px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[11px] font-semibold w-fit">
                          Système
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-semibold w-fit">
                          Personnalisé
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(state)}
                          className="p-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={14} />
                        </button>
                        {!state.is_system && (
                          <button
                            onClick={() => handleDelete(state.id)}
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isEditing}
        onClose={handleCloseModal}
        title={editingState ? "Modifier l'état" : 'Nouvel état dentaire'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Code (unique) *</label>
            <input
              type="text"
              required
              disabled={!!editingState}
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              placeholder="EX: IMPLANT_GOLD"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Couleur de fond</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-9 p-0 border border-gray-200 rounded-lg cursor-pointer"
                />
                <span className="text-xs text-gray-500 font-mono">{formData.color}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Couleur de bordure</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.border_color || '#000000'}
                  onChange={(e) => setFormData({ ...formData, border_color: e.target.value })}
                  className="w-10 h-9 p-0 border border-gray-200 rounded-lg cursor-pointer"
                />
                <span className="text-xs text-gray-500 font-mono">{formData.border_color}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Ordre d'affichage</label>
            <input
              type="number"
              value={formData.order_index}
              onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col items-center gap-2">
            <span className="text-xs text-gray-400">Aperçu</span>
            <div
              className="w-14 h-14 rounded-full"
              style={{ backgroundColor: formData.color, border: `4px solid ${formData.border_color || '#000000'}` }}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
      />
    </div>
  );
};

export default ToothStatesPage;
