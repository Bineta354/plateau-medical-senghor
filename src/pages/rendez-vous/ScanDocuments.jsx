import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { Upload, FileText, CheckCircle, X, Tag, Search, Filter, Download, Eye, Trash2, Clock } from 'lucide-react';
import KpiCard from '../../components/common/KpiCard';

const ScanDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    valides: 0,
    rejetes: 0,
    aujourdhui: 0
  });

  const [newDocument, setNewDocument] = useState({
    patient_id: '',
    type_document: 'analyse',
    nom_fichier: '',
    description: '',
    tags: [],
    metadata: {}
  });

  const [newSession, setNewSession] = useState({
    patient_id: '',
    medecin_id: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    updateStats();
  }, [documents]);

  const setupRealtimeSubscription = () => {
    const channel = supabase.channel('documents_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents_patients'
      }, (payload) => {
        console.log('Changement document:', payload);
        fetchDocuments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [documentsData, sessionsData, patientsData, medecinsData] = await Promise.all([
        fetchDocuments(),
        fetchSessions(),
        fetchPatients(),
        fetchMedecins()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents_patients')
        .select(`
          *,
          patient:patients(nom, prenom),
          scanned_by_user:users!fk_documents_patients_scanned_by(nom, prenom),
          valide_par_user:users!fk_documents_patients_valide_par(nom, prenom)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      return data;
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
      return [];
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions_scan')
        .select(`
          *,
          patients!sessions_scan_patient_id_fkey(nom, prenom),
          users!sessions_scan_medecin_id_fkey(nom, prenom),
          users!sessions_scan_secretaire_id_fkey(nom, prenom)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
      return data;
    } catch (error) {
      console.error('Erreur lors du chargement des sessions:', error);
      return [];
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, nom, prenom, numero_dossier')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setPatients(data || []);
      return data;
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
      return [];
    }
  };

  const fetchMedecins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nom, prenom, specialite')
        .eq('role', 'doctor')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setMedecins(data || []);
      return data;
    } catch (error) {
      console.error('Erreur lors du chargement des médecins:', error);
      return [];
    }
  };

  const updateStats = () => {
    const total = documents.length;
    const enAttente = documents.filter(d => d.statut_validation === 'en_attente').length;
    const valides = documents.filter(d => d.statut_validation === 'valide').length;
    const rejetes = documents.filter(d => d.statut_validation === 'rejete').length;
    const aujourdhui = documents.filter(d => {
      const today = new Date().toDateString();
      const docDate = new Date(d.created_at).toDateString();
      return today === docDate;
    }).length;

    setStats({ total, enAttente, valides, rejetes, aujourdhui });
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    try {
      // Simuler l'upload de fichier (dans un vrai projet, utiliser Supabase Storage)
      const file = e.target.files[0];
      if (!file) return;

      const fileUrl = URL.createObjectURL(file);
      const fileSize = file.size;
      const fileFormat = file.name.split('.').pop();

      setNewDocument(prev => ({
        ...prev,
        nom_fichier: file.name,
        url_fichier: fileUrl,
        taille_fichier: fileSize,
        format_fichier: fileFormat
      }));
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
    }
  };

  const handleSubmitDocument = async (e) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('documents_patients')
        .insert({
          ...newDocument,
          scanned_by: user.id,
          hash_fichier: `hash_${Date.now()}`, // Simuler un hash
          metadata: {
            uploaded_at: new Date().toISOString(),
            file_type: newDocument.format_fichier,
            file_size: newDocument.taille_fichier
          }
        })
        .select()
        .single();

      if (error) throw error;

      setDocuments(prev => [data, ...prev]);
      setShowUploadModal(false);
      setNewDocument({
        patient_id: '',
        type_document: 'analyse',
        nom_fichier: '',
        description: '',
        tags: [],
        metadata: {}
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout du document:', error);
    }
  };

  const handleSubmitSession = async (e) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('sessions_scan')
        .insert({
          ...newSession,
          secretaire_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => [data, ...prev]);
      setShowSessionModal(false);
      setNewSession({
        patient_id: '',
        medecin_id: '',
        notes: ''
      });
    } catch (error) {
      console.error('Erreur lors de la création de session:', error);
    }
  };

  const validateDocument = async (documentId, statut) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('documents_patients')
        .update({
          statut_validation: statut,
          valide_par: user.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;

      setDocuments(prev => 
        prev.map(d => d.id === documentId ? {
          ...d,
          statut_validation: statut,
          valide_par: user.id,
          date_validation: new Date().toISOString()
        } : d)
      );
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      const { error } = await supabase
        .from('documents_patients')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      setDocuments(prev => prev.filter(d => d.id !== documentId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'valide': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejete': return 'text-red-600 bg-red-50 border-red-200';
      case 'archive': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'analyse': return 'Analyse';
      case 'imagerie': return 'Imagerie';
      case 'prescription': return 'Prescription';
      case 'certificat': return 'Certificat';
      case 'autre': return 'Autre';
      default: return type;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(document => {
    const matchesType = !filterType || document.type_document === filterType;
    const matchesStatut = !filterStatut || document.statut_validation === filterStatut;
    const matchesPatient = !filterPatient || document.patient_id === parseInt(filterPatient);
    const matchesSearch = !searchTerm || 
      document.nom_fichier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      document.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesStatut && matchesPatient && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scan de Documents</h1>
        <p className="text-gray-600">Gestion avancée du scan et de la validation des documents patients</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <KpiCard icon={FileText} tone="blue" label="Total" value={stats.total} />

        <KpiCard icon={Clock} tone="yellow" label="En attente" value={stats.enAttente} />

        <KpiCard icon={CheckCircle} tone="green" label="Validés" value={stats.valides} />

        <KpiCard icon={X} tone="red" label="Rejetés" value={stats.rejetes} />

        <KpiCard icon={Upload} tone="purple" label="Aujourd'hui" value={stats.aujourdhui} />
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Upload className="w-4 h-4 mr-2" />
                Scanner un document
              </button>
              <button
                onClick={() => setShowSessionModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Nouvelle session
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher dans les documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent w-full"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="">Tous les types</option>
              <option value="analyse">Analyse</option>
              <option value="imagerie">Imagerie</option>
              <option value="prescription">Prescription</option>
              <option value="certificat">Certificat</option>
              <option value="autre">Autre</option>
            </select>

            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="valide">Validé</option>
              <option value="rejete">Rejeté</option>
              <option value="archive">Archivé</option>
            </select>

            <select
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
            >
              <option value="">Tous les patients</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.nom} {patient.prenom} ({patient.numero_dossier})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Liste des documents */}
        <div className="divide-y divide-gray-200">
          {filteredDocuments.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun document trouvé</p>
            </div>
          ) : (
            filteredDocuments.map((document) => (
              <div key={document.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {document.nom_fichier}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatutColor(document.statut_validation)}`}>
                          {document.statut_validation}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getTypeLabel(document.type_document)}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-2">{document.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <span>Patient: {document.patients?.nom} {document.patients?.prenom}</span>
                        <span>•</span>
                        <span>Scanné par: {document.users?.nom} {document.users?.prenom}</span>
                        <span>•</span>
                        <span>{formatFileSize(document.taille_fichier)}</span>
                        <span>•</span>
                        <span>{new Date(document.created_at).toLocaleDateString()}</span>
                      </div>

                      {document.tags && document.tags.length > 0 && (
                        <div className="flex items-center space-x-2 mb-2">
                          <Tag className="w-4 h-4 text-gray-400" />
                          {document.tags.map((tag, index) => (
                            <span key={`${document.id}-tag-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {document.valide_par && (
                        <div className="text-sm text-gray-500">
                          Validé par: {document.users?.nom} {document.users?.prenom} le {new Date(document.date_validation).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setSelectedDocument(document)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Voir le document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.open(document.url_fichier, '_blank')}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {document.statut_validation === 'en_attente' && (
                      <>
                        <button
                          onClick={() => validateDocument(document.id, 'valide')}
                          className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                          title="Valider"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => validateDocument(document.id, 'rejete')}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Rejeter"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteDocument(document.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Retirer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal d'upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Scanner un document</h2>
            <form onSubmit={handleSubmitDocument}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient
                  </label>
                  <select
                    value={newDocument.patient_id}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, patient_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    required
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.nom} {patient.prenom} ({patient.numero_dossier})
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
                    onChange={(e) => {
                      // Empêcher la sélection de radiographie
                      if (e.target.value === 'radio' || e.target.value === 'imagerie') {
                        unifiedNotificationService.warning('Le scan de radiographies n\'est pas disponible. Veuillez sélectionner un autre type de document.');
                        return;
                      }
                      setNewDocument(prev => ({ ...prev, type_document: e.target.value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    required
                  >
                    <option value="analyse">Analyse</option>
                    <option value="prescription">Prescription</option>
                    <option value="certificat">Certificat</option>
                    <option value="autre">Autre</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Note: Le scan de radiographies n'est pas disponible
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fichier
                  </label>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newDocument.description}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Scanner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de session */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nouvelle session de scan</h2>
            <form onSubmit={handleSubmitSession}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient
                  </label>
                  <select
                    value={newSession.patient_id}
                    onChange={(e) => setNewSession(prev => ({ ...prev, patient_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    required
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.nom} {patient.prenom} ({patient.numero_dossier})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Médecin (optionnel)
                  </label>
                  <select
                    value={newSession.medecin_id}
                    onChange={(e) => setNewSession(prev => ({ ...prev, medecin_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  >
                    <option value="">Sélectionner un médecin</option>
                    {medecins.map(medecin => (
                      <option key={medecin.id} value={medecin.id}>
                        {medecin.nom} {medecin.prenom} ({medecin.specialite})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newSession.notes}
                    onChange={(e) => setNewSession(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Créer la session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanDocuments;
