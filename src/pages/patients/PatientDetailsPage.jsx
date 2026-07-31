import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft,
  Edit,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  User,
  AlertCircle,
  Heart,
  Shield,
  Clock
} from 'lucide-react';

const PatientDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      loadPatient();
    }
  }, [id]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          assurances (
            id,
            nom,
            type_assurance,
            taux_remboursement,
            description
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPatient(data);
      console.log('✅ Patient chargé avec assurance:', data);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setError('Erreur lors du chargement du patient');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleEdit = () => {
    navigate(`/patients/edit/${id}`);
  };

  const handleNewAppointment = () => {
    navigate(`/appointments?patientId=${id}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return '-';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} ans`;
  };

  // Détecter le type de couverture du patient
  const getTypeCouverture = () => {
    if (patient?.assurance_id && patient?.assurances) return 'assurance';
    if (patient?.nom_assurance) return 'legacy'; // Ancien système avec nom_assurance
    return null;
  };

  // Obtenir le badge de type d'assurance
  const getAssuranceTypeBadge = (type) => {
    const badges = {
      'mutuelle': { label: 'MUTUELLE', color: 'bg-purple-600' },
      'securite_sociale': { label: 'SÉCURITÉ SOCIALE', color: 'bg-blue-600' },
      'privee': { label: 'ASSURANCE PRIVÉE', color: 'bg-green-600' },
      'autre': { label: 'AUTRE', color: 'bg-gray-600' }
    };
    return badges[type] || { label: 'ASSURANCE', color: 'bg-green-600' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                <p className="text-sm text-red-700 mt-1">{error || 'Patient non trouvé'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Détails du patient
              </h1>
              <p className="text-gray-600 mt-1">
                {patient.prenom} {patient.nom}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleNewAppointment}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Nouveau RDV
              </button>
              <button
                onClick={handleEdit}
                className="flex items-center px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </button>
            </div>
          </div>
        </div>

        {/* Informations du patient */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informations personnelles */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <User className="w-5 h-5 mr-2 text-medical-primary" />
              Informations personnelles
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Nom complet</label>
                <p className="text-gray-900 font-medium">{patient.prenom} {patient.nom}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Date de naissance</label>
                <p className="text-gray-900">{formatDate(patient.date_naissance)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Âge</label>
                <p className="text-gray-900">{calculateAge(patient.date_naissance)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Sexe</label>
                <p className="text-gray-900">{patient.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Lieu de naissance</label>
                <p className="text-gray-900">{patient.lieu_naissance || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Nationalité</label>
                <p className="text-gray-900">{patient.nationalite || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Profession</label>
                <p className="text-gray-900">{patient.profession || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Situation familiale</label>
                <p className="text-gray-900">{patient.situation_familiale || '-'}</p>
              </div>
            </div>
          </div>

          {/* Contact et adresse */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <Phone className="w-5 h-5 mr-2 text-medical-primary" />
              Contact et adresse
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Téléphone</label>
                <p className="text-gray-900 font-medium">{patient.telephone || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{patient.email || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Adresse</label>
                <p className="text-gray-900">{patient.adresse || '-'}</p>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-md font-medium text-gray-900 mb-3">Personne à contacter</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nom</label>
                    <p className="text-gray-900">{patient.personne_contact || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Téléphone</label>
                    <p className="text-gray-900">{patient.telephone_contact || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Lien</label>
                    <p className="text-gray-900">{patient.lien_contact || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Informations médicales */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <FileText className="w-5 h-5 mr-2 text-medical-primary" />
              Informations médicales
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Numéro de dossier</label>
                <p className="text-gray-900 font-medium">{patient.numero_dossier || '-'}</p>
              </div>
              
              {/* Affichage de l'assurance */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Couverture santé
                </h4>
                
                {getTypeCouverture() === 'assurance' && patient.assurances && (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-3 py-1 ${getAssuranceTypeBadge(patient.assurances.type_assurance).color} text-white text-xs font-medium rounded-full`}>
                          {getAssuranceTypeBadge(patient.assurances.type_assurance).label}
                        </span>
                        {patient.assurances.taux_remboursement > 0 && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                            {patient.assurances.taux_remboursement}% de remboursement
                          </span>
                        )}
                      </div>
                       
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Nom de l'assurance</label>
                          <p className="text-lg text-gray-900 font-semibold">{patient.assurances.nom}</p>
                        </div>
                        
                        {patient.numero_assurance && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Numéro d'assurance du patient</label>
                            <p className="text-sm text-gray-900 mt-1">{patient.numero_assurance}</p>
                          </div>
                        )}
                        
                        {patient.assurances.taux_remboursement > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Taux de remboursement</label>
                            <div className="flex items-center mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                <div 
                                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${patient.assurances.taux_remboursement}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-bold text-green-600">
                                {patient.assurances.taux_remboursement}%
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {patient.assurances.description && (
                          <div>
                            <label className="text-sm font-medium text-gray-600">Description</label>
                            <p className="text-sm text-gray-700 mt-1">{patient.assurances.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Affichage de secours pour anciens patients avec nom_assurance */}
                {getTypeCouverture() === 'legacy' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Assurance (ancien système)</label>
                        <p className="text-lg text-gray-900 font-semibold">{patient.nom_assurance}</p>
                      </div>
                      {patient.numero_assurance && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Numéro d'assurance</label>
                          <p className="text-sm text-gray-900">{patient.numero_assurance}</p>
                        </div>
                      )}
                      <p className="text-xs text-yellow-700 mt-2">⚠️ Ce patient utilise l'ancien système d'assurance. Veuillez le mettre à jour.</p>
                    </div>
                  </div>
                )}

                {!getTypeCouverture() && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <Shield className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Aucune couverture santé enregistrée</p>
                    <p className="text-xs text-gray-400 mt-1">Le patient n'a pas d'assurance</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {patient.notes && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
              <FileText className="w-5 h-5 mr-2 text-medical-primary" />
              Notes
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}

        {/* Informations système */}
        <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            <span>
              Créé le {formatDate(patient.created_at)} 
              {patient.updated_at && patient.updated_at !== patient.created_at && 
                ` • Modifié le ${formatDate(patient.updated_at)}`
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailsPage;
