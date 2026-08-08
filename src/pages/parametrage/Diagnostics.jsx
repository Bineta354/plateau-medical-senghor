import React, { useState, useEffect } from 'react';
import ParametrageLayout from '../../components/ParametrageLayout';
import ParametrageList from '../../components/ParametrageList';
import { diagnosticsRefService } from '../../services/referentielService';
import { specialtyService } from '../../lib/services/specialtyService';

const EMPTY_DIAG = {
  nom: '', description: '', code_cim: '',
  niveau_gravite: 'leger', ordre_affichage: 0, actif: true
};

const niveauxGravite = [
  { value: 'leger', label: 'Léger', color: 'bg-green-100 text-green-800' },
  { value: 'modere', label: 'Modéré', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'grave', label: 'Grave', color: 'bg-orange-100 text-orange-800' },
  { value: 'critique', label: 'Critique', color: 'bg-red-100 text-red-800' }
];

const Diagnostics = () => {
  const [diagnostics, setDiagnostics] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [selectedSpecialites, setSelectedSpecialites] = useState([]);
  const [newDiagnostic, setNewDiagnostic] = useState(EMPTY_DIAG);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialite, setFilterSpecialite] = useState('');
  const [filterGravite, setFilterGravite] = useState('');

  useEffect(() => {
    fetchSpecialites();
    fetchDiagnostics();
  }, []);

  const fetchSpecialites = async () => {
    try {
      const data = await specialtyService.getAll();
      setSpecialites(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      const data = await diagnosticsRefService.list();
      setDiagnostics(data);
    } catch (error) {
      console.error('Erreur lors du chargement des diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialite = (specId) => {
    setSelectedSpecialites(prev =>
      prev.includes(specId) ? prev.filter(s => s !== specId) : [...prev, specId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        nom: newDiagnostic.nom,
        description: newDiagnostic.description,
        code_cim: newDiagnostic.code_cim || null,
        niveau_gravite: newDiagnostic.niveau_gravite,
        ordre_affichage: parseInt(newDiagnostic.ordre_affichage) || 0,
        actif: newDiagnostic.actif
      };

      let diagId = editingId;
      if (editingId) {
        await diagnosticsRefService.update(editingId, dataToSave);
      } else {
        const created = await diagnosticsRefService.create(dataToSave);
        diagId = created.id;
      }

      await diagnosticsRefService.syncSpecialites(diagId, selectedSpecialites);

      setNewDiagnostic(EMPTY_DIAG);
      setSelectedSpecialites([]);
      setShowForm(false);
      setEditingId(null);
      fetchDiagnostics();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (diagnostic) => {
    setEditingId(diagnostic.id);
    setShowForm(true);
    setNewDiagnostic({
      nom: diagnostic.nom,
      description: diagnostic.description || '',
      code_cim: diagnostic.code_cim || '',
      niveau_gravite: diagnostic.niveau_gravite || 'leger',
      ordre_affichage: diagnostic.ordre_affichage || 0,
      actif: diagnostic.actif
    });
    setSelectedSpecialites(
      diagnostic.diagnostics_specialites?.map(lnk => lnk.specialite_id) || []
    );
  };

  const handleAddNew = () => {
    setEditingId(null);
    setShowForm(true);
    setNewDiagnostic(EMPTY_DIAG);
    setSelectedSpecialites([]);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setNewDiagnostic(EMPTY_DIAG);
    setSelectedSpecialites([]);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce diagnostic ?')) {
      try {
        await diagnosticsRefService.remove(id);
        fetchDiagnostics();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const getSpecsForDiag = (diag) =>
    diag.diagnostics_specialites?.map(lnk => lnk.specialites?.nom).filter(Boolean) || [];

  const filteredDiagnostics = diagnostics.filter(d => {
    const matchSearch = d.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code_cim?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSpec = !filterSpecialite ||
      d.diagnostics_specialites?.some(lnk => lnk.specialite_id === parseInt(filterSpecialite));
    const matchGrav = !filterGravite || d.niveau_gravite === filterGravite;
    return matchSearch && matchSpec && matchGrav;
  });

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div>
      <ParametrageLayout
        title="Diagnostics"
        addButtonText={editingId ? 'Modifier diagnostic' : 'Ajouter diagnostic'}
        showForm={showForm}
        onAddClick={handleAddNew}
        onCancelClick={handleCancel}
      >
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom *</label>
                <input
                  type="text"
                  value={newDiagnostic.nom}
                  onChange={(e) => setNewDiagnostic({ ...newDiagnostic, nom: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Code CIM-10</label>
                <input
                  type="text"
                  value={newDiagnostic.code_cim}
                  onChange={(e) => setNewDiagnostic({ ...newDiagnostic, code_cim: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={newDiagnostic.description}
                onChange={(e) => setNewDiagnostic({ ...newDiagnostic, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>

            {/* Sélecteur de spécialités */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spécialités concernées
                <span className="text-gray-400 font-normal ml-2 text-xs">(aucune = toutes)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {specialites.map(spec => {
                  const isSelected = selectedSpecialites.includes(spec.id);
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => toggleSpecialite(spec.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {spec.nom}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Niveau de gravité</label>
                <select
                  value={newDiagnostic.niveau_gravite}
                  onChange={(e) => setNewDiagnostic({ ...newDiagnostic, niveau_gravite: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {niveauxGravite.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ordre d'affichage</label>
                <input
                  type="number"
                  value={newDiagnostic.ordre_affichage}
                  onChange={(e) => setNewDiagnostic({ ...newDiagnostic, ordre_affichage: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Statut</label>
                <select
                  value={newDiagnostic.actif}
                  onChange={(e) => setNewDiagnostic({ ...newDiagnostic, actif: e.target.value === 'true' })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value={true}>Actif</option>
                  <option value={false}>Inactif</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                {editingId ? 'Modifier' : 'Ajouter'}
              </button>
              <button type="button" onClick={handleCancel} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Annuler
              </button>
            </div>
          </form>
        )}
      </ParametrageLayout>

      <ParametrageList
        title="Liste des diagnostics"
        itemCount={filteredDiagnostics.length}
        itemName="diagnostics"
        emptyMessage="Aucun diagnostic enregistré."
      >
        <div className="mb-4 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Rechercher par nom, description ou code CIM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2 border rounded"
          />
          <select value={filterSpecialite} onChange={(e) => setFilterSpecialite(e.target.value)} className="p-2 border rounded">
            <option value="">Toutes les spécialités</option>
            {specialites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
          <select value={filterGravite} onChange={(e) => setFilterGravite(e.target.value)} className="p-2 border rounded">
            <option value="">Tous les niveaux</option>
            {niveauxGravite.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnostic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code CIM-10</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spécialités</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gravité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDiagnostics.map((diag) => {
                const specs = getSpecsForDiag(diag);
                return (
                  <tr key={diag.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{diag.nom}</div>
                      {diag.description && <div className="text-sm text-gray-500">{diag.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{diag.code_cim || '-'}</td>
                    <td className="px-6 py-4">
                      {specs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {specs.map(nom => (
                            <span key={nom} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{nom}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Toutes</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${niveauxGravite.find(n => n.value === diag.niveau_gravite)?.color || 'bg-gray-100 text-gray-800'}`}>
                        {niveauxGravite.find(n => n.value === diag.niveau_gravite)?.label || diag.niveau_gravite}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${diag.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {diag.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleEdit(diag)} className="text-indigo-600 hover:text-indigo-900 mr-3">Modifier</button>
                      <button onClick={() => handleDelete(diag.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ParametrageList>
    </div>
  );
};

export default Diagnostics;
