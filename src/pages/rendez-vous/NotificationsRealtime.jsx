import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllNotifications,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
  deleteNotification as deleteNotificationById,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  isNotificationForUser,
  deduplicateNotifications,
} from '../../lib/notifications';
import useUserProfile from '../../hooks/useUserProfile';
import { Bell, AlertTriangle, CheckCircle, Clock, Filter, Search, RefreshCw, Trash2, Check } from 'lucide-react';
import KpiCard from '../../components/common/KpiCard';

const NotificationsRealtime = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterPriorite, setFilterPriorite] = useState('');
  const [filterLu, setFilterLu] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    nonLues: 0,
    urgentes: 0,
    aujourdhui: 0
  });

  const { currentUser } = useAuth();
  const { profile: userProfile } = useUserProfile();

  useEffect(() => {
    if (!currentUser) return;
    fetchNotifications();
    setupRealtimeSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, userProfile?.id]);

  useEffect(() => {
    updateStats();
  }, [notifications]);

  const setupRealtimeSubscription = () => {
    if (!userProfile?.id || !userProfile?.role) return;
    
    const channel = subscribeToNotifications(userProfile.id, userProfile.role, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        if (!isNotificationForUser(payload.new, userProfile.id, userProfile.role)) {
          return;
        }
        setNotifications((prev) =>
          deduplicateNotifications([payload.new, ...prev])
        );
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        setNotifications((prev) =>
          deduplicateNotifications(
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          )
        );
      }
    });

    return () => {
      if (channel) {
        unsubscribeFromNotifications(channel);
      }
    };
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      if (!userProfile?.id || !userProfile?.role) {
        console.log('⚠️ [NotificationsRealtime] Profil utilisateur non disponible');
        return;
      }
      const data = await getAllNotifications(userProfile.id, userProfile.role);
      setNotifications(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = () => {
    const total = notifications.length;
    const nonLues = notifications.filter(n => !n.lu).length;
    const urgentes = notifications.filter(n => n.priorite === 'urgente').length;
    const aujourdhui = notifications.filter(n => {
      const today = new Date().toDateString();
      const notificationDate = new Date(n.created_at).toDateString();
      return today === notificationDate;
    }).length;

    setStats({ total, nonLues, urgentes, aujourdhui });
  };

  const markAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, lu: true, lu_at: new Date().toISOString() } : n)
      );
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!userProfile?.id || !userProfile?.role) return;
      await markAllNotificationsAsRead(userProfile.id, userProfile.role);
      setNotifications(prev => 
        prev.map(n => ({ ...n, lu: true, lu_at: new Date().toISOString() }))
      );
    } catch (error) {
      console.error('Erreur lors du marquage de toutes comme lues:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await deleteNotificationById(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };



  const getTypeIcon = (type) => {
    switch (type) {
      case 'patient_arrive': return <Bell className="w-5 h-5" />;
      case 'medecin_disponible': return <CheckCircle className="w-5 h-5" />;
      case 'patient_envoye': return <Clock className="w-5 h-5" />;
      case 'document_scanne': return <CheckCircle className="w-5 h-5" />;
      case 'urgence': return <AlertTriangle className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'patient_arrive': return 'Patient arrivé';
      case 'medecin_disponible': return 'Médecin disponible';
      case 'patient_envoye': return 'Patient appelé';
      case 'consultation_terminee': return 'Consultation terminée';
      case 'document_scanne': return 'Document scanné';
      case 'urgence': return 'Urgence';
      case 'rappel': return 'Rappel';
      default: return type;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesType = !filterType || notification.type_notification === filterType;
    const matchesPriorite = !filterPriorite || notification.priorite === filterPriorite;
    const matchesLu = filterLu === '' || 
      (filterLu === 'true' && notification.lu) || 
      (filterLu === 'false' && !notification.lu);
    const matchesSearch = !searchTerm || 
      notification.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesPriorite && matchesLu && matchesSearch;
  });

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
    if (diffInMinutes < 1440) return `Il y a ${Math.floor(diffInMinutes / 60)}h`;
    return `Il y a ${Math.floor(diffInMinutes / 1440)}j`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">Gestion des notifications du cabinet</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <KpiCard icon={Bell} tone="blue" label="Total" value={stats.total} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <KpiCard icon={Clock} tone="yellow" label="Non lues" value={stats.nonLues} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <KpiCard icon={AlertTriangle} tone="red" label="Urgentes" value={stats.urgentes} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <KpiCard icon={CheckCircle} tone="green" label="Aujourd'hui" value={stats.aujourdhui} />
        </motion.div>
      </div>

      {/* Barre de recherche et filtres */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-lg shadow-md border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  showFilters 
                    ? 'bg-medical-primary text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filtres</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={markAllAsRead}
                disabled={stats.nonLues === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Tout marquer lu</span>
              </button>
              <button
                onClick={fetchNotifications}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>
          </div>

          {/* Filtres étendus */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="">Tous les types</option>
                    <option value="patient_arrive">Patient arrivé</option>
                    <option value="medecin_disponible">Médecin disponible</option>
                    <option value="consultation_terminee">Consultation terminée</option>
                    <option value="document_scanne">Document scanné</option>
                    <option value="urgence">Urgence</option>
                    <option value="rappel">Rappel</option>
                  </select>

                  <select
                    value={filterPriorite}
                    onChange={(e) => setFilterPriorite(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="">Toutes priorités</option>
                    <option value="urgente">Urgente</option>
                    <option value="haute">Haute</option>
                    <option value="normale">Normale</option>
                    <option value="basse">Basse</option>
                  </select>

                  <select
                    value={filterLu}
                    onChange={(e) => setFilterLu(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="">Tous les statuts</option>
                    <option value="false">Non lues</option>
                    <option value="true">Lues</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Liste des notifications */}
        <div className="divide-y divide-gray-200">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune notification trouvée</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.lu ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`p-2 rounded-lg ${
                        notification.priorite === 'urgente' ? 'bg-red-100 text-red-600' :
                        notification.priorite === 'haute' ? 'bg-orange-100 text-orange-600' :
                        notification.priorite === 'normale' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {getTypeIcon(notification.type_notification)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className={`text-lg font-semibold ${
                            !notification.lu ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.titre}
                          </h3>
                          {!notification.lu && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                              Nouveau
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            notification.priorite === 'urgente' ? 'bg-red-100 text-red-700' :
                            notification.priorite === 'haute' ? 'bg-orange-100 text-orange-700' :
                            notification.priorite === 'normale' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {notification.priorite}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-2">{notification.message}</p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{getTypeLabel(notification.type_notification)}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(notification.created_at)}</span>
                          {notification.lu && (
                            <>
                              <span>•</span>
                              <span>Lu {formatTimeAgo(notification.lu_at)}</span>
                            </>
                          )}
                        </div>

                        {notification.data && (
                          <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                            <pre className="text-xs text-gray-600 overflow-x-auto">
                              {JSON.stringify(notification.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {!notification.lu && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                          title="Marquer comme lu"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Retirer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NotificationsRealtime;
