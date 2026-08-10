import React from 'react';
import { CheckCircle } from 'lucide-react';
import { getHoraireDuJour, isJourOuvrable } from '../../utils/horairesOuverture';

export const Step1DoctorAvailability = ({
  formData, setFormData,
  manualDate, setManualDate,
  manualTime, setManualTime,
  availableDoctors,
  doctorLoadsById,
  generateDoctorTimeSlots,
  hasCurrentSelectionConflict,
  selectedSpecialiteStepper, setSelectedSpecialiteStepper,
  selectedDoctorStepper, setSelectedDoctorStepper,
  horairesOuverture
}) => {
  const horaireDuJour = getHoraireDuJour(horairesOuverture, manualDate);
  const jourFerme = !isJourOuvrable(horairesOuverture, manualDate);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3 h-full overflow-y-auto pr-1">
          {availableDoctors.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Aucun médecin actif pour cette spécialité.
            </div>
          )}
          {availableDoctors.map((doctor) => {
            const isSelected = formData.medecin_id === doctor.id;
            const doctorDailyLoad = doctorLoadsById[doctor.id] || 0;
            return (
              <button
                type="button"
                key={doctor.id}
                onClick={() => {
                  setSelectedDoctorStepper(doctor.id);
                  setFormData((prev) => ({
                    ...prev,
                    medecin_id: doctor.id,
                    date_heure: ''
                  }));
                  setManualTime('');
                }}
                className={`w-full text-left border rounded-lg p-4 transition-colors ${
                  isSelected
                    ? 'border-medical-primary bg-medical-primary/5 shadow-sm'
                    : 'border-gray-200 hover:border-medical-primary'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Dr. {doctor.prenom} {doctor.nom}
                    </p>
                    <p className="text-xs text-gray-500">
                      {doctor.specialite || 'Médecin généraliste'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600">
                      {doctorDailyLoad} RDV
                    </span>
                    {isSelected && <CheckCircle className="w-5 h-5 text-medical-primary" />}
                  </div>
                </div>
                {doctor.telephone && (
                  <p className="text-xs text-gray-400 mt-3">Tél. {doctor.telephone}</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2 space-y-6">
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
                  <p className="text-xs text-gray-500">
                    Sélectionnez un créneau ou saisissez une heure personnalisée.
                  </p>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
                  Durée actuelle&nbsp;: {formData.duree} min
                </span>
              </div>

              {jourFerme ? (
                <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-700">
                  Le cabinet est fermé ce jour-là. Veuillez choisir une autre date.
                </div>
              ) : (
              <>
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {generateDoctorTimeSlots(formData.medecin_id).map((slot) => {
                  // Vérifie si ce créneau est couvert par la durée du RDV sélectionné
                  let isWithinDuration = false;
                  if (formData.date_heure) {
                    const selectedStart = new Date(formData.date_heure);
                    const selectedEnd = new Date(selectedStart.getTime() + (formData.duree || 30) * 60000);
                    const slotTime = new Date(slot.iso);
                    isWithinDuration = slotTime.getTime() >= selectedStart.getTime() && slotTime.getTime() < selectedEnd.getTime();
                  }

                  // Conflit : créneau dans la durée mais occupé par un autre RDV
                  const isDurationConflict = isWithinDuration && slot.isOccupied;

                  const classes = isDurationConflict
                    ? 'border-orange-400 bg-orange-100 text-orange-700 cursor-not-allowed ring-2 ring-orange-300'
                    : slot.isOccupied
                      ? 'border-red-200 bg-red-50 text-red-400 cursor-not-allowed line-through'
                      : isWithinDuration
                        ? 'border-medical-primary bg-medical-primary text-white shadow-sm'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-medical-primary hover:bg-white';
                  return (
                    <button
                      key={`${slot.iso}-${slot.time}`}
                      type="button"
                      disabled={slot.isOccupied}
                      onClick={() => {
                        if (slot.isOccupied) return;
                        setManualTime(slot.time);
                        setFormData((prev) => ({
                          ...prev,
                          date_heure: slot.iso
                        }));
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${classes}`}
                      title={isDurationConflict ? `Chevauchement : ce créneau est occupé et couvert par la durée de ${formData.duree} min` : ''}
                    >
                      {slot.time}
                    </button>
                  );
                })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heure personnalisée *
                  </label>
                  <input
                    type="time"
                    step="300"
                    value={manualTime}
                    min={horaireDuJour?.debut}
                    max={horaireDuJour?.fin}
                    onChange={(e) => {
                      const t = e.target.value;
                      setManualTime(t);
                      if (manualDate && t) {
                        const [hh, mm] = t.split(':');
                        const composed = new Date(manualDate);
                        composed.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
                        setFormData((prev) => ({
                          ...prev,
                          date_heure: composed.toISOString()
                        }));
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          date_heure: ''
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durée (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={formData.duree}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        duree: parseInt(e.target.value || '0', 10)
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  />
                </div>
              </div>
              </>
              )}

              {hasCurrentSelectionConflict && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                  Attention : le créneau choisi chevauche un rendez-vous existant de ce médecin.
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              Sélectionnez un médecin à gauche pour afficher ses disponibilités.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};