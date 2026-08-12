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
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Key,
  X,
  Palette,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ROLES } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';
import { DOCTOR_COLOR_PALETTE } from '../../utils/doctorColors';
import KpiCard from '../../components/common/KpiCard';
import Dropdown from '../../components/common/Dropdown';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Inactifs' },
];

const PAGE_SIZE_OPTIONS = [
  { value: '5', label: '5 / page' },
  { value: '10', label: '10 / page' },
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
];

const GestionMedecins = () => {
  const { tenantId } = useAuth();
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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  useEffect(() => {
    fetchMedecins();
    fetchSpecialites();
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

  const handleDelete = (id) => {
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
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      medecin.nom?.toLowerCase().includes(term) ||
      medecin.prenom?.toLowerCase().includes(term) ||
      medecin.email?.toLowerCase().includes(term) ||
      medecin.specialite?.toLowerCase().includes(term) ||
      medecin.specialites_associees?.some(spec => spec?.nom?.toLowerCase().includes(term));

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSpecialite, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredMedecins.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIdx = (page - 1) * itemsPerPage;
  const pageItems = filteredMedecins.slice(startIdx, startIdx + itemsPerPage);

  const specialiteOptions = [
    { value: 'all', label: 'Toutes les spécialités' },
    ...specialites.map((spec) => ({ value: spec.id.toString(), label: spec.nom })),
  ];

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
    <div className="min-h-screen bg-gray-50 px-6 md:px-10 py-8 pb-16">
      <div className="max-w-[1180px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Médecins</h1>
            <p className="text-[13px] text-gray-500 mt-1">
              {stats.total} médecins au total · {stats.active} actifs
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={fetchMedecins}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
            <button
              onClick={() => navigate('/administration/gestion-medecins/details/nouveau')}
              className="flex items-center gap-2 px-[18px] py-2.5 bg-medical-primary text-white rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 14px rgb(var(--medical-primary-rgb) / 0.35)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau médecin
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <KpiCard icon={Stethoscope} tone="blue" label="Total" value={stats.total} />
          <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
          <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
        </div>

        {/* Recherche + filtres */}
        <div className="bg-white border border-gray-200 rounded-[20px] p-4 md:p-5 shadow-sm mb-5 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3.5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 invisible" aria-hidden="true">Recherche</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom, email, spécialité…"
                className="w-full border border-gray-200 rounded-[10px] pl-9 pr-9 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <Dropdown label="Spécialité" value={filterSpecialite} onChange={setFilterSpecialite} options={specialiteOptions} size="md" />
          <Dropdown label="Statut" value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} size="md" />
        </div>

        {/* Liste */}
        <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <p className="text-[12.5px] font-semibold text-gray-900">
              {filteredMedecins.length} médecin(s) trouvé(s)
            </p>
            <Dropdown
              value={String(itemsPerPage)}
              onChange={(v) => setItemsPerPage(Number(v))}
              options={PAGE_SIZE_OPTIONS}
              size="sm"
              wrapperClassName="w-40"
            />
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[340px]">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-500">Médecin</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Contact</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Spécialité</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Statut</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Couleur</th>
                  <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((medecin) => {
                  const specialitePrincipale = medecin.specialites?.nom || medecin.specialite;
                  return (
                    <tr key={medecin.id} className="border-t border-gray-100">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-medical-primary to-medical-secondary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {medecin.prenom?.[0]}
                            {medecin.nom?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-[13.5px] truncate">
                              {medecin.prenom} {medecin.nom}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600 text-[12.5px]">{medecin.email}</p>
                        {medecin.telephone && <p className="text-gray-400 text-xs mt-0.5">{medecin.telephone}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {specialitePrincipale ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap bg-blue-100 text-blue-700 w-fit">
                              {specialitePrincipale}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Aucune spécialité</span>
                          )}
                          {medecin.specialites_associees && medecin.specialites_associees.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {medecin.specialites_associees
                                .filter((spec) => spec.nom !== specialitePrincipale)
                                .slice(0, 2)
                                .map((spec, idx) => (
                                  <span
                                    key={spec.id || idx}
                                    className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-gray-100 text-gray-600"
                                  >
                                    {spec.nom}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleMedecinStatus(medecin.id, medecin.actif)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors ${
                            medecin.actif ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: medecin.actif ? '#047857' : '#9ca3af' }}
                          />
                          {medecin.actif ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openColorModal(medecin)}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Modifier la couleur"
                        >
                          <div
                            className="w-5 h-5 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: medecin.couleur || '#3b82f6' }}
                          />
                          <Palette className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/administration/gestion-medecins/details/${medecin.id}`)}
                            className="p-1.5 bg-medical-primary/10 text-medical-primary rounded-lg hover:bg-medical-primary/20 transition-colors"
                            title="Voir détails"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/administration/gestion-medecins/details/${medecin.id}`)}
                            className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleChangePassword(medecin)}
                            className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                            title="Modifier le mot de passe"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(medecin.id)}
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
          </div>

          {filteredMedecins.length === 0 && (
            <div className="py-16 px-5 text-center">
              <Stethoscope className="w-8 h-8 text-gray-300 mx-auto mb-2.5" />
              <p className="text-[13px] text-gray-400">Aucun médecin ne correspond à ces filtres</p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {filteredMedecins.length === 0
                ? ''
                : `${startIdx + 1}–${Math.min(startIdx + itemsPerPage, filteredMedecins.length)} sur ${filteredMedecins.length}`}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:text-gray-300 disabled:cursor-default hover:enabled:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setCurrentPage(n)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                    n === page ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 disabled:text-gray-300 disabled:cursor-default hover:enabled:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && selectedMedecin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer le médecin <strong>{selectedMedecin.prenom} {selectedMedecin.nom}</strong> ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
                Annuler
              </button>
              <button onClick={confirmDelete} className="btn btn-danger">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modification de mot de passe */}
      {showPasswordModal && selectedMedecin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
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
