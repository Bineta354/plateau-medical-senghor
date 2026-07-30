import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { userService } from '../lib/services';

export default function useRdvData() {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [specialites, setSpecialites] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      setPatients(data || []);
      return data || [];
    } catch (e) {
      console.error('Erreur lors du chargement des patients:', e);
      setPatients([]);
      return [];
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
      return data || [];
    } catch (e) {
      console.error('Erreur lors du chargement des médecins:', e);
      setDoctors([]);
      return [];
    }
  };

  const fetchSpecialites = async () => {
    try {
      const data = await userService.getUniqueDoctorSpecialties();
      setSpecialites(Array.isArray(data) ? data : []);
      return data || [];
    } catch (e) {
      console.error('Erreur lors du chargement des spécialités:', e);
      setSpecialites([]);
      return [];
    }
  };

  const fetchAppointments = async (date) => {
    try {
      if (!date) {
        setAppointments([]);
        return [];
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
      return data || [];
    } catch (e) {
      console.error('Erreur lors du chargement des rendez-vous:', e);
      setAppointments([]);
      return [];
    }
  };

  const fetchInitialData = async () => {
    await Promise.all([fetchPatients(), fetchDoctors(), fetchSpecialites()]);
  };

  return {
    patients,
    doctors,
    specialites,
    appointments,
    fetchPatients,
    fetchDoctors,
    fetchSpecialites,
    fetchAppointments,
    fetchInitialData
  };
}
