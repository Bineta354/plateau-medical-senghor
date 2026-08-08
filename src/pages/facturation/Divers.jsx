import { useConsultations } from '../../hooks/consultation/useConsultations';
import { supabase } from '../../lib/supabase';
import KpiCard from '../../components/common/KpiCard';
import {
  PlusIcon,
  PencilIcon, 
  TrashIcon, 
  CheckIcon,
  InformationCircleIcon,
  CalendarIcon,
  DocumentTextIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const Divers = () => {
  const [instructions, setInstructions] = useState([]);
  const { consultations } = useConsultations(); // No specific status filter needed here
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    consultation_id: '',
    type_instruction: 'general',
    titre: '',
    description: '',
    priorite: 'normale'
  });

  const typeInstructions = [
    { value: 'general', label: 'Général', icon: InformationCircleIcon },
    { value: 'rendez_vous', label: 'Rendez-vous', icon: CalendarIcon },
    { value: 'examen', label: 'Examen', icon: DocumentTextIcon },
    { value: 'pharmacie', label: 'Pharmacie', icon: DocumentTextIcon },
    { value: 'laboratoire', label: 'Laboratoire', icon: DocumentTextIcon },
    { value: 'patient', label: 'Patient', icon: UserIcon }
  ];

  const priorites = [
    { value: 'basse', label: 'Basse', color: 'bg-gray-100 text-gray-800' },
    { value: 'normale', label: 'Normale', color: 'bg-blue-100 text-blue-800' },
    { value: 'haute', label: 'Haute', color: 'bg-orange-100 text-orange-800' },
    { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-800' }
  ];

  const statuts = [
    { value: 'en_attente', label: 'En attente', color: 'bg-yellow-100 text-yellow-800', tone: 'yellow' },
    { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-800', tone: 'blue' },
    { value: 'terminee', label: 'Terminée', color: 'bg-green-100 text-green-800', tone: 'green' },
    { value: 'annulee', label: 'Annulée', color: 'bg-gray-100 text-gray-800', tone: 'gray' }
  ];



  const fetchInstructions = async () => {
    try {
      const { data, error } = await supabase
        .from('divers_instructions')
        .select(`
          *,
          consultations (
            date_consultation,
            patients (nom, prenom)
          ),
          medecins (nom, prenom)
        `)
        .order('date_creation', { ascending: false });

      if (error) throw error;
      setInstructions(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des instructions:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const { data: medecinData } = await supabase
        .from('medecins')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!medecinData) {
        alert('Médecin non trouvé');
        return;
      }

      const instructionData = {
        ...formData,
        medecin_id: medecinData.id
      };

      if (editingInstruction) {
        const { error } = await supabase
          .from('divers_instructions')
          .update(instructionData)
          .eq('id', editingInstruction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('divers_instructions')
          .insert([instructionData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingInstruction(null);
      resetForm();
      fetchInstructions();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (instruction) => {
    setEditingInstruction(instruction);
    setFormData({
      consultation_id: instruction.consultation_id,
      type_instruction: instruction.type_instruction,
      titre: instruction.titre,
      description: instruction.description,
      priorite: instruction.priorite
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette instruction ?')) return;

    try {
      const { error } = await supabase
        .from('divers_instructions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchInstructions();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('divers_instructions')
        .update({ 
          statut: newStatus,
          date_execution: newStatus === 'terminee' ? new Date().toISOString() : null
        })
        .eq('id', id);

      if (error) throw error;
      fetchInstructions();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const resetForm = () => {
    setFormData({
      consultation_id: '',
      type_instruction: 'general',
      titre: '',
      description: '',
      priorite: 'normale'
    });
  };

  const filteredInstructions = instructions.filter(instruction => {
    const matchesFilter = filter === 'all' || instruction.statut === filter;
    const matchesSearch = instruction.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         instruction.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getTypeIcon = (type) => {
    const typeInfo = typeInstructions.find(t => t.value === type);
    return typeInfo ? typeInfo.icon : InformationCircleIcon;
  };

  const getPrioriteColor = (priorite) => {
    const prioriteInfo = priorites.find(p => p.value === priorite);
    return prioriteInfo ? prioriteInfo.color : 'bg-gray-100 text-gray-800';
  };

  const getStatutColor = (statut) => {
    const statutInfo = statuts.find(s => s.value === statut);
    return statutInfo ? statutInfo.color : 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Instructions Diverses</h1>
        <p className="text-gray-600">Gestion des instructions textuelles pour l'accueil</p>
      </div>

      {/* Filtres et recherche */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher dans les instructions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            {statuts.map(statut => (
              <option key={statut.value} value={statut.value}>{statut.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditingInstruction(null);
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Nouvelle instruction
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {statuts.map(statut => {
          const count = instructions.filter(i => i.statut === statut.value).length;
          return (
            <KpiCard key={statut.value} tone={statut.tone} label={statut.label} value={count} />
          );
        })}
      </div>

      {/* Liste des instructions */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instruction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priorité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médecin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInstructions.map((instruction) => {
                const TypeIcon = getTypeIcon(instruction.type_instruction);
                return (
                  <tr key={instruction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {instruction.titre}
                        </div>
                        <div className="text-sm text-gray-500 max-w-xs truncate">
                          {instruction.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {typeInstructions.find(t => t.value === instruction.type_instruction)?.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPrioriteColor(instruction.priorite)}`}>
                        {priorites.find(p => p.value === instruction.priorite)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatutColor(instruction.statut)}`}>
                        {statuts.find(s => s.value === instruction.statut)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      Dr. {instruction.medecins?.nom} {instruction.medecins?.prenom}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(instruction.date_creation).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(instruction)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(instruction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                        {instruction.statut !== 'terminee' && (
                          <button
                            onClick={() => handleStatusChange(instruction.id, 'terminee')}
                            className="text-green-600 hover:text-green-900"
                            title="Marquer comme terminée"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pour ajouter/modifier */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingInstruction ? 'Modifier l\'instruction' : 'Nouvelle instruction'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consultation
                  </label>
                  <select
                    value={formData.consultation_id}
                    onChange={(e) => setFormData({...formData, consultation_id: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner une consultation</option>
                    {consultations.map(consultation => (
                      <option key={consultation.id} value={consultation.id}>
                        {consultation.patients?.nom} {consultation.patients?.prenom} - {new Date(consultation.date_consultation).toLocaleDateString('fr-FR')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type d'instruction
                  </label>
                  <select
                    value={formData.type_instruction}
                    onChange={(e) => setFormData({...formData, type_instruction: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {typeInstructions.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titre
                  </label>
                  <input
                    type="text"
                    value={formData.titre}
                    onChange={(e) => setFormData({...formData, titre: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorité
                  </label>
                  <select
                    value={formData.priorite}
                    onChange={(e) => setFormData({...formData, priorite: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {priorites.map(priorite => (
                      <option key={priorite.value} value={priorite.value}>{priorite.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingInstruction(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingInstruction ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Divers;
