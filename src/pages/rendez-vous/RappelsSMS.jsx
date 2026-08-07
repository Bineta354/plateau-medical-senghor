import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import KpiCard from '../../components/common/KpiCard';

const RappelsSMS = () => {
  const [rappels, setRappels] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchRappelsForDate();
    }
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchRappels(),
        fetchAppointments()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRappels = async () => {
    try {
      const { data, error } = await supabase
        .from('rappels_sms')
        .select(`
          *,
          appointments:appointment_id (
            date_heure,
            motif,
            patients:patient_id (nom, prenom, telephone),
            medecins:medecin_id (nom, prenom, actif)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filtrer pour ne montrer que les rappels avec des médecins actifs
      const filteredData = (data || []).filter(rappel => rappel.appointments?.medecins?.actif !== false);
      setRappels(filteredData);
    } catch (error) {
      console.error('Erreur lors du chargement des rappels:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:patient_id (nom, prenom, telephone),
          medecins:medecin_id (nom, prenom, actif)
        `)
        .gte('date_heure', today.toISOString())
        .lte('date_heure', nextWeek.toISOString())
        .order('date_heure', { ascending: true });

      if (error) throw error;
      // Filtrer pour ne montrer que les rendez-vous avec des médecins actifs
      const filteredData = (data || []).filter(apt => apt.medecins?.actif !== false);
      setAppointments(filteredData);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const fetchRappelsForDate = async () => {
    try {
      const startDate = new Date(selectedDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);

      const { data, error } = await supabase
        .from('rappels_sms')
        .select(`
          *,
          appointments:appointment_id (
            date_heure,
            motif,
            patients:patient_id (nom, prenom, telephone),
            medecins:medecin_id (nom, prenom, actif)
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filtrer pour ne montrer que les rappels avec des médecins actifs
      const filteredData = (data || []).filter(rappel => rappel.appointments?.medecins?.actif !== false);
      setRappels(filteredData);
    } catch (error) {
      console.error('Erreur lors du chargement des rappels pour la date:', error);
    }
  };

  const generateRappels = async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Récupérer les rendez-vous de demain pour les rappels veille
      const { data: appointmentsTomorrow, error: errorTomorrow } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:patient_id (nom, prenom, telephone),
          medecins:medecin_id (nom, prenom, actif)
        `)
        .gte('date_heure', tomorrow.toISOString())
        .lt('date_heure', new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .eq('rappel_veille_envoye', false);

      if (errorTomorrow) throw errorTomorrow;

      // Récupérer les rendez-vous d'aujourd'hui pour les rappels jour J
      const { data: appointmentsToday, error: errorToday } = await supabase
        .from('appointments')
        .select(`
          *,
          patients:patient_id (nom, prenom, telephone),
          medecins:medecin_id (nom, prenom, actif)
        `)
        .gte('date_heure', today.toISOString())
        .lt('date_heure', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
        .eq('rappel_envoye', false);

      if (errorToday) throw errorToday;

      // Filtrer pour ne générer des rappels que pour les médecins actifs
      const filteredAppointmentsTomorrow = (appointmentsTomorrow || []).filter(apt => apt.medecins?.actif !== false);
      const filteredAppointmentsToday = (appointmentsToday || []).filter(apt => apt.medecins?.actif !== false);

      const rappelsToCreate = [];

      // Créer les rappels veille
      filteredAppointmentsTomorrow.forEach(appointment => {
        if (appointment.patients?.telephone) {
          rappelsToCreate.push({
            appointment_id: appointment.id,
            patient_id: appointment.patient_id,
            medecin_id: appointment.medecin_id,
            type_rappel: 'veille',
            numero_telephone: appointment.patients.telephone,
            message: `Rappel: Vous avez rendez-vous demain à ${new Date(appointment.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} avec Dr. ${appointment.medecins.prenom} ${appointment.medecins.nom}. Motif: ${appointment.motif}`,
            statut: 'en_attente'
          });
        }
      });

      // Créer les rappels jour J
      filteredAppointmentsToday.forEach(appointment => {
        if (appointment.patients?.telephone) {
          rappelsToCreate.push({
            appointment_id: appointment.id,
            patient_id: appointment.patient_id,
            medecin_id: appointment.medecin_id,
            type_rappel: 'jour_j',
            numero_telephone: appointment.patients.telephone,
            message: `Rappel: Vous avez rendez-vous aujourd'hui à ${new Date(appointment.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} avec Dr. ${appointment.medecins.prenom} ${appointment.medecins.nom}. Motif: ${appointment.motif}`,
            statut: 'en_attente'
          });
        }
      });

      if (rappelsToCreate.length > 0) {
        const { error } = await supabase
          .from('rappels_sms')
          .insert(rappelsToCreate);

        if (error) throw error;
      }

      fetchRappels();
    } catch (error) {
      console.error('Erreur lors de la génération des rappels:', error);
    }
  };

  const sendRappel = async (rappelId) => {
    try {
      // Simuler l'envoi d'un SMS
      const { error } = await supabase
        .from('rappels_sms')
        .update({
          statut: 'envoye',
          date_envoi: new Date().toISOString()
        })
        .eq('id', rappelId);

      if (error) throw error;

      // Mettre à jour le statut du rendez-vous
      const rappel = rappels.find(r => r.id === rappelId);
      if (rappel) {
        const updateField = rappel.type_rappel === 'veille' ? 'rappel_veille_envoye' : 'rappel_envoye';
        await supabase
          .from('appointments')
          .update({ [updateField]: true })
          .eq('id', rappel.appointment_id);
      }

      fetchRappels();
    } catch (error) {
      console.error('Erreur lors de l\'envoi du rappel:', error);
    }
  };

  const sendAllRappels = async () => {
    const rappelsEnAttente = rappels.filter(r => r.statut === 'en_attente');
    
    for (const rappel of rappelsEnAttente) {
      await sendRappel(rappel.id);
    }
  };

  const deleteRappel = async (rappelId) => {
    try {
      const { error } = await supabase
        .from('rappels_sms')
        .delete()
        .eq('id', rappelId);

      if (error) throw error;
      fetchRappels();
    } catch (error) {
      console.error('Erreur lors de la suppression du rappel:', error);
    }
  };

  const filteredRappels = rappels.filter(rappel => {
    const matchesType = !filterType || rappel.type_rappel === filterType;
    const matchesStatut = !filterStatut || rappel.statut === filterStatut;
    return matchesType && matchesStatut;
  });

  const getTypeLabel = (type) => {
    switch (type) {
      case 'veille': return 'Veille';
      case 'jour_j': return 'Jour J';
      case 'annulation': return 'Annulation';
      case 'modification': return 'Modification';
      default: return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'veille': return 'bg-blue-100 text-blue-800';
      case 'jour_j': return 'bg-green-100 text-green-800';
      case 'annulation': return 'bg-red-100 text-red-800';
      case 'modification': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'en_attente': return 'bg-yellow-100 text-yellow-800';
      case 'envoye': return 'bg-blue-100 text-blue-800';
      case 'delivre': return 'bg-green-100 text-green-800';
      case 'erreur': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Rappels SMS</h1>
        <p className="text-gray-600">Gestion des rappels SMS pour les rendez-vous</p>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={generateRappels}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Générer les rappels
          </button>
          <button
            onClick={sendAllRappels}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Envoyer tous les rappels
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="veille">Veille</option>
              <option value="jour_j">Jour J</option>
              <option value="annulation">Annulation</option>
              <option value="modification">Modification</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="envoye">Envoyé</option>
              <option value="delivre">Délivré</option>
              <option value="erreur">Erreur</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <KpiCard tone="blue" label="En attente" value={rappels.filter(r => r.statut === 'en_attente').length} />
        <KpiCard tone="green" label="Envoyés" value={rappels.filter(r => r.statut === 'envoye').length} />
        <KpiCard tone="blue" label="Délivrés" value={rappels.filter(r => r.statut === 'delivre').length} />
        <KpiCard tone="red" label="Erreurs" value={rappels.filter(r => r.statut === 'erreur').length} />
      </div>

      {/* Liste des rappels */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Rappels SMS ({filteredRappels.length})
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
                  Rendez-vous
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRappels.map((rappel) => (
                <tr key={rappel.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {rappel.appointments?.patients?.prenom} {rappel.appointments?.patients?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {rappel.numero_telephone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(rappel.appointments?.date_heure).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(rappel.appointments?.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm text-gray-500">
                        Dr. {rappel.appointments?.medecins?.prenom} {rappel.appointments?.medecins?.nom}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(rappel.type_rappel)}`}>
                      {getTypeLabel(rappel.type_rappel)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {rappel.message}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatutColor(rappel.statut)}`}>
                      {rappel.statut}
                    </span>
                    {rappel.date_envoi && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(rappel.date_envoi).toLocaleString('fr-FR')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-1">
                      {rappel.statut === 'en_attente' && (
                        <button
                          onClick={() => sendRappel(rappel.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Envoyer
                        </button>
                      )}
                      <button
                        onClick={() => deleteRappel(rappel.id)}
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
    </div>
  );
};

export default RappelsSMS;
