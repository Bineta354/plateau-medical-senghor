import React, { useEffect, useMemo, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr as frLocale } from 'date-fns/locale';
import { Calendar, Plus, Save, X } from 'lucide-react';
import PropTypes from 'prop-types';

import { supabase } from '../../lib/supabase';
import { appointmentService, userService } from '../../lib/services';
//import { supabaseQuery as supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { usePersonnalisation } from '../../contexts/PersonnalisationContext';
import {
  DEFAULT_HORAIRES_OUVERTURE,
  generateDoctorTimeSlotsForDay,
  getHoraireDuJour,
  isJourOuvrable,
} from '../../utils/horairesOuverture';
import SearchableSelect from '../common/SearchableSelect';
import RdvStepper from './RdvStepper';
import PatientSelector from './PatientSelector';
import SpecialiteSelect from './SpecialiteSelect';
import DateSelector from './DateSelector';
import DoctorList from './DoctorList';
import TimeSlots from './TimeSlots';
import ConfirmationDetails from './ConfirmationDetails';
import SuccessToast from './SuccessToast';

registerLocale('fr', frLocale);

const STORAGE_KEY_LAST_TIME = 'rdv_last_time';

const composeDateTime = (dateObj, timeValue) => {
  if (!dateObj || !timeValue) return '';
  const [hh, mm] = timeValue.split(':');
  if (hh === undefined || mm === undefined) return '';
  const composed = new Date(dateObj);
  composed.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  return composed.toISOString();
};

const defaultFormState = {
  patient_id: '',
  medecin_id: '',
  date_heure: '',
  motif: '',
  duree: 30,
  statut: 'confirme',
  priorite: 'normale',
  notes: '',
  type_rdv: 'consultation'
};

const defaultQuickBooking = {
  patient_nom: '',
  patient_prenom: '',
  patient_telephone: '',
  patient_email: '',
  patient_sexe: 'M',
  create_patient: false
};

const RdvCreationModal = ({
  isOpen,
  onClose,
  initialDate = new Date(),
  initialDoctorId = '',
  initialPatientId = '',
  initialDuration = 30,
  initialSpecialty = '',
  editingAppointment = null,
  onSuccess,
  onDelete,
  onReportPast,
  isPastAppointment = false,
  restrictToCurrentDoctor = false,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentErrorMessage
}) => {
  const { currentUser, userProfile } = useAuth();
  const { showError, showWarning } = useAlert();
  const { settings: personnalisationSettings } = usePersonnalisation();
  const horairesOuverture = personnalisationSettings?.horaires_ouverture || DEFAULT_HORAIRES_OUVERTURE;

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secretaireId, setSecretaireId] = useState(null);

  const [formData, setFormData] = useState(defaultFormState);
  const [quickBooking, setQuickBooking] = useState(defaultQuickBooking);
  const [manualDate, setManualDate] = useState(initialDate);
  const [manualTime, setManualTime] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    if (!manualTime) return;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LAST_TIME, manualTime);
      }
    } catch (error) {
      console.warn('Impossible de stocker l\'heure sélectionnée:', error);
    }
  }, [manualTime, isOpen]);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSpecialiteStepper, setSelectedSpecialiteStepper] = useState(initialSpecialty || '');
  const [selectedDoctorStepper, setSelectedDoctorStepper] = useState(initialDoctorId || '');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchSecretary = async () => {
      try {
        if (currentUser?.email) {
          const { data, error } = await supabase
            .from('users')
            .select('id, role, email')
            .eq('role', 'secretary')
            .eq('email', currentUser.email)
            .maybeSingle();

          if (error) throw error;
          if (data?.id) {
            setSecretaireId(data.id);
            return;
          }
        }

        const { data: firstSec } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'secretary')
          .order('id')
          .limit(1)
          .maybeSingle();
        if (firstSec?.id) setSecretaireId(firstSec.id);
      } catch (e) {
        console.error('Erreur récupération secretaireId:', e);
      }
    };
    fetchSecretary();
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    initializeModal();
    fetchInitialData();
    console.log('[RdvCreationModal] Modal ouvert - initialDate:', initialDate, 'initialDoctorId:', initialDoctorId, 'initialSpecialty:', initialSpecialty);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchAppointments(manualDate);
  }, [manualDate, selectedDoctorStepper, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!formData.date_heure) return;

    const dt = new Date(formData.date_heure);
    if (Number.isNaN(dt.getTime())) return;

    const hh = dt.getHours().toString().padStart(2, '0');
    const mm = dt.getMinutes().toString().padStart(2, '0');
    const hhmm = `${hh}:${mm}`;

    if (manualTime !== hhmm) {
      setManualTime(hhmm);
    }

    if (!manualDate || !isSameDay(manualDate, dt)) {
      const normalized = new Date(dt);
      normalized.setHours(0, 0, 0, 0);
      setManualDate(normalized);
    }
  }, [formData.date_heure, isOpen]);

  const initializeModal = () => {
    // Si restrictToCurrentDoctor est activé, forcer le médecin connecté
    let doctorId = editingAppointment?.medecin_id ?? initialDoctorId ?? '';
    if (restrictToCurrentDoctor && userProfile?.id) {
      doctorId = String(userProfile.id);
    }
    const patientId = editingAppointment?.patient_id ?? initialPatientId ?? '';

    const baseDateTime = editingAppointment?.date_heure
      ? new Date(editingAppointment.date_heure)
      : initialDate
        ? new Date(initialDate)
        : new Date();

    const normalizedDate = new Date(baseDateTime);
    normalizedDate.setHours(0, 0, 0, 0);

    const manualTimeFromInitial = baseDateTime
      ? `${baseDateTime.getHours().toString().padStart(2, '0')}:${baseDateTime
          .getMinutes()
          .toString()
          .padStart(2, '0')}`
      : '';

    const baseIso = editingAppointment?.date_heure
      ? editingAppointment.date_heure
      : initialDate
        ? composeDateTime(normalizedDate, manualTimeFromInitial)
        : '';

    const isEditing = !!editingAppointment;

    let effectiveTime = manualTimeFromInitial;
    if (!isEditing && !effectiveTime) {
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(STORAGE_KEY_LAST_TIME);
          if (stored) {
            effectiveTime = stored;
          }
        }
      } catch (error) {
        console.warn('Impossible de récupérer l\'heure stockée:', error);
      }
    }

    let computedIso = baseIso;
    if (!isEditing) {
      if (effectiveTime) {
        computedIso = composeDateTime(normalizedDate, effectiveTime);
      } else if (!baseIso && manualTimeFromInitial) {
        computedIso = composeDateTime(normalizedDate, manualTimeFromInitial);
      }
    }

    const timeFromComputedIso = computedIso
      ? (() => {
          const dt = new Date(computedIso);
          if (Number.isNaN(dt.getTime())) return '';
          return `${dt.getHours().toString().padStart(2, '0')}:${dt
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
        })()
      : '';

    setFormData({
      ...defaultFormState,
      patient_id: patientId ? String(patientId) : '',
      medecin_id: doctorId ? String(doctorId) : '',
      date_heure: computedIso,
      motif: editingAppointment?.motif || '',
      duree: editingAppointment?.duree || initialDuration || 30,
      statut: editingAppointment?.statut || 'confirme',
      priorite: editingAppointment?.priorite || 'normale',
      notes: editingAppointment?.notes || '',
      type_rdv: editingAppointment?.type_rdv || 'consultation'
    });
    setManualDate(normalizedDate);
    setManualTime(effectiveTime || timeFromComputedIso || '');
    setQuickBooking(defaultQuickBooking);
    setCurrentStep(0);
    const initialSpecialiteValue =
      (editingAppointment?.medecin?.specialite_id ? String(editingAppointment.medecin.specialite_id) : '') ||
      initialSpecialty ||
      '';
    setSelectedSpecialiteStepper(initialSpecialiteValue);
    setSelectedDoctorStepper(doctorId ? String(doctorId) : '');
    setSuccessMessage('');
    setShowSuccessToast(false);
    console.log('[RdvCreationModal] Form initialisé', {
      doctorId,
      patientId,
      computedIso,
      effectiveTime,
      manualTimeFromInitial,
      initialSpecialty,
    });
  };
  useEffect(() => {
    if (!selectedDoctorStepper) return;
    if (selectedSpecialiteStepper) return;
    const doctor = doctors.find(
      (doc) => String(doc.id) === String(selectedDoctorStepper)
    );
    if (doctor?.specialite_id) {
      setSelectedSpecialiteStepper(String(doctor.specialite_id));
    }
  }, [doctors, selectedDoctorStepper, selectedSpecialiteStepper]);

  // Forcer la sélection du médecin connecté si restrictToCurrentDoctor est activé
  useEffect(() => {
    if (restrictToCurrentDoctor && userProfile?.id && isOpen && doctors.length > 0) {
      const doctorId = String(userProfile.id);
      const doctor = doctors.find((doc) => String(doc.id) === doctorId);
      
      if (doctor) {
        // Forcer la sélection du médecin
        if (String(selectedDoctorStepper) !== doctorId) {
          setSelectedDoctorStepper(doctorId);
          setFormData((prev) => ({
            ...prev,
            medecin_id: doctorId,
          }));
        }
        
        // Forcer la sélection de la spécialité du médecin
        if (doctor.specialite_id && selectedSpecialiteStepper !== String(doctor.specialite_id)) {
          setSelectedSpecialiteStepper(String(doctor.specialite_id));
        }
      }
    }
  }, [restrictToCurrentDoctor, userProfile?.id, isOpen, selectedDoctorStepper, doctors, selectedSpecialiteStepper]);


  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPatients(), fetchDoctors(), fetchSpecialites()]);
    } catch (error) {
      console.error('Erreur chargement initial modal RDV:', error);
    } finally {
      setLoading(false);
    }
  }; 

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('nom', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
      setPatients([]);
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
      setDoctors(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
      setDoctors([]);
    }
  };

  const fetchSpecialites = async () => {
    try {
      const data = await userService.getUniqueDoctorSpecialties();
      console.log("SPECIALITES FETCH:", data);
      setSpecialites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      setSpecialites([]);
    }
  };

  const fetchAppointments = async (date) => {
    try { 
      if (!date) {
        setAppointments([]);
        return;
      }

      const targetDate = new Date(date);
      const dayString = targetDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('date_heure', `${dayString}T00:00:00`)
        .lt('date_heure', `${dayString}T23:59:59`)
        .order('date_heure', { ascending: true });

      if (error) throw error;
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
      setAppointments([]);
    }
  };

  const specialitesDisponibles = useMemo(() => specialites, [specialites]);

  const getSpecialiteNom = (specialiteId) => {
    if (!specialiteId) return '';
    const found = specialites.find((s) => String(s.id) === String(specialiteId));
    return found?.nom || '';
  };

  useEffect(() => {
  console.log("SPECIALITES DISPONIBLES:", specialitesDisponibles);
}, [specialitesDisponibles]);

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
    let base = selectedSpecialiteStepper
      ? doctors.filter((doctor) => specialiteIdsWithChildren.includes(String(doctor.specialite_id)))
      : doctors;

    // Si restrictToCurrentDoctor est activé, ne montrer que le médecin connecté
    if (restrictToCurrentDoctor && userProfile?.id) {
      base = base.filter((doctor) => String(doctor.id) === String(userProfile.id));
    }

    return [...base].sort((a, b) => {
      const countA = doctorLoadsById[a.id] || 0;
      const countB = doctorLoadsById[b.id] || 0;
      if (countA !== countB) return countA - countB;
      const nameA = `${a.nom || ''} ${a.prenom || ''}`.trim().toLowerCase();
      const nameB = `${b.nom || ''} ${b.prenom || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [doctors, selectedSpecialiteStepper, specialiteIdsWithChildren, doctorLoadsById, restrictToCurrentDoctor, userProfile]);

  const generateDoctorTimeSlots = (doctorId) => {
    if (!manualDate || !doctorId) return [];
    return generateDoctorTimeSlotsForDay({
      date: manualDate,
      horairesOuverture,
      doctorAppointments: appointmentsByDoctor[doctorId] || [],
      duree: formData.duree,
      editingAppointmentId: editingAppointment?.id,
    });
  };

  const hasSlotConflict = (doctorId, isoDateTime) => {
    if (!doctorId || !isoDateTime) return false;
    const doctorAppointments = appointmentsByDoctor[doctorId] || [];
    const slotStart = new Date(isoDateTime);
    const slotEnd = new Date(slotStart.getTime() + (formData.duree || 30) * 60000);
    return doctorAppointments.some((apt) => {
      if (editingAppointment && apt.id === editingAppointment.id) return false;
      if (apt.statut === 'annule') return false;
      const aptStart = new Date(apt.date_heure);
      const aptEnd = new Date(aptStart.getTime() + (apt.duree || 30) * 60000);
      return aptStart < slotEnd && aptEnd > slotStart;
    });
  };

  const selectedDoctorData = useMemo(
    () => doctors.find((doctor) => String(doctor.id) === String(formData.medecin_id)) || null,
    [doctors, formData.medecin_id]
  );

  const selectedPatientData = useMemo(() => {
    if (quickBooking.create_patient) return null;
    if (!formData.patient_id) return null;
    return patients.find((patient) => String(patient.id) === String(formData.patient_id)) || null;
  }, [patients, formData.patient_id, quickBooking.create_patient]);

  const hasCurrentSelectionConflict = useMemo(() => {
    if (!formData.medecin_id || !formData.date_heure) return false;
    return hasSlotConflict(formData.medecin_id, formData.date_heure);
  }, [formData.medecin_id, formData.date_heure, formData.duree, appointmentsByDoctor]);

  // Quand la durée change et provoque un chevauchement, avertir et réinitialiser le créneau
  useEffect(() => {
    if (!isOpen || !formData.medecin_id || !formData.date_heure) return;
    if (hasSlotConflict(formData.medecin_id, formData.date_heure)) {
      showWarning('La durée choisie provoque un chevauchement avec un rendez-vous existant. Veuillez choisir un autre créneau.');
      setManualTime('');
      setFormData((prev) => ({ ...prev, date_heure: '' }));
    }
  }, [formData.duree]);

  const canSubmit = (() => {
    if (submitting) return false;
    if (!formData.medecin_id) return false;
    if (!formData.date_heure) return false;
    if (hasCurrentSelectionConflict) return false;
    if (quickBooking.create_patient) {
      return !!(quickBooking.patient_nom && quickBooking.patient_prenom);
    }
    return !!formData.patient_id;
  })();

  const handlePreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleNextStep = async (event) => {
    if (event) event.preventDefault();

    if (currentStep === 0) {
      if (quickBooking.create_patient) {
        if (!quickBooking.patient_nom || !quickBooking.patient_prenom) {
          showWarning('Veuillez renseigner le nom et le prénom du nouveau patient.');
          return false;
        }
      } else if (!formData.patient_id) {
        showWarning('Veuillez sélectionner un patient existant.');
        return false;
      }

      if (!selectedSpecialiteStepper) {
        showWarning('Veuillez sélectionner une spécialité médicale.');
        return false;
      }

      if (!manualDate) {
        showWarning('Veuillez sélectionner la date du rendez-vous.');
        return false;
      }

      if (!isJourOuvrable(horairesOuverture, manualDate)) {
        showWarning('Le cabinet est fermé ce jour-là. Veuillez choisir une autre date.');
        return false;
      }

      if (availableDoctors.length === 0) {
        showWarning('Aucun médecin actif pour cette spécialité.');
        return false;
      }

      const doctorStillAvailable = selectedDoctorStepper
        ? availableDoctors.some((doctor) => String(doctor.id) === String(selectedDoctorStepper))
        : false;

      const normalizedDate = manualDate instanceof Date ? new Date(manualDate) : new Date(manualDate);
      normalizedDate.setHours(0, 0, 0, 0);
      const previousDateTime = formData.date_heure ? new Date(formData.date_heure) : null;
      const keepExistingSlot =
        previousDateTime &&
        doctorStillAvailable &&
        isSameDay(previousDateTime, normalizedDate);

      setFormData((prev) => ({
        ...prev,
        medecin_id: doctorStillAvailable ? String(selectedDoctorStepper) : '',
        date_heure: keepExistingSlot ? prev.date_heure : ''
      }));

      if (!keepExistingSlot) {
        setManualTime('');
      }

      setCurrentStep(1);
      return true;
    }

    if (currentStep === 1) {
      if (!formData.medecin_id) {
        showWarning('Veuillez sélectionner un médecin pour ce rendez-vous.');
        return false;
      }

      if (!formData.date_heure) {
        showWarning('Veuillez choisir un créneau horaire disponible.');
        return false;
      }

      if (hasCurrentSelectionConflict) {
        showWarning('Le créneau sélectionné est déjà occupé.');
        return false;
      }

      setCurrentStep(2);
      return true;
    }

    return false;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (currentStep < 2) {
      await handleNextStep();
      return;
    }

    if (submitting) return;

    setSubmitting(true);

    try {
      let patientId = formData.patient_id;

      if (quickBooking.create_patient && quickBooking.patient_nom && quickBooking.patient_prenom) {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert([{
            nom: quickBooking.patient_nom,
            prenom: quickBooking.patient_prenom,
            telephone: quickBooking.patient_telephone,
            email: quickBooking.patient_email || null,
            sexe: quickBooking.patient_sexe || 'M',
            actif: true,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      }

      const appointmentData = {
        patient_id: patientId,
        medecin_id: formData.medecin_id,
        date_heure: formData.date_heure,
        motif: formData.motif || '',
        duree: formData.duree || 30,
        statut: formData.statut || 'confirme',
        priorite: formData.priorite || 'normale',
        notes: formData.notes || '',
        type_rdv: formData.type_rdv || 'consultation',
        created_at: new Date().toISOString()
      };

      let resultAppointment = null;
      let addedToWaitingQueue = false;

      if (editingAppointment) {
        // Utilisez le service de rendez-vous mis à jour
        resultAppointment = await updateAppointment(editingAppointment.id, appointmentData);
      } else {
        // Utilisez le service de rendez-vous mis à jour
        resultAppointment = await createAppointment(appointmentData);
        
        // NE PLUS ajouter automatiquement à la salle d'attente
        // Le patient sera ajouté à la salle d'attente uniquement lorsqu'il se présentera physiquement
        // via le bouton "Confirmer la présence" dans la liste des rendez-vous
      }

      if (onSuccess) {
        const message = editingAppointment
          ? 'Rendez-vous modifié avec succès !'
          : addedToWaitingQueue
            ? 'Rendez-vous créé avec succès et ajouté à la file d\'attente !'
            : 'Rendez-vous créé avec succès !';
        await onSuccess(resultAppointment, message);
      } else {
        setSuccessMessage(
          editingAppointment
            ? 'Rendez-vous modifié avec succès !'
            : 'Rendez-vous créé avec succès !'
        );
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      }

      handleClose();
    } catch (error) {
      console.error('Erreur lors de la création du rendez-vous:', error);
      const notification = appointmentService.getCreationErrorNotification(error);
      if (notification.type === 'warning') {
        showWarning(notification.message, notification.title);
      } else {
        showError(notification.message, notification.title);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(defaultFormState);
    setQuickBooking(defaultQuickBooking);
    setManualTime('');
    setCurrentStep(0);
    setSelectedSpecialiteStepper('');
    setSelectedDoctorStepper('');
    onClose?.();
  };

  const handleDelete = async () => {
    if (!editingAppointment || !onDelete) return;
    try {
      await deleteAppointment(editingAppointment.id);
      if (onSuccess) {
        await onSuccess(null, 'Rendez-vous supprimé avec succès.');
      }
      handleClose();
    } catch (error) {
      console.error('Erreur lors de la suppression du rendez-vous:', error);
      showError(`Erreur lors de la suppression du rendez-vous: ${getAppointmentErrorMessage(error)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <SuccessToast visible={showSuccessToast} message={successMessage} onClose={() => setShowSuccessToast(false)} />

        <div className="p-6 border-b border-gray-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAppointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
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
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              type="button"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0">
            <RdvStepper
              steps={[
                { id: 0, title: 'Patient & contexte', description: 'Sélectionnez le patient, la spécialité et la date du rendez-vous' },
                { id: 1, title: 'Médecin & disponibilité', description: 'Choisissez un médecin et un créneau libre pour la date sélectionnée' },
                { id: 2, title: 'Confirmation', description: 'Renseignez les derniers détails avant la confirmation' }
              ]}
              currentStep={currentStep}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {currentStep === 0 && (
            <div className="space-y-6">
              <PatientSelector
                quickBooking={quickBooking}
                setQuickBooking={setQuickBooking}
                patients={patients}
                value={formData.patient_id}
                onChange={(value) => setFormData({ ...formData, patient_id: value })}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SpecialiteSelect
                  value={selectedSpecialiteStepper}
                  onChange={setSelectedSpecialiteStepper}
                  options={specialitesDisponibles}
                />
                <DateSelector
                  selected={manualDate}
                  onChange={(date) => {
                    setManualDate(date);
                    setManualTime('');
                    setFormData((prev) => ({ ...prev, date_heure: '' }));
                  }}
                  minDate={new Date()}
                  locale="fr"
                  filterDate={(date) => isJourOuvrable(horairesOuverture, date)}
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {!restrictToCurrentDoctor && (
                  <DoctorList
                    availableDoctors={availableDoctors}
                    onSelectDoctor={(doctor) => {
                      setSelectedDoctorStepper(doctor.id);
                      const manualIso = manualDate && manualTime ? composeDateTime(manualDate, manualTime) : '';
                      const fallbackIso = manualIso || formData.date_heure || '';
                      if (!manualIso && fallbackIso && !manualTime) {
                        const dt = new Date(fallbackIso);
                        if (!Number.isNaN(dt.getTime())) {
                          const fallbackTime = `${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
                          setManualTime(fallbackTime);
                        }
                      }
                      setFormData((prev) => ({ ...prev, medecin_id: String(doctor.id), date_heure: fallbackIso }));
                    }}
                    selectedDoctorId={formData.medecin_id}
                    doctorLoadsById={doctorLoadsById}
                    restrictToCurrentDoctor={restrictToCurrentDoctor}
                  />
                )}

                <div className={`${restrictToCurrentDoctor ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6`}>
                  {formData.medecin_id ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            Disponibilités du{' '}
                            {manualDate
                              ? manualDate.toLocaleDateString('fr-FR', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : 'jour sélectionné'}
                          </h4>
                          <p className="text-xs text-gray-500">Sélectionnez un créneau ou saisissez une heure personnalisée.</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">Durée actuelle&nbsp;: {formData.duree} min</span>
                      </div>

                      <TimeSlots
                        slots={generateDoctorTimeSlots(formData.medecin_id)}
                        onSelectSlot={(slot) => {
                          if (slot.isOccupied) return;
                          setManualTime(slot.time);
                          setFormData((prev) => ({ ...prev, date_heure: slot.iso }));
                        }}
                        manualTime={manualTime}
                        onManualTimeChange={(t) => {
                          setManualTime(t);
                          if (manualDate && t) {
                            const [hh, mm] = t.split(':');
                            const composed = new Date(manualDate);
                            composed.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
                            setFormData((prev) => ({ ...prev, date_heure: composed.toISOString() }));
                          } else {
                            setFormData((prev) => ({ ...prev, date_heure: '' }));
                          }
                        }}
                        duree={formData.duree}
                        onDureeChange={(val) => setFormData((prev) => ({ ...prev, duree: val }))}
                        hasConflict={hasCurrentSelectionConflict}
                        selectedDateTime={formData.date_heure}
                        minTime={getHoraireDuJour(horairesOuverture, manualDate)?.debut}
                        maxTime={getHoraireDuJour(horairesOuverture, manualDate)?.fin}
                        closed={!isJourOuvrable(horairesOuverture, manualDate)}
                      />
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Sélectionnez un médecin à gauche pour afficher ses disponibilités.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Patient</h4>
                  {quickBooking.create_patient ? (
                    <div className="text-sm text-gray-700">
                      {quickBooking.patient_prenom} {quickBooking.patient_nom}
                      <span className="block text-xs text-gray-500 mt-1">
                        Nouveau patient à créer
                      </span>
                      {quickBooking.patient_telephone && (
                        <span className="block text-xs text-gray-500">
                          Tél. {quickBooking.patient_telephone}
                        </span>
                      )}
                    </div>
                  ) : selectedPatientData ? (
                    <div className="text-sm text-gray-700">
                      {selectedPatientData.prenom} {selectedPatientData.nom}
                      {selectedPatientData.telephone && (
                        <span className="block text-xs text-gray-500">
                          Tél. {selectedPatientData.telephone}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-600">Aucun patient sélectionné.</p>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Médecin</h4>
                  {selectedDoctorData ? (
                    <div className="text-sm text-gray-700">
                      Dr. {selectedDoctorData.prenom} {selectedDoctorData.nom}
                      {getSpecialiteNom(selectedDoctorData.specialite_id) && (
                        <span className="block text-xs text-gray-500">
                          {getSpecialiteNom(selectedDoctorData.specialite_id)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-600">Aucun médecin sélectionné.</p>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Créneau retenu</h4>
                {formData.date_heure ? (
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-medical-primary" />
                    <span className="text-sm font-medium text-gray-900">
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
                    </span>
                    <span className="text-xs text-gray-500">Durée {formData.duree} min</span>
                  </div>
                ) : (
                  <p className="text-sm text-red-600">Aucun créneau sélectionné.</p>
                )}
                {hasCurrentSelectionConflict && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ Ce créneau est en conflit avec un autre rendez-vous. Revenez à l’étape précédente pour choisir une autre heure.
                  </p>
                )}
              </div>

              <ConfirmationDetails
                formData={formData}
                onChange={(next) => setFormData(next)}
                isEditing={!!editingAppointment}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                currentStep === 0
                  ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'text-gray-700 border-gray-300 hover:border-medical-primary'
              }`}
            >
              Étape précédente
            </button>
            <div className="flex items-center space-x-3 flex-wrap justify-end gap-2">
              {isPastAppointment && onReportPast && (
                <button
                  type="button"
                  onClick={onReportPast}
                  className="px-4 py-2 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50 transition-colors"
                >
                  Annuler
                </button>
              )}
              {editingAppointment && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                >
                  Supprimer
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              {currentStep < 2 && !editingAppointment && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = window.confirm(
                      'Passer les contrôles de cette étape ? Assurez-vous que les informations essentielles sont renseignées.',
                    );
                    if (!ok) return;
                    setCurrentStep((prev) => Math.min(prev + 1, 2));
                  }}
                  className="px-3 py-2 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Passer l&apos;étape
                </button>
              )}
              {currentStep < 2 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={currentStep === 1 && (!formData.medecin_id || !formData.date_heure || hasCurrentSelectionConflict)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentStep === 1 && (!formData.medecin_id || !formData.date_heure || hasCurrentSelectionConflict)
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-medical-primary text-white hover:bg-medical-primary-dark'
                  }`}
                >
                  Étape suivante
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    !canSubmit
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-medical-primary hover:bg-medical-primary-dark text-white'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingAppointment ? 'Mettre à jour' : 'Confirmer'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
RdvCreationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  onDelete: PropTypes.func,
  editingAppointment: PropTypes.object,
  initialSpecialty: PropTypes.string, 
  initialDuration: PropTypes.number,
  restrictToCurrentDoctor: PropTypes.bool,
   createAppointment: PropTypes.func.isRequired,
  updateAppointment: PropTypes.func.isRequired,
  deleteAppointment: PropTypes.func.isRequired,
  getAppointmentErrorMessage: PropTypes.func,
    initialDate : PropTypes.string,
  initialDoctorId : PropTypes.string,
  initialPatientId : PropTypes.string,

};

export default RdvCreationModal;

