import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../lib/services';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  AlertCircle,
  RefreshCw,
  X,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { ROLES, isCaissierRole } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';
import Dropdown from '../../components/common/Dropdown';
import KpiCard from '../../components/common/KpiCard';

const ROLE_META = {
  [ROLES.ADMIN]: { label: 'Administrateur', barColor: '#dc2626', badgeBg: 'bg-red-100', badgeText: 'text-red-700' },
  [ROLES.DOCTOR]: { label: 'Médecin', barColor: '#1d4ed8', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
  [ROLES.SECRETARY]: { label: 'Secrétaire', barColor: '#047857', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700' },
  [ROLES.ACCOUNTING]: { label: 'Comptable', barColor: '#7c3aed', badgeBg: 'bg-purple-100', badgeText: 'text-purple-700' },
  [ROLES.CAISSIER]: { label: 'Caissier', barColor: '#c2410c', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700' },
};
const ROLE_ORDER = [ROLES.ADMIN, ROLES.DOCTOR, ROLES.SECRETARY, ROLES.ACCOUNTING, ROLES.CAISSIER];

const roleKeyOf = (role) => (isCaissierRole(role) ? ROLES.CAISSIER : role);

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

const GestionUtilisateurs = () => {
  const { tenantId } = useAuth();
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
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    fetchUtilisateurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchUtilisateurs = async () => {
    try {
      const data = await userService.getAll({ tenantId });
      setUtilisateurs((data || []).slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '')));
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      showError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    setSelectedUser(utilisateurs.find((u) => u.id === id));
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await userService.delete(selectedUser.id);

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
      await userService.update(userId, { actif: !currentStatus });
      fetchUtilisateurs();
      showSuccess(`Utilisateur ${!currentStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const stats = {
    total: utilisateurs.length,
    active: utilisateurs.filter((u) => u.actif).length,
    inactive: utilisateurs.filter((u) => !u.actif).length,
  };

  const filteredUtilisateurs = utilisateurs.filter((utilisateur) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      utilisateur.nom?.toLowerCase().includes(term) ||
      utilisateur.prenom?.toLowerCase().includes(term) ||
      utilisateur.email?.toLowerCase().includes(term) ||
      utilisateur.specialite?.toLowerCase().includes(term);

    const matchesRole = filterRole === 'all' || roleKeyOf(utilisateur.role) === filterRole;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && utilisateur.actif) ||
      (filterStatus === 'inactive' && !utilisateur.actif);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredUtilisateurs.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIdx = (page - 1) * itemsPerPage;
  const pageItems = filteredUtilisateurs.slice(startIdx, startIdx + itemsPerPage);

  const roleBars = ROLE_ORDER.map((key) => {
    const count = utilisateurs.filter((u) => roleKeyOf(u.role) === key).length;
    const meta = ROLE_META[key];
    return { key, count, color: meta.barColor, label: `${meta.label} (${count})` };
  });

  const roleFilters = [
    { key: 'all', label: 'Tous', count: stats.total, color: '#6b7280' },
    ...ROLE_ORDER.map((key) => ({
      key,
      label: ROLE_META[key].label,
      count: utilisateurs.filter((u) => roleKeyOf(u.role) === key).length,
      color: ROLE_META[key].barColor,
    })),
  ];

  const roleDropdownOptions = roleFilters.map((f) => ({
    value: f.key,
    label: f.key === 'all' ? `Tous les rôles (${f.count})` : `${f.label} (${f.count})`,
  }));

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
    <div className="min-h-screen bg-gray-50 px-6 md:px-10 py-8 pb-16">
      <div className="max-w-[1180px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Utilisateurs</h1>
            <p className="text-[13px] text-gray-500 mt-1">
              {stats.total} comptes au total · {stats.active} actifs
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={fetchUtilisateurs}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
            <button
              onClick={() => navigate('/administration/gestion-utilisateurs/details/nouveau')}
              className="flex items-center gap-2 px-[18px] py-2.5 bg-medical-primary text-white rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 14px rgb(var(--medical-primary-rgb) / 0.35)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvel utilisateur
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <KpiCard icon={Users} tone="blue" label="Total" value={stats.total} />
          <KpiCard icon={CheckCircle} tone="green" label="Actifs" value={stats.active} />
          <KpiCard icon={XCircle} tone="yellow" label="Inactifs" value={stats.inactive} />
        </div>

        {/* Répartition par rôle */}
        <div className="bg-white border border-gray-200 rounded-[20px] p-5 md:p-6 shadow-sm mb-5">
          <div className="flex justify-between items-baseline mb-3.5">
            <p className="text-[11px] font-semibold tracking-[.12em] uppercase text-gray-400">Répartition par rôle</p>
            <p className="text-xs text-gray-400">{stats.inactive} compte(s) inactif(s)</p>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3.5">
            {roleBars.map((rb) => (
              <div
                key={rb.key}
                onClick={() => setFilterRole((prev) => (prev === rb.key ? 'all' : rb.key))}
                title={rb.label}
                className="cursor-pointer transition-opacity"
                style={{
                  flex: rb.count || 0.001,
                  background: rb.color,
                  opacity: filterRole === 'all' || filterRole === rb.key ? 1 : 0.25,
                }}
              />
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {roleFilters.map((f) => {
              const active = filterRole === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilterRole(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: active ? '#fff' : f.color }} />
                  {f.label}
                  <span className="opacity-60">· {f.count}</span>
                </button>
              );
            })}
          </div>
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
          <Dropdown label="Rôle" value={filterRole} onChange={setFilterRole} options={roleDropdownOptions} size="md" />
          <Dropdown label="Statut" value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} size="md" />
        </div>

        {/* Liste */}
        <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <p className="text-[12.5px] font-semibold text-gray-900">
              {filteredUtilisateurs.length} utilisateur(s) trouvé(s)
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
                  <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-500">Utilisateur</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Contact</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Rôle</th>
                  <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500">Statut</th>
                  <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((utilisateur) => {
                  const meta = ROLE_META[roleKeyOf(utilisateur.role)] || {
                    label: 'Utilisateur',
                    badgeBg: 'bg-gray-100',
                    badgeText: 'text-gray-700',
                  };
                  return (
                    <tr key={utilisateur.id} className="border-t border-gray-100">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-medical-primary to-medical-secondary text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {utilisateur.prenom?.[0]}
                            {utilisateur.nom?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-[13.5px] truncate">
                              {utilisateur.prenom} {utilisateur.nom}
                            </p>
                            {utilisateur.specialite && (
                              <p className="text-[11.5px] text-gray-400 truncate">{utilisateur.specialite}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600 text-[12.5px]">{utilisateur.email}</p>
                        {utilisateur.telephone && <p className="text-gray-400 text-xs mt-0.5">{utilisateur.telephone}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.badgeBg} ${meta.badgeText}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleUserStatus(utilisateur.id, utilisateur.actif)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors ${
                            utilisateur.actif ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: utilisateur.actif ? '#047857' : '#9ca3af' }}
                          />
                          {utilisateur.actif ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/administration/gestion-utilisateurs/details/${utilisateur.id}`)}
                            className="p-1.5 bg-medical-primary/10 text-medical-primary rounded-lg hover:bg-medical-primary/20 transition-colors"
                            title="Voir détails"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/administration/gestion-utilisateurs/details/${utilisateur.id}`)}
                            className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(utilisateur.id)}
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

          {filteredUtilisateurs.length === 0 && (
            <div className="py-16 px-5 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2.5" />
              <p className="text-[13px] text-gray-400">Aucun utilisateur ne correspond à ces filtres</p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {filteredUtilisateurs.length === 0
                ? ''
                : `${startIdx + 1}–${Math.min(startIdx + itemsPerPage, filteredUtilisateurs.length)} sur ${filteredUtilisateurs.length}`}
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
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{selectedUser.prenom} {selectedUser.nom}</strong> ?
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
    </div>
  );
};

export default GestionUtilisateurs;
