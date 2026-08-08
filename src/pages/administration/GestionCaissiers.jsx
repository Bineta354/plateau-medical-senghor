import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react';
import { ROLES } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';
import KpiCard from '../../components/common/KpiCard';

const GestionCaissiers = () => {
  const { currentUser, tenantId } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [caissiers, setCaissiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  useEffect(() => {
    fetchCaissiers();
  }, [tenantId]);

  const fetchCaissiers = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .in('role', ['caissier', 'cashier'])
        .order('nom');
        
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCaissiers(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des caissiers:', error);
      showError('Erreur lors du chargement des caissiers');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (users) => {
    setStats({
      total: users.length,
      active: users.filter(u => u.actif).length,
      inactive: users.filter(u => !u.actif).length
    });
  };

  const handleViewDetails = (caissier) => {
    navigate(`/administration/gestion-caissiers/details/${caissier.id}`);
  };

  const handleEdit = (caissier) => {
    navigate(`/administration/gestion-caissiers/details/${caissier.id}`);
  };

  const handleDelete = (id) => {
    setSelectedUser(caissiers.find(u => u.id === id));
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      showSuccess('Caissier supprimé avec succès');
      fetchCaissiers();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showError('Erreur lors de la suppression: ' + error.message);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ actif: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      fetchCaissiers();
      showSuccess(`Caissier ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const filteredCaissiers = caissiers.filter(caissier => {
    const matchesSearch =
      (caissier.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (caissier.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (caissier.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && caissier.actif) ||
      (filterStatus === 'inactive' && !caissier.actif);

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredCaissiers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCaissiers = filteredCaissiers.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des caissiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-orange-600" />
            Gestion des Caissiers
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez les comptes utilisateurs du service caisse
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => fetchCaissiers()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button
            onClick={() => navigate('/administration/gestion-caissiers/details/nouveau')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau Caissier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          icon={Users}
          label="Total"
          value={stats.total}
          className="rounded-lg p-4 bg-orange-50 hover:shadow-md"
          iconClassName="text-orange-600"
          valueClassName="text-orange-600"
          labelClassName="text-orange-700"
        />
        <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
        <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un caissier (nom, prénom, email)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentCaissiers.map((caissier) => (
                <tr key={caissier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{caissier.prenom} {caissier.nom}</div>
                    <div className="text-sm text-gray-500">{caissier.username}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{caissier.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${caissier.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {caissier.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleViewDetails(caissier)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Voir">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(caissier)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg" title="Modifier">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleUserStatus(caissier.id, caissier.actif)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title={caissier.actif ? 'Désactiver' : 'Activer'}>
                        {caissier.actif ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(caissier.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {currentCaissiers.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    Aucun caissier trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} sur {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer le caissier <strong>{selectedUser?.prenom} {selectedUser?.nom}</strong> ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="btn btn-danger"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionCaissiers;
