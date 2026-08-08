import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase'; // Keep for now for RPC calls
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { fr as frLocale } from 'date-fns/locale';

registerLocale('fr', frLocale);
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SearchableSelect from '../../components/common/SearchableSelect';
import Dropdown from '../../components/common/Dropdown';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAlert } from '../../contexts/AlertContext';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  CalendarDays,
  UserCheck,
  Edit,
  Trash2,
  Users,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { formatDoctorSpecialties } from '../../utils/doctorUtils';

import { useAppointmentBookingData } from '../../hooks/useAppointmentBookingData';
import { appointmentService } from '../../lib/services'; // Import appointmentService for deletion

import { NewAppointmentModal } from '../../components/rendez-vous/NewAppointmentModal';

const PriseRendezVousPage = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { dialogState, showError, showConfirm, closeDialog } = useConfirmDialog();
  const { showError: showAlertError, showSuccess, showWarning } = useAlert();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('');
  const [selectedSpecialiteFilter, setSelectedSpecialiteFilter] = useState('');
  const [secretaireId, setSecretaireId] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // Keep searchTerm locally
  // Modal "Nouveau rendez-vous" / "Modifier le rendez-vous" (composant
  // autonome, voir components/rendez-vous/NewAppointmentModal.jsx)
  const [modalOpen, setModalOpen] = useState(false);
  const [localEditingAppointment, setLocalEditingAppointment] = useState(null);
  const [confirmedPresenceAppointmentId, setConfirmedPresenceAppointmentId] = useState(null);
  // Menu secondaire (Modifier/Supprimer) séparé du bouton "Confirmer la présence"
  // pour éviter les mis-clics (voir FIX_ETAPE_1_SECRETAIRE.md point 4)
  const [openMenuId, setOpenMenuId] = useState(null);
  const openMenuRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Récupérer le patientId depuis l'URL pour pré-sélection
  const preselectedPatientId = searchParams.get('patientId');

  // Use the appointment booking data hook
  const {
    specialites,
    allPatients,
    allDoctors,
    appointments,
    error: dataError,
    refreshAppointments
  } = useAppointmentBookingData(selectedDate, selectedDoctorFilter, selectedSpecialiteFilter);

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

  // Reset confirmedPresenceAppointmentId when date or doctor filter changes
  useEffect(() => {
    setConfirmedPresenceAppointmentId(null);
  }, [selectedDate, selectedDoctorFilter]);

  // Ouvrir directement le modal "Nouveau rendez-vous" via ?new=true (ex. depuis
  // le bouton "Nouveau rendez-vous" du dashboard secrétaire). Le modal étant
  // désormais autonome (charge ses propres données), plus besoin d'attendre
  // le chargement de la liste de cette page.
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setLocalEditingAppointment(null);
      setModalOpen(true);
      // Nettoyer le paramètre pour ne pas rouvrir le modal à chaque re-render
      navigate('/rendez-vous/prise-rendez-vous', { replace: true });
    }
  }, [searchParams, navigate]);

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
      // Action à haute fréquence : toast non bloquant plutôt qu'une modale à fermer manuellement
      // (voir FIX_ETAPE_1_SECRETAIRE.md point 3)
      unifiedNotificationService.success(data?.message || 'Patient confirmé présent et ajouté à la salle d\'attente');
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
          unifiedNotificationService.info('Rendez-vous marqué absent (annulé)');
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
          unifiedNotificationService.success('Rendez-vous supprimé avec succès');
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
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prise de Rendez-vous</h1>
          <p className="text-gray-600">Planification et gestion des consultations</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/salle-attente')}
            className="flex items-center px-4 py-2 bg-white text-medical-primary border border-medical-primary rounded-lg hover:bg-medical-primary/5 transition-colors"
            title="Gérer les patients déjà en salle d'attente"
          >
            <Users className="w-4 h-4 mr-2" />
            Salle d'attente
          </button>
          <button
            onClick={() => {
              setLocalEditingAppointment(null);
              setModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rendez-vous
          </button>
        </div>
      </div>

      {/* Filtres — une seule ligne compacte (l'ancien gabarit avait 4 blocs dans
          une grille à 3 colonnes : le bouton Actualiser se retrouvait seul sur
          une 2e ligne) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              minDate={new Date()}
              locale="fr"
            />
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Spécialité</label>
            <Dropdown
              value={selectedSpecialiteFilter}
              onChange={(value) => {
                setSelectedSpecialiteFilter(value);
                setSelectedDoctorFilter(''); // Reset doctor filter when speciality changes
              }}
              options={[
                { value: '', label: 'Toutes les spécialités' },
                ...specialites
                  .filter((s) => !s.parent_id)
                  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }))
                  .flatMap((parent) => {
                    const children = specialites
                      .filter((s) => s.parent_id === parent.id)
                      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }));
                    return [
                      { value: parent.id, label: parent.nom },
                      ...children.map((child) => ({ value: child.id, label: '— ' + child.nom })),
                    ];
                  }),
              ]}
              size="sm"
              className="w-full"
            />
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Médecin</label>
            <Dropdown
              value={selectedDoctorFilter}
              onChange={(value) => {
                setSelectedDoctorFilter(value);
                setSelectedSpecialiteFilter(''); // Reset speciality filter when doctor changes
              }}
              options={[
                { value: '', label: 'Tous les médecins' },
                ...allDoctors.map(doctor => ({
                  value: doctor.id,
                  label: `Dr. ${doctor.prenom} ${doctor.nom} - ${doctor.specialite}`,
                })),
              ]}
              size="sm"
              className="w-full"
            />
          </div>

          <button
            onClick={refreshAppointments} // Use refreshAppointments from hook
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {formatTime(appointment.date_heure).split(':')[0]}
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-[160px_100px_140px_180px_1fr] items-center gap-x-3">
                      <span className="font-bold text-gray-900 text-base truncate" title={`${appointment.patient?.prenom} ${appointment.patient?.nom}`}>
                        {appointment.patient?.prenom} {appointment.patient?.nom}
                      </span>
                      <span className="justify-self-start">{getStatusBadge(appointment.statut)}</span>
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        {new Date(appointment.date_heure).toLocaleDateString('fr-FR')} · {formatTime(appointment.date_heure)}
                      </span>
                      <span className="text-sm text-gray-500 truncate" title={appointment.motif || ''}>
                        {appointment.motif}
                      </span>
                      {appointment.medecin && (
                        <span className="text-sm text-gray-500 truncate">
                          Dr. {appointment.medecin.prenom} {appointment.medecin.nom}
                          {appointment.medecin.specialite ? ` · ${appointment.medecin.specialite}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!['arrive', 'termine', 'annule'].includes(appointment.statut) && (
                      <button
                        onClick={() => handleConfirmPatientPresence(appointment)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                        title="Confirmer la présence"
                      >
                        <UserCheck className="w-4 h-4" />
                        Confirmer présence
                      </button>
                    )}

                    {/* Actions secondaires (Modifier/Supprimer) regroupées dans un
                        menu à part — la suppression ne doit pas être un clic voisin
                        de "Confirmer présence", l'action répétée à longueur de journée. */}
                    <div
                      className="relative"
                      ref={openMenuId === appointment.id ? openMenuRef : undefined}
                    >
                      <button
                        onClick={() => setOpenMenuId(openMenuId === appointment.id ? null : appointment.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Autres actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === appointment.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                          <button
                            onClick={() => {
                              setLocalEditingAppointment(appointment);
                              setModalOpen(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit className="w-4 h-4" />
                            Modifier
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDelete(appointment.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
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

      {/* Modal "Nouveau rendez-vous" / "Modifier le rendez-vous" — composant
          autonome et réutilisable, voir components/rendez-vous/NewAppointmentModal.jsx */}
      <NewAppointmentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setLocalEditingAppointment(null);
        }}
        editingAppointment={localEditingAppointment}
        initialDate={selectedDate}
        initialDoctorId={selectedDoctorFilter}
        preselectedPatientId={preselectedPatientId}
        onSaved={refreshAppointments}
      />

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
