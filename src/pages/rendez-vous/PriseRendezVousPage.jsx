import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase'; // Keep for now for RPC calls
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { fr as frLocale } from 'date-fns/locale';

registerLocale('fr', frLocale);
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SearchableSelect from '../../components/common/SearchableSelect';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAlert } from '../../contexts/AlertContext';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  CalendarDays,
  Save,
  X,
  UserCheck,
  Edit,
  Trash2
} from 'lucide-react';
import { formatDoctorSpecialties } from '../../utils/doctorUtils';

import { useAppointmentBookingData } from '../../hooks/useAppointmentBookingData';
import { useAppointmentForm } from '../../hooks/useAppointmentForm';
import { appointmentService } from '../../lib/services'; // Import appointmentService for deletion

import { Step0PatientContext } from '../../components/rendez-vous/Step0PatientContext';
import { Step1DoctorAvailability } from '../../components/rendez-vous/Step1DoctorAvailability';
import { Step2Confirmation } from '../../components/rendez-vous/Step2Confirmation';

const PriseRendezVousPage = () => {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const { dialogState, showError, showConfirm, closeDialog } = useConfirmDialog();
  const { showError: showAlertError, showSuccess, showWarning, showInfo } = useAlert();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('');
  const [selectedSpecialiteFilter, setSelectedSpecialiteFilter] = useState('');
  const [secretaireId, setSecretaireId] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // Keep searchTerm locally
  const [localEditingAppointment, setLocalEditingAppointment] = useState(null); // Local state to pass to form hook
  const [confirmedPresenceAppointmentId, setConfirmedPresenceAppointmentId] = useState(null);
  
  // Récupérer le patientId depuis l'URL pour pré-sélection
  const preselectedPatientId = searchParams.get('patientId');

  // Use the appointment booking data hook
  const {
    specialites,
    allPatients,
    allDoctors,
    appointments,
    loading: dataLoading,
    error: dataError,
    refreshAppointments
  } = useAppointmentBookingData(selectedDate, selectedDoctorFilter, selectedSpecialiteFilter);

  // Use the appointment form hook
  const {
    formData, setFormData,
    quickBooking, setQuickBooking,
    manualDate, setManualDate,
    manualTime, setManualTime,
    showForm, setShowForm,
    editingAppointment, setEditingAppointment, // Renamed from hook to local editingAppointment
    submitting,
    currentStep, setCurrentStep,
    selectedSpecialiteStepper, setSelectedSpecialiteStepper,
    selectedDoctorStepper, setSelectedDoctorStepper,
    showSuccessToast, successMessage, setShowSuccessToast,
    stepperSteps,
    availableDoctors,
    selectedDoctorData,
    selectedPatientData,
    hasCurrentSelectionConflict,
    canSubmit,
    handlePreviousStep,
    handleNextStep,
    handleSubmit,
    resetForm,
    generateDoctorTimeSlots,
    doctorLoadsById,
    isSameDay,
    error, setError
  } = useAppointmentForm({
    allPatients,
    allDoctors,
    specialites,
    appointments,
    refreshAppointments,
    showAlertError,
    showDialogError: showError, // Pass showError from useConfirmDialog
    showSuccess,
    showWarning,
    editingAppointment: localEditingAppointment, // Pass local state to hook
    selectedDoctorFilter // Pass for resetForm logic
  });

  // Effect to sync local editingAppointment with hook's editingAppointment
  useEffect(() => {
    setLocalEditingAppointment(editingAppointment);
  }, [editingAppointment]);

  // Initialiser secretaireId avec l'ID de l'utilisateur connecté (userProfile.id est bigint, currentUser.id est UUID)
  useEffect(() => {
    console.log('🔍 [PriseRendezVous] userProfile:', userProfile);
    console.log('🔍 [PriseRendezVous] currentUser:', currentUser);
    if (userProfile?.id) {
      console.log('✅ [PriseRendezVous] Setting secretaireId to:', userProfile.id);
      setSecretaireId(userProfile.id);
    } else {
      console.warn('⚠️ [PriseRendezVous] userProfile.id is null/undefined');
    }
  }, [userProfile]);

  // Pré-sélectionner le patient si patientId est dans l'URL
  useEffect(() => {
    if (preselectedPatientId && allPatients.length > 0) {
      const preselectedPatient = allPatients.find(p => p.id === parseInt(preselectedPatientId));
      if (preselectedPatient) {
        setFormData(prev => ({
          ...prev,
          patient_id: preselectedPatient.id
        }));
        console.log('✅ Patient pré-sélectionné:', preselectedPatient.nom, preselectedPatient.prenom);
      }
    }
  }, [preselectedPatientId, allPatients, setFormData]);

  // Reset confirmedPresenceAppointmentId when date or doctor filter changes
  useEffect(() => {
    setConfirmedPresenceAppointmentId(null);
  }, [selectedDate, selectedDoctorFilter]);

  // Confirmer la présence du patient et l'ajouter à la salle d'attente
  const handleConfirmPatientPresence = async (appointment) => {
    try {
      if (!appointment?.id) return;
      const secId = secretaireId;
      console.log('🔍 [ConfirmPresence] secId:', secId);
      console.log('🔍 [ConfirmPresence] userProfile.id:', userProfile?.id);
      console.log('🔍 [ConfirmPresence] currentUser.id:', currentUser?.id);

      if (!secId) {
        showAlertError("Impossible d'identifier la secrétaire (secretaireId manquant)");
        return;
      }

      console.log('🔍 [ConfirmPresence] Appel RPC avec:', {
        appointment_id: appointment.id,
        secretaire_id: secId,
        type_secretaire_id: typeof secId
      });

      const { data, error } = await supabase.rpc('secretaire_confirme_patient_presence', {
        p_appointment_id: appointment.id,
        p_secretaire_id: secId
      });

      if (error) throw error;

      console.log('✅ [ConfirmPresence] RPC réussi:', data);

      setConfirmedPresenceAppointmentId(appointment.id);
      // Recharger les rendez-vous pour mettre à jour le statut
      await refreshAppointments();
      // Envoyer notification au médecin que le patient est dans la salle d'attente
      if (data?.medecin_id && appointment.patient) {
        const { sendNotification, NOTIFICATION_TYPES } = await import('../../lib/notifications');
        const patientName = `${appointment.patient.prenom ?? ''} ${appointment.patient.nom ?? ''}`.trim();

        console.log('📤 [ConfirmPresence] Envoi notification avec:', {
          type: NOTIFICATION_TYPES.PATIENT_ARRIVED,
          senderId: secId,
          receiverId: data.medecin_id,
          patientName,
          additionalData: {
            appointment_id: appointment.id,
            patient_id: data.patient_id
          },
          types: {
            senderId_type: typeof secId,
            receiverId_type: typeof data.medecin_id,
            appointment_id_type: typeof appointment.id,
            patient_id_type: typeof data.patient_id
          }
        });

        await sendNotification(
          NOTIFICATION_TYPES.PATIENT_ARRIVED,
          secId,
          data.medecin_id,
          null,
          patientName,
          {
            appointmentId: appointment.id,
            patientId: data.patient_id
          }
        );
      }

      console.log('🔄 [ConfirmPresence] Rafraîchissement des rendez-vous...');
      await refreshAppointments();
      console.log('✅ [ConfirmPresence] Rendez-vous rafraîchis');
      showSuccess(data?.message || 'Patient confirmé présent et ajouté à la salle d\'attente');
    } catch (err) {
      console.error('❌ [ConfirmPresence] Erreur:', err);
      showAlertError(err.message || 'Erreur lors de la confirmation de présence');
    }
  };

  // Marquer un rendez-vous comme absent (annule le RDV)
  const handleMarkAbsent = async (appointmentId) => {
    await showConfirm({
      title: 'Marquer absent',
      message: 'Voulez-vous marquer ce rendez-vous comme absent (annulé) ?',
      type: 'warning',
      confirmText: 'Oui, marquer absent',
      cancelText: 'Annuler',
      showCancel: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('appointments')
            .update({ statut: 'annule' })
            .eq('id', appointmentId);
          if (error) throw error;
          refreshAppointments();
          showInfo('Rendez-vous marqué absent (annulé)');
        } catch (err) {
          console.error('Erreur handleMarkAbsent:', err);
          showAlertError(err.message || 'Erreur lors du marquage absent');
        }
      }
    });
  };

  // Supprimer un rendez-vous
  const handleDelete = async (appointmentId) => {
    await showConfirm({
      title: 'Supprimer le rendez-vous',
      message: 'Êtes-vous sûr de vouloir supprimer ce rendez-vous ? Cette action est irréversible.',
      type: 'danger',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      showCancel: true,
      onConfirm: async () => {
        try {
          const result = await appointmentService.deleteAppointment(appointmentId);
          if (result && result.success === false) {
            showAlertError(result.error || 'Erreur lors de la suppression du rendez-vous');
            return;
          }
          refreshAppointments();
          showSuccess('Rendez-vous supprimé avec succès');
        } catch (err) {
          console.error('Erreur handleDelete:', err);
          showAlertError(err.message || 'Erreur lors de la suppression du rendez-vous');
        }
      }
    });
  };

  const getStatusBadge = (statut) => {
    const statusConfig = {
      confirme: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      en_attente: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      annule: { color: 'bg-red-100 text-red-800', icon: XCircle },
      arrive: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
    };
    
    const config = statusConfig[statut] || statusConfig.confirme;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {statut === 'confirme' ? 'Confirmé' : 
         statut === 'en_attente' ? 'En attente' : 
         statut === 'annule' ? 'Annulé' :
         statut === 'arrive' ? 'Arrivé' : statut}
      </span>
    );
  };

  const getPriorityColor = (priorite) => {
    switch (priorite) {
      case 'urgente': return 'border-l-orange-500';
      case 'tres_urgente': return 'border-l-red-500';
      default: return 'border-l-blue-500';
    }
  };

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSlotStatus = (appointment) => {
    const now = new Date();
    const appointmentTime = new Date(appointment.date_heure);
    const isPast = appointmentTime < now;
    
    // Statuts considérés comme terminés
    const completedStatuses = ['termine', 'completed', 'done', 'annule'];
    const isCompleted = completedStatuses.includes(appointment.statut);
    
    if (isPast) {
      return { status: 'past', label: 'Passé', color: 'bg-gray-100 text-gray-600 border-gray-300' };
    }
    
    if (isCompleted) {
      return { status: 'available', label: 'Disponible', color: 'bg-green-100 text-green-800 border-green-200' };
    }
    
    return { status: 'occupied', label: 'Occupé', color: 'bg-red-100 text-red-800 border-red-200' };
  };


  if (dataError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <XCircle className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg">Erreur lors du chargement des données: {dataError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Toast de succès */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-lg p-4 flex items-center space-x-3 max-w-md">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prise de Rendez-vous</h1>
          <p className="text-gray-600">Planification et gestion des consultations</p>
          {formData.date_heure && (
            <div className="mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                <Clock className="w-4 h-4 mr-1" />
                {new Date(formData.date_heure).toLocaleDateString('fr-FR')} à {new Date(formData.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            resetForm(); // Reset form to initial state
            setShowForm(true);
            setManualDate(selectedDate); // Set manual date to current selected filter date
            // Set doctor in form data if a filter is active
            setFormData(prev => ({ 
              ...prev, 
              medecin_id: selectedDoctorFilter || '',
              date_heure: '' // Clear date_heure for new appointment
            }));
            setSelectedDoctorStepper(selectedDoctorFilter || '');
          }}
          className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau rendez-vous
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              minDate={new Date()}
              locale="fr"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Spécialité</label>
            <select
              value={selectedSpecialiteFilter}
              onChange={(e) => {
                setSelectedSpecialiteFilter(e.target.value);
                setSelectedDoctorFilter(''); // Reset doctor filter when speciality changes
              }}
              className="input-field"
            >
              <option value="">Toutes les spécialités</option>
              {specialites
                .filter((s) => !s.parent_id)
                .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }))
                .flatMap((parent) => {
                  const children = specialites
                    .filter((s) => s.parent_id === parent.id)
                    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }));
                  return [
                    <option key={parent.id} value={parent.id}>{parent.nom}</option>,
                    ...children.map((child) => (
                      <option key={child.id} value={child.id}>{'— ' + child.nom}</option>
                    ))
                  ];
                })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Médecin</label>
            <select
              value={selectedDoctorFilter}
              onChange={(e) => {
                setSelectedDoctorFilter(e.target.value);
                setSelectedSpecialiteFilter(''); // Reset speciality filter when doctor changes
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="">Tous les médecins</option>
              {allDoctors.map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.prenom} {doctor.nom} - {doctor.specialite}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={refreshAppointments} // Use refreshAppointments from hook
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Rendez-vous du jour */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Rendez-vous du jour</h2>
          <p className="text-sm text-gray-600">{appointments.length} rendez-vous</p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {appointments.map((appointment) => (
              <div 
                key={appointment.id} 
                className={`p-3 border-b border-gray-100 border-l-4 ${getPriorityColor(appointment.priorite)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {formatTime(appointment.date_heure).split(':')[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 text-base">
                        {appointment.patient?.prenom} {appointment.patient?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatTime(appointment.date_heure)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!['arrive', 'termine', 'annule'].includes(appointment.statut) && (
                      <button
                        onClick={() => handleConfirmPatientPresence(appointment)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Confirmer la présence"
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingAppointment(appointment)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifier le rendez-vous"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(appointment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer le rendez-vous"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
              
              {appointments.length === 0 && (
                <div className="text-center py-8">
                  <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun rendez-vous ce jour</p>
                </div>
              )}
        </div>
      </div>

      {/* Modal de formulaire avec stepper */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {localEditingAppointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
                  </h3>
                  {formData.date_heure && (
                    <p className="text-sm text-blue-600 mt-2">
                      📅{' '}
                      {new Date(formData.date_heure).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}{' '}
                      à{' '}
                      {new Date(formData.date_heure).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingAppointment(null); // Clear editing appointment in hook
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0">
                {stepperSteps.map((step, index) => {
                  const isCompleted = currentStep > index;
                  const isCurrent = currentStep === index;
                  return (
                    <div key={step.id} className="flex items-start md:flex-1 gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          isCurrent
                            ? 'border-medical-primary text-medical-primary'
                            : isCompleted
                              ? 'border-medical-primary bg-medical-primary text-white'
                              : 'border-gray-300 text-gray-500'
                        }`}
                      >
                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                        <p className="text-xs text-gray-500 leading-4">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {currentStep === 0 && (
                <Step0PatientContext
                  formData={formData}
                  setFormData={setFormData}
                  quickBooking={quickBooking}
                  setQuickBooking={setQuickBooking}
                  manualDate={manualDate}
                  setManualDate={setManualDate}
                  selectedSpecialiteStepper={selectedSpecialiteStepper}
                  setSelectedSpecialiteStepper={setSelectedSpecialiteStepper}
                  specialites={specialites}
                  allPatients={allPatients}
                />
              )}

              {currentStep === 1 && (
                <Step1DoctorAvailability
                  formData={formData}
                  setFormData={setFormData}
                  manualDate={manualDate}
                  setManualDate={setManualDate}
                  manualTime={manualTime}
                  setManualTime={setManualTime}
                  availableDoctors={availableDoctors}
                  doctorLoadsById={doctorLoadsById}
                  generateDoctorTimeSlots={generateDoctorTimeSlots}
                  hasCurrentSelectionConflict={hasCurrentSelectionConflict}
                  selectedSpecialiteStepper={selectedSpecialiteStepper}
                  setSelectedSpecialiteStepper={setSelectedSpecialiteStepper}
                  selectedDoctorStepper={selectedDoctorStepper}
                  setSelectedDoctorStepper={setSelectedDoctorStepper}
                />
              )}

              {currentStep === 2 && (
                <Step2Confirmation
                  formData={formData}
                  setFormData={setFormData}
                  quickBooking={quickBooking}
                  selectedPatientData={selectedPatientData}
                  selectedDoctorData={selectedDoctorData}
                  hasCurrentSelectionConflict={hasCurrentSelectionConflict}
                />
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={currentStep === 0}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentStep === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Précédent
                </button>

                {currentStep < stepperSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
                  >
                    Suivant
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      canSubmit && !submitting
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {submitting ? 'Enregistrement...' : localEditingAppointment ? 'Modifier' : 'Enregistrer'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
      />
    </div>
  );
};

export default PriseRendezVousPage;
