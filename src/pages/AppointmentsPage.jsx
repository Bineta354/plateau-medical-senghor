import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppointmentTypeMotifFields, { resolveAppointmentMotif } from '../components/common/AppointmentTypeMotifFields';
import Dropdown from '../components/common/Dropdown';
import patientStatusService from '../services/patientStatusService';
import { sendNotification, NOTIFICATION_TYPES } from '../lib/notifications';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Plus, 
  Search, 
  Filter,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  CalendarDays,
  Stethoscope
} from 'lucide-react';

const AppointmentsPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    medecin_id: '',
    date_heure: '',
    motif: '',
    motif_autre: '',
    type_rdv: 'consultation',
    priorite: 'normale',
    duree: 30,
    statut: 'confirme',
    notes: '',
  });

  useEffect(() => {
    fetchData();
    
    // Vérifier si un patientId est passé en paramètre
    const patientId = searchParams.get('patientId');
    if (patientId) {
      setFormData(prev => ({ ...prev, patient_id: patientId }));
      setShowForm(true);
    }
  }, [selectedDate, searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAppointments(),
        fetchPatients(),
        fetchDoctors(),
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*),
          medecin:users!inner(*)
        `)
        .gte('date_heure', `${selectedDate}T00:00:00`)
        .lt('date_heure', `${selectedDate}T23:59:59`)
        .order('date_heure', { ascending: false });

      if (error) throw error;
      // Filtrer pour ne montrer que les rendez-vous avec des médecins actifs
      const filteredData = (data || []).filter(appointment => appointment.medecin?.actif !== false);
      setAppointments(filteredData);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('nom', { ascending: true });

      if (error) throw error;
      console.log('Patients chargés:', data?.length || 0);
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'doctor')
        .eq('actif', true)
        .order('nom', { ascending: true });

      if (error) throw error;
      console.log('Médecins chargés:', data?.length || 0);
      setDoctors(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = 
      appointment.patient?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.patient?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.medecin?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.motif?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || appointment.statut === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      console.log('=== DÉBUT CRÉATION RENDEZ-VOUS ===');
      console.log('Données formulaire:', formData);
      
      // Validation des données renforcée
      const validationErrors = [];
      
      if (!formData.patient_id || formData.patient_id === '') {
        validationErrors.push('Patient requis');
      }
      if (!formData.medecin_id || formData.medecin_id === '') {
        validationErrors.push('Médecin requis');
      }
      if (!formData.date_heure || formData.date_heure === '') {
        validationErrors.push('Date et heure requises');
      }
      
      // Vérification format date et date future
      if (formData.date_heure) {
        const appointmentDate = new Date(formData.date_heure);
        if (isNaN(appointmentDate.getTime())) {
          validationErrors.push('Format de date invalide');
        } else if (appointmentDate < new Date()) {
          validationErrors.push('La date ne peut pas être dans le passé');
        }
      }
      
      // Vérification durée
      if (formData.duree && (formData.duree < 15 || formData.duree > 120)) {
        validationErrors.push('Durée doit être entre 15 et 120 minutes');
      }
      
      // Vérification statut
      const validStatuses = ['confirme', 'en_attente', 'annule'];
      if (formData.statut && !validStatuses.includes(formData.statut)) {
        validationErrors.push('Statut invalide');
      }
      
      if (validationErrors.length > 0) {
        console.error('Erreurs de validation:', validationErrors);
        alert('Erreurs de validation:\n' + validationErrors.join('\n'));
        return;
      }
      
      // Vérification que les IDs existent
      console.log('Vérification patient ID:', formData.patient_id);
      const { data: patientExists } = await supabase
        .from('patients')
        .select('id')
        .eq('id', parseInt(formData.patient_id))
        .single();
      
      if (!patientExists) {
        alert('Patient sélectionné introuvable. Veuillez actualiser la page.');
        return;
      }
      
      console.log('Vérification médecin ID:', formData.medecin_id);
      const { data: doctorExists } = await supabase
        .from('users')
        .select('id')
        .eq('id', parseInt(formData.medecin_id))
        .eq('role', 'doctor')
        .single();
      
      if (!doctorExists) {
        alert('Médecin sélectionné introuvable. Veuillez actualiser la page.');
        return;
      }
      
      // Préparation des données avec conversion des types
      const processedData = {
        patient_id: parseInt(formData.patient_id),
        medecin_id: parseInt(formData.medecin_id),
        date_heure: new Date(formData.date_heure).toISOString(),
        motif: resolveAppointmentMotif(formData.motif, formData.motif_autre),
        type_rdv: formData.type_rdv || 'consultation',
        priorite: formData.priorite || 'normale',
        statut: formData.statut || 'confirme',
        duree: parseInt(formData.duree) || 30,
        notes: formData.notes || null
      };
      
      console.log('Données traitées pour insertion:', processedData);
      
      let result, error;
      
      if (editingAppointment) {
        console.log('Mode modification - ID:', editingAppointment.id);
        ({ data: result, error } = await supabase
          .from('appointments')
          .update(processedData)
          .eq('id', editingAppointment.id)
          .select(`
            *,
            patient:patients(*),
            medecin:users(*)
          `));
      } else {
        console.log('Mode création - insertion...');
        ({ data: result, error } = await supabase
          .from('appointments')
          .insert([processedData])
          .select(`
            *,
            patient:patients(*),
            medecin:users(*)
          `));
      }
      
      if (error) {
        console.error('❌ Erreur base de données:', error);
        console.error('Code d\'erreur:', error.code);
        console.error('Message:', error.message);
        console.error('Détails:', error.details);
        console.error('Hint:', error.hint);
        
        // Messages d'erreur plus spécifiques
        let errorMessage = 'Erreur lors de l\'enregistrement du rendez-vous';
        
        if (error.code === '23503') {
          errorMessage = 'Référence invalide. Vérifiez que le patient et le médecin existent.';
        } else if (error.code === '23514') {
          errorMessage = 'Données invalides. Vérifiez le statut, la durée et les autres champs.';
        } else if (error.code === '42501') {
          errorMessage = 'Permissions insuffisantes. Contactez l\'administrateur.';
        } else if (error.message.includes('RLS')) {
          errorMessage = 'Problème de sécurité. Veuillez vous reconnecter.';
        } else if (error.message) {
          errorMessage = `Erreur: ${error.message}`;
        }
        
        alert(errorMessage);
        return;
      }
      
      console.log('✅ Rendez-vous enregistré avec succès:', result);
      
      // Mettre à jour le statut du patient si c'est une création
      if (!editingAppointment && result && result.length > 0) {
        const appointment = result[0];
        console.log('🔄 Mise à jour statut patient pour nouveau rendez-vous...');
        try {
          const statusUpdate = await patientStatusService.updatePatientStatusOnAppointment(
            appointment.patient_id, 
            appointment
          );
          
          if (statusUpdate.patientWasInactive) {
            console.log('📋 Patient était inactif et a été activé automatiquement');
            // TODO: Afficher une notification à l'utilisateur
            alert('Le patient était inactif et a été activé automatiquement.');
          }
        } catch (statusError) {
          console.error('❌ Erreur mise à jour statut patient:', statusError);
          // Ne pas bloquer le processus si la mise à jour échoue
        }
      }
      
      // Envoyer une notification
      if (result && result.length > 0) {
        const appointment = result[0];
        if (appointment.patient && appointment.medecin) {
          console.log('📢 Envoi de notification pour le rendez-vous...');
          try {
            // Envoyer notification de nouveau rendez-vous
            await sendNotification(
              NOTIFICATION_TYPES.NEW_APPOINTMENT,
              currentUser?.id, // Système comme expéditeur
              appointment.medecin_id, // Médecin comme destinataire
              null, // Pas de consultation_id
              `${appointment.patient?.prenom} ${appointment.patient?.nom}`,
              {
                appointment_id: appointment.id,
                date_heure: appointment.date_heure,
                motif: appointment.motif
              }
            );
            console.log('✅ Notification de nouveau rendez-vous envoyée');
          } catch (notifError) {
            console.error('❌ Erreur lors de l\'envoi de la notification:', notifError);
            // Ne pas bloquer le processus si la notification échoue
          }
        }
      }
      
      // Fermer le formulaire et actualiser
      setShowForm(false);
      setEditingAppointment(null);
      resetForm();
      await fetchAppointments();
      
      const successMessage = editingAppointment ? 
        'Rendez-vous modifié avec succès!' : 
        'Rendez-vous créé avec succès!';
      
      alert(successMessage);
      console.log('=== FIN CRÉATION RENDEZ-VOUS ===');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement:', error);
      console.error('Stack trace:', error.stack);
      
      let errorMessage = 'Erreur technique: ';
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Erreur inconnue. Consultez la console pour plus de détails.';
      }
      
      alert(errorMessage);
    }
  };

  const handleEdit = (appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      patient_id: appointment.patient_id,
      medecin_id: appointment.medecin_id,
      date_heure: appointment.date_heure,
      motif: appointment.motif || '',
      motif_autre: '',
      type_rdv: appointment.type_rdv || 'consultation',
      priorite: appointment.priorite || 'normale',
      duree: appointment.duree || 30,
      statut: appointment.statut,
      notes: appointment.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (appointmentId, appointmentStatus) => {
    // Empêcher la suppression des rendez-vous déjà réalisés
    const completedStatuses = ['termine', 'réalisé', 'consulté', 'termine_consultation', 'consultation_terminee'];
    if (completedStatuses.includes(appointmentStatus?.toLowerCase())) {
      alert('Impossible de supprimer un rendez-vous déjà réalisé. Ce rendez-vous fait partie de l\'historique médical.');
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) {
      try {
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', appointmentId);
        
        if (error) throw error;
        fetchAppointments();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du rendez-vous');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      patient_id: '',
      medecin_id: '',
      date_heure: '',
      motif: '',
      motif_autre: '',
      type_rdv: 'consultation',
      priorite: 'normale',
      duree: 30,
      statut: 'confirme',
      notes: '',
    });
  };

  const getStatusBadge = (statut) => {
    const statusConfig = {
      confirme: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      en_attente: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      annule: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    
    const config = statusConfig[statut] || statusConfig.confirme;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {statut === 'confirme' ? 'Confirmé' : 
         statut === 'en_attente' ? 'En attente' : 'Annulé'}
      </span>
    );
  };

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des rendez-vous...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Rendez-vous</h1>
          <p className="text-gray-600">Planification et suivi des consultations</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau rendez-vous
        </button>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Patient, médecin, motif..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <Dropdown
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              options={[
                { value: 'all', label: 'Tous les statuts' },
                { value: 'confirme', label: 'Confirmé' },
                { value: 'en_attente', label: 'En attente' },
                { value: 'annule', label: 'Annulé' },
              ]}
              size="md"
              className="w-full"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={fetchData}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Liste des rendez-vous */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Rendez-vous du {new Date(selectedDate).toLocaleDateString('fr-FR')}
          </h2>
          <p className="text-sm text-gray-600">{filteredAppointments.length} rendez-vous trouvé(s)</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motif
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
              {filteredAppointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatTime(appointment.date_heure)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.patient?.prenom} {appointment.patient?.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.patient?.telephone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Stethoscope className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Dr. {appointment.medecin?.prenom} {appointment.medecin?.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.medecin?.specialite}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {appointment.motif || 'Consultation'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(appointment.statut)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(appointment)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {appointment.statut && !['termine', 'réalisé', 'consulté', 'termine_consultation', 'consultation_terminee'].includes(appointment.statut.toLowerCase()) && (
                        <button
                          onClick={() => handleDelete(appointment.id, appointment.statut)}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredAppointments.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun rendez-vous trouvé pour cette date</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAppointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  <Dropdown
                    value={formData.patient_id}
                    onChange={(value) => setFormData({...formData, patient_id: value})}
                    options={[
                      { value: '', label: 'Sélectionner un patient' },
                      ...patients.map(patient => ({
                        value: patient.id,
                        label: `${patient.prenom} ${patient.nom}`,
                      })),
                    ]}
                    size="md"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médecin *</label>
                  <Dropdown
                    value={formData.medecin_id}
                    onChange={(value) => setFormData({...formData, medecin_id: value})}
                    options={[
                      { value: '', label: 'Sélectionner un médecin' },
                      ...doctors.map(doctor => ({
                        value: doctor.id,
                        label: `Dr. ${doctor.prenom} ${doctor.nom} - ${doctor.specialite}`,
                      })),
                    ]}
                    size="md"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure *</label>
                  <input
                    type="datetime-local"
                    value={formData.date_heure}
                    onChange={(e) => setFormData({...formData, date_heure: e.target.value})}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
                  <input
                    type="number"
                    value={formData.duree}
                    onChange={(e) => setFormData({...formData, duree: parseInt(e.target.value)})}
                    min="15"
                    max="120"
                    step="15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  />
                </div>
              </div>
              
              <AppointmentTypeMotifFields
                typeRdv={formData.type_rdv}
                motif={formData.motif}
                motifAutre={formData.motif_autre}
                priorite={formData.priorite}
                showPriorite
                onChange={(fields) => setFormData((prev) => ({ ...prev, ...fields }))}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <Dropdown
                  value={formData.statut}
                  onChange={(value) => setFormData({...formData, statut: value})}
                  options={[
                    { value: 'confirme', label: 'Confirmé' },
                    { value: 'en_attente', label: 'En attente' },
                    { value: 'annule', label: 'Annulé' },
                  ]}
                  size="md"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  placeholder="Notes additionnelles..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingAppointment(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
                >
                  {editingAppointment ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
