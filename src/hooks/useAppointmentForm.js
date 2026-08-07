import { useState, useMemo, useCallback, useEffect } from 'react';
import { patientService, appointmentService, waitingQueueService } from '../lib/services';
import { useAlert } from '../contexts/AlertContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { resolveAppointmentMotif } from '../components/common/AppointmentTypeMotifFields';

export const useAppointmentForm = ({
  allPatients,
  allDoctors,
  specialites = [],
  appointments, // Appointments for the selected date
  refreshAppointments,
  showAlertError, // From AlertContext
  showSuccess, // From AlertContext
  showWarning, // From AlertContext
  // No need for showInfo from AlertContext or dialogState, showError, showConfirm, closeDialog from useConfirmDialog
  // if they are only used for UI (which will be in the component itself)
  editingAppointment: initialEditingAppointment, // Renamed to avoid conflict
}) => {
  // NB: useConfirmDialog() ici est une instance à part de celle du composant
  // appelant — dialogState/closeDialog doivent être retournés (ci-dessous) et
  // rendus par l'appelant, sinon les erreurs de validation du stepper
  // (patient/spécialité/créneau requis, conflit de planning) ne s'affichent
  // nulle part.
  const { dialogState, showError: showDialogError, showConfirm, closeDialog } = useConfirmDialog();

  const [editingAppointment, setEditingAppointment] = useState(initialEditingAppointment);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSpecialiteStepper, setSelectedSpecialiteStepper] = useState('');
  const [selectedDoctorStepper, setSelectedDoctorStepper] = useState('');
  const [manualDate, setManualDate] = useState(new Date()); // Date for manual selection
  const [manualTime, setManualTime] = useState(''); // Time for manual selection
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    patient_id: '',
    medecin_id: '',
    date_heure: '',
    motif: '',
    motif_autre: '',
    duree: 30,
    statut: 'confirme',
    priorite: 'normale',
    notes: '',
    type_rdv: 'consultation',
  });

  const [quickBooking, setQuickBooking] = useState({
    patient_nom: '',
    patient_prenom: '',
    patient_telephone: '',
    patient_email: '',
    patient_date_naissance: '',
    patient_sexe: 'M',
    create_patient: false
  });

  const stepperSteps = [
    {
      id: 0,
      title: 'Patient & contexte',
      description: 'Sélectionnez le patient, la spécialité et la date du rendez-vous'
    },
    {
      id: 1,
      title: 'Médecin & disponibilité',
      description: 'Choisissez un médecin et un créneau libre pour la date sélectionnée'
    },
    {
      id: 2,
      title: 'Confirmation',
      description: 'Renseignez les derniers détails avant la confirmation'
    }
  ];

  // Initialize form when editingAppointment changes
  useEffect(() => {
    if (initialEditingAppointment) {
      setEditingAppointment(initialEditingAppointment);
      setFormData({
        patient_id: initialEditingAppointment.patient_id,
        medecin_id: initialEditingAppointment.medecin_id,
        date_heure: initialEditingAppointment.date_heure,
        motif: initialEditingAppointment.motif || '',
        duree: initialEditingAppointment.duree || 30,
        statut: initialEditingAppointment.statut,
        priorite: initialEditingAppointment.priorite || 'normale',
        notes: initialEditingAppointment.notes || '',
        type_rdv: initialEditingAppointment.type_rdv || 'consultation'
      });
      const d = new Date(initialEditingAppointment.date_heure);
      setManualDate(d);
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      setManualTime(`${hh}:${mm}`);
      setShowForm(true);
      setCurrentStep(0);
      setSelectedSpecialiteStepper(initialEditingAppointment.medecin?.specialite || '');
      setSelectedDoctorStepper(initialEditingAppointment.medecin_id || '');
    } else {
      resetForm();
      setShowForm(false);
      setEditingAppointment(null);
    }
  }, [initialEditingAppointment]);

  const isSameDay = (dateA, dateB) => {
    if (!dateA || !dateB) return false;
    const d1 = new Date(dateA);
    const d2 = new Date(dateB);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const appointmentsByDoctor = useMemo(() => {
    if (!manualDate) return {};
    const map = {};
    appointments.forEach((apt) => {
      if (!apt?.medecin_id) return;
      if (!isSameDay(apt.date_heure, manualDate)) return;
      if (!map[apt.medecin_id]) {
        map[apt.medecin_id] = [];
      }
      map[apt.medecin_id].push(apt);
    });
    return map;
  }, [appointments, manualDate]);

  const doctorLoadsById = useMemo(() => {
    const map = {};
    Object.entries(appointmentsByDoctor).forEach(([doctorId, list]) => {
      map[doctorId] = Array.isArray(list) ? list.length : 0;
    });
    return map;
  }, [appointmentsByDoctor]);

  const specialiteIdsWithChildren = useMemo(() => {
    if (!selectedSpecialiteStepper) return [];
    const selectedId = String(selectedSpecialiteStepper);
    const ids = [selectedId];
    specialites.forEach((s) => {
      if (String(s.parent_id) === selectedId) {
        ids.push(String(s.id));
      }
    });
    return ids;
  }, [selectedSpecialiteStepper, specialites]);

  const availableDoctors = useMemo(() => {
    const base = selectedSpecialiteStepper
      ? allDoctors.filter((doctor) => specialiteIdsWithChildren.includes(String(doctor.specialite_id)))
      : allDoctors;

    return [...base].sort((a, b) => {
      const countA = doctorLoadsById[a.id] || 0;
      const countB = doctorLoadsById[b.id] || 0;
      if (countA !== countB) return countA - countB;
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allDoctors, selectedSpecialiteStepper, specialiteIdsWithChildren, doctorLoadsById]);

  const generateDoctorTimeSlots = useCallback((doctorId) => {
    if (!manualDate || !doctorId) return [];
    const slots = [];
    const baseDate = new Date(manualDate);
    for (let hour = 8; hour < 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotDate = new Date(baseDate);
        slotDate.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotDate.getTime() + (formData.duree || 30) * 60000);

        const doctorAppointments = appointmentsByDoctor[doctorId] || [];
        const isOccupied = doctorAppointments.some((apt) => {
          if (apt.statut === 'annule') return false;
          const aptStart = new Date(apt.date_heure);
          const aptEnd = new Date(aptStart.getTime() + (apt.duree || 30) * 60000);
          return aptStart < slotEnd && aptEnd > slotDate;
        });

        slots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          iso: slotDate.toISOString(),
          isOccupied
        });
      }
    }
    return slots;
  }, [manualDate, formData.duree, appointmentsByDoctor]);

  const hasSlotConflict = useCallback((doctorId, isoDateTime) => {
    if (!doctorId || !isoDateTime) return false;
    const doctorAppointments = appointmentsByDoctor[doctorId] || [];
    const slotStart = new Date(isoDateTime);
    const slotEnd = new Date(slotStart.getTime() + (formData.duree || 30) * 60000);
    return doctorAppointments.some((apt) => {
      if (apt.statut === 'annule') return false;
      const aptStart = new Date(apt.date_heure);
      const aptEnd = new Date(aptStart.getTime() + (apt.duree || 30) * 60000);
      // Check for overlap excluding the current editing appointment
      if (editingAppointment && apt.id === editingAppointment.id) {
        return false;
      }
      return aptStart < slotEnd && aptEnd > slotStart;
    });
  }, [formData.duree, appointmentsByDoctor, editingAppointment]);

  const selectedDoctorData = useMemo(
    () => allDoctors.find((doctor) => doctor.id === formData.medecin_id) || null,
    [allDoctors, formData.medecin_id]
  );

  const selectedPatientData = useMemo(() => {
    if (quickBooking.create_patient) return null;
    if (!formData.patient_id) return null;
    return allPatients.find((patient) => patient.id === formData.patient_id) || null;
  }, [allPatients, formData.patient_id, quickBooking.create_patient]);

  const hasCurrentSelectionConflict = useMemo(() => {
    if (!formData.medecin_id || !formData.date_heure) return false;
    return hasSlotConflict(formData.medecin_id, formData.date_heure);
  }, [formData.medecin_id, formData.date_heure, hasSlotConflict]);

  // Bouton Créer/Modifier activé uniquement si champs requis ok
  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!formData.medecin_id) return false;
    if (!formData.date_heure) return false;
    if (hasCurrentSelectionConflict) return false;
    if (quickBooking.create_patient) {
      return !!(quickBooking.patient_nom && quickBooking.patient_prenom && quickBooking.patient_date_naissance);
    }
    return !!formData.patient_id;
  }, [submitting, formData.medecin_id, formData.date_heure, hasCurrentSelectionConflict, quickBooking.create_patient, quickBooking.patient_nom, quickBooking.patient_prenom, quickBooking.patient_date_naissance, formData.patient_id]);

  const resetForm = useCallback(() => {
    setFormData({
      patient_id: '',
      medecin_id: '',
      date_heure: '',
      motif: '',
      motif_autre: '',
      duree: 30,
      statut: 'confirme',
      priorite: 'normale',
      notes: '',
      type_rdv: 'consultation',
    });
    setQuickBooking({
      patient_nom: '',
      patient_prenom: '',
      patient_telephone: '',
      patient_email: '',
      patient_date_naissance: '',
      patient_sexe: 'M',
      create_patient: false
    });
    setManualDate(new Date());
    setManualTime('');
    setCurrentStep(0);
    setSelectedSpecialiteStepper('');
    setSelectedDoctorStepper('');
    setEditingAppointment(null);
  }, []);

  const handlePreviousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNextStep = useCallback(async (event) => {
    if (event) event.preventDefault();

    if (currentStep === 0) {
      if (quickBooking.create_patient) {
        if (!quickBooking.patient_nom || !quickBooking.patient_prenom) {
          await showDialogError('Informations patient', 'Veuillez renseigner le nom et le prénom du nouveau patient.');
          return false;
        }
        if (!quickBooking.patient_date_naissance) {
          await showDialogError('Informations patient', 'Veuillez renseigner la date de naissance du nouveau patient.');
          return false;
        }
      } else if (!formData.patient_id) {
        await showDialogError('Patient requis', 'Veuillez sélectionner un patient existant.');
        return false;
      }

      if (!selectedSpecialiteStepper) {
        await showDialogError('Spécialité requise', 'Veuillez sélectionner une spécialité médicale.');
        return false;
      }

      if (!manualDate) {
        await showDialogError('Date requise', 'Veuillez sélectionner la date du rendez-vous.');
        return false;
      }

      if (availableDoctors.length === 0) {
        await showDialogError(
          'Aucun médecin disponible',
          'Aucun médecin actif n’est associé à cette spécialité. Veuillez choisir une autre spécialité.'
        );
        return false;
      }

      const doctorStillAvailable = selectedDoctorStepper
        ? availableDoctors.some((doctor) => doctor.id === selectedDoctorStepper)
        : false;

      if (!doctorStillAvailable) {
        setSelectedDoctorStepper('');
      }

      const normalizedDate = manualDate instanceof Date ? new Date(manualDate) : new Date(manualDate);
      normalizedDate.setHours(0, 0, 0, 0);
      const previousDateTime = formData.date_heure ? new Date(formData.date_heure) : null;
      const keepExistingSlot = 
        previousDateTime && 
        doctorStillAvailable && 
        isSameDay(previousDateTime, normalizedDate);

      setFormData((prev) => ({
        ...prev,
        medecin_id: doctorStillAvailable ? selectedDoctorStepper : '',
        date_heure: keepExistingSlot ? prev.date_heure : ''
      }));

      if (!keepExistingSlot) {
        setManualTime('');
      }

      // No need to call setSelectedDate directly, as manualDate is managed here.
      // Refreshing appointments will be handled by the data hook in the main component.
      setCurrentStep(1);
      return true;
    }

    if (currentStep === 1) {
      if (!formData.medecin_id) {
        await showDialogError('Médecin requis', 'Veuillez sélectionner un médecin pour ce rendez-vous.');
        return false;
      }

      if (!formData.date_heure) {
        await showDialogError('Créneau requis', 'Veuillez choisir un créneau horaire disponible.');
        return false;
      }

      if (hasCurrentSelectionConflict) {
        await showDialogError(
          'Conflit de planning',
          'Le créneau sélectionné chevauche un autre rendez-vous du médecin. Choisissez un autre horaire.'
        );
        return false;
      }

      setCurrentStep(2);
      return true;
    }

    return false;
  }, [currentStep, quickBooking, formData, selectedSpecialiteStepper, manualDate, availableDoctors, selectedDoctorStepper, hasCurrentSelectionConflict, showDialogError, isSameDay]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (currentStep < stepperSteps.length - 1) {
      const canProceed = await handleNextStep();
      if (canProceed) {
        // If handleNextStep returned true (meaning it successfully moved to the next step or validated)
        // and it's the last step, proceed with submission
        if (currentStep === stepperSteps.length - 1) {
           // This case should not happen as handleSubmit is only called on the last step's form submission
           // but it's a safety check
        }
      }
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    
    try {
      let patientId = formData.patient_id;
      let createdPatient = null;

      // Créer un nouveau patient si nécessaire
      if (quickBooking.create_patient && quickBooking.patient_nom && quickBooking.patient_prenom) {
        createdPatient = await patientService.create({
          nom: quickBooking.patient_nom,
          prenom: quickBooking.patient_prenom,
          telephone: quickBooking.patient_telephone,
          email: quickBooking.patient_email,
          date_naissance: quickBooking.patient_date_naissance || null,
          sexe: quickBooking.patient_sexe || 'M',
          actif: true,
        });
        patientId = createdPatient.id;
      }

      const appointmentData = {
        patient_id: patientId,
        medecin_id: formData.medecin_id,
        date_heure: formData.date_heure,
        motif: resolveAppointmentMotif(formData.motif, formData.motif_autre),
        duree: formData.duree || 30,
        statut: formData.statut || 'confirme',
        statut_arrivee: 'en_attente_arrivee', // Par défaut, le patient n'est pas encore arrivé
        priorite: formData.priorite || 'normale',
        notes: formData.notes || '',
        type_rdv: formData.type_rdv || 'consultation',
      };

      // Convertir les IDs en bigint si nécessaire (patient_id et medecin_id sont bigint dans la base)
      // NE PAS convertir les UUID (created_by, updated_by)
      if (appointmentData.patient_id && typeof appointmentData.patient_id === 'string') {
        // Vérifier si c'est un UUID (ne pas convertir les UUID)
        if (!appointmentData.patient_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          appointmentData.patient_id = parseInt(appointmentData.patient_id);
        }
      }
      if (appointmentData.medecin_id && typeof appointmentData.medecin_id === 'string') {
        // Vérifier si c'est un UUID (ne pas convertir les UUID)
        if (!appointmentData.medecin_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          appointmentData.medecin_id = parseInt(appointmentData.medecin_id);
        }
      }
      
      let addedToWaitingQueue = false;

      if (editingAppointment) {
        const result = await appointmentService.update(editingAppointment.id, appointmentData);
        if (!result.success) throw new Error(result.error || 'Failed to update appointment');
      } else {
        const result = await appointmentService.create(appointmentData);
        if (!result.success) throw new Error(result.error || 'Failed to create appointment');
        
        // NE PLUS ajouter automatiquement à la salle d'attente
        // Le patient sera ajouté à la salle d'attente uniquement lorsqu'il se présentera physiquement
        // via le bouton "Arrivé" dans la liste des rendez-vous
      }
      
      setShowForm(false);
      resetForm();
      refreshAppointments(); // Refresh appointments in the main component
      
      let successText = editingAppointment
        ? 'Rendez-vous modifié avec succès !'
        : 'Rendez-vous créé avec succès !';
      if (!editingAppointment && addedToWaitingQueue) {
        successText = 'Rendez-vous créé avec succès et ajouté à la file d\'attente !';
      }
      setSuccessMessage(successText);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      showSuccess(successText); // Use the provided showSuccess from AlertContext
      
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
      const notification = appointmentService.getCreationErrorNotification(error);
      setError(notification.message);

      if (notification.type === 'warning' && showWarning) {
        showWarning(notification.message, notification.title);
      } else if (showAlertError) {
        showAlertError(notification.message, notification.title);
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, currentStep, handleNextStep, editingAppointment, quickBooking, formData, refreshAppointments, showDialogError, showSuccess, showAlertError, showWarning]);


  return {
    formData, setFormData,
    quickBooking, setQuickBooking,
    manualDate, setManualDate,
    manualTime, setManualTime,
    showForm, setShowForm,
    editingAppointment, setEditingAppointment,
    submitting,
    currentStep, setCurrentStep,
    selectedSpecialiteStepper, setSelectedSpecialiteStepper,
    selectedDoctorStepper, setSelectedDoctorStepper,
    showSuccessToast, successMessage, setShowSuccessToast,
    error, setError,
    // Dialog des erreurs de validation du stepper — à rendre via <ConfirmDialog>
    // côté appelant (voir note plus haut).
    dialogState, closeDialog,
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
    appointmentsByDoctor, // Exposing this for potential debugging or future use in UI
    isSameDay
  };
};
