import React from 'react';
import DatePicker from 'react-datepicker';
import SearchableSelect from '../../components/common/SearchableSelect';
import Dropdown from '../common/Dropdown';

export const Step0PatientContext = ({
  formData, setFormData,
  quickBooking, setQuickBooking,
  manualDate, setManualDate,
  selectedSpecialiteStepper, setSelectedSpecialiteStepper,
  specialites,
  allPatients
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={quickBooking.create_patient}
            onChange={(e) =>
              setQuickBooking({
                ...quickBooking,
                create_patient: e.target.checked
              })
            }
            className="mt-1 h-4 w-4 rounded border-blue-400 text-medical-primary focus:ring-medical-primary"
          />
          <div>
            <span className="text-sm font-medium text-blue-800">
              Créer un nouveau patient
            </span>
            <p className="text-xs text-blue-700 mt-1">
              Cochez cette case pour enregistrer rapidement un patient avant de planifier son
              rendez-vous.
            </p>
          </div>
        </label>
      </div>

      {quickBooking.create_patient ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              value={quickBooking.patient_nom}
              onChange={(e) =>
                setQuickBooking({
                  ...quickBooking,
                  patient_nom: e.target.value
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prénom *
            </label>
            <input
              type="text"
              value={quickBooking.patient_prenom}
              onChange={(e) =>
                setQuickBooking({
                  ...quickBooking,
                  patient_prenom: e.target.value
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone
            </label>
            <input
              type="tel"
              value={quickBooking.patient_telephone}
              onChange={(e) =>
                setQuickBooking({
                  ...quickBooking,
                  patient_telephone: e.target.value
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={quickBooking.patient_email}
              onChange={(e) =>
                setQuickBooking({
                  ...quickBooking,
                  patient_email: e.target.value
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance *
            </label>
            <DatePicker
              selected={quickBooking.patient_date_naissance}
              onChange={(date) =>
                setQuickBooking({
                  ...quickBooking,
                  patient_date_naissance: date
                })
              }
              dateFormat="dd/MM/yyyy"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={100}
              maxDate={new Date()}
              locale="fr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sexe
            </label>
            <Dropdown
              value={quickBooking.patient_sexe || 'M'}
              onChange={(value) =>
                setQuickBooking({
                  ...quickBooking,
                  patient_sexe: value
                })
              }
              options={[
                { value: 'M', label: 'Masculin' },
                { value: 'F', label: 'Féminin' }
              ]}
              size="md"
            />
          </div>
        </div>
      ) : (
        <SearchableSelect
          label="Patient"
          required
          options={allPatients.map((p) => ({
            id: p.id,
            label: `${p.prenom} ${p.nom}`,
            nom: p.nom,
            prenom: p.prenom,
            telephone: p.telephone,
            email: p.email
          }))}
          value={formData.patient_id}
          onChange={(value) =>
            setFormData({
              ...formData,
              patient_id: value
            })
          }
          placeholder="Sélectionner un patient"
          searchPlaceholder="Rechercher par nom, prénom, téléphone..."
          emptyMessage="Aucun patient trouvé"
          renderOption={(option) => (
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">
                {option.prenom} {option.nom}
              </span>
              <span className="text-xs text-gray-500">{option.telephone}</span>
            </div>
          )}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Spécialité *
          </label>
          <Dropdown
            value={selectedSpecialiteStepper}
            onChange={(value) => setSelectedSpecialiteStepper(value)}
            options={[
              { value: '', label: 'Sélectionner une spécialité' },
              ...specialites
                .filter((s) => !s.parent_id)
                .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }))
                .flatMap((parent) => {
                  const children = specialites
                    .filter((s) => s.parent_id === parent.id)
                    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'accent' }));
                  return [
                    { value: parent.id, label: parent.nom },
                    ...children.map((child) => ({ value: child.id, label: '— ' + child.nom }))
                  ];
                })
            ]}
            searchable
            searchPlaceholder="Rechercher une spécialité..."
            size="md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date du rendez-vous *
          </label>
          <DatePicker
            selected={manualDate}
            onChange={(date) => {
              setManualDate(date);
              setManualTime('');
              setFormData((prev) => ({
                ...prev,
                date_heure: ''
              }));
            }}
            dateFormat="dd/MM/yyyy"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            minDate={new Date()}
            locale="fr"
          />
        </div>
      </div>
    </div>
  );
};
