import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Dropdown from '../components/common/Dropdown';
import {
  Search,
  User, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  FileText,
  Edit,
  Eye,
  Download,
  Plus,
  Filter,
  RefreshCw,
  MoreHorizontal,
  X
} from 'lucide-react';

const FicheIdentificationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [selectedPatientForMore, setSelectedPatientForMore] = useState(null);

  // Charger les patients depuis Supabase
  useEffect(() => {
    fetchPatients();
  }, []);


  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('nom');
      
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des patients:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const filteredPatients = patients.filter(patient => {
    const matchesSearch = patient.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patient.telephone?.includes(searchTerm) ||
                         patient.assurance?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = selectedFilter === 'all' || 
                         (selectedFilter === 'actif' && true) ||
                         (selectedFilter === 'inactif' && false);
    
    return matchesSearch && matchesFilter;
  });

  const handleSearch = () => {
    fetchPatients();
  };

  const handlePatientSelect = (patient) => {
    // Naviguer directement vers la page de détails au lieu d'afficher dans la même page
    navigate(`/patients/details/${patient.id}`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusColor = (actif) => {
    return actif ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  const handleNewPatient = () => {
    navigate('/patients/create');
  };

  const handleMoreActions = (patient) => {
    setSelectedPatientForMore(patient);
    setShowMoreModal(true);
  };

  const closeMoreModal = () => {
    setShowMoreModal(false);
    setSelectedPatientForMore(null);
  };

  const handlePrintPatient = (patient) => {
    // Logique d'impression spécifique au patient
    window.print();
    closeMoreModal();
  };

  const handleExportPatient = (patient) => {
    // Logique d'export des données patient
    console.log('Export patient:', patient);
    closeMoreModal();
  };

  const handleArchivePatient = (patient) => {
    // Logique d'archivage patient
    console.log('Archive patient:', patient);
    closeMoreModal();
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fiche d'Identification</h1>
          <p className="text-gray-600">Recherche et consultation des dossiers patients</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleNewPatient}
            className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau patient
          </button>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher un patient</label>
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom, prénom, téléphone ou assurance..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-medical-primary text-white rounded-r-lg hover:bg-medical-primary-dark transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <Dropdown
              value={selectedFilter}
              onChange={(value) => setSelectedFilter(value)}
              options={[
                { value: 'all', label: 'Tous les patients' },
                { value: 'actif', label: 'Patients actifs' },
                { value: 'inactif', label: 'Patients inactifs' },
              ]}
              size="md"
              className="w-full"
            />
          </div>
          
          <div className="flex items-end">
            <button className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Liste des patients */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Résultats de recherche</h2>
          <p className="text-sm text-gray-600">{filteredPatients.length} patient(s) trouvé(s)</p>
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
                  Assurance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Groupe Sanguin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Naissance
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
                <tr 
                  key={patient.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handlePatientSelect(patient)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-medical-primary flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {patient.prenom} {patient.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {patient.date_naissance && formatDate(patient.date_naissance)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{patient.telephone || '-'}</div>
                    <div className="text-sm text-gray-500">{patient.adresse || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {patient.assurance || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {patient.groupe_sanguin || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {patient.date_naissance && formatDate(patient.date_naissance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(true)}`}>
                      Actif
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patients/details/${patient.id}`);
                        }}
                        className="text-medical-primary hover:text-medical-primary-dark"
                        title="Voir les détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patients/edit/${patient.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/appointments?patientId=${patient.id}`);
                        }}
                        className="text-purple-600 hover:text-purple-800"
                        title="Nouveau rendez-vous"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoreActions(patient);
                        }}
                        className="text-gray-600 hover:text-gray-800"
                        title="Voir plus d'actions"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal "Voir plus" */}
      {showMoreModal && selectedPatientForMore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Actions pour {selectedPatientForMore.prenom} {selectedPatientForMore.nom}
              </h3>
              <button
                onClick={closeMoreModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  navigate(`/patients/details/${selectedPatientForMore.id}`);
                  closeMoreModal();
                }}
                className="w-full flex items-center px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Eye className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-blue-900">Voir les détails</p>
                  <p className="text-sm text-blue-600">Consulter le dossier complet</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  navigate(`/patients/edit/${selectedPatientForMore.id}`);
                  closeMoreModal();
                }}
                className="w-full flex items-center px-4 py-3 text-left bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                <Edit className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-green-900">Modifier</p>
                  <p className="text-sm text-green-600">Éditer les informations</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  navigate(`/appointments?patientId=${selectedPatientForMore.id}`);
                  closeMoreModal();
                }}
                className="w-full flex items-center px-4 py-3 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <Calendar className="w-5 h-5 text-purple-600 mr-3" />
                <div>
                  <p className="font-medium text-purple-900">Nouveau rendez-vous</p>
                  <p className="text-sm text-purple-600">Planifier un RDV</p>
                </div>
              </button>
              
              <button
                onClick={() => handlePrintPatient(selectedPatientForMore)}
                className="w-full flex items-center px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Download className="w-5 h-5 text-gray-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Imprimer</p>
                  <p className="text-sm text-gray-600">Imprimer le dossier</p>
                </div>
              </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={closeMoreModal}
                className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FicheIdentificationPage;
