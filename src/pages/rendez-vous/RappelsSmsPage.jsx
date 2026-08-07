import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { 
  MessageSquare, 
  Send, 
  Clock, 
  User, 
  Phone, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Bell,
  Settings,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Zap,
  Timer,
  History,
  FileText,
  Smartphone,
  Users
} from 'lucide-react';
import KpiCard from '../../components/common/KpiCard';

const RappelsSmsPage = () => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [smsHistory, setSmsHistory] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [templateForm, setTemplateForm] = useState({
    nom: '',
    message: '',
    type: 'rappel_24h',
    actif: true
  });

  const [smsForm, setSmsForm] = useState({
    template_id: '',
    message_personnalise: '',
    heure_envoi: '',
    type_rappel: 'immediat'
  });

  const [stats, setStats] = useState({
    total_rappels: 0,
    envoyes_aujourd_hui: 0,
    programmes: 0,
    taux_reussite: 0
  });

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAppointments(),
        fetchSmsHistory(),
        fetchSmsTemplates(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(*),
          medecin:users!inner(*)
        `)
        .gte('date_heure', `${tomorrowStr}T00:00:00`)
        .lt('date_heure', `${tomorrowStr}T23:59:59`)
        .eq('statut', 'confirme')
        .order('date_heure', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    }
  };

  const fetchSmsHistory = async () => {
    try {
      // Simuler l'historique SMS (à adapter selon votre structure BDD)
      const mockHistory = [
        {
          id: 1,
          patient_nom: 'Aminata Diallo',
          telephone: '+221 77 123 45 67',
          message: 'Rappel: RDV demain à 14h30 avec Dr. Ndiaye',
          statut: 'envoye',
          date_envoi: new Date().toISOString(),
          type: 'rappel_24h'
        },
        {
          id: 2,
          patient_nom: 'Moussa Ba',
          telephone: '+221 77 234 56 78',
          message: 'Rappel: RDV aujourd\'hui à 10h00 avec Dr. Seck',
          statut: 'echec',
          date_envoi: new Date().toISOString(),
          type: 'rappel_jour'
        }
      ];
      setSmsHistory(mockHistory);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique SMS:', error);
    }
  };

  const fetchSmsTemplates = async () => {
    try {
      // Templates par défaut
      const defaultTemplates = [
        {
          id: 1,
          nom: 'Rappel 24h',
          message: 'Bonjour {patient_nom}, nous vous rappelons votre RDV demain à {heure} avec {medecin}. Cabinet Médical.',
          type: 'rappel_24h',
          actif: true
        },
        {
          id: 2,
          nom: 'Rappel jour J',
          message: 'Bonjour {patient_nom}, votre RDV est aujourd\'hui à {heure} avec {medecin}. Merci de vous présenter 15min avant.',
          type: 'rappel_jour',
          actif: true
        },
        {
          id: 3,
          nom: 'Confirmation RDV',
          message: 'RDV confirmé le {date} à {heure} avec {medecin}. Pour annuler, appelez le 33 123 45 67.',
          type: 'confirmation',
          actif: true
        }
      ];
      setSmsTemplates(defaultTemplates);
    } catch (error) {
      console.error('Erreur lors du chargement des templates:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Statistiques simulées
      setStats({
        total_rappels: 156,
        envoyes_aujourd_hui: 23,
        programmes: 45,
        taux_reussite: 94.5
      });
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

  const handleSendSms = async (appointmentIds, templateId, customMessage = '') => {
    try {
      const template = smsTemplates.find(t => t.id === parseInt(templateId));
      const appointmentsToSend = appointments.filter(apt => appointmentIds.includes(apt.id));

      for (const appointment of appointmentsToSend) {
        let message = customMessage || template.message;
        
        // Remplacer les variables dans le message
        message = message
          .replace('{patient_nom}', `${appointment.patient.prenom} ${appointment.patient.nom}`)
          .replace('{medecin}', `Dr. ${appointment.medecin.prenom} ${appointment.medecin.nom}`)
          .replace('{heure}', new Date(appointment.date_heure).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}))
          .replace('{date}', new Date(appointment.date_heure).toLocaleDateString('fr-FR'));

        // Simuler l'envoi SMS (à remplacer par votre service SMS)
        console.log(`SMS envoyé à ${appointment.patient.telephone}: ${message}`);
        
        // Ajouter à l'historique
        const newSms = {
          id: Date.now() + Math.random(),
          patient_nom: `${appointment.patient.prenom} ${appointment.patient.nom}`,
          telephone: appointment.patient.telephone,
          message: message,
          statut: 'envoye',
          date_envoi: new Date().toISOString(),
          type: template.type
        };
        
        setSmsHistory(prev => [newSms, ...prev]);
      }

      unifiedNotificationService.success(`${appointmentsToSend.length} SMS envoyé(s) avec succès !`);
      setSelectedAppointments([]);
      setShowSendForm(false);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi des SMS:', error);
      unifiedNotificationService.error('Erreur lors de l\'envoi des SMS');
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const newTemplate = {
        id: Date.now(),
        ...templateForm
      };
      
      setSmsTemplates(prev => [...prev, newTemplate]);
      setTemplateForm({ nom: '', message: '', type: 'rappel_24h', actif: true });
      setShowTemplateForm(false);
      
    } catch (error) {
      console.error('Erreur lors de la création du template:', error);
      unifiedNotificationService.error('Erreur lors de la création du template');
    }
  };

  const getStatusBadge = (statut) => {
    const statusConfig = {
      envoye: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      programme: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      echec: { color: 'bg-red-100 text-red-800', icon: XCircle },
      en_cours: { color: 'bg-yellow-100 text-yellow-800', icon: Timer }
    };
    
    const config = statusConfig[statut] || statusConfig.envoye;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {statut === 'envoye' ? 'Envoyé' : 
         statut === 'programme' ? 'Programmé' : 
         statut === 'echec' ? 'Échec' : 'En cours'}
      </span>
    );
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('fr-FR');
  };

  const filteredAppointments = appointments.filter(appointment =>
    appointment.patient?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.patient?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.patient?.telephone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des rappels SMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rappels SMS</h1>
          <p className="text-gray-600">Gestion automatisée des rappels de rendez-vous</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowTemplateForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau template
          </button>
          <button
            onClick={() => setShowSendForm(true)}
            className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
          >
            <Send className="w-4 h-4 mr-2" />
            Envoyer SMS
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={MessageSquare} tone="blue" label="Total rappels" value={stats.total_rappels} />

        <KpiCard icon={Send} tone="green" label="Envoyés aujourd'hui" value={stats.envoyes_aujourd_hui} />

        <KpiCard
          icon={Clock}
          label="Programmés"
          value={stats.programmes}
          className="rounded-lg p-4 bg-orange-50 hover:shadow-md"
          iconClassName="text-orange-600"
          valueClassName="text-orange-600"
          labelClassName="text-orange-700"
        />

        <KpiCard icon={CheckCircle} tone="purple" label="Taux de réussite" value={`${stats.taux_reussite}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rendez-vous à rappeler */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Rendez-vous de demain</h2>
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedAppointments.includes(appointment.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAppointments([...selectedAppointments, appointment.id]);
                        } else {
                          setSelectedAppointments(selectedAppointments.filter(id => id !== appointment.id));
                        }
                      }}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {appointment.patient?.prenom} {appointment.patient?.nom}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDateTime(appointment.date_heure)} - Dr. {appointment.medecin?.prenom} {appointment.medecin?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        <Phone className="w-3 h-3 inline mr-1" />
                        {appointment.patient?.telephone}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedAppointments([appointment.id]);
                      setShowSendForm(true);
                    }}
                    className="p-2 text-medical-primary hover:text-medical-primary-dark transition-colors"
                    title="Envoyer SMS"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {filteredAppointments.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun rendez-vous à rappeler</p>
              </div>
            )}
          </div>
          
          {selectedAppointments.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowSendForm(true)}
                className="w-full flex items-center justify-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
              >
                <Send className="w-4 h-4 mr-2" />
                Envoyer SMS à {selectedAppointments.length} patient(s)
              </button>
            </div>
          )}
        </div>

        {/* Historique SMS */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Historique des envois</h2>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {smsHistory.map((sms) => (
              <div key={sms.id} className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">{sms.patient_nom}</div>
                  {getStatusBadge(sms.statut)}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {sms.telephone}
                </div>
                <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  {sms.message}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {formatDateTime(sms.date_envoi)}
                </div>
              </div>
            ))}
            
            {smsHistory.length === 0 && (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun historique d'envoi</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Templates SMS */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Templates de messages</h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {smsTemplates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{template.nom}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    template.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {template.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  Type: {template.type}
                </div>
                <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-3">
                  {template.message}
                </div>
                <div className="flex space-x-2">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    <Edit className="w-3 h-3 inline mr-1" />
                    Mettre à jour
                  </button>
                  <button className="text-red-600 hover:text-red-800 text-sm">
                    <Trash2 className="w-3 h-3 inline mr-1" />
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal nouveau template */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nouveau template SMS</h3>
            </div>
            
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du template</label>
                <input
                  type="text"
                  value={templateForm.nom}
                  onChange={(e) => setTemplateForm({...templateForm, nom: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={templateForm.type}
                  onChange={(e) => setTemplateForm({...templateForm, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="rappel_24h">Rappel 24h</option>
                  <option value="rappel_jour">Rappel jour J</option>
                  <option value="confirmation">Confirmation</option>
                  <option value="annulation">Annulation</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={templateForm.message}
                  onChange={(e) => setTemplateForm({...templateForm, message: e.target.value})}
                  rows={4}
                  placeholder="Utilisez {patient_nom}, {medecin}, {heure}, {date} comme variables"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTemplateForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal envoi SMS */}
      {showSendForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Envoyer SMS</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select
                  value={smsForm.template_id}
                  onChange={(e) => setSmsForm({...smsForm, template_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="">Sélectionner un template</option>
                  {smsTemplates.filter(t => t.actif).map(template => (
                    <option key={template.id} value={template.id}>
                      {template.nom}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message personnalisé (optionnel)</label>
                <textarea
                  value={smsForm.message_personnalise}
                  onChange={(e) => setSmsForm({...smsForm, message_personnalise: e.target.value})}
                  rows={3}
                  placeholder="Laissez vide pour utiliser le template"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'envoi</label>
                <select
                  value={smsForm.type_rappel}
                  onChange={(e) => setSmsForm({...smsForm, type_rappel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="immediat">Immédiat</option>
                  <option value="programme">Programmé</option>
                </select>
              </div>
              
              {smsForm.type_rappel === 'programme' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heure d'envoi</label>
                  <input
                    type="datetime-local"
                    value={smsForm.heure_envoi}
                    onChange={(e) => setSmsForm({...smsForm, heure_envoi: e.target.value})}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  />
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSendForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleSendSms(selectedAppointments, smsForm.template_id, smsForm.message_personnalise)}
                  disabled={!smsForm.template_id || selectedAppointments.length === 0}
                  className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-2 inline" />
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RappelsSmsPage;
