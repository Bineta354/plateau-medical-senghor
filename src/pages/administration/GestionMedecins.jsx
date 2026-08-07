import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Stethoscope, 
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
  Award,
  X,
  Palette
} from 'lucide-react';
import { ROLES, getRoleDisplayName } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';
import { DOCTOR_COLOR_PALETTE, getContrastTextColor } from '../../utils/doctorColors';
import KpiCard from '../../components/common/KpiCard';

const GestionMedecins = () => {
  const { currentUser, tenantId } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const [medecins, setMedecins] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSpecialite, setFilterSpecialite] = useState('all');
  const [selectedMedecin, setSelectedMedecin] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  useEffect(() => {
    fetchMedecins();
  }, [tenantId]);

  const fetchMedecins = async () => {
    try {
      let query = supabase
        .from('users')
        .select('*, specialites:specialite_id(id, nom), couleur')
        .eq('role', ROLES.DOCTOR)
        .order('nom');
        
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
        
      const { data: medecinsData, error: medecinsError } = await query;
      
      if (medecinsError) throw medecinsError;
      
      // Pour chaque médecin, récupérer toutes ses spécialités
      const medecinsWithSpecialites = await Promise.all(
        (medecinsData || []).map(async (medecin) => {
          const { data: specialitesData, error: specialitesError } = await supabase
            .from('medecin_specialites')
            .select('specialite_id, specialites:specialite_id(id, nom)')
            .eq('medecin_id', medecin.id);
          
          if (!specialitesError && specialitesData) {
            medecin.specialites_associees = specialitesData
              .map(item => item.specialites)
              .filter(Boolean);
          }
          
          return medecin;
        })
      );
      
      setMedecins(medecinsWithSpecialites);
      calculateStats(medecinsWithSpecialites);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialites = async () => {
    try {
      const { data, error } = await supabase
        .from('specialites')
        .select('id, nom')
        .eq('actif', true)
        .order('nom');
      
      if (error) throw error;
      setSpecialites(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
    }
  };

  const calculateStats = (medecins) => {
    const stats = {
      total: medecins.length,
      active: medecins.filter(m => m.actif).length,
      inactive: medecins.filter(m => !m.actif).length
    };
    setStats(stats);
  };

  const handleViewDetails = (medecin) => {
    navigate(`/administration/gestion-medecins/details/${medecin.id}`);
  };

  const handleEdit = (medecin) => {
    navigate(`/administration/gestion-medecins/details/${medecin.id}`);
  };

  const handleDelete = async (id) => {
    setSelectedMedecin(medecins.find(m => m.id === id));
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedMedecin.id);
      if (error) throw error;
      
      showSuccess('Médecin supprimé avec succès');
      fetchMedecins();
      setShowDeleteModal(false);
      setSelectedMedecin(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showError('Erreur lors de la suppression: ' + error.message);
    }
  };

  const toggleMedecinStatus = async (medecinId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ actif: !currentStatus })
        .eq('id', medecinId);
      
      if (error) throw error;
      fetchMedecins();
      showSuccess(`Médecin ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const handleChangePassword = (medecin) => {
    setSelectedMedecin(medecin);
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
          userEmail: selectedMedecin.email,
          newPassword: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la modification du mot de passe');
      }

      showSuccess('Mot de passe modifié avec succès');
      setShowPasswordModal(false);
      setSelectedMedecin(null);
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

  const handleColorChange = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ couleur: selectedColor })
        .eq('id', selectedMedecin.id);

      if (error) throw error;

      showSuccess('Couleur modifiée avec succès');
      setShowColorModal(false);
      setSelectedMedecin(null);
      setSelectedColor('');
      fetchMedecins();
    } catch (error) {
      console.error('Erreur lors de la modification de la couleur:', error);
      showError('Erreur lors de la modification de la couleur: ' + error.message);
    }
  };

  const openColorModal = (medecin) => {
    setSelectedMedecin(medecin);
    setSelectedColor(medecin.couleur || DOCTOR_COLOR_PALETTE[0]);
    setShowColorModal(true);
  };

  const filteredMedecins = medecins.filter(medecin => {
    // Recherche dans les noms, prénom, email et spécialités (texte libre)
    const matchesSearch = 
      (medecin.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (medecin.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (medecin.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (medecin.specialite?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      // Recherche dans les spécialités associées
      (medecin.specialites_associees?.some(spec => 
        spec?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
      ) || false);
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && medecin.actif) ||
      (filterStatus === 'inactive' && !medecin.actif);
    
    // Filtrage par spécialité : vérifier si le médecin a la spécialité sélectionnée
    const matchesSpecialite = filterSpecialite === 'all' || 
      medecin.specialite_id?.toString() === filterSpecialite ||
      medecin.specialites_associees?.some(spec => 
        spec?.id?.toString() === filterSpecialite
      );
    
    return matchesSearch && matchesStatus && matchesSpecialite;
  });

  // Pagination
  const totalPages = Math.ceil(filteredMedecins.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMedecins = filteredMedecins.slice(indexOfFirstItem, indexOfLastItem);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSpecialite]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des médecins...</p>
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
            <Stethoscope className="w-8 h-8 text-medical-primary" />
            Gestion des Médecins
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez les comptes médecins du cabinet médical
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => fetchMedecins()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
          <button 
            onClick={() => navigate('/administration/gestion-medecins/details/nouveau')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau Médecin
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard icon={Stethoscope} tone="blue" label="Total" value={stats.total} />
        <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
        <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
      </div>

      {/* Filtres et recherche */}
      {/* Filtres et recherche */}
<div className="card w-full">
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
    <div className="md:col-span-6 relative">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-medical-primary transition-colors" />
      <input
        type="text"
        placeholder="Rechercher un médecin (nom, prénom, email, spécialité)..."
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
    
    <div className="md:col-span-3">
      <select
        value={filterSpecialite}
        onChange={(e) => setFilterSpecialite(e.target.value)}
        className="form-select w-full border-2 border-gray-300 focus:border-medical-primary focus:ring-2 focus:ring-medical-primary/20 transition-all"
      >
        <option value="all">Toutes les spécialités</option>
        {specialites.map(spec => (
          <option key={spec.id} value={spec.id.toString()}>{spec.nom}</option>
        ))}
      </select>
    </div>
  </div>
</div>

      {/* Liste des médecins */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Médecin</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Contact</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 w-32">Spécialité</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 w-24">Statut</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 w-24">Couleur</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentMedecins.map((medecin) => (
                <tr key={medecin.id} className="border-b border-gray-100">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {medecin.prenom?.[0]}{medecin.nom?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {medecin.prenom} {medecin.nom}
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{medecin.email}</span>
                      </div>
                      {medecin.telephone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{medecin.telephone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-4 w-32">
                    <div className="flex flex-col gap-1">
                      {medecin.specialites?.nom || medecin.specialite ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-medical-primary bg-opacity-10 text-medical-primary border border-medical-primary border-opacity-30 w-fit">
                          {medecin.specialites?.nom || medecin.specialite}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Aucune spécialité</span>
                      )}
                      {medecin.specialites_associees && medecin.specialites_associees.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {medecin.specialites_associees
                            .filter((spec) => spec.nom !== (medecin.specialites?.nom || medecin.specialite))
                            .slice(0, 2)
                            .map((spec, idx) => (
                              <span
                                key={spec.id || idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                              >
                                {spec.nom}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-4 w-24">
                    <div className="flex items-center">
                      {medecin.actif ? (
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
                  
                  <td className="py-4 px-4 w-24">
                    <button
                      onClick={() => openColorModal(medecin)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Modifier la couleur"
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: medecin.couleur || '#3b82f6' }}
                      />
                      <Palette className="w-4 h-4 text-gray-400" />
                    </button>
                  </td>
                  
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleViewDetails(medecin)}
                        className="p-2 text-indigo-600 rounded-lg"
                        title="Voir détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(medecin)}
                        className="p-2 text-blue-600 rounded-lg"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleChangePassword(medecin)}
                        className="p-2 text-purple-600 rounded-lg"
                        title="Modifier le mot de passe"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleMedecinStatus(medecin.id, medecin.actif)}
                        className={`p-2 rounded-lg ${
                          medecin.actif 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}
                        title={medecin.actif ? 'Désactiver' : 'Activer'}
                      >
                        {medecin.actif ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => handleDelete(medecin.id)}
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
        
        {filteredMedecins.length === 0 && (
          <div className="text-center py-12">
            <Stethoscope className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucun médecin trouvé</p>
          </div>
        )}

        {/* Pagination */}
        {filteredMedecins.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-700">
              Affichage de <span className="font-medium">{indexOfFirstItem + 1}</span> à{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, filteredMedecins.length)}</span> sur{' '}
              <span className="font-medium">{filteredMedecins.length}</span> résultats
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
      {showDeleteModal && selectedMedecin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer le médecin <strong>{selectedMedecin.prenom} {selectedMedecin.nom}</strong> ?
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
      {showPasswordModal && selectedMedecin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Modifier le mot de passe</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Nouveau mot de passe pour <strong>{selectedMedecin.prenom} {selectedMedecin.nom}</strong>
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
                  setSelectedMedecin(null);
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

      {/* Modal de modification de couleur */}
      {showColorModal && selectedMedecin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Modifier la couleur</h3>
            </div>
            
            <p className="text-gray-600 mb-4">
              Couleur pour <strong>{selectedMedecin.prenom} {selectedMedecin.nom}</strong>
            </p>
            
            <div className="grid grid-cols-4 gap-3 mb-6">
              {DOCTOR_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  type="button"
                  className={`w-12 h-12 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? 'border-gray-900 scale-110'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
              <div
                className="w-10 h-10 rounded-full border-2 border-gray-300"
                style={{ backgroundColor: selectedColor }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Couleur sélectionnée</p>
                <p className="text-xs text-gray-600">{selectedColor}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowColorModal(false);
                  setSelectedMedecin(null);
                  setSelectedColor('');
                }}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleColorChange}
                className="btn btn-primary"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GestionMedecins;

