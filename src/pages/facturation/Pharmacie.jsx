import { useConsultations } from '../../hooks/consultation/useConsultations';
import { supabase } from '../../lib/supabase';
import KpiCard from '../../components/common/KpiCard';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const Pharmacie = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const { consultations } = useConsultations({ status: 'terminee' });
  const [patients, setPatients] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterUrgence, setFilterUrgence] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  const [newPrescription, setNewPrescription] = useState({
    consultation_id: '',
    patient_id: '',
    medicament_id: '',
    posologie: '',
    duree_traitement: '',
    quantite: 1,
    urgence: false,
    date_prescription: new Date().toISOString().split('T')[0],
    date_dispensation: '',
    statut: 'prescrit',
    notes: '',
    instructions_particulieres: ''
  });



  const fetchPrescriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('prescriptions_pharmacie')
        .select(`
          *,
          consultations:consultation_id(date_consultation, motif),
          patients:patient_id(nom, prenom, numero_dossier),
          medicaments:medicament_id(nom, forme, dosage)
        `)
        .order('date_prescription', { ascending: false });
      
      if (error) throw error;
      setPrescriptions(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des prescriptions:', error);
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

  const fetchMedicaments = async () => {
    try {
      const { data, error } = await supabase
        .from('medicaments')
        .select('*')
        .eq('actif', true)
        .order('nom');
      
      if (error) throw error;
      setMedicaments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des médicaments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('prescriptions_pharmacie')
          .update(newPrescription)
          .eq('id', editingId);
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('prescriptions_pharmacie')
          .insert([newPrescription]);
        if (error) throw error;
      }
      
      setNewPrescription({
        consultation_id: '',
        patient_id: '',
        medicament_id: '',
        posologie: '',
        duree_traitement: '',
        quantite: 1,
        urgence: false,
        date_prescription: new Date().toISOString().split('T')[0],
        date_dispensation: '',
        statut: 'prescrit',
        notes: '',
        instructions_particulieres: ''
      });
      setShowModal(false);
      fetchPrescriptions();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (prescription) => {
    setEditingId(prescription.id);
    setNewPrescription({
      consultation_id: prescription.consultation_id,
      patient_id: prescription.patient_id,
      medicament_id: prescription.medicament_id,
      posologie: prescription.posologie,
      duree_traitement: prescription.duree_traitement,
      quantite: prescription.quantite,
      urgence: prescription.urgence,
      date_prescription: prescription.date_prescription,
      date_dispensation: prescription.date_dispensation,
      statut: prescription.statut,
      notes: prescription.notes,
      instructions_particulieres: prescription.instructions_particulieres
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette prescription ?')) {
      try {
        const { error } = await supabase
          .from('prescriptions_pharmacie')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchPrescriptions();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const handleConsultationChange = (consultationId) => {
    const consultation = consultations.find(c => c.id === parseInt(consultationId));
    if (consultation) {
      setNewPrescription({
        ...newPrescription,
        consultation_id: consultationId,
        patient_id: consultation.patients.id
      });
    }
  };

  const handleDispenser = async (prescription) => {
    try {
      const { error } = await supabase
        .from('prescriptions_pharmacie')
        .update({
          statut: 'dispense',
          date_dispensation: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', prescription.id);
      
      if (error) throw error;
      fetchPrescriptions();
    } catch (error) {
      console.error('Erreur lors de la dispensation:', error);
    }
  };

  const handleVoirDetails = (prescription) => {
    setSelectedPrescription(prescription);
    setShowDetailModal(true);
  };

  const getStatutColor = (statut) => {
    switch (statut) {
      case 'prescrit': return 'bg-blue-100 text-blue-800';
      case 'en_attente': return 'bg-yellow-100 text-yellow-800';
      case 'dispense': return 'bg-green-100 text-green-800';
      case 'annule': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatutIcon = (statut) => {
    switch (statut) {
      case 'prescrit': return <BeakerIcon className="w-4 h-4" />;
      case 'en_attente': return <ClockIcon className="w-4 h-4" />;
      case 'dispense': return <CheckCircleIcon className="w-4 h-4" />;
      case 'annule': return <XCircleIcon className="w-4 h-4" />;
      default: return <BeakerIcon className="w-4 h-4" />;
    }
  };

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const matchesSearch = 
      prescription.patients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.patients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.medicaments?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.posologie?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatut = !filterStatut || prescription.statut === filterStatut;
    const matchesUrgence = filterUrgence === '' || prescription.urgence === (filterUrgence === 'true');
    
    return matchesSearch && matchesStatut && matchesUrgence;
  });

  const stats = {
    total: prescriptions.length,
    prescrit: prescriptions.filter(p => p.statut === 'prescrit').length,
    en_attente: prescriptions.filter(p => p.statut === 'en_attente').length,
    dispense: prescriptions.filter(p => p.statut === 'dispense').length,
    annule: prescriptions.filter(p => p.statut === 'annule').length,
    urgent: prescriptions.filter(p => p.urgence).length
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
          <h1 className="text-2xl font-bold text-gray-900">Prescriptions Pharmaceutiques</h1>
          <p className="text-gray-600">Gestion des prescriptions et dispensation</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nouvelle Prescription
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard tone="blue" label="Total" value={stats.total} />
        <KpiCard tone="blue" label="Prescrites" value={stats.prescrit} />
        <KpiCard tone="yellow" label="En attente" value={stats.en_attente} />
        <KpiCard tone="green" label="Dispensées" value={stats.dispense} />
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
                placeholder="Rechercher par patient, médicament, posologie..."
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
              <option value="en_attente">En attente</option>
              <option value="dispense">Dispensé</option>
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

      {/* Tableau des prescriptions */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Médicament
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Posologie
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
            {filteredPrescriptions.map((prescription) => (
              <tr key={prescription.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium">{prescription.patients?.nom} {prescription.patients?.prenom}</div>
                    <div className="text-sm text-gray-500">Dossier: {prescription.patients?.numero_dossier}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <div className="font-medium">{prescription.medicaments?.nom}</div>
                    <div className="text-sm text-gray-500">
                      {prescription.medicaments?.forme} - {prescription.medicaments?.dosage}
                    </div>

                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <div className="font-medium">{prescription.posologie}</div>
                    <div className="text-sm text-gray-500">
                      {prescription.duree_traitement} - Qté: {prescription.quantite}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">{prescription.date_prescription}</div>
                  {prescription.date_dispensation && (
                    <div className="text-xs text-gray-500">Dispensation: {prescription.date_dispensation}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatutColor(prescription.statut)}`}>
                    <div className="flex items-center gap-1">
                      {getStatutIcon(prescription.statut)}
                      {prescription.statut}
                    </div>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {prescription.urgence ? (
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
                      onClick={() => handleVoirDetails(prescription)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Voir détails"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(prescription)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    {prescription.statut === 'prescrit' && (
                      <button
                        onClick={() => handleDispenser(prescription)}
                        className="text-green-600 hover:text-green-900"
                        title="Dispenser"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(prescription.id)}
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

      {/* Modal pour créer/modifier une prescription */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Modifier la prescription' : 'Nouvelle prescription'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Consultation</label>
                  <select
                    value={newPrescription.consultation_id}
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
                    value={newPrescription.patient_id}
                    onChange={(e) => setNewPrescription({...newPrescription, patient_id: e.target.value})}
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
                  <label className="block text-sm font-medium mb-2">Médicament</label>
                  <select
                    value={newPrescription.medicament_id}
                    onChange={(e) => setNewPrescription({...newPrescription, medicament_id: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Sélectionner un médicament</option>
                    {medicaments.map(medicament => (
                      <option key={medicament.id} value={medicament.id}>
                        {medicament.nom} - {medicament.forme} {medicament.dosage}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Date de prescription</label>
                  <input
                    type="date"
                    value={newPrescription.date_prescription}
                    onChange={(e) => setNewPrescription({...newPrescription, date_prescription: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Statut</label>
                  <select
                    value={newPrescription.statut}
                    onChange={(e) => setNewPrescription({...newPrescription, statut: e.target.value})}
                    className="w-full p-2 border rounded"
                  >
                    <option value="prescrit">Prescrit</option>
                    <option value="en_attente">En attente</option>
                    <option value="dispense">Dispensé</option>
                    <option value="annule">Annulé</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Quantité</label>
                  <input
                    type="number"
                    value={newPrescription.quantite}
                    onChange={(e) => setNewPrescription({...newPrescription, quantite: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded"
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Posologie</label>
                <textarea
                  value={newPrescription.posologie}
                  onChange={(e) => setNewPrescription({...newPrescription, posologie: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="2"
                  placeholder="Ex: 1 comprimé matin et soir"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Durée du traitement</label>
                <input
                  type="text"
                  value={newPrescription.duree_traitement}
                  onChange={(e) => setNewPrescription({...newPrescription, duree_traitement: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: 7 jours, 1 mois, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Instructions particulières</label>
                <textarea
                  value={newPrescription.instructions_particulieres}
                  onChange={(e) => setNewPrescription({...newPrescription, instructions_particulieres: e.target.value})}
                  className="w-full p-2 border rounded"
                  rows="2"
                  placeholder="Instructions spéciales pour le patient..."
                />
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newPrescription.urgence}
                    onChange={(e) => setNewPrescription({...newPrescription, urgence: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Urgent</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={newPrescription.notes}
                  onChange={(e) => setNewPrescription({...newPrescription, notes: e.target.value})}
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
                    setNewPrescription({
                      consultation_id: '',
                      patient_id: '',
                      medicament_id: '',
                      posologie: '',
                      duree_traitement: '',
                      quantite: 1,
                      urgence: false,
                      date_prescription: new Date().toISOString().split('T')[0],
                      date_dispensation: '',
                      statut: 'prescrit',
                      notes: '',
                      instructions_particulieres: ''
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

      {/* Modal pour voir les détails */}
      {showDetailModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Détails de la prescription
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Patient</label>
                  <p className="text-sm text-gray-900">
                    {selectedPrescription.patients?.nom} {selectedPrescription.patients?.prenom}
                  </p>
                  <p className="text-xs text-gray-500">Dossier: {selectedPrescription.patients?.numero_dossier}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Consultation</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.consultations?.date_consultation}</p>
                  <p className="text-xs text-gray-500">{selectedPrescription.consultations?.motif}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Médicament</label>
                <p className="text-sm text-gray-900 font-medium">{selectedPrescription.medicaments?.nom}</p>
                <p className="text-sm text-gray-600">
                  {selectedPrescription.medicaments?.forme} - {selectedPrescription.medicaments?.dosage}
                </p>

              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Posologie</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.posologie}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Durée du traitement</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.duree_traitement}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantité</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.quantite}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date de prescription</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.date_prescription}</p>
                </div>
              </div>
              
              {selectedPrescription.date_dispensation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date de dispensation</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.date_dispensation}</p>
                </div>
              )}
              
              {selectedPrescription.instructions_particulieres && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Instructions particulières</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.instructions_particulieres}</p>
                </div>
              )}
              
              {selectedPrescription.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <p className="text-sm text-gray-900">{selectedPrescription.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedPrescription(null);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pharmacie;
