import React, { useState, useEffect, useCallback, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { fr as frLocale } from 'date-fns/locale';
import { CheckCircle, X, Save } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAppointmentForm } from '../../hooks/useAppointmentForm';
import { useAlert } from '../../contexts/AlertContext';
import { userService, patientService, appointmentService } from '../../lib/services';
import { Step0PatientContext } from './Step0PatientContext';
import { Step1DoctorAvailability } from './Step1DoctorAvailability';
import { Step2Confirmation } from './Step2Confirmation';

registerLocale('fr', frLocale);

/**
 * Modal "Nouveau rendez-vous" / "Modifier le rendez-vous" — stepper à 3 étapes
 * (Patient & contexte → Médecin & disponibilité → Confirmation).
 *
 * Composant autonome et réutilisable : contrairement à la version d'origine
 * (câblée à PriseRendezVousPage.jsx via useAppointmentBookingData), il charge
 * lui-même ses données (patients, médecins, spécialités) et les rendez-vous
 * nécessaires à la vérification des conflits de créneaux — n'importe quelle
 * page peut donc le monter sans dépendre de l'état interne d'une autre page.
 *
 * Props :
 * - isOpen : affiche le stepper (le composant reste monté même si false, pour
 *   ne pas couper le toast de succès affiché après fermeture)
 * - onClose : appelé à la fermeture (croix, ou après un enregistrement réussi)
 * - editingAppointment : rendez-vous à modifier (null/undefined = création)
 * - initialDate, initialDoctorId : pré-remplissage en mode création
 * - preselectedPatientId : pré-sélection du patient en mode création
 * - onSaved : appelé après un enregistrement réussi (pour que la page
 *   appelante rafraîchisse sa propre liste)
 */
export const NewAppointmentModal = ({
  isOpen,
  onClose,
  editingAppointment = null,
  initialDate = null,
  initialDoctorId = '',
  preselectedPatientId = null,
  onSaved,
}) => {
  const { showError: showAlertError, showSuccess, showWarning } = useAlert();

  // Données statiques (patients/médecins/spécialités) — chargées une fois,
  // à la première ouverture du modal.
  const [specialites, setSpecialites] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Rendez-vous du jour sélectionné dans le stepper (étape 1), pour la
  // détection de conflit de créneau — recalculé à chaque changement de date,
  // indépendamment de tout filtre de liste d'une page parente.
  const [conflictAppointments, setConflictAppointments] = useState([]);

  const handleSaved = useCallback(() => {
    onSaved?.();
    onClose?.();
  }, [onSaved, onClose]);

  const form = useAppointmentForm({
    allPatients,
    allDoctors,
    specialites,
    appointments: conflictAppointments,
    refreshAppointments: handleSaved,
    showAlertError,
    showSuccess,
    showWarning,
    editingAppointment,
  });

  // Chargement des données statiques à la première ouverture.
  useEffect(() => {
    if (!isOpen || dataLoaded || dataLoading) return;
    setDataLoading(true);
    Promise.all([
      patientService.getAll(),
      userService.getDoctors({ ignoreSpecialityFilter: true }),
      userService.getUniqueDoctorSpecialties(),
    ])
      .then(([patients, doctors, specs]) => {
        setAllPatients(patients || []);
        setAllDoctors(doctors || []);
        setSpecialites(specs || []);
        setDataLoaded(true);
      })
      .catch((err) => {
        console.error('❌ [NewAppointmentModal] Erreur chargement données:', err);
        showAlertError('Erreur lors du chargement des données du formulaire');
      })
      .finally(() => setDataLoading(false));
  }, [isOpen, dataLoaded, dataLoading, showAlertError]);

  // Rendez-vous du jour choisi dans le stepper, pour la vérification de
  // créneaux — indépendant du filtre de liste d'une éventuelle page parente.
  useEffect(() => {
    if (!form.manualDate) {
      setConflictAppointments([]);
      return;
    }
    const d = form.manualDate instanceof Date ? form.manualDate : new Date(form.manualDate);
    if (Number.isNaN(d.getTime())) {
      setConflictAppointments([]);
      return;
    }
    const dayString = d.toISOString().split('T')[0];
    appointmentService
      .getAppointmentsByDateAndDoctor(dayString)
      .then((data) => setConflictAppointments(data || []))
      .catch((err) => console.error('❌ [NewAppointmentModal] Erreur chargement créneaux:', err));
  }, [form.manualDate]);

  // Pré-remplissage à l'ouverture (mode création uniquement — le mode édition
  // est déjà géré par l'effet interne de useAppointmentForm sur editingAppointment).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened || editingAppointment) return;

    form.resetForm();
    form.setManualDate(initialDate || new Date());
    form.setFormData((prev) => ({
      ...prev,
      medecin_id: initialDoctorId || '',
      date_heure: '',
    }));
    form.setSelectedDoctorStepper(initialDoctorId || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAppointment, initialDate, initialDoctorId]);

  // Pré-sélection du patient (ex. arrivée depuis une fiche patient), une fois
  // la liste des patients chargée.
  useEffect(() => {
    if (!isOpen || editingAppointment || !preselectedPatientId || allPatients.length === 0) return;
    const patient = allPatients.find((p) => p.id === parseInt(preselectedPatientId));
    if (patient) {
      form.setFormData((prev) => ({ ...prev, patient_id: patient.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAppointment, preselectedPatientId, allPatients]);

  return (
    <>
      {/* Toast de succès — rendu indépendamment de isOpen pour rester visible
          après la fermeture automatique du modal suivant un enregistrement. */}
      {form.showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-lg p-4 flex items-center space-x-3 max-w-md">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">{form.successMessage}</p>
            </div>
            <button
              onClick={() => form.setShowSuccessToast(false)}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 !m-0 h-screen w-screen bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[92vh] overflow-y-auto">
            {dataLoading || !dataLoaded ? (
              <div className="flex items-center justify-center p-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-medical-primary mx-auto"></div>
                  <p className="mt-4 text-gray-600">Chargement du formulaire...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-gray-200 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {editingAppointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
                      </h3>
                      {form.formData.date_heure && (
                        <p className="text-sm text-blue-600 mt-2">
                          📅{' '}
                          {new Date(form.formData.date_heure).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}{' '}
                          à{' '}
                          {new Date(form.formData.date_heure).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onClose?.()}
                      className="text-gray-400 hover:text-gray-600"
                      type="button"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-start md:space-x-4 space-y-4 md:space-y-0">
                    {form.stepperSteps.map((step, index) => {
                      const isCompleted = form.currentStep > index;
                      const isCurrent = form.currentStep === index;
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

                <form onSubmit={form.handleSubmit} className="p-6 space-y-6">
                  {form.currentStep === 0 && (
                    <Step0PatientContext
                      formData={form.formData}
                      setFormData={form.setFormData}
                      quickBooking={form.quickBooking}
                      setQuickBooking={form.setQuickBooking}
                      manualDate={form.manualDate}
                      setManualDate={form.setManualDate}
                      selectedSpecialiteStepper={form.selectedSpecialiteStepper}
                      setSelectedSpecialiteStepper={form.setSelectedSpecialiteStepper}
                      specialites={specialites}
                      allPatients={allPatients}
                    />
                  )}

                  {form.currentStep === 1 && (
                    <Step1DoctorAvailability
                      formData={form.formData}
                      setFormData={form.setFormData}
                      manualDate={form.manualDate}
                      setManualDate={form.setManualDate}
                      manualTime={form.manualTime}
                      setManualTime={form.setManualTime}
                      availableDoctors={form.availableDoctors}
                      doctorLoadsById={form.doctorLoadsById}
                      generateDoctorTimeSlots={form.generateDoctorTimeSlots}
                      hasCurrentSelectionConflict={form.hasCurrentSelectionConflict}
                      selectedSpecialiteStepper={form.selectedSpecialiteStepper}
                      setSelectedSpecialiteStepper={form.setSelectedSpecialiteStepper}
                      selectedDoctorStepper={form.selectedDoctorStepper}
                      setSelectedDoctorStepper={form.setSelectedDoctorStepper}
                    />
                  )}

                  {form.currentStep === 2 && (
                    <Step2Confirmation
                      formData={form.formData}
                      setFormData={form.setFormData}
                      quickBooking={form.quickBooking}
                      selectedPatientData={form.selectedPatientData}
                      selectedDoctorData={form.selectedDoctorData}
                      hasCurrentSelectionConflict={form.hasCurrentSelectionConflict}
                    />
                  )}

                  {/* Navigation buttons */}
                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={form.handlePreviousStep}
                      disabled={form.currentStep === 0}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        form.currentStep === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Précédent
                    </button>

                    {form.currentStep < form.stepperSteps.length - 1 ? (
                      <button
                        type="button"
                        onClick={form.handleNextStep}
                        className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
                      >
                        Suivant
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!form.canSubmit || form.submitting}
                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                          form.canSubmit && !form.submitting
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {form.submitting ? 'Enregistrement...' : editingAppointment ? 'Modifier' : 'Enregistrer'}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Erreurs de validation du stepper (patient/spécialité/créneau requis,
          conflit de planning) — dialogState vient de l'instance useConfirmDialog
          interne à useAppointmentForm. */}
      <ConfirmDialog
        isOpen={form.dialogState.isOpen}
        onClose={form.closeDialog}
        onConfirm={form.dialogState.onConfirm}
        title={form.dialogState.title}
        message={form.dialogState.message}
        type={form.dialogState.type}
        confirmText={form.dialogState.confirmText}
        cancelText={form.dialogState.cancelText}
        showCancel={form.dialogState.showCancel}
      />
    </>
  );
};

export default NewAppointmentModal;
