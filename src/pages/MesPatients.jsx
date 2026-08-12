import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Search,
  Plus,
  Eye,
  Phone,
  Mail,
  User,
  AlertCircle,
  RefreshCw,
  Edit,
  Trash2
} from 'lucide-react';
import Pagination, { ItemsPerPageSelector } from '../components/common/Pagination';

const MesPatientsPage = () => {
  console.log('🔄 [MesPatientsPage] DÉBUT - Chargement de la page Mes Patients');
  
  try {
    const navigate = useNavigate();
    const { currentUser, getUserProfile } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [userProfile, setUserProfile] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [recentFilter, setRecentFilter] = useState(true); // Par défaut, afficher seulement les patients récents

    useEffect(() => {
      initializeData();
    }, []);

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm]);

    const initializeData = async () => {
      try {
        console.log('🔄 [MesPatientsPage] Initialisation des données...');
        if (currentUser) {
          const profile = await getUserProfile();
          console.log('🔄 [MesPatientsPage] Profil chargé:', profile);
          setUserProfile(profile);
          if (profile?.id) {
            await fetchPatients(profile.id);
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchPatients = async (doctorId) => {
      try {
        console.log('🔄 [MesPatientsPage] Récupération des patients du médecin:', doctorId);
        
        // Récupérer les patients qui ont un rendez-vous avec ce médecin dans la file d'attente
        const { data: waitingQueueData, error: waitingQueueError } = await supabase
          .from('waiting_queue')
          .select('patient_id')
          .eq('medecin_id', doctorId);

        if (waitingQueueError) {
          console.error('Erreur lors de la récupération de la file d\'attente:', waitingQueueError);
        }

        let patientIds = [];
        if (waitingQueueData && waitingQueueData.length > 0) {
          patientIds = [...new Set(waitingQueueData.map(wq => wq.patient_id).filter(Boolean))];
          console.log('� [MesPatientsPage] Patients dans la file d\'attente:', patientIds.length);
        }

        // Récupérer les patients qui ont des rendez-vous avec ce médecin
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select('patient_id')
          .eq('medecin_id', doctorId)
          .gte('date_heure', today.toISOString())
          .lt('date_heure', tomorrow.toISOString());

        if (!appointmentsError && appointmentsData) {
          const appointmentPatientIds = appointmentsData.map(a => a.patient_id).filter(Boolean);
          patientIds = [...new Set([...patientIds, ...appointmentPatientIds])];
          console.log('📅 [MesPatientsPage] Patients avec rendez-vous aujourd\'hui:', appointmentPatientIds.length);
        }

        // Récupérer les patients correspondants
        let foundPatients = [];
        if (patientIds.length > 0) {
          const { data: patientsData, error: patientsError } = await supabase
            .from('patients')
            .select('*')
            .in('id', patientIds)
            .order('nom', { ascending: true });

          if (!patientsError && patientsData) {
            foundPatients = patientsData;
            console.log('✅ [MesPatientsPage] Patients trouvés:', foundPatients.length);
          }
        }

        console.log('✅ [FINAL] Patients du médecin trouvés:', foundPatients.length);
        setPatients(foundPatients);

      } catch (error) {
        console.error('Erreur lors du chargement des patients:', error);
        setPatients([]);
      }
    };

    const handleViewPatient = (patient) => {
      navigate(`/rendez-vous/fiche-patient?id=${patient.id}`);
    };

    const handleEditPatient = (patient) => {
      navigate(`/patients?id=${patient.id}&edit=true`);
    };

    const handleDeletePatient = async (patient) => {
      if (window.confirm(`Êtes-vous sûr de vouloir supprimer le patient ${patient.prenom} ${patient.nom} ?`)) {
        try {
          const { error } = await supabase
            .from('patients')
            .delete()
            .eq('id', patient.id);

          if (error) {
            console.error('Erreur lors de la suppression du patient:', error);
            alert('Erreur lors de la suppression du patient');
          } else {
            console.log('✅ Patient supprimé avec succès');
            // Recharger la liste des patients
            fetchPatients(userProfile?.id);
          }
        } catch (error) {
          console.error('Erreur lors de la suppression du patient:', error);
          alert('Erreur lors de la suppression du patient');
        }
      }
    };

    const filteredPatients = patients.filter(patient => {
      const matchesSearch = !searchTerm || 
        patient.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.telephone?.includes(searchTerm) ||
        patient.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });

    // Pagination
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-primary"></div>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-medical-primary" />
              Mes Patients
            </h1>
            <p className="text-gray-600 mt-2">
              Gérez votre liste de patients personnels
            </p>
          </div>
          
          <button 
            onClick={() => navigate('/patients')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau Patient
          </button>
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            
            <button 
              onClick={() => fetchPatients(userProfile?.id)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {filteredPatients.length} patient(s) trouvé(s)
            </p>
            <ItemsPerPageSelector
              value={itemsPerPage}
              onChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-medical-primary flex items-center justify-center">
                            <User className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.prenom} {patient.nom}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-900">
                        {patient.telephone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{patient.telephone}</span>
                          </div>
                        )}
                        {patient.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{patient.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleViewPatient(patient)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditPatient(patient)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Modifier le patient"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePatient(patient)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer le patient"
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
          
          {filteredPatients.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'Aucun patient trouvé pour cette recherche' : 'Vous n\'avez encore aucun patient'}
              </p>
              {!searchTerm && (
                <p className="text-sm text-gray-400 mt-2">
                  Les patients apparaîtront ici après votre première consultation avec eux
                </p>
              )}
            </div>
          )}

          {filteredPatients.length > 0 && (
            <div className="border-t border-gray-200">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredPatients.length}
              />
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('❌ [MesPatientsPage] Erreur dans le composant:', error);
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Erreur de chargement</h3>
          <p className="text-red-600 text-sm mt-1">Une erreur est survenue lors du chargement de la page.</p>
        </div>
      </div>
    );
  }
};

export default MesPatientsPage;
