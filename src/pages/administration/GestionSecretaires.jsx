import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  UserCheck, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock,
  Unlock,
  Key,
  X
} from 'lucide-react';
import { ROLES, getRoleDisplayName } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';
import KpiCard from '../../components/common/KpiCard';

const GestionSecretaires = () => {
  const { currentUser, tenantId } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const [secretaires, setSecretaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSecretaire, setSelectedSecretaire] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  useEffect(() => {
    fetchSecretaires();
  }, [tenantId]);

  const fetchSecretaires = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', ROLES.SECRETARY)
        .order('nom');
        
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
        
      const { data, error } = await query;
      
      if (error) throw error;
      setSecretaires(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des secrétaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (secretaires) => {
    const stats = {
      total: secretaires.length,
      active: secretaires.filter(s => s.actif).length,
      inactive: secretaires.filter(s => !s.actif).length
    };
    setStats(stats);
  };

  const handleViewDetails = (secretaire) => {
    navigate(`/administration/gestion-secretaires/details/${secretaire.id}`);
  };

  const handleEdit = (secretaire) => {
    navigate(`/administration/gestion-secretaires/details/${secretaire.id}`);
  };

  const handleDelete = async (id) => {
    setSelectedSecretaire(secretaires.find(s => s.id === id));
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedSecretaire.id);
      if (error) throw error;
      
      showSuccess('Secrétaire supprimé avec succès');
      fetchSecretaires();
      setShowDeleteModal(false);
      setSelectedSecretaire(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showError('Erreur lors de la suppression: ' + error.message);
    }
  };

  const toggleSecretaireStatus = async (secretaireId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ actif: !currentStatus })
        .eq('id', secretaireId);
      
      if (error) throw error;
      fetchSecretaires();
      showSuccess(`Secrétaire ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const handleChangePassword = (secretaire) => {
    setSelectedSecretaire(secretaire);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const confirmChangePassword = async () => {
    try {
      if (!newPassword || newPassword.length < 6) {
        showWarning('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }

      // Récupérer le token d'accès
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Vous devez être connecté pour modifier un mot de passe');
        return;
      }

      // Appeler l'edge function pour modifier le mot de passe
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update-password',
          userEmail: selectedSecretaire.email,
          newPassword: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la modification du mot de passe');
      }

      showSuccess('Mot de passe modifié avec succès');
      setShowPasswordModal(false);
      setSelectedSecretaire(null);
      setNewPassword('');
    } catch (error) {
      console.error('Erreur lors de la modification du mot de passe:', error);
      showError('Erreur lors de la modification du mot de passe: ' + error.message);
    }
  };

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setNewPassword(password);
  };

  const filteredSecretaires = secretaires.filter(secretaire => {
    const matchesSearch = 
      (secretaire.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (secretaire.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (secretaire.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && secretaire.actif) ||
      (filterStatus === 'inactive' && !secretaire.actif);
    
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSecretaires.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSecretaires = filteredSecretaires.slice(indexOfFirstItem, indexOfLastItem);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des secrétaires...</p>
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
            <UserCheck className="w-8 h-8 text-medical-primary" />
            Gestion des Secrétaires
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez les comptes secrétaires du cabinet médical
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => fetchSecretaires()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button 
            onClick={() => navigate('/administration/gestion-secretaires/details/nouveau')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau Secrétaire
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard icon={UserCheck} tone="blue" label="Total" value={stats.total} />
        <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
        <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
      </div>

      {/* Filtres et recherche */}
      <div className="card w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
          <div className="md:col-span-9 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-medical-primary transition-colors" />
            <input
              type="text"
              placeholder="Rechercher un secrétaire (nom, prénom, email)..."
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

      {/* Liste des secrétaires */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Secrétaire</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 w-24">Statut</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSecretaires.map((secretaire) => (
                <tr key={secretaire.id} className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {secretaire.prenom?.[0]}{secretaire.nom?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {secretaire.prenom} {secretaire.nom}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{secretaire.email}</span>
                      </div>
                      {secretaire.telephone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{secretaire.telephone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-4 w-24">
                    <div className="flex items-center">
                      {secretaire.actif ? (
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
                        onClick={() => handleViewDetails(secretaire)}
                        className="p-2 text-indigo-600 rounded-lg"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(secretaire)}
                        className="p-2 text-blue-600 rounded-lg"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleChangePassword(secretaire)}
                        className="p-2 text-purple-600 rounded-lg"
                        title="Modifier le mot de passe"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleSecretaireStatus(secretaire.id, secretaire.actif)}
                        className={`p-2 rounded-lg ${
                          secretaire.actif 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}
                        title={secretaire.actif ? 'Désactiver' : 'Activer'}
                      >
                        {secretaire.actif ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDelete(secretaire.id)}
                        className="p-2 text-red-600 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredSecretaires.length === 0 && (
          <div className="text-center py-12">
            <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun secrétaire trouvé</p>
          </div>
        )}

        {/* Pagination */}
        {filteredSecretaires.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-700">
              Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, filteredSecretaires.length)}</span> sur{' '}
              <span className="font-medium">{filteredSecretaires.length}</span> résultats
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
      {showDeleteModal && selectedSecretaire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer le secrétaire <strong>{selectedSecretaire.prenom} {selectedSecretaire.nom}</strong> ?
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

      {/* Modal de modification de mot de passe */}
      {showPasswordModal && selectedSecretaire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Modifier le mot de passe</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Nouveau mot de passe pour <strong>{selectedSecretaire.prenom} {selectedSecretaire.nom}</strong>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau mot de passe (minimum 6 caractères)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field flex-1"
                    placeholder="Saisir le nouveau mot de passe..."
                    minLength={6}
                  />
                  <button
                    onClick={generatePassword}
                    className="btn btn-secondary flex items-center gap-2"
                    title="Générer un mot de passe"
                  >
                    <Key className="w-4 h-4" />
                    Générer
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setSelectedSecretaire(null);
                  setNewPassword('');
                }}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={confirmChangePassword}
                className="btn btn-primary"
                disabled={!newPassword || newPassword.length < 6}
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GestionSecretaires;

