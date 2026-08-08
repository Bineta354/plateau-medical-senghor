import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import SearchableSelect from '../../components/common/SearchableSelect';
import Dropdown from '../../components/common/Dropdown';
import {
  Calendar,
  Filter,
  RefreshCcw,
  Search,
  Stethoscope,
  User,
  Clock
} from 'lucide-react';
import { formatDoctorSpecialties } from '../../utils/doctorUtils';
import Pagination from '../../components/common/Pagination';

const ITEMS_PER_PAGE = 20;

const formatISODate = (date) => date.toISOString().split('T')[0];

const initializeDateFilters = () => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  return {
    start: formatISODate(start),
    end: formatISODate(today)
  };
};

const RechercheRendezVousPage = () => {
  const initialDates = useMemo(() => initializeDateFilters(), []);
  const [filters, setFilters] = useState({
    dateStart: initialDates.start,
    dateEnd: initialDates.end,
    medecinId: '',
    patientId: '',
    specialite: ''
  });
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const specialitesDisponibles = useMemo(() => {
    const values = doctors
      .map((doctor) => ({ id: doctor.specialite_id, nom: doctor.specialite }))
      .filter((value) => value.id && value.nom && value.nom.trim() !== '');
    // Remove duplicates by id
    const uniqueMap = new Map();
    values.forEach(s => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [doctors]);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [{ data: patientsData, error: patientsError }, { data: doctorsData, error: doctorsError }] =
          await Promise.all([
            supabase
              .from('patients')
              .select('id, nom, prenom, telephone')
              .order('nom', { ascending: true }),
            supabase
              .from('users')
              .select('id, nom, prenom, specialite, specialite_id')
              .eq('role', 'doctor')
              .eq('actif', true)
              .order('nom', { ascending: true })
          ]);

        if (patientsError) throw patientsError;
        if (doctorsError) throw doctorsError;

        setPatients(patientsData || []);
        setDoctors(doctorsData || []);
      } catch (err) {
        console.error('Erreur lors du chargement des références:', err);
        setError("Impossible de charger les patients et médecins. Veuillez réessayer.");
      }
    };

    loadReferenceData();
  }, []);

  useEffect(() => {
    handleSearch();
    setIsInitialMount(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Déclencher la recherche automatiquement quand les filtres changent
  useEffect(() => {
    // Ne pas déclencher la recherche au montage initial (déjà fait par le useEffect précédent)
    if (isInitialMount) {
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 300); // Debounce de 300ms pour éviter trop de requêtes

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateStart, filters.dateEnd, filters.medecinId, filters.patientId, filters.specialite]);

  const toIntOrNull = (value) => {
    if (!value || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const buildDateBoundary = (dateString, endOfDay = false) => {
    if (!dateString) return null;
    const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00';
    return `${dateString}${suffix}`;
  };

  const handleSearch = async (overrideFilters) => {
    let activeFilters = filters;

    if (overrideFilters) {
      if (typeof overrideFilters.preventDefault === 'function') {
        overrideFilters.preventDefault();
      } else {
        activeFilters = overrideFilters;
      }
    }
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('appointments')
        .select(
          `
            id,
            date_heure,
            statut,
            motif,
            duree,
            priorite,
            patient:patients(id, nom, prenom, telephone),
            medecin:users!inner(id, nom, prenom, specialite, actif)
          `
        )
        .order('date_heure', { ascending: true });

      const startBoundary = buildDateBoundary(activeFilters.dateStart, false);
      const endBoundary = buildDateBoundary(activeFilters.dateEnd, true);
      const medecinId = toIntOrNull(activeFilters.medecinId);
      const patientId = toIntOrNull(activeFilters.patientId);

      if (startBoundary) {
        query = query.gte('date_heure', startBoundary);
      }
      if (endBoundary) {
        query = query.lte('date_heure', endBoundary);
      }
      if (medecinId) {
        query = query.eq('medecin_id', medecinId);
      }
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error: appointmentsError } = await query;
      if (appointmentsError) throw appointmentsError;

      let filtered = data || [];
      if (activeFilters.specialite) {
        const specialiteId = parseInt(activeFilters.specialite);
        filtered = filtered.filter(
          (appointment) => appointment.medecin?.specialite_id === specialiteId
        );
      }

      setAppointments(filtered);
      setCurrentPage(1);
    } catch (err) {
      console.error('Erreur lors de la recherche de rendez-vous:', err);
      setError("Une erreur est survenue lors de la recherche des rendez-vous.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleReset = () => {
    const dates = initializeDateFilters();
    const defaultFilters = {
      dateStart: dates.start,
      dateEnd: dates.end,
      medecinId: '',
      patientId: '',
      specialite: ''
    };
    setFilters(defaultFilters);
    handleSearch(defaultFilters);
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return '';
    return new Date(dateTime).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.max(1, Math.ceil(appointments.length / ITEMS_PER_PAGE));
  const paginatedAppointments = appointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const renderStatusBadge = (statut) => {
    const config = {
      confirme: { label: 'Confirmé', color: 'bg-green-100 text-green-800' },
      en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      arrive: { label: 'Arrive', color: 'bg-blue-100 text-blue-800' },
      termine: { label: 'Termine', color: 'bg-purple-100 text-purple-800' },
      reporte: { label: 'Reporte', color: 'bg-orange-100 text-orange-800' },
      annule: { label: 'Annulé', color: 'bg-red-100 text-red-800' }
    };
    const { label, color } = config[statut] || { label: statut || 'Inconnu', color: 'bg-gray-100 text-gray-600' };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recherche de rendez-vous</h1>
          <p className="text-gray-600">
            Filtrez vos rendez-vous par date, patient, médecin ou spécialité.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center gap-3 border-b border-gray-200 p-4">
          <Filter className="w-5 h-5 text-medical-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Filtres de recherche</h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.dateStart || ''}
                  onChange={(e) => handleFilterChange('dateStart', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.dateEnd || ''}
                  onChange={(e) => handleFilterChange('dateEnd', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <SearchableSelect
                label="Médecin"
                options={[
                  { id: '', label: 'Tous les médecins', prenom: '', nom: '', specialite: '' },
                  ...doctors.map((doctor) => ({
                    id: doctor.id,
                    label: `Dr. ${doctor.prenom} ${doctor.nom}${doctor.specialite ? ` - ${doctor.specialite}` : ''}`,
                    prenom: doctor.prenom,
                    nom: doctor.nom,
                    specialite: doctor.specialite
                  }))
                ]}
                value={filters.medecinId}
                onChange={(value) => handleFilterChange('medecinId', value)}
                placeholder="Tous les médecins"
                searchPlaceholder="Rechercher un médecin par nom, prénom ou spécialité..."
                emptyMessage="Aucun médecin trouvé"
                renderOption={(option) => {
                  if (!option.id) {
                    return <span className="font-medium text-gray-900">{option.label}</span>;
                  }
                  return (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        Dr. {option.prenom} {option.nom}
                      </span>
                      {option.specialite && (
                        <span className="text-xs text-gray-500">
                          {option.specialite}
                        </span>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            <div>
              <SearchableSelect
                label="Patient"
                options={[
                  { id: '', label: 'Tous les patients', prenom: '', nom: '', telephone: '' },
                  ...patients.map((patient) => ({
                    id: patient.id,
                    label: `${patient.prenom} ${patient.nom}`,
                    prenom: patient.prenom,
                    nom: patient.nom,
                    telephone: patient.telephone
                  }))
                ]}
                value={filters.patientId}
                onChange={(value) => handleFilterChange('patientId', value)}
                placeholder="Tous les patients"
                searchPlaceholder="Rechercher un patient par nom, prénom ou téléphone..."
                emptyMessage="Aucun patient trouvé"
                renderOption={(option) => {
                  if (!option.id) {
                    return <span className="font-medium text-gray-900">{option.label}</span>;
                  }
                  return (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {option.prenom} {option.nom}
                      </span>
                      {option.telephone && (
                        <span className="text-xs text-gray-500">
                          {option.telephone}
                        </span>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Spécialité</label>
              <Dropdown
                value={filters.specialite}
                onChange={(value) => handleFilterChange('specialite', value)}
                options={[
                  { value: '', label: 'Toutes les spécialités' },
                  ...specialitesDisponibles.map((specialite) => ({
                    value: specialite.id,
                    label: specialite.nom,
                  })),
                ]}
                size="md"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              onClick={handleReset}
              className="inline-flex items-center justify-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Réinitialiser
            </button>
            <button
              onClick={handleSearch}
              className="inline-flex items-center justify-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
              disabled={loading}
            >
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Recherche...' : 'Rechercher'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Résultats</h2>
            <p className="text-sm text-gray-600">
              {loading ? 'Chargement des rendez-vous...' : `${appointments.length} rendez-vous trouvé(s)`}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spécialité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motif
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAppointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDateTime(appointment.date_heure)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.patient
                            ? `${appointment.patient.prenom} ${appointment.patient.nom}`
                            : 'Patient inconnu'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.patient?.telephone || 'Téléphone non renseigné'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Stethoscope className="w-4 h-4 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">
                        {appointment.medecin
                          ? `Dr. ${appointment.medecin.prenom} ${appointment.medecin.nom}`
                          : 'Médecin inconnu'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {appointment.medecin?.specialite || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {appointment.motif || 'Consultation'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStatusBadge(appointment.statut)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && appointments.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun rendez-vous ne correspond à ces critères.</p>
            </div>
          )}
        </div>

        {!loading && appointments.length > 0 && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RechercheRendezVousPage;


