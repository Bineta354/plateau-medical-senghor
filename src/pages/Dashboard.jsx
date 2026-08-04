import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Clock, 
  Coins, 
  AlertTriangle,
  CheckCircle,
  UserCheck,
  FileText,
  Plus,
  Volume2,
  Bell,
  VolumeX
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import TestNotifications from '../components/TestNotifications';
import { useDashboardData } from '../hooks/useDashboardData'; // Import the new hook
import { formatMontant } from '../utils/currency';

const Dashboard = () => {
  const { currentUser, hasRole } = useAuth();
  const navigate = useNavigate();

  // Use the new useDashboardData hook
  const { 
    patients, 
    medecins: fetchedMedecins,
    loading: dataLoading, 
    error, 
    fetchPatients
  } = useDashboardData();

  const [stats, setStats] = useState({
    totalPatients: 0,
    patientsWaiting: 0,
    consultationsCompleted: 0,
    totalRevenue: 0,
    totalUsers: 0
  });
  const [waitingQueue, setWaitingQueue] = useState([]); // Keep local for now, as it's simulated
  const [notifications, setNotifications] = useState([]); // Keep local for now
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef(null);

  // Initial data load for patients
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Fetch real waiting queue data and calculate statistics
  useEffect(() => {
    const fetchWaitingQueueData = async () => {
      try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();

        const { data: queueData, error } = await supabase
          .from('waiting_queue')
          .select(`
            *,
            appointments(date_heure, statut_arrivee, heure_arrivee, statut)
          `)
          .gte('appointments.date_heure', todayStart)
          .lt('appointments.date_heure', tomorrowStart)
          .eq('appointments.statut_arrivee', 'arrive')
          .in('status', ['waiting', 'en_attente', 'present', 'arrive', 'authorized', 'called', 'appele', 'en_route', 'medecin_pret', 'in_consultation', 'en_consultation'])
          .order('order_position', { ascending: true });

        if (error) throw error;

        const queue = Array.isArray(queueData) ? queueData : [];
        setWaitingQueue(queue);

        // Calculate real statistics
        const stats = {
          totalPatients: patients.length,
          patientsWaiting: queue.filter(q => 
            q.status === 'waiting' || 
            q.status === 'en_attente' || 
            q.status === 'present' || 
            q.status === 'arrive'
          ).length,
          consultationsCompleted: queue.filter(q => 
            q.status === 'in_consultation' || 
            q.status === 'en_consultation'
          ).length,
          totalRevenue: 0, // Would need to fetch from actual revenue data
          totalUsers: fetchedMedecins.length
        };

        setStats(stats);
      } catch (error) {
        console.error('Erreur lors du chargement de la file d\'attente:', error);
      }
    };

    fetchWaitingQueueData();

    // Real-time subscription to waiting_queue changes
    const subscription = supabase
      .channel('waiting_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_queue' }, () => {
        fetchWaitingQueueData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [patients, fetchedMedecins]);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const toggleSound = () => setSoundEnabled(!soundEnabled);

  // Grouper la file d'attente par médecin (using fetchedMedecins)
  const queueByDoctor = fetchedMedecins.map(medecin => ({
    medecin,
    patients: waitingQueue.filter(q => q.medecin_id === medecin.id)
  }));

  const markNotificationAsRead = (notificationId) => {
    // Marquer la notification comme lue localement
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, lu: true } : n)
    );
    // TODO: Add actual API call to mark as read
  };

  if (dataLoading) { // Use dataLoading from the hook
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de l'accueil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg">Erreur lors du chargement des données: {error.message}</p>
        </div>
      </div>
    );
  }

  // TODO: Implement logic to populate stats from the fetched data (patients, appointments, etc.)
  // For now, stats remain 0 as they are not explicitly calculated from the fetched data in this refactoring.
  // This will be a future task to calculate these metrics from `patients`, `appointments`, `waitingQueue`, etc.

  return (
    <div className="space-y-6 p-6">
      {/* Audio pour les notifications */}
      <audio ref={audioRef} src="/notification.mp3" />

      {/* En-tête avec bouton son */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Accueil
          </h1>
          <p className="text-gray-600 mt-1">
            Bienvenue, {currentUser?.nom} {currentUser?.prenom}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {(hasRole(['admin']) || hasRole(['doctor'])) && (
            <button
              onClick={() => navigate('/personnalisation')}
              className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary/90 transition-colors shadow-md"
            >
              <FileText className="w-4 h-4 mr-2" />
              Personnalisation
            </button>
          )}
          <button
            onClick={toggleSound}
            className="p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-medical-primary" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{patients.length}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En Attente</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.patientsWaiting}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Consultations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.consultationsCompleted}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <UserCheck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenus (FCFA)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatMontant(stats.totalRevenue)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-emerald-100">
              <Coins className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Utilisateurs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fetchedMedecins.length}</p>
            </div>
            <div className="p-3 rounded-full bg-indigo-100">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Salle d'attente par médecin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-lg shadow-md border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-medical-primary" />
              Salle d'attente
            </h2>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto">
            {queueByDoctor.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun patient en attente</p>
            ) : (
              <div className="space-y-4">
                {queueByDoctor.map(({ medecin, patients }) => (
                  patients.length > 0 && (
                    <div key={medecin.id} className="border-l-4 border-medical-primary pl-4">
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Dr. {medecin.nom} {medecin.prenom}
                      </h3>
                      <div className="space-y-2">
                        {patients.map((patient) => (
                          <div
                            key={patient.id}
                            className={`p-3 rounded-lg ${
                              patient.status === 'present' 
                                ? 'bg-green-50 border border-green-200' 
                                : 'bg-yellow-50 border border-yellow-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {patient.patients?.nom} {patient.patients?.prenom}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Arrivée: {new Date(patient.created_at).toLocaleTimeString('fr-FR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                patient.status === 'present' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {patient.status === 'present' ? 'Présent' : 'En attente'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Notifications et alertes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-lg shadow-md border border-gray-200"
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-medical-primary" />
              Notifications
            </h2>
          </div>
          <div className="p-6 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-500">Aucune notification</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border ${
                      notification.lu 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}
                    onClick={() => !notification.lu && markNotificationAsRead(notification.id)}
                  >
                    <div className="flex items-start">
                      <Bell className={`w-5 h-5 mr-3 mt-0.5 ${
                        notification.lu ? 'text-gray-400' : 'text-blue-600'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.titre}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notification.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Actions rapides */}
      {hasRole(['admin', 'secretaire']) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-medical-primary" />
            Actions Rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/introduction-patient')}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Users className="w-5 h-5 mr-2" />
              Nouveau Patient
            </button>
            <button 
              onClick={() => navigate('/facturation')}
              className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FileText className="w-5 h-5 mr-2" />
              Nouvelle Facture
            </button>
          </div>
        </motion.div>
      )}

      {/* Composant de test temporaire pour les notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="mt-8"
      >
        <TestNotifications />
      </motion.div>
    </div>
  );
};

export default Dashboard;

