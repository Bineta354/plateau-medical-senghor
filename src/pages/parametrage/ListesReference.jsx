import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast.jsx';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  antecedentsRefService,
  signesCliniquesRefService,
  diagnosticsRefService,
  appareilsRefService,
} from '../../services/referentielService';
import { specialtyService } from '../../lib/services/specialtyService';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  ListChecks,
  Stethoscope,
  Eye,
  Activity,
  Monitor,
  FileSearch,
  History,
  Pill,
  FileText,
} from 'lucide-react';

/**
 * "Listes de référence" gère, sur une seule page, tout le vocabulaire clinique
 * réellement utilisé pendant une consultation (cf. src/services/consultation/
 * referenceDataService.js) : antécédents, signes cliniques, diagnostics,
 * appareils, médicaments, constantes vitales et documents. Un seul moteur
 * CRUD générique (liste + modale, piloté par `fields`) gère les 8 tables au
 * lieu de dupliquer le composant liste/formulaire à chaque table — cf. le même
 * principe déjà appliqué dans src/pages/administration/GestionUtilisateurs.jsx.
 */

const CATEGORIES_ANTECEDENTS = [
  { value: 'generale', label: 'Générale' },
  { value: 'cardiovasculaire', label: 'Cardiovasculaire' },
  { value: 'respiratoire', label: 'Respiratoire' },
  { value: 'digestif', label: 'Digestif' },
  { value: 'neurologique', label: 'Neurologique' },
  { value: 'metabolique', label: 'Métabolique' },
  { value: 'oncologique', label: 'Oncologique' },
  { value: 'allergique', label: 'Allergique' },
  { value: 'chirurgical', label: 'Chirurgical' },
  { value: 'traumatologique', label: 'Traumatologique' },
  { value: 'psychiatrique', label: 'Psychiatrique' },
];

const CATEGORIES_SIGNES = [
  { value: 'generale', label: 'Général' },
  { value: 'neurologique', label: 'Neurologique' },
  { value: 'dermatologique', label: 'Dermatologique' },
  { value: 'cardiovasculaire', label: 'Cardiovasculaire' },
  { value: 'respiratoire', label: 'Respiratoire' },
  { value: 'orthopedique', label: 'Orthopédique' },
  { value: 'dentaire', label: 'Dentaire' },
  { value: 'parodontal', label: 'Parodontal' },
  { value: 'muqueuse', label: 'Muqueuse' },
  { value: 'fonctionnel', label: 'Fonctionnel' },
  { value: 'salivaire', label: 'Salivaire' },
];

const CATEGORIES_CONSTANTES = [
  { value: 'generale', label: 'Générale' },
  { value: 'cardiovasculaire', label: 'Cardiovasculaire' },
  { value: 'respiratoire', label: 'Respiratoire' },
  { value: 'metabolique', label: 'Métabolique' },
  { value: 'neurologique', label: 'Neurologique' },
  { value: 'dermatologique', label: 'Dermatologique' },
  { value: 'orthopedique', label: 'Orthopédique' },
];

const NIVEAUX_GRAVITE = [
  { value: 'leger', label: 'Léger', color: 'bg-green-100 text-green-700' },
  { value: 'modere', label: 'Modéré', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'grave', label: 'Grave', color: 'bg-orange-100 text-orange-700' },
  { value: 'critique', label: 'Critique', color: 'bg-red-100 text-red-700' },
];

// Doit rester synchronisé avec la contrainte CHECK(type_element IN (...)) sur
// la table elements_synthese (migration 20250102000002_phase2_parametrage_medical.sql).
const TYPES_ELEMENTS = [
  { value: 'observation', label: 'Observation', color: 'bg-blue-100 text-blue-700' },
  { value: 'conclusion', label: 'Conclusion', color: 'bg-purple-100 text-purple-700' },
  { value: 'recommandation', label: 'Recommandation', color: 'bg-green-100 text-green-700' },
  { value: 'prescription', label: 'Prescription', color: 'bg-orange-100 text-orange-700' },
];

const FORMES_PHARMACEUTIQUES = [
  'Comprimé', 'Gélule', 'Sirop', 'Ampoule', 'Flacon', 'Pommade',
  'Crème', 'Gel', 'Suppositoire', 'Collyre', 'Spray', 'Patch',
].map((v) => ({ value: v, label: v }));

const GROUPS = [
  {
    id: 'clinique',
    label: 'Antécédents & Diagnostics',
    icon: Stethoscope,
    items: [
      {
        key: 'antecedents',
        label: 'Antécédents',
        icon: History,
        table: 'antecedents',
        refService: antecedentsRefService,
        liaisonTable: 'antecedents_specialites',
        fields: [
          { name: 'code_cim', label: 'Code CIM-10', type: 'text' },
          { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES_ANTECEDENTS, default: 'generale' },
          { name: 'niveau_gravite', label: 'Gravité', type: 'select', options: NIVEAUX_GRAVITE, default: 'leger', badge: true },
          { name: 'specialites', label: 'Spécialités concernées', type: 'specialites-multi' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
      {
        key: 'signes-cliniques',
        label: 'Signes cliniques',
        icon: Eye,
        table: 'signes_cliniques',
        refService: signesCliniquesRefService,
        liaisonTable: 'signes_cliniques_specialites',
        fields: [
          { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES_SIGNES, default: 'generale' },
          { name: 'specialites', label: 'Spécialités concernées', type: 'specialites-multi' },
          { name: 'description', label: 'Description', type: 'textarea' },
        ],
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics',
        icon: FileSearch,
        table: 'diagnostics',
        refService: diagnosticsRefService,
        liaisonTable: 'diagnostics_specialites',
        fields: [
          { name: 'code_cim', label: 'Code CIM-10', type: 'text' },
          { name: 'niveau_gravite', label: 'Gravité', type: 'select', options: NIVEAUX_GRAVITE, default: 'leger', badge: true },
          { name: 'specialites', label: 'Spécialités concernées', type: 'specialites-multi' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
    ],
  },
  {
    id: 'examen',
    label: 'Examen clinique',
    icon: Monitor,
    items: [
      {
        key: 'appareils',
        label: 'Appareils',
        icon: Monitor,
        table: 'appareils',
        refService: appareilsRefService,
        liaisonTable: 'appareils_specialites',
        fields: [
          { name: 'specialites', label: 'Spécialités concernées', type: 'specialites-multi' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
      {
        key: 'constantes',
        label: 'Constantes vitales',
        icon: Activity,
        table: 'constantes',
        fields: [
          { name: 'unite', label: 'Unité', type: 'text' },
          { name: 'valeur_normale_min', label: 'Valeur normale min', type: 'number' },
          { name: 'valeur_normale_max', label: 'Valeur normale max', type: 'number' },
          { name: 'valeur_min', label: 'Valeur min (alerte)', type: 'number', column: false },
          { name: 'valeur_max', label: 'Valeur max (alerte)', type: 'number', column: false },
          { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES_CONSTANTES, default: 'generale' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
    ],
  },
  {
    id: 'prescription',
    label: 'Prescriptions & Documents',
    icon: Pill,
    items: [
      {
        key: 'medicaments',
        label: 'Médicaments',
        icon: Pill,
        table: 'medicaments',
        specialiteField: 'specialite_id',
        fields: [
          { name: 'forme_pharmaceutique', label: 'Forme', type: 'select', options: FORMES_PHARMACEUTIQUES },
          { name: 'dosage', label: 'Dosage', type: 'text' },
          { name: 'specialite_id', label: 'Spécialité', type: 'specialite-single' },
          { name: 'posologie_defaut', label: 'Posologie par défaut', type: 'textarea' },
          { name: 'contre_indications', label: 'Contre-indications', type: 'textarea' },
          { name: 'interactions', label: 'Interactions', type: 'textarea' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
      {
        key: 'types-certificats',
        label: 'Types de certificats',
        icon: FileText,
        table: 'types_certificats',
        specialiteField: 'specialite_id',
        fields: [
          { name: 'duree_defaut', label: 'Durée par défaut (jours)', type: 'number', default: 0 },
          { name: 'specialite_id', label: 'Spécialité', type: 'specialite-single' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
      {
        key: 'elements-synthese',
        label: 'Éléments de synthèse',
        icon: FileText,
        table: 'elements_synthese',
        fields: [
          { name: 'type_element', label: "Type d'élément", type: 'select', options: TYPES_ELEMENTS, default: 'observation', badge: true },
          { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES_ANTECEDENTS, default: 'generale' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'ordre_affichage', label: "Ordre d'affichage", type: 'number', default: 0, column: false },
        ],
      },
    ],
  },
];

const ALL_REFERENTIELS = GROUPS.flatMap((g) => g.items);

const emptyFormData = (item) => {
  const base = { nom: '', actif: true };
  item.fields.forEach((f) => {
    if (f.type === 'specialites-multi') return;
    base[f.name] = f.default ?? (f.type === 'number' ? '' : '');
  });
  return base;
};

const optionLabel = (options, value) => options.find((o) => o.value === value)?.label ?? value;
const optionColor = (options, value) => options.find((o) => o.value === value)?.color ?? 'bg-gray-100 text-gray-600';

/** Panneau liste + modale pour un référentiel donné (une table). */
const ReferentielPanel = ({ item, specialites }) => {
  const { showSuccess, showError } = useToast();
  const { dialogState, showWarning, closeDialog } = useConfirmDialog();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(() => emptyFormData(item));
  const [selectedSpecialites, setSelectedSpecialites] = useState([]);
  const [saving, setSaving] = useState(false);

  const hasSpecialitesMulti = item.fields.some((f) => f.type === 'specialites-multi');

  useEffect(() => {
    setSearchTerm('');
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      let data;
      if (item.refService) {
        data = await item.refService.list();
      } else if (item.specialiteField) {
        const res = await supabase
          .from(item.table)
          .select(`*, specialites:${item.specialiteField}(nom)`)
          .order('ordre_affichage', { ascending: true })
          .order('nom');
        if (res.error) throw res.error;
        data = res.data || [];
      } else {
        const res = await supabase
          .from(item.table)
          .select('*')
          .order('ordre_affichage', { ascending: true })
          .order('nom');
        if (res.error) throw res.error;
        data = res.data || [];
      }
      setItems(data);
    } catch (error) {
      console.error(`Erreur lors du chargement de "${item.label}":`, error);
      showError(`Erreur lors du chargement de "${item.label}"`);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setFormData(emptyFormData(item));
    setSelectedSpecialites([]);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingItem(row);
    setFormData({ ...emptyFormData(item), ...row });
    if (item.liaisonTable) {
      setSelectedSpecialites((row[item.liaisonTable] || []).map((lnk) => lnk.specialite_id));
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const toggleSpecialite = (specId) => {
    setSelectedSpecialites((prev) =>
      prev.includes(specId) ? prev.filter((s) => s !== specId) : [...prev, specId]
    );
  };

  const buildPayload = () => {
    const payload = { nom: formData.nom.trim(), actif: !!formData.actif };
    item.fields.forEach((f) => {
      if (f.type === 'specialites-multi') return;
      if (f.type === 'number') {
        payload[f.name] = formData[f.name] === '' || formData[f.name] == null ? null : Number(formData[f.name]);
      } else if (f.type === 'specialite-single') {
        payload[f.name] = formData[f.name] ? Number(formData[f.name]) : null;
      } else {
        payload[f.name] = formData[f.name] || null;
      }
    });
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom || !formData.nom.trim()) {
      showError('Le nom est requis');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      let savedId = editingItem?.id;

      if (item.refService) {
        if (editingItem) {
          await item.refService.update(editingItem.id, payload);
        } else {
          const created = await item.refService.create(payload);
          savedId = created.id;
        }
        if (hasSpecialitesMulti) {
          await item.refService.syncSpecialites(savedId, selectedSpecialites);
        }
      } else if (editingItem) {
        const { error } = await supabase.from(item.table).update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(item.table).insert([payload]);
        if (error) throw error;
      }

      showSuccess(editingItem ? `"${payload.nom}" modifié avec succès` : `"${payload.nom}" ajouté avec succès`);
      closeModal();
      fetchItems();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showError('Erreur lors de la sauvegarde: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row) => {
    showWarning(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer "${row.nom}" ? Cette action est irréversible.`,
      async () => {
        try {
          if (item.refService) {
            await item.refService.remove(row.id);
          } else {
            const { error } = await supabase.from(item.table).delete().eq('id', row.id);
            if (error) throw error;
          }
          showSuccess(`"${row.nom}" supprimé`);
          fetchItems();
        } catch (error) {
          console.error('Erreur lors de la suppression:', error);
          showError('Erreur lors de la suppression: ' + error.message);
        }
      }
    );
  };

  const toggleActif = async (row) => {
    try {
      if (item.refService) {
        await item.refService.update(row.id, { actif: !row.actif });
      } else {
        const { error } = await supabase.from(item.table).update({ actif: !row.actif }).eq('id', row.id);
        if (error) throw error;
      }
      fetchItems();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const getSpecialiteNames = (row) =>
    (row[item.liaisonTable] || []).map((lnk) => lnk.specialites?.nom).filter(Boolean);

  const displayFields = item.fields.filter(
    (f) => f.type !== 'specialites-multi' && f.type !== 'textarea' && f.type !== 'specialite-single' && f.column !== false
  );

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return items;
    return items.filter((row) => {
      if (row.nom?.toLowerCase().includes(term)) return true;
      if (row.description?.toLowerCase().includes(term)) return true;
      return item.fields.some(
        (f) => f.type === 'text' && String(row[f.name] || '').toLowerCase().includes(term)
      );
    });
  }, [items, searchTerm, item.fields]);

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{item.label}</h1>
            <p className="text-[13px] text-gray-500 mt-1">{filteredItems.length} élément(s)</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-[18px] py-2.5 bg-medical-primary text-white rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 14px rgb(var(--medical-primary-rgb) / 0.35)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-[20px] p-4 md:p-5 shadow-sm mb-5">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="w-full border border-gray-200 rounded-[10px] pl-9 pr-3 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary transition-colors"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-gray-400">Chargement...</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="bg-gray-50">
                    <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-500">Nom</th>
                    {displayFields.map((f) => (
                      <th key={f.name} className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">
                        {f.label}
                      </th>
                    ))}
                    {(hasSpecialitesMulti || item.specialiteField) && (
                      <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Spécialités</th>
                    )}
                    <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Statut</th>
                    <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((row) => {
                    const specs = hasSpecialitesMulti ? getSpecialiteNames(row) : null;
                    return (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="py-3 px-5">
                          <div className="font-medium text-gray-900">{row.nom}</div>
                          {row.description && (
                            <div className="text-xs text-gray-400 truncate max-w-[220px]">{row.description}</div>
                          )}
                        </td>
                        {displayFields.map((f) => (
                          <td key={f.name} className="py-3 px-4 text-gray-600">
                            {f.type === 'select' && f.badge ? (
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${optionColor(f.options, row[f.name])}`}>
                                {optionLabel(f.options, row[f.name])}
                              </span>
                            ) : f.type === 'select' ? (
                              optionLabel(f.options, row[f.name])
                            ) : f.type === 'specialite-single' ? (
                              row.specialites?.nom || <span className="text-gray-300">Toutes</span>
                            ) : (
                              row[f.name] ?? <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                        {hasSpecialitesMulti && (
                          <td className="py-3 px-4">
                            {specs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {specs.slice(0, 3).map((nom) => (
                                  <span key={nom} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                    {nom}
                                  </span>
                                ))}
                                {specs.length > 3 && (
                                  <span
                                    className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500"
                                    title={specs.slice(3).join(', ')}
                                  >
                                    +{specs.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Toutes</span>
                            )}
                          </td>
                        )}
                        {item.specialiteField && (
                          <td className="py-3 px-4">
                            {row.specialites?.nom ? (
                              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                {row.specialites.nom}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Toutes</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleActif(row)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors ${
                              row.actif
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ background: row.actif ? '#047857' : '#9ca3af' }}
                            />
                            {row.actif ? 'Actif' : 'Inactif'}
                          </button>
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(row)}
                              className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredItems.length === 0 && (
                <div className="py-16 px-5 text-center">
                  <ListChecks className="w-8 h-8 text-gray-300 mx-auto mb-2.5" />
                  <p className="text-[13px] text-gray-400">
                    {searchTerm ? 'Aucun élément ne correspond à cette recherche' : 'Aucun élément pour le moment'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Modale d'ajout / modification */}
      <Modal isOpen={showModal} onClose={closeModal} title={editingItem ? `Modifier — ${item.label}` : `Ajouter — ${item.label}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="input-field w-full"
              required
              autoFocus
            />
          </div>

          {item.fields.map((f) => {
            if (f.type === 'specialites-multi') {
              return (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {f.label}
                    <span className="text-gray-400 font-normal ml-2 text-xs">(aucune = toutes)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {specialites.map((spec) => {
                      const isSelected = selectedSpecialites.includes(spec.id);
                      return (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() => toggleSpecialite(spec.id)}
                          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-medical-primary text-white border-medical-primary'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-medical-primary/50'
                          }`}
                        >
                          {spec.nom}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (f.type === 'specialite-single') {
              return (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <select
                    value={formData[f.name] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">Toutes les spécialités</option>
                    {specialites.map((spec) => (
                      <option key={spec.id} value={spec.id}>{spec.nom}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === 'select') {
              return (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <select
                    value={formData[f.name] ?? f.default ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                    className="input-field w-full"
                  >
                    {f.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div key={f.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={formData[f.name] || ''}
                    onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                    className="input-field w-full"
                    rows={3}
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={formData[f.name] ?? ''}
                    onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                    className="input-field w-full"
                  />
                )}
              </div>
            );
          })}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!formData.actif}
              onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Actif</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" />
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Enregistrement...' : editingItem ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog {...dialogState} onClose={closeDialog} />
    </>
  );
};

const ListesReference = () => {
  const [activeKey, setActiveKey] = useState(ALL_REFERENTIELS[0].key);
  const [specialites, setSpecialites] = useState([]);
  const active = ALL_REFERENTIELS.find((r) => r.key === activeKey) || ALL_REFERENTIELS[0];

  useEffect(() => {
    specialtyService.getAll().then(setSpecialites).catch(() => setSpecialites([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 px-6 md:px-10 py-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2.5">
            <ListChecks className="w-6 h-6 text-medical-primary" />
            Listes de référence
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Vocabulaire clinique utilisé pendant la consultation : antécédents, signes cliniques, diagnostics,
            appareils, médicaments, constantes vitales et documents.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
          {/* Navigation par groupe */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-3 lg:sticky lg:top-6">
            {GROUPS.map((group) => (
              <div key={group.id} className="mb-3 last:mb-0">
                <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold tracking-[.08em] uppercase text-gray-400">
                  <group.icon className="w-3.5 h-3.5" />
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((it) => (
                    <button
                      key={it.key}
                      onClick={() => setActiveKey(it.key)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        activeKey === it.key
                          ? 'bg-medical-primary/10 text-medical-primary'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <ReferentielPanel key={active.key} item={active} specialites={specialites} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListesReference;
