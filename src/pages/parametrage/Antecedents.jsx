import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { antecedentsRefService } from '../../services/referentielService';
import { specialtyService } from '../../lib/services/specialtyService';

const Antecedents = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [antecedents, setAntecedents] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');
  const [filterGravite, setFilterGravite] = useState('');
  const [filterSpecialite, setFilterSpecialite] = useState('');
  const [message, setMessage] = useState(null);

  const categories = [
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
    { value: 'psychiatrique', label: 'Psychiatrique' }
  ];

  const niveauxGravite = [
    { value: 'leger', label: 'Léger', color: 'bg-green-100 text-green-800' },
    { value: 'modere', label: 'Modéré', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'grave', label: 'Grave', color: 'bg-orange-100 text-orange-800' },
    { value: 'critique', label: 'Critique', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    fetchSpecialites();
    fetchAntecedents();

    if (location.state?.message) {
      setMessage({
        text: location.state.message,
        type: location.state.type || 'success'
      });

      setTimeout(() => {
        setMessage(null);
      }, 5000);

      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  const fetchSpecialites = async () => {
    try {
      const data = await specialtyService.getAll();
      setSpecialites(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
  };

  const fetchAntecedents = async () => {
    try {
      setLoading(true);
      const data = await antecedentsRefService.list();
      setAntecedents(data);
    } catch (error) {
      console.error('Erreur lors du chargement des antécédents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    navigate('/parametrage/antecedents/form');
  };

  const handleEdit = (antecedent) => {
    navigate(`/parametrage/antecedents/form/${antecedent.id}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet antécédent ?')) {
      try {
        await antecedentsRefService.remove(id);
        fetchAntecedents();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const getSpecialitesForAntecedent = (antecedent) => {
    return antecedent.antecedents_specialites?.map(lnk => lnk.specialites?.nom).filter(Boolean) || [];
  };

  const filteredAntecedents = antecedents.filter(antecedent => {
    const matchesSearch = antecedent.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         antecedent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         antecedent.code_cim?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategorie = !filterCategorie || antecedent.categorie === filterCategorie;
    const matchesGravite = !filterGravite || antecedent.niveau_gravite === filterGravite;
    const matchesSpecialite = !filterSpecialite ||
      antecedent.antecedents_specialites?.some(lnk => lnk.specialite_id === parseInt(filterSpecialite));

    return matchesSearch && matchesCategorie && matchesGravite && matchesSpecialite;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Antécédents</h1>
          <p className="text-gray-600">Gérez les antécédents médicaux pouvant être associés aux patients</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel antécédent
        </button>
      </div>

      {/* Message succès/erreur */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${message.type === 'success'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-4 h-4" />
          Filtres
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nom, description, code CIM..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
            <select
              value={filterSpecialite}
              onChange={(e) => setFilterSpecialite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les spécialités</option>
              {specialites.map(spec => (
                <option key={spec.id} value={spec.id}>{spec.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={filterCategorie}
              onChange={(e) => setFilterCategorie(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gravité</label>
            <select
              value={filterGravite}
              onChange={(e) => setFilterGravite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les niveaux</option>
              {niveauxGravite.map(niveau => (
                <option key={niveau.value} value={niveau.value}>{niveau.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Liste des Antécédents ({filteredAntecedents.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code CIM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catégorie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gravité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spécialités
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAntecedents.map((antecedent) => {
                const specs = getSpecialitesForAntecedent(antecedent);
                return (
                  <tr key={antecedent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{antecedent.nom}</div>
                        {antecedent.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{antecedent.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {antecedent.code_cim || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {categories.find(cat => cat.value === antecedent.categorie)?.label || antecedent.categorie}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${niveauxGravite.find(n => n.value === antecedent.niveau_gravite)?.color || 'bg-gray-100 text-gray-800'}`}>
                        {niveauxGravite.find(n => n.value === antecedent.niveau_gravite)?.label || antecedent.niveau_gravite}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {specs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {specs.map(nom => (
                            <span key={nom} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                              {nom}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Toutes</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${antecedent.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {antecedent.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(antecedent)}
                        className="text-blue-600 hover:text-blue-900 mr-3 flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(antecedent.id)}
                        className="text-red-600 hover:text-red-900 flex items-center gap-1 mt-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAntecedents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun antécédent trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Antecedents;
