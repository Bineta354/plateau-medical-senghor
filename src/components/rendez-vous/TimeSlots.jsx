import React from 'react';
import PropTypes from 'prop-types';

const TimeSlots = ({ slots, onSelectSlot, manualTime, onManualTimeChange, duree, onDureeChange, hasConflict, selectedDateTime, minTime, maxTime, closed }) => {
  if (closed) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Le cabinet est fermé ce jour-là. Veuillez choisir une autre date.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
          {slots.map((slot) => {
            // Vérifie si ce créneau est couvert par la durée du RDV sélectionné
            let isWithinDuration = false;
            if (selectedDateTime) {
              const selectedStart = new Date(selectedDateTime);
              const selectedEnd = new Date(selectedStart.getTime() + (duree || 30) * 60000);
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
                onClick={() => !slot.isOccupied && onSelectSlot(slot)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${classes}`}
                title={isDurationConflict ? `Chevauchement : ce créneau est occupé et couvert par la durée de ${duree} min` : ''}
              >
                {slot.time}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heure personnalisée *</label>
          <input
            type="time"
            step="300"
            value={manualTime}
            onChange={(e) => onManualTimeChange(e.target.value)}
            min={minTime}
            max={maxTime}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
          <input
            type="number"
            min="5"
            step="5"
            value={duree}
            onChange={(e) => onDureeChange(parseInt(e.target.value || '0', 10))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
          />
        </div>
      </div>

      {hasConflict && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          Attention : le créneau choisi ({duree} min) chevauche un rendez-vous existant de ce médecin. Réduisez la durée ou choisissez un autre horaire.
        </div>
      )}
    </>
  );
};

TimeSlots.propTypes = {
  slots: PropTypes.array.isRequired,
  onSelectSlot: PropTypes.func.isRequired,
  manualTime: PropTypes.string,
  onManualTimeChange: PropTypes.func.isRequired,
  duree: PropTypes.number.isRequired,
  onDureeChange: PropTypes.func.isRequired,
  hasConflict: PropTypes.bool,
  selectedDateTime: PropTypes.string,
  minTime: PropTypes.string,
  maxTime: PropTypes.string,
  closed: PropTypes.bool
};

export default TimeSlots;
