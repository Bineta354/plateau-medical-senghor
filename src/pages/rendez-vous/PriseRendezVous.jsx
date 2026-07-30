import React, { useState, useEffect } from 'react';
import useRdvData from '../../hooks/useRdvData';
import { appointmentService } from '../../lib/services'; // Import appointmentService for creation
import motifsConsultationService from '../../services/motifsConsultationService';

const PriseRendezVous = () => {
  // Local states for filtering and form
  const [selectedSpecialite, setSelectedSpecialite] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [newAppointment, setNewAppointment] = useState({
    patient_id: '',
    medecin_id: '',
    date_heure: '',
    duree: 30,
    type_rdv: 'consultation',
    motif: '',
    motif_detaille: ''
  });
  const [showModal, setShowModal] = useState(false);
  const [motifsList, setMotifsList] = useState([]);

  // Use the new usePriseRendezVousData hook
  const { 
    specialites, 
    medecins, 
    patients, 
    appointments, 
    loading: dataLoading, // Renamed to avoid conflict with local loading if any
    error 
  } = useRdvData(selectedSpecialite, selectedMonth);

  // Charger les motifs de consultation
  useEffect(() => {
    const loadMotifs = async () => {
      try {
        const motifs = await motifsConsultationService.getMotifsForSelect('Dentiste');
        setMotifsList(motifs);
      } catch (error) {
        console.error('Erreur lors du chargement des motifs:', error);
        // Utiliser les motifs par défaut en cas d'erreur
        const defaultMotifs = motifsConsultationService.getDefaultMotifsForSelect();
        setMotifsList(defaultMotifs);
      }
    };

    loadMotifs();
  }, []);

  // No need for fetchInitialData, fetchMedecins, fetchAppointments or their useEffects here,
  // as the usePriseRendezVousData hook handles all that.

  const handleSlotClick = (date, medecinId) => {
    const dateTime = new Date(date);
    dateTime.setHours(9, 0, 0, 0); // Heure de début par défaut

    setSelectedSlot({ date, medecinId });
    setNewAppointment({
      ...newAppointment,
      medecin_id: medecinId,
      date_heure: dateTime.toISOString()
    });
    setShowModal(true);
  };

  const handleSubmitAppointment = async (e) => {
    e.preventDefault();
    
    try {
      // Use the appointmentService to create the appointment
      const result = await appointmentService.create(newAppointment);

      if (result.success) {
        setShowModal(false);
        setSelectedSlot(null);
        setNewAppointment({
          patient_id: '',
          medecin_id: '',
          date_heure: '',
          duree: 30,
          type_rdv: 'consultation',
          motif: '',
          motif_detaille: ''
        });
        // Re-fetch appointments after successful creation to update the calendar
        // The hook will automatically re-fetch if selectedSpecialite or selectedMonth changes,
        // but for immediate update, we might need to trigger a re-render or re-fetch explicitly.
        // For now, relying on the hook's reactive nature. If it doesn't auto-update, we'd need
        // to pass a refresh function from the hook.
      } else {
        throw new Error(result.error || 'Failed to create appointment');
      }

    } catch (error) {
      console.error('Erreur lors de la création du rendez-vous:', error);
      // TODO: Display user-friendly error message
    }
  };

  const generateCalendarDays = () => {
    if (!selectedMonth) return [];
    
    const [year, month] = selectedMonth.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const days = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return days;
  };

  const isSlotOccupied = (date, medecinId) => {
    return appointments.some(appointment => {
      const appointmentDate = new Date(appointment.date_heure);
      const slotDate = new Date(date);
      return appointmentDate.toDateString() === slotDate.toDateString() && 
             appointment.medecin_id === medecinId;
    });
  };

  const getAppointmentForSlot = (date, medecinId) => {
    return appointments.find(appointment => {
      const appointmentDate = new Date(appointment.date_heure);
      const slotDate = new Date(date);
      return appointmentDate.toDateString() === slotDate.toDateString() && 
             appointment.medecin_id === medecinId;
    });
  };

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', { 
      weekday: 'short', 
      day: 'numeric' 
    });
  };

  if (dataLoading) { // Use dataLoading from the hook
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500">Erreur de chargement des données: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Prise de Rendez-vous</h1>
        <p className="text-gray-600">Sélectionnez une spécialité et un mois pour voir les disponibilités</p>
      </div>

      {/* Sélecteurs */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spécialité
            </label>
            <select
              value={selectedSpecialite}
              onChange={(e) => setSelectedSpecialite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner une spécialité</option>
              {specialites.map((specialite) => (
                <option key={specialite.id} value={specialite.id}>{specialite.parent_id ? `— ${specialite.nom}` : specialite.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mois
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Calendrier interactif */}
      {selectedSpecialite && selectedMonth && medecins.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">
              Disponibilités - {selectedSpecialite} - {new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  {medecins.map((medecin) => (
                    <th key={medecin.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dr. {medecin.prenom} {medecin.nom}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {generateCalendarDays().map((date) => (
                  <tr key={date.toISOString()}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(date)}
                    </td>
                    {medecins.map((medecin) => {
                      const isOccupied = isSlotOccupied(date, medecin.id);
                      const appointment = getAppointmentForSlot(date, medecin.id);
                      
                      return (
                        <td key={medecin.id} className="px-4 py-3 whitespace-nowrap">
                          {isOccupied ? (
                            <div className="bg-red-100 border border-red-300 rounded p-2">
                              <div className="text-sm font-medium text-red-800">
                                {appointment.patients?.prenom} {appointment.patients?.nom}
                              </div>
                              <div className="text-xs text-red-600">
                                {formatTime(appointment.date_heure)}
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSlotClick(date, medecin.id)}
                              className="w-full bg-green-100 border border-green-300 rounded p-2 hover:bg-green-200 transition-colors"
                            >
                              <div className="text-sm font-medium text-green-800">
                                Disponible
                              </div>
                              <div className="text-xs text-green-600">
                                9h00 - 17h00
                              </div>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de création de rendez-vous */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Nouveau Rendez-vous
              </h3>
              
              <form onSubmit={handleSubmitAppointment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient *
                  </label>
                  <select
                    required
                    value={newAppointment.patient_id}
                    onChange={(e) => setNewAppointment({...newAppointment, patient_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.prenom} {patient.nom} - {patient.numero_dossier}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date et heure
                  </label>
                  <input
                    type="datetime-local"
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    value={newAppointment.date_heure ? newAppointment.date_heure.slice(0, 16) : ''}
                    onChange={(e) => setNewAppointment({...newAppointment, date_heure: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durée (minutes)
                  </label>
                  <select
                    value={newAppointment.duree}
                    onChange={(e) => setNewAppointment({...newAppointment, duree: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de rendez-vous
                  </label>
                  <select
                    value={newAppointment.type_rdv}
                    onChange={(e) => setNewAppointment({...newAppointment, type_rdv: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="suivi">Suivi</option>
                    <option value="urgence">Urgence</option>
                    <option value="preventif">Préventif</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif *
                  </label>
                  <select
                    required
                    value={newAppointment.motif}
                    onChange={(e) => setNewAppointment({...newAppointment, motif: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un motif...</option>
                    {motifsList.map((motif) => (
                      <option key={motif.value} value={motif.value}>
                        {motif.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif détaillé
                  </label>
                  <textarea
                    value={newAppointment.motif_detaille}
                    onChange={(e) => setNewAppointment({...newAppointment, motif_detaille: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description détaillée du motif"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedSlot(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriseRendezVous;
