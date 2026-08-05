import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDoctorSpecialties } from '../../utils/doctorUtils';
import {
  confirmSkippedWorkflowSteps,
  validateQueueTransition,
} from '../../utils/workflowGuards';
import { FileText } from 'lucide-react';
import AntecedentsMedicaux from '../../components/consultation/AntecedentsMedicaux';
import * as consultationService from '../../services/consultation/consultationService';

const SalleAttente = () => {
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAntecedentsModal, setShowAntecedentsModal] = useState(false);
  const [selectedPatientForAntecedents, setSelectedPatientForAntecedents] = useState(null);
  const [antecedents, setAntecedents] = useState([]);
  const [antecedentsRef, setAntecedentsRef] = useState([]);
  const [newArrival, setNewArrival] = useState({
    patient_id: '',
    medecin_id: '',
    motif_consultation: '',
    documents_scannes: false
  });
  const [newDocument, setNewDocument] = useState({
    patient_id: '',
    type_document: 'analyse',
    nom_fichier: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
    // Écouter les changements en temps réel
    const channel = supabase
      .channel('waiting_queue_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'waiting_queue' 
      }, () => {
        fetchWaitingQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchWaitingQueue(),
        fetchPatients(),
        fetchMedecins(),
        fetchAppointments()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitingQueue = async () => {
    try {
      // Calculer les bornes de la date d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      const { data, error } = await supabase
        .from('waiting_queue')
        .select(`
          *,
          patients:patient_id (nom, prenom, numero_dossier),
          medecins:medecin_id (nom, prenom, specialite),
          appointments(date_heure, statut_arrivee, heure_arrivee, statut)
        `)
        .gte('appointments.date_heure', todayStart)
        .lt('appointments.date_heure', tomorrowStart)
        .eq('appointments.statut_arrivee', 'arrive')
        .neq('appointments.statut', 'termine')
        .neq('appointments.statut', 'annule')
        .order('appointments.heure_arrivee', { ascending: true });

      if (error) throw error;

      // Filtrer supplémentairement pour exclure les rendez-vous passés qui ne sont plus en consultation
      const now = new Date();
      const filteredData = (data || []).filter(item => {
        if (!item.appointments) return false;

        const appointmentDate = new Date(item.appointments.date_heure);
        const appointmentStatus = item.appointments.statut;
        const waitingQueueStatus = item.status;

        // Si le rendez-vous est dans le futur, l'inclure
        if (appointmentDate > now) return true;

        // Si le rendez-vous est passé, vérifier si le patient est encore actif
        // Inclure si le patient est: waiting, called, present, ou in_consultation
        const activeStatuses = ['waiting', 'called', 'present', 'in_consultation'];
        if (activeStatuses.includes(waitingQueueStatus)) {
          return true;
        }

        // Sinon, exclure ce rendez-vous passé
        return false;
      });

      setWaitingQueue(filteredData);
    } catch (error) {
      console.error('Erreur lors du chargement de la salle d\'attente:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('actif', true)
        .order('nom', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    }
  };

  const fetchMedecins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'doctor')
        .eq('actif', true)
        .order('nom', { ascending: true });

      if (error) throw error;
      setMedecins(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:patient_id (nom, prenom, numero_dossier),
          medecins:medecin_id (nom, prenom, specialite)
        `)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', tomorrow.toISOString())
        .order('date_heure', { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const handlePatientArrival = async (e) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('waiting_queue')
        .insert([{
          ...newArrival,
          status: 'present',
          heure_arrivee: new Date().toISOString()
        }]);

      if (error) throw error;

      setShowArrivalModal(false);
      setNewArrival({
        patient_id: '',
        medecin_id: '',
        motif_consultation: '',
        documents_scannes: false
      });
      fetchWaitingQueue();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'arrivée:', error);
    }
  };

  const handleDocumentScan = async (e) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('documents_patients')
        .insert([{
          ...newDocument,
          url_fichier: 'placeholder_url', // À remplacer par l'upload réel
          taille_fichier: 0,
          format_fichier: 'pdf',
          scanned_by: 1 // ID de l'utilisateur connecté
        }]);

      if (error) throw error;

      // Mettre à jour le statut dans la salle d'attente
      await supabase
        .from('waiting_queue')
        .update({ documents_scannes: true })
        .eq('patient_id', newDocument.patient_id);

      setShowDocumentModal(false);
      setNewDocument({
        patient_id: '',
        type_document: 'analyse',
        nom_fichier: '',
        description: ''
      });
      fetchWaitingQueue();
    } catch (error) {
      console.error('Erreur lors du scan du document:', error);
    }
  };

  // Gestion des antécédents
  const handleViewAntecedents = async (patient) => {
    setSelectedPatientForAntecedents(patient);
    await fetchAntecedents(patient.patient_id);
    await fetchAntecedentsRef();
    setShowAntecedentsModal(true);
  };

  const fetchAntecedents = async (patientId) => {
    try {
      const { data, error } = await supabase
        .from('antecedents_patients')
        .select(`
          *,
          antecedents (*)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAntecedents(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des antécédents:', error);
      setAntecedents([]);
    }
  };

  const fetchAntecedentsRef = async () => {
    try {
      const { data, error } = await supabase
        .from('antecedents')
        .select('*')
        .order('nom');

      if (error) throw error;
      setAntecedentsRef(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des références d\'antécédents:', error);
      setAntecedentsRef([]);
    }
  };
        .from('waiting_queue')
        .update({ documents_scannes: true })
        .eq('patient_id', newDocument.patient_id);

      setShowDocumentModal(false);
      setNewDocument({
        patient_id: '',
        type_document: 'analyse',
        nom_fichier: '',
        description: ''
      });
      fetchWaitingQueue();
    } catch (error) {
      console.error('Erreur lors du scan du document:', error);
    }
  };

  const handleStatusChange = async (queueId, newStatus) => {
    try {
      const currentPatient = waitingQueue.find(p => p.id === queueId);
      if (!currentPatient) {
        console.error('Patient non trouvé');
        return;
      }

      const transition = validateQueueTransition(currentPatient.status, newStatus);
      if (transition.needsConfirmation && !confirmSkippedWorkflowSteps(transition.skippedSteps, 'changer le statut')) {
        return;
      }

      const { error } = await supabase
        .from('waiting_queue')
        .update({ status: newStatus })
        .eq('id', queueId);

      if (error) throw error;
      fetchWaitingQueue();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  };

  const handleRemoveFromQueue = async (queueId) => {
    try {
      const { error } = await supabase
        .from('waiting_queue')
        .delete()
        .eq('id', queueId);

      if (error) throw error;
      fetchWaitingQueue();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'en_consultation': return 'bg-blue-100 text-blue-800';
      case 'termine': return 'bg-gray-100 text-gray-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'present': return 'Présent';
      case 'en_consultation': return 'En consultation';
      case 'termine': return 'Terminé';
      default: return 'En attente';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Salle d'Attente</h1>
        <p className="text-gray-600">Gestion des patients en salle d'attente</p>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setShowArrivalModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Enregistrer une arrivée
          </button>
          <button
            onClick={() => setShowDocumentModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Scanner un document
          </button>
        </div>
      </div>

      {/* Salle d'attente actuelle */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Patients en salle d'attente ({waitingQueue.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heure d'arrivée
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {waitingQueue.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.patients?.prenom} {item.patients?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        Dossier: {item.patients?.numero_dossier}
                      </div>
                      {item.motif_consultation && (
                        <div className="text-sm text-gray-500">
                          Motif: {item.motif_consultation}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatDoctorSpecialties(item.medecins)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.heure_arrivee).toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.documents_scannes ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Scannés
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Aucun
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleViewAntecedents(item.patients)}
                        className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
                      >
                        <FileText className="w-4 h-4" />
                        Antécédents
                      </button>
                      {item.status === 'present' && (
                        <button
                          onClick={() => handleStatusChange(item.id, 'en_consultation')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          En consultation
                        </button>
                      )}
                      {item.status === 'en_consultation' && (
                        <button
                          onClick={() => handleStatusChange(item.id, 'termine')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Terminer
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFromQueue(item.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Retirer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rendez-vous du jour */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Rendez-vous du jour ({appointments.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appointments.map((appointment) => {
                const isInQueue = waitingQueue.some(item => 
                  item.patient_id === appointment.patient_id && 
                  item.medecin_id === appointment.medecin_id
                );
                
                return (
                  <tr key={appointment.id} className={`hover:bg-gray-50 ${isInQueue ? 'bg-green-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(appointment.date_heure).toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {appointment.patients?.prenom} {appointment.patients?.nom}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDoctorSpecialties(appointment.medecins)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'arrivée de patient */}
      {showArrivalModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Enregistrer une arrivée
              </h3>
              
              <form onSubmit={handlePatientArrival} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient *
                  </label>
                  <select
                    required
                    value={newArrival.patient_id}
                    onChange={(e) => setNewArrival({...newArrival, patient_id: e.target.value})}
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
                    Médecin *
                  </label>
                  <select
                    required
                    value={newArrival.medecin_id}
                    onChange={(e) => setNewArrival({...newArrival, medecin_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un médecin</option>
                    {medecins.map((medecin) => (
                      <option key={medecin.id} value={medecin.id}>
                        Dr. {medecin.prenom} {medecin.nom} - {medecin.specialite}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif de consultation
                  </label>
                  <textarea
                    value={newArrival.motif_consultation}
                    onChange={(e) => setNewArrival({...newArrival, motif_consultation: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Motif de la consultation"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="documents_scannes"
                    checked={newArrival.documents_scannes}
                    onChange={(e) => setNewArrival({...newArrival, documents_scannes: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="documents_scannes" className="ml-2 block text-sm text-gray-900">
                    Documents scannés
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArrivalModal(false)}
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

      {/* Modal de scan de document */}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Scanner un document
              </h3>
              
              <form onSubmit={handleDocumentScan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient *
                  </label>
                  <select
                    required
                    value={newDocument.patient_id}
                    onChange={(e) => setNewDocument({...newDocument, patient_id: e.target.value})}
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
                    Type de document
                  </label>
                  <select
                    value={newDocument.type_document}
                    onChange={(e) => setNewDocument({...newDocument, type_document: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="analyse">Analyse</option>
                    <option value="imagerie">Imagerie</option>
                    <option value="prescription">Prescription</option>
                    <option value="certificat">Certificat</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du fichier *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDocument.nom_fichier}
                    onChange={(e) => setNewDocument({...newDocument, nom_fichier: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom du fichier"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newDocument.description}
                    onChange={(e) => setNewDocument({...newDocument, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description du document"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Scanner
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDocumentModal(false)}
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

      {/* Modal des antécédents */}
      {showAntecedentsModal && selectedPatientForAntecedents && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Antécédents médicaux - {selectedPatientForAntecedents.prenom} {selectedPatientForAntecedents.nom}
                </h3>
                <button
                  onClick={() => setShowAntecedentsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <AntecedentsMedicaux
                antecedents={antecedents}
                fetchAntecedents={() => fetchAntecedents(selectedPatientForAntecedents.patient_id)}
                antecedentsRef={antecedentsRef}
                patient={{ id: selectedPatientForAntecedents.patient_id }}
                isTerminated={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalleAttente;
