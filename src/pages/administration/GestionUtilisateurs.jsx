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
  Shield,
  Stethoscope,
  UserCheck,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock,
  Unlock,
  X,
  Calculator
} from 'lucide-react';
import { ROLES, getRoleDisplayName, getRoleColor, getRoleIcon } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';
import KpiCard from '../../components/common/KpiCard';

const GestionUtilisateurs = () => {
  const { currentUser, tenantId } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    doctors: 0,
    secretaries: 0,
    accounting: 0,
    cashiers: 0,
    active: 0,
    inactive: 0
  });

  useEffect(() => {
    fetchUtilisateurs();
  }, [tenantId]);

  const fetchUtilisateurs = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .order('nom');
        
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setUtilisateurs(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (users) => {
    const stats = {
      total: users.length,
      admins: users.filter(u => u.role === ROLES.ADMIN).length,
      doctors: users.filter(u => u.role === ROLES.DOCTOR).length,
      secretaries: users.filter(u => u.role === ROLES.SECRETARY).length,
      accounting: users.filter(u => u.role === ROLES.ACCOUNTING).length,
      cashiers: users.filter(u => u.role === ROLES.CASHIER || u.role === 'cashier').length,
      active: users.filter(u => u.actif).length,
      inactive: users.filter(u => !u.actif).length
    };
    setStats(stats);
  };

  const handleViewDetails = (utilisateur) => {
    // Navigation vers la page de formulaire en mode consultation
    navigate(`/administration/gestion-utilisateurs/details/${utilisateur.id}`);
  };

  const handleEdit = (utilisateur) => {
    // Navigation vers la page de formulaire en mode édition
    navigate(`/administration/gestion-utilisateurs/details/${utilisateur.id}`);
  };

  const handleDelete = async (id) => {
    setSelectedUser(utilisateurs.find(u => u.id === id));
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id);
      if (error) throw error;
      
      showSuccess('Utilisateur supprimé avec succès');
      fetchUtilisateurs();
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
      fetchUtilisateurs();
      showSuccess(`Utilisateur ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const filteredUtilisateurs = utilisateurs.filter(utilisateur => {
    const matchesSearch = 
      (utilisateur.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (utilisateur.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (utilisateur.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (utilisateur.specialite?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesRole = filterRole === 'all' || utilisateur.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && utilisateur.actif) ||
      (filterStatus === 'inactive' && !utilisateur.actif);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUtilisateurs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUtilisateurs = filteredUtilisateurs.slice(indexOfFirstItem, indexOfLastItem);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus]);

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case ROLES.ADMIN: return 'bg-red-100 text-red-800 border-red-200';
      case ROLES.DOCTOR: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ROLES.SECRETARY: return 'bg-green-100 text-green-800 border-green-200';
      case ROLES.ACCOUNTING: return 'bg-purple-100 text-purple-800 border-purple-200';
      case ROLES.CASHIER: return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case ROLES.ADMIN: return Shield;
      case ROLES.DOCTOR: return Stethoscope;
      case ROLES.SECRETARY: return UserCheck;
      case ROLES.ACCOUNTING: return RefreshCw;
      case ROLES.CASHIER: return Calculator;
      default: return Users;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-medical-primary" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez les comptes utilisateurs du cabinet médical
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => fetchUtilisateurs()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button 
            onClick={() => navigate('/administration/gestion-utilisateurs/details/nouveau')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouvel Utilisateur
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <KpiCard icon={Users} tone="blue" label="Total" value={stats.total} />
        <KpiCard icon={Shield} tone="red" label="Admins" value={stats.admins} />
        <KpiCard icon={Stethoscope} tone="blue" label="Médecins" value={stats.doctors} />
        <KpiCard icon={UserCheck} tone="green" label="Secrétaires" value={stats.secretaries} />
        <KpiCard icon={RefreshCw} tone="purple" label="Comptables" value={stats.accounting} />
        <KpiCard
          icon={Calculator}
          label="Caissiers"
          value={stats.cashiers}
          className="rounded-lg p-4 bg-orange-50 hover:shadow-md"
          iconClassName="text-orange-600"
          valueClassName="text-orange-600"
          labelClassName="text-orange-700"
        />
        <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
        <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
      </div>


      {/* Filtres et recherche */}
      <div className="card w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-medical-primary transition-colors" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur (nom, prénom, email, spécialité)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12 pr-10 w-full border-2 border-gray-300 focus:border-medical-primary focus:ring-2 focus:ring-medical-primary/20 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                title="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="md:col-span-3">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="form-select w-full border-2 border-gray-300 focus:border-medical-primary focus:ring-2 focus:ring-medical-primary/20 transition-all"
            >
              <option value="all">Tous les rôles</option>
              <option value={ROLES.ADMIN}>Administrateurs</option>
              <option value={ROLES.DOCTOR}>Médecins</option>
              <option value={ROLES.SECRETARY}>Secrétaires</option>
              <option value={ROLES.ACCOUNTING}>Comptables</option>
              <option value={ROLES.CASHIER}>Caissiers</option>
            </select>
          </div>
          
          <div className="md:col-span-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-select w-full border-2 border-gray-300 focus:border-medical-primary focus:ring-2 focus:ring-medical-primary/20 transition-all"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Utilisateur</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 w-32">Rôle</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 w-24">Statut</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUtilisateurs.map((utilisateur) => {
                const RoleIcon = getRoleIcon(utilisateur.role);
                return (
                  <tr key={utilisateur.id} className="border-b border-gray-100">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-medical-primary to-medical-secondary rounded-full flex items-center justify-center text-white font-semibold">
                          {utilisateur.prenom?.[0]}{utilisateur.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {utilisateur.prenom} {utilisateur.nom}
                          </p>
                          {utilisateur.specialite && (
                            <p className="text-sm text-gray-500">{utilisateur.specialite}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{utilisateur.email}</span>
                        </div>
                        {utilisateur.telephone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{utilisateur.telephone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-4 px-4 w-32">
                      <div className="flex items-center gap-1.5">
                        <RoleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border truncate ${getRoleBadgeColor(utilisateur.role)}`}>
                          {getRoleDisplayName(utilisateur.role)}
                        </span>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4 w-24">
                      <div className="flex items-center">
                        {utilisateur.actif ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 shadow-sm">
                            <CheckCircle className="w-3 h-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">Actif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 shadow-sm">
                            <XCircle className="w-3 h-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">Inactif</span>
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleViewDetails(utilisateur)}
                          className="p-2 text-indigo-600 rounded-lg"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(utilisateur)}
                          className="p-2 text-blue-600 rounded-lg"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleUserStatus(utilisateur.id, utilisateur.actif)}
                          className={`p-2 rounded-lg ${
                            utilisateur.actif 
                              ? 'text-yellow-600' 
                              : 'text-green-600'
                          }`}
                          title={utilisateur.actif ? 'Désactiver' : 'Activer'}
                        >
                          {utilisateur.actif ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleDelete(utilisateur.id)}
                          className="p-2 text-red-600 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredUtilisateurs.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun utilisateur trouvé</p>
          </div>
        )}

        {/* Pagination */}
        {filteredUtilisateurs.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-700">
              Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, filteredUtilisateurs.length)}</span> sur{' '}
              <span className="font-medium">{filteredUtilisateurs.length}</span> résultats
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              {[...Array(totalPages)].map((_, index) => {
                const page = index + 1;
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === page
                          ? 'bg-medical-primary text-white border-medical-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2">...</span>;
                }
                return null;
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{selectedUser.prenom} {selectedUser.nom}</strong> ?
              Cette action est irréversible.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
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

export default GestionUtilisateurs;
