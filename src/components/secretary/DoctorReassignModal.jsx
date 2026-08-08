import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Stethoscope, Check } from 'lucide-react';
import Dropdown from '../common/Dropdown';

const DoctorReassignModal = ({ 
  isOpen, 
  onClose, 
  patient, 
  onReassignComplete,
  currentMedecinId 
}) => {
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [reason, setReason] = useState('Médecin indisponible');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableDoctors();
    }
  }, [isOpen, currentMedecinId]);

  const fetchAvailableDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Récupérer la spécialité du médecin actuel
      const { data: currentMedecin } = await supabase
        .from('users')
        .select('specialite_id')
        .eq('id', currentMedecinId)
        .single();

      // Récupérer les médecins disponibles de la même spécialité
      const { data: doctors, error } = await supabase
        .from('users')
        .select(`
          id,
          nom,
          prenom,
          specialite_id,
          specialites (
            id,
            nom
          )
        `)
        .eq('role', 'medecin')
        .eq('actif', true)
        .neq('id', currentMedecinId);

      if (error) throw error;

      // Filtrer par spécialité si disponible
      let filteredDoctors = doctors || [];
      if (currentMedecin?.specialite_id) {
        filteredDoctors = filteredDoctors.filter(
          doc => doc.specialite_id === currentMedecin.specialite_id
        );
      }

      setAvailableDoctors(filteredDoctors);
    } catch (err) {
      console.error('Erreur lors du chargement des médecins:', err);
      setError('Impossible de charger les médecins disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedDoctor) {
      setError('Veuillez sélectionner un médecin');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Appeler la fonction PostgreSQL de réassignation
      const { error } = await supabase.rpc('reassign_patient_to_doctor', {
        p_waiting_queue_id: patient.id,
        p_new_medecin_id: selectedDoctor.id,
        p_reason: reason
      });

      if (error) throw error;

      // Notifier le patient (si numéro de téléphone disponible)
      if (patient.patient?.telephone) {
        await notifyPatient(patient, selectedDoctor);
      }

      onReassignComplete && onReassignComplete();
      onClose();
    } catch (err) {
      console.error('Erreur lors de la réassignation:', err);
      setError('Erreur lors de la réassignation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const notifyPatient = async (patientData, newDoctor) => {
    try {
      // Créer une notification pour le patient
      const { error } = await supabase
        .from('notifications_realtime')
        .insert([{
          user_id: patientData.patient_id,
          type_notification: 'doctor_reassigned',
          titre: 'Changement de médecin',
          message: `Votre rendez-vous a été réassigné au Dr. ${newDoctor.prenom} ${newDoctor.nom}.`,
          priorite: 'normale',
          data: {
            patient_id: patientData.patient_id,
            old_medecin_id: currentMedecinId,
            new_medecin_id: newDoctor.id,
            reason: reason
          }
        }]);

      if (error) {
        console.error('Erreur lors de la notification du patient:', error);
      }
    } catch (err) {
      console.error('Erreur lors de la notification du patient:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Réassigner le patient</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Informations du patient */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">
              {patient.patient?.prenom} {patient.patient?.nom}
            </p>
            <p className="text-sm text-gray-500">
              Médecin actuel: Dr. {patient.medecin?.prenom} {patient.medecin?.nom}
            </p>
          </div>

          {/* Liste des médecins disponibles */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choisir un médecin disponible
            </label>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-primary mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Chargement...</p>
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : availableDoctors.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Aucun médecin disponible</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableDoctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    onClick={() => setSelectedDoctor(doctor)}
                    className={`w-full p-3 border rounded-lg flex items-center space-x-3 transition-colors ${
                      selectedDoctor?.id === doctor.id
                        ? 'border-medical-primary bg-medical-primary/5'
                        : 'border-gray-200 hover:border-medical-primary'
                    }`}
                  >
                    <div className="w-10 h-10 bg-medical-primary rounded-full flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">
                        Dr. {doctor.prenom} {doctor.nom}
                      </p>
                      <p className="text-sm text-gray-500">
                        {doctor.specialites?.nom || 'Spécialité non définie'}
                      </p>
                    </div>
                    {selectedDoctor?.id === doctor.id && (
                      <Check className="w-5 h-5 text-medical-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Raison de la réassignation */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raison de la réassignation
            </label>
            <Dropdown
              value={reason}
              onChange={(value) => setReason(value)}
              options={[
                { value: 'Médecin indisponible', label: 'Médecin indisponible' },
                { value: 'Urgence médicale', label: 'Urgence médicale' },
                { value: 'Demande du patient', label: 'Demande du patient' },
                { value: 'Autre', label: 'Autre' },
              ]}
              size="md"
              className="w-full"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleReassign}
            disabled={loading || !selectedDoctor}
            className="px-4 py-2 text-white bg-medical-primary rounded-md hover:bg-medical-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Réassignation...' : 'Réassigner'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorReassignModal;
