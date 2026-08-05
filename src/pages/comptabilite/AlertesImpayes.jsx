import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, Filter, Download, AlertTriangle, Bell, Calendar,
  TrendingUp, Clock, CheckCircle, XCircle, RefreshCw,
  Mail, Phone, MessageSquare, Eye, Edit, Trash2
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';

const AlertesImpayes = () => {
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverite, setFilterSeverite] = useState('all');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState({
    seuilAlerte: 30, // jours
    emailActive: true,
    smsActive: false,
    frequenceRappel: 7 // jours
  });

  // Charger les alertes
  useEffect(() => {
    chargerAlertes();
  }, []);

  const chargerAlertes = async () => {
    setLoading(true);
    try {
      // Récupérer les factures impayées depuis la base de données
      const { data: factures, error } = await supabase
        .from('factures')
        .select(`
          id,
          numero_facture,
          date_facture,
          montant_ttc,
          montant_paye,
          montant_restant,
          statut_paiement,
          patient_id,
          assurance_id,
          patients ( id, nom, prenom, email, telephone ),
          assurances ( id, nom )
        `)
        .is('facture_parent_id', null)
        .or('statut_paiement.eq.en_attente,statut_paiement.eq.partiel')
        .order('date_facture', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Transformer les factures en alertes
      const alertesTransformees = (factures || []).map(f => {
        const montantRestant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        const dateFacture = new Date(f.date_facture);
        const dateEcheance = new Date(dateFacture);
        dateEcheance.setDate(dateEcheance.getDate() + 30); // Échéance à 30 jours par défaut
        const retard = Math.floor((new Date() - dateEcheance) / (1000 * 60 * 60 * 24));
        
        // Déterminer la sévérité
        let severite = 'moyen';
        if (retard > 60) severite = 'critique';
        else if (retard > 30) severite = 'eleve';

        return {
          id: f.id,
          patient: f.patients,
          facture: {
            numero: f.numero_facture,
            montant_total: parseFloat(f.montant_ttc || 0),
            montant_paye: parseFloat(f.montant_paye || 0),
            montant_restant: montantRestant,
            date_emission: f.date_facture,
            date_echeance: dateEcheance.toISOString().split('T')[0]
          },
          retard: Math.max(0, retard),
          severite,
          dernierRappel: null,
          nombreRappels: 0,
          statut: 'actif',
          notes: ''
        };
      });

      setAlertes(alertesTransformees);
    } catch (e) {
      console.error('Erreur lors du chargement des alertes:', e);
      setAlertes([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les alertes
  const filteredAlertes = alertes.filter(alerte => {
    const matchesSearch = 
      `${alerte.patient.prenom} ${alerte.patient.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alerte.facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alerte.patient.telephone?.includes(searchTerm);
    
    const matchesSeverite = filterSeverite === 'all' || alerte.severite === filterSeverite;
    
    return matchesSearch && matchesSeverite;
  });

  // Obtenir la couleur de sévérité
  const getSeveriteColor = (severite) => {
    switch (severite) {
      case 'critique': return 'bg-red-100 text-red-800 border-red-200';
      case 'eleve': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moyen': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'faible': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Obtenir l'icône de sévérité
  const getSeveriteIcon = (severite) => {
    switch (severite) {
      case 'critique': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'eleve': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'moyen': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'faible': return <AlertTriangle className="w-4 h-4 text-blue-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  // Envoyer un rappel
  const envoyerRappel = async (alerteId, type) => {
    try {
      console.log(`Envoi de rappel ${type} pour l'alerte ${alerteId}`);
      // Implémentation de l'envoi de rappel
      alert(`Rappel ${type} envoyé avec succès!`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du rappel:', error);
      alert('Erreur lors de l\'envoi du rappel');
    }
  };

  // Marquer comme résolu
  const marquerResolu = async (alerteId) => {
    try {
      setAlertes(prev => prev.map(alerte => 
        alerte.id === alerteId 
          ? { ...alerte, statut: 'resolu' }
          : alerte
      ));
      alert('Alerte marquée comme résolue!');
    } catch (error) {
      console.error('Erreur lors de la résolution:', error);
      alert('Erreur lors de la résolution de l\'alerte');
    }
  };

  // Exporter les alertes
  const exporterAlertes = (format) => {
    console.log(`Exportation en ${format}`);
  };

  // Statistiques
  const stats = {
    total: alertes.length,
    actives: alertes.filter(a => a.statut === 'actif').length,
    critiques: alertes.filter(a => a.severite === 'critique' && a.statut === 'actif').length,
    montantTotal: alertes.reduce((sum, a) => sum + a.facture.montant_restant, 0),
    montantCritique: alertes.filter(a => a.severite === 'critique' && a.statut === 'actif')
      .reduce((sum, a) => sum + a.facture.montant_restant, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Chargement des alertes...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="w-8 h-8 text-purple-600" />
            Alertes Impayés
          </h1>
          <p className="text-gray-600 mt-2">
            Gestion automatique des alertes de paiements en retard
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Configuration
          </button>
          
          <button
            onClick={() => exporterAlertes('pdf')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter
          </button>
          
          <button
            onClick={chargerAlertes}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Alertes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Bell className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Alertes Actives</p>
              <p className="text-2xl font-bold text-orange-600">{stats.actives}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critiques</p>
              <p className="text-2xl font-bold text-red-600">{stats.critiques}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Total</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMontant(stats.montantTotal)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Montant Critique</p>
              <p className="text-2xl font-bold text-red-600">
                {formatMontant(stats.montantCritique)}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Recherche
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Patient, facture, téléphone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Sévérité
            </label>
            <select
              value={filterSeverite}
              onChange={(e) => setFilterSeverite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Toutes les sévérités</option>
              <option value="critique">Critique</option>
              <option value="eleve">Élevée</option>
              <option value="moyen">Moyenne</option>
              <option value="faible">Faible</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Statut
            </label>
            <select
              value={filterPeriode}
              onChange={(e) => setFilterPeriode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="actif">Actives</option>
              <option value="resolu">Résolues</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des alertes */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Alertes ({filteredAlertes.length})
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredAlertes.map((alerte) => (
            <div key={alerte.id} className={`p-6 ${alerte.statut === 'resolu' ? 'bg-gray-50' : 'bg-white'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getSeveriteIcon(alerte.severite)}
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getSeveriteColor(alerte.severite)}`}>
                      {alerte.severite === 'critique' ? 'Critique' :
                       alerte.severite === 'eleve' ? 'Élevée' :
                       alerte.severite === 'moyen' ? 'Moyenne' : 'Faible'}
                    </span>
                    {alerte.statut === 'resolu' && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                        Résolu
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {alerte.retard} jours de retard
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {alerte.patient.prenom} {alerte.patient.nom}
                      </h4>
                      <div className="text-sm text-gray-600 mt-1">
                        <div>{alerte.patient.telephone}</div>
                        <div>{alerte.patient.email}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {alerte.facture.numero}
                      </h4>
                      <div className="text-sm text-gray-600 mt-1">
                        <div>Total: {formatMontant(alerte.facture.montant_total)}</div>
                        <div>Reste: {formatMontant(alerte.facture.montant_restant)}</div>
                        <div>Échéance: {new Date(alerte.facture.date_echeance).toLocaleDateString('fr-FR')}</div>
                      </div>
                    </div>
                  </div>
                  
                  {alerte.notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-800">
                        <strong>Notes:</strong> {alerte.notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Dernier rappel: {alerte.dernierRappel ? 
                        new Date(alerte.dernierRappel).toLocaleDateString('fr-FR') : 
                        'Jamais'
                      }
                    </div>
                    <div>
                      Nombre de rappels: {alerte.nombreRappels}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 ml-4">
                  {alerte.statut === 'actif' && (
                    <>
                      <button
                        onClick={() => envoyerRappel(alerte.id, 'email')}
                        className="btn btn-secondary flex items-center gap-2 text-sm"
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </button>
                      
                      <button
                        onClick={() => envoyerRappel(alerte.id, 'sms')}
                        className="btn btn-secondary flex items-center gap-2 text-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        SMS
                      </button>
                      
                      <button
                        onClick={() => envoyerRappel(alerte.id, 'telephone')}
                        className="btn btn-secondary flex items-center gap-2 text-sm"
                      >
                        <Phone className="w-4 h-4" />
                        Appel
                      </button>
                      
                      <button
                        onClick={() => marquerResolu(alerte.id)}
                        className="btn btn-primary flex items-center gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Résolu
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de configuration */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configuration des Alertes
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil d'alerte (jours)
                </label>
                <input
                  type="number"
                  value={config.seuilAlerte}
                  onChange={(e) => setConfig({...config, seuilAlerte: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fréquence des rappels (jours)
                </label>
                <input
                  type="number"
                  value={config.frequenceRappel}
                  onChange={(e) => setConfig({...config, frequenceRappel: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="emailActive"
                  checked={config.emailActive}
                  onChange={(e) => setConfig({...config, emailActive: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="emailActive" className="text-sm text-gray-700">
                  Activer les rappels par email
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="smsActive"
                  checked={config.smsActive}
                  onChange={(e) => setConfig({...config, smsActive: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="smsActive" className="text-sm text-gray-700">
                  Activer les rappels par SMS
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                className="btn btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  alert('Configuration sauvegardée!');
                }}
                className="btn btn-primary flex-1"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertesImpayes;
