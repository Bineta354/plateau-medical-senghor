import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Dropdown from '../../components/common/Dropdown';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { Plus, Search, ChevronRight, Folder, List, Edit2, Trash2 } from 'lucide-react';

const EMPTY_FORM = { nom: '', description: '', parent_id: null, actif: true };

const Specialites = () => {
  const [specialites, setSpecialites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchSpecialites();
  }, []);

  const fetchSpecialites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('specialites').select('*').order('nom');
      if (error) throw error;
      setSpecialites(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      unifiedNotificationService.error('Erreur lors du chargement des spécialités');
    } finally {
      setLoading(false);
    }
  };

  const parents = useMemo(() => specialites.filter((s) => !s.parent_id), [specialites]);
  const childrenOf = (parentId) => specialites.filter((s) => s.parent_id === parentId);

  const matchesSearch = (s) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return s.nom.toLowerCase().includes(term) || (s.description || '').toLowerCase().includes(term);
  };

  const visibleParents = useMemo(() => {
    const term = searchTerm.trim();
    return parents
      .map((p) => {
        const children = childrenOf(p.id);
        const matchingChildren = children.filter(matchesSearch);
        const parentMatches = matchesSearch(p);
        if (term && !parentMatches && matchingChildren.length === 0) return null;
        const visibleChildren = term ? matchingChildren : children;
        return {
          ...p,
          hasChildren: children.length > 0,
          childCount: children.length,
          visibleChildren,
          autoExpand: !!term && matchingChildren.length > 0,
        };
      })
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parents, specialites, searchTerm]);

  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openAdd = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (specialite) => {
    setEditing(specialite);
    setFormData({
      nom: specialite.nom,
      description: specialite.description || '',
      parent_id: specialite.parent_id,
      actif: specialite.actif,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim() || saving) return;

    setSaving(true);
    try {
      const payload = {
        nom: formData.nom.trim(),
        description: formData.description.trim() || null,
        parent_id: formData.parent_id || null,
        actif: formData.actif,
      };

      if (editing) {
        const { error } = await supabase.from('specialites').update(payload).eq('id', editing.id);
        if (error) throw error;
        unifiedNotificationService.success('Spécialité modifiée avec succès');
      } else {
        const { error } = await supabase.from('specialites').insert([payload]);
        if (error) throw error;
        unifiedNotificationService.success('Spécialité ajoutée avec succès');
      }

      closeModal();
      fetchSpecialites();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      unifiedNotificationService.error('Erreur lors de la sauvegarde : ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id) => setDeleteConfirm({ isOpen: true, id });

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('specialites').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      fetchSpecialites();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      unifiedNotificationService.error('Erreur lors de la suppression : ' + error.message);
    } finally {
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const parentOptions = [
    { value: '', label: 'Aucune (spécialité principale)' },
    ...parents.filter((p) => !editing || p.id !== editing.id).map((p) => ({ value: String(p.id), label: p.nom })),
  ];

  const childCount = specialites.length - parents.length;
  const isEmpty = visibleParents.length === 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Spécialités</h1>
          <p className="mt-1 text-sm text-gray-500">
            {parents.length} spécialité{parents.length > 1 ? 's' : ''} principale{parents.length > 1 ? 's' : ''} ·{' '}
            {childCount} sous-spécialité{childCount > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-[18px] py-2.5 bg-violet-500 text-white border-none rounded-xl text-sm font-medium cursor-pointer shadow-[0_4px_14px_rgba(139,92,246,.35)] hover:bg-violet-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </button>
      </div>

      {/* Recherche */}
      <div className="relative mb-4">
        <Search className="w-[15px] h-[15px] text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher une spécialité ou sous-spécialité…"
          className="w-full border border-gray-200 rounded-[10px] py-2.5 pl-9 pr-3.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* Liste */}
      <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
        {visibleParents.map((p, index) => {
          const isExpanded = expanded[p.id] ?? p.autoExpand;
          const noChildrenMatch = isExpanded && p.visibleChildren.length === 0;
          return (
            <div key={p.id} className={index > 0 ? 'border-t border-gray-100' : ''}>
              <div
                className="flex items-center gap-3 px-[18px] py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(p.id)}
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 text-gray-400 flex-none transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
                <Folder className="w-[17px] h-[17px] text-violet-700 flex-none" />
                <span className="flex-1 text-sm font-semibold text-gray-900">{p.nom}</span>
                {p.hasChildren && (
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px] font-medium">
                    {p.childCount}
                  </span>
                )}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    p.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {p.actif ? 'Actif' : 'Inactif'}
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                    title="Modifier"
                  >
                    <Edit2 className="w-[13px] h-[13px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(p.id)}
                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-[13px] h-[13px]" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-[#fafafb]">
                  {p.visibleChildren.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 pl-[46px] pr-[18px] py-[11px] border-t border-gray-100"
                    >
                      <List className="w-3.5 h-3.5 text-gray-300 flex-none" />
                      <span className="flex-1 text-[13.5px] text-gray-900">{c.nom}</span>
                      {c.description && <span className="text-xs text-gray-400">{c.description}</span>}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-medium ${
                          c.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {c.actif ? 'Actif' : 'Inactif'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(c.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {noChildrenMatch && (
                    <p className="m-0 pl-[46px] pr-[18px] py-3 text-[12.5px] text-gray-400">
                      Aucune sous-spécialité
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isEmpty && (
          <div className="py-16 px-5 text-center">
            <Search className="w-7 h-7 text-gray-300 mx-auto mb-2.5" />
            <p className="m-0 text-sm text-gray-400">Aucune spécialité ne correspond à cette recherche</p>
          </div>
        )}
      </div>

      {/* Modale ajout / édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? 'Modifier la spécialité' : 'Nouvelle spécialité'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom *</label>
            <input
              type="text"
              required
              value={formData.nom}
              onChange={(e) => setFormData((prev) => ({ ...prev, nom: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-[10px] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Spécialité parente</label>
            <Dropdown
              size="md"
              options={parentOptions}
              value={formData.parent_id != null ? String(formData.parent_id) : ''}
              onChange={(val) => setFormData((prev) => ({ ...prev, parent_id: val ? parseInt(val, 10) : null }))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.actif}
              onChange={(e) => setFormData((prev) => ({ ...prev, actif: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Actif</span>
          </label>

          <div className="flex justify-end gap-2.5 mt-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-none rounded-[10px] text-sm font-medium cursor-pointer transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-[18px] py-2 bg-violet-500 hover:bg-violet-600 text-white border-none rounded-[10px] text-sm font-medium cursor-pointer shadow-[0_4px_14px_rgba(139,92,246,.35)] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={handleConfirmDelete}
        title="Supprimer la spécialité"
        message="Êtes-vous sûr de vouloir supprimer cette spécialité ? Cette action est irréversible."
        type="error"
        confirmText="Supprimer"
      />
    </div>
  );
};

export default Specialites;
