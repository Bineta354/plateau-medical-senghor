import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const FichePatient = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('id') || searchParams.get('edit');
  const isEditMode = searchParams.has('edit');
  
  const [patients, setPatients] = useState([]);
  const [newPatient, setNewPatient] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    telephone: '',
    email: '',
    sexe: 'M',
    numero_dossier: '',
    lieu_naissance: '',
    nationalite: 'Sénégalais(e)',
    profession: '',
    situation_familiale: '',
    personne_contact: '',
    telephone_contact: '',
    lien_contact: '',
    medecin_traitant: '',
    numero_ipm: '',
    mutuelle: '',
    numero_mutuelle: '',
    actif: true,
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActif, setFilterActif] = useState('');

  useEffect(() => {
    fetchPatients();
    
    // Si un ID est fourni, charger les données du patient
    if (patientId) {
      loadPatientData(patientId);
    }
  }, [patientId]);
  
  const loadPatientData = async (id) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setNewPatient({
          ...data,
          date_naissance: data.date_naissance ? data.date_naissance.split('T')[0] : ''
        });
        if (isEditMode) {
          setEditingId(id);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du patient:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('nom', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        // Ne jamais envoyer numero_dossier dans le payload de mise à jour
        const updateData = { ...newPatient };
        delete updateData.numero_dossier;
        
        const { error } = await supabase
          .from('patients')
          .update(updateData)
          .eq('id', editingId);
        
        if (error) throw error;
        setEditingId(null);
      } else {
        // Ne jamais envoyer numero_dossier dans le payload de création
        const insertData = { ...newPatient };
        delete insertData.numero_dossier;
        
        const { error } = await supabase
          .from('patients')
          .insert([insertData]);
        
        if (error) throw error;
      }

      setNewPatient({
        nom: '',
        prenom: '',
        date_naissance: '',
        telephone: '',
        email: '',
        sexe: 'M',
        numero_dossier: '',
        lieu_naissance: '',
        nationalite: 'Sénégalais(e)',
        profession: '',
        situation_familiale: '',
        personne_contact: '',
        telephone_contact: '',
        lien_contact: '',
        medecin_traitant: '',
        numero_ipm: '',
        mutuelle: '',
        numero_mutuelle: '',
        actif: true,
        notes: ''
      });
      fetchPatients();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEdit = (patient) => {
    navigate(`/rendez-vous/fiche-patient/form?id=${patient.id}`);
  };

  const handleAddNew = () => {
    navigate('/rendez-vous/fiche-patient/form');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir archiver ce patient ?')) {
      try {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        fetchPatients();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.numero_dossier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActif = filterActif === '' || patient.actif === (filterActif === 'true');
    
    return matchesSearch && matchesActif;
  });

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return '';
    const today = new Date();
    const birthDate = new Date(dateNaissance);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Fiche Patient</h1>
        <p className="text-gray-600">Gestion complète des informations patients</p>
        <button
          onClick={handleAddNew}
          className="bg-medical-primary text-white px-6 py-3 rounded-lg hover:bg-medical-primary-dark transition-colors"
        >
          + Nouveau patient
        </button>
      </div>

      {/* Formulaire supprimé - redirection vers page dédiée */}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rechercher par nom, prénom, dossier ou email..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filterActif}
              onChange={(e) => setFilterActif(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les patients</option>
              <option value="true">Patients actifs</option>
              <option value="false">Patients inactifs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Liste des Patients ({filteredPatients.length})
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
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dossier
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
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {patient.prenom} {patient.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient.sexe === 'M' ? 'Masculin' : 'Féminin'} • {calculateAge(patient.date_naissance)} ans
                      </div>
                      {patient.profession && (
                        <div className="text-sm text-gray-500">{patient.profession}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">{patient.telephone}</div>
                      {patient.email && (
                        <div className="text-sm text-gray-500">{patient.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      {patient.numero_dossier && (
                        <div className="text-sm font-medium text-blue-600">{patient.numero_dossier}</div>
                      )}
                      {patient.numero_ipm && (
                        <div className="text-sm text-gray-500">SS: {patient.numero_ipm}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${patient.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {patient.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(patient)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Mettre à jour
                    </button>
                    <button
                      onClick={() => handleDelete(patient.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Archiver
                    </button>
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

export default FichePatient;
