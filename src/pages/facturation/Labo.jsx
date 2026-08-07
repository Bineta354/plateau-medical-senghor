import { useConsultations } from '../../hooks/consultation/useConsultations';
import { supabase } from '../../lib/supabase';
import KpiCard from '../../components/common/KpiCard';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const Labo = () => {
  const [analyses, setAnalyses] = useState([]);
  const { consultations } = useConsultations({ status: 'terminee' });
  const [patients, setPatients] = useState([]);
  const [typesAnalyses, setTypesAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterUrgence, setFilterUrgence] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showResultatModal, setShowResultatModal] = useState(false);
  const [selectedAnalyse, setSelectedAnalyse] = useState(null);

  const [newAnalyse, setNewAnalyse] = useState({
    consultation_id: '',
    patient_id: '',
    type_analyse: '',
    description: '',
    urgence: false,
    date_prescription: new Date().toISOString().split('T')[0],
    date_prelevement: '',
    date_resultat: '',
    statut: 'prescrit',
    resultat: '',
    valeurs_normales: '',
    interpretation: '',
    notes: ''
  });

  const [resultatData, setResultatData] = useState({
    resultat: '',
    valeurs_normales: '',
    interpretation: '',
    date_resultat: new Date().toISOString().split('T')[0]
  });



  const fetchAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('analyses_labo_prescrites')
        .select(`
          *,
          consultations:consultation_id(date_consultation, motif),
          patients:patient_id(nom, prenom, numero_dossier)
        `)
        .order('date_prescription', { ascending: false });
      
      if (error) throw error;
      setAnalyses(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des analyses:', error);
    } finally {
      setLoading(false);
    }
  };



  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, nom, prenom, numero_dossier')
        .order('nom');
      
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    }
  };

  const fetchTypesAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('types_analyses_labo')
        .select('*')
        .eq('actif', true)
        .order('nom');
      
      if (error) throw error;
      setTypesAnalyses(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des types d\'analyses:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('analyses_labo_prescrites')
          .update(newAnalyse)
          .eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('analyses_labo_prescrites')
          .insert([newAnalyse]);
        if (error) throw error;
      }
      
      setNewAnalyse({
        consultation_id: '',
        patient_id: '',
        type_analyse: '',
        description: '',
        urgence: false,
        date_prescription: new Date().toISOString().split('T')[0],
        date_prelevement: '',
        date_resultat: '',
        statut: 'prescrit',
        resultat: '',
        valeurs_normales: '',
        interpretation: '',
        notes: ''
      });
      setShowModal(false);
      fetchAnalyses();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (analyse) => {
    setEditingId(analyse.id);
    setNewAnalyse({
      consultation_id: analyse.consultation_id,
      patient_id: analyse.patient_id,
      type_analyse: analyse.type_analyse,
      description: analyse.description,
      urgence: analyse.urgence,
      date_prescription: analyse.date_prescription,
      date_prelevement: analyse.date_prelevement,
      date_resultat: analyse.date_resultat,
      statut: analyse.statut,
      resultat: analyse.resultat,
      valeurs_normales: analyse.valeurs_normales,
      interpretation: analyse.interpretation,
      notes: analyse.notes
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette analyse ?')) {
      try {
        const { error } = await supabase
          .from('analyses_labo_prescrites')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchAnalyses();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const handleConsultationChange = (consultationId) => {
    const consultation = consultations.find(c => c.id === parseInt(consultationId));
    if (consultation) {
      setNewAnalyse({
        ...newAnalyse,
        consultation_id: consultationId,
        patient_id: consultation.patients.id
      });
    }
  };

  const handleSaisirResultat = (analyse) => {
    setSelectedAnalyse(analyse);
    setResultatData({
      resultat: analyse.resultat || '',
      valeurs_normales: analyse.valeurs_normales || '',
      interpretation: analyse.interpretation || '',
      date_resultat: analyse.date_resultat || new Date().toISOString().split('T')[0]
    });
    setShowResultatModal(true);
  };

  const handleResultatSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('analyses_labo_prescrites')
        .update({
          ...resultatData,
          statut: 'termine',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAnalyse.id);
      
      if (error) throw error;
      
      setShowResultatModal(false);
      setSelectedAnalyse(null);
      fetchAnalyses();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du résultat:', error);
    }
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'prescrit': return 'bg-blue-100 text-blue-800';
      case 'preleve': return 'bg-yellow-100 text-yellow-800';
      case 'en_cours': return 'bg-orange-100 text-orange-800';
      case 'termine': return 'bg-green-100 text-green-800';
      case 'annule': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatutIcon = (statut) => {
    switch (statut) {
      case 'prescrit': return <DocumentTextIcon className="w-4 h-4" />;
      case 'preleve': return <ClockIcon className="w-4 h-4" />;
      case 'en_cours': return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'termine': return <CheckCircleIcon className="w-4 h-4" />;
      case 'annule': return <XCircleIcon className="w-4 h-4" />;
      default: return <DocumentTextIcon className="w-4 h-4" />;
    }
  };

  const filteredAnalyses = analyses.filter(analyse => {
    const matchesSearch = 
      analyse.patients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analyse.patients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analyse.type_analyse?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analyse.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatut = !filterStatut || analyse.statut === filterStatut;
    const matchesUrgence = filterUrgence === '' || analyse.urgence === (filterUrgence === 'true');
    
    return matchesSearch && matchesStatut && matchesUrgence;
  });

  const stats = {
    total: analyses.length,
    prescrit: analyses.filter(a => a.statut === 'prescrit').length,
    preleve: analyses.filter(a => a.statut === 'preleve').length,
    en_cours: analyses.filter(a => a.statut === 'en_cours').length,
    termine: analyses.filter(a => a.statut === 'termine').length,
    annule: analyses.filter(a => a.statut === 'annule').length,
    urgent: analyses.filter(a => a.urgence).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analyses de Laboratoire</h1>
          <p className="text-gray-600">Gestion des analyses prescrites et résultats</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nouvelle Analyse
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard tone="blue" label="Total" value={stats.total} />
        <KpiCard tone="blue" label="Prescrites" value={stats.prescrit} />
        <KpiCard tone="yellow" label="Prélevées" value={stats.preleve} />
        <KpiCard
          label="En cours"
          value={stats.en_cours}
          className="rounded-lg p-4 bg-orange-50 hover:shadow-md"
          valueClassName="text-orange-600"
          labelClassName="text-orange-700"
        />
        <KpiCard tone="green" label="Terminées" value={stats.termine} />
        <KpiCard tone="red" label="Annulées" value={stats.annule} />
        <KpiCard tone="red" label="Urgentes" value={stats.urgent} />
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par patient, type d'analyse..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="prescrit">Prescrit</option>
              <option value="preleve">Prélevé</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="annule">Annulé</option>
            </select>
            <select
              value={filterUrgence}
              onChange={(e) => setFilterUrgence(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Toutes urgences</option>
              <option value="true">Urgent</option>
              <option value="false">Non urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des analyses */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type d'analyse
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date prescription
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Urgence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAnalyses.map((analyse) => (
              <tr key={analyse.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium">{analyse.patients?.nom} {analyse.patients?.prenom}</div>
                    <div className="text-sm text-gray-500">Dossier: {analyse.patients?.numero_dossier}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <div className="font-medium">{analyse.type_analyse}</div>
                    <div className="text-sm text-gray-500 mt-1">{analyse.description}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">{analyse.date_prescription}</div>
                  {analyse.date_prelevement && (
                    <div className="text-xs text-gray-500">Prélèvement: {analyse.date_prelevement}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatutColor(analyse.statut)}`}>
                    <div className="flex items-center gap-1">
                      {getStatutIcon(analyse.statut)}
                      {analyse.statut}
                    </div>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {analyse.urgence ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Urgent
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      Normal
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(analyse)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    {analyse.statut !== 'termine' && (
                      <button
                        onClick={() => handleSaisirResultat(analyse)}
                        className="text-green-600 hover:text-green-900"
                        title="Saisir résultat"
                      >
                        <DocumentTextIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(analyse.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal pour créer/modifier une analyse */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Modifier l\'analyse' : 'Nouvelle analyse'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Consultation</label>
                  <select
                    value={newAnalyse.consultation_id}
                    onChange={(e) => handleConsultationChange(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Sélectionner une consultation</option>
                    {consultations.map(consultation => (
                      <option key={consultation.id} value={consultation.id}>
                        {consultation.date_consultation} - {consultation.patients?.nom} {consultation.patients?.prenom}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Patient</label>
                  <select
                    value={newAnalyse.patient_id}
                    onChange={(e) => setNewAnalyse({...newAnalyse, patient_id: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.nom} {patient.prenom} - {patient.numero_dossier}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Type d'analyse</label>
                  <input
                    type="text"
                    value={newAnalyse.type_analyse}
                    onChange={(e) => setNewAnalyse({...newAnalyse, type_analyse: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Ex: NFS, Glycémie, etc."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Date de prescription</label>
                  <input
                    type="date"
                    value={newAnalyse.date_prescription}
                    onChange={(e) => setNewAnalyse({...newAnalyse, date_prescription: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Statut</label>
                  <select
                    value={newAnalyse.statut}
                    onChange={(e) => setNewAnalyse({...newAnalyse, statut: e.target.value})}
                    className="w-full p-2 border rounded"
                  >
                    <option value="prescrit">Prescrit</option>
                    <option value="preleve">Prélevé</option>
                    <option value="en_cours">En cours</option>
                    <option value="termine">Terminé</option>
                    <option value="annule">Annulé</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Date de prélèvement</label>
                  <input
                    type="date"
                    value={newAnalyse.date_prelevement}
                    onChange={(e) => setNewAnalyse({...newAnalyse, date_prelevement: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newAnalyse.description}
                  onChange={(e) => setNewAnalyse({...newAnalyse, description: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="3"
                  placeholder="Description détaillée de l'analyse..."
                />
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newAnalyse.urgence}
                    onChange={(e) => setNewAnalyse({...newAnalyse, urgence: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Urgent</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={newAnalyse.notes}
                  onChange={(e) => setNewAnalyse({...newAnalyse, notes: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="2"
                  placeholder="Notes supplémentaires..."
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setNewAnalyse({
                      consultation_id: '',
                      patient_id: '',
                      type_analyse: '',
                      description: '',
                      urgence: false,
                      date_prescription: new Date().toISOString().split('T')[0],
                      date_prelevement: '',
                      date_resultat: '',
                      statut: 'prescrit',
                      resultat: '',
                      valeurs_normales: '',
                      interpretation: '',
                      notes: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingId ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal pour saisir les résultats */}
      {showResultatModal && selectedAnalyse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Saisir les résultats - {selectedAnalyse.type_analyse}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Patient: {selectedAnalyse.patients?.nom} {selectedAnalyse.patients?.prenom}
            </p>
            <form onSubmit={handleResultatSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Résultats</label>
                <textarea
                  value={resultatData.resultat}
                  onChange={(e) => setResultatData({...resultatData, resultat: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="4"
                  placeholder="Saisir les résultats de l'analyse..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Valeurs normales</label>
                <textarea
                  value={resultatData.valeurs_normales}
                  onChange={(e) => setResultatData({...resultatData, valeurs_normales: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="2"
                  placeholder="Valeurs de référence..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Interprétation</label>
                <textarea
                  value={resultatData.interpretation}
                  onChange={(e) => setResultatData({...resultatData, interpretation: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="3"
                  placeholder="Interprétation médicale des résultats..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Date des résultats</label>
                <input
                  type="date"
                  value={resultatData.date_resultat}
                  onChange={(e) => setResultatData({...resultatData, date_resultat: e.target.value})}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResultatModal(false);
                    setSelectedAnalyse(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Enregistrer les résultats
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Labo;
