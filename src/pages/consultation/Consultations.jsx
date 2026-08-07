import React, { useState } from 'react';
import { useConsultationsPage } from '../../hooks/consultation/useConsultationsPage';
import { getConsultationMotif, getConsultationTypeLabel } from '../../utils/consultationUtils';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Stethoscope, 
  FileText,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Star,
  Bell,
  Settings,
  FileDown,
  CalendarDays,
  Heart,
  Brain,
  Activity,
  MoreHorizontal,
  Pill,
  FileCheck
} from 'lucide-react';

const Consultations = () => {
  const {
    // Data
    loading,
    patients,
    modeles,
    stats,
    filteredConsultations,
    userProfile,

    // Filter Setters
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    urgenceFilter, setUrgenceFilter,
    typeFilter, setTypeFilter,

    // Modal State
    showModal, setShowModal,
    showModeleModal, setShowModeleModal,
    showExportModal, setShowExportModal,
    showVoirPlusModal, setShowVoirPlusModal,
    selectedConsultationId, setSelectedConsultationId,

    // Form State
    selectedPatient, setSelectedPatient,
    selectedModele, setSelectedModele,
    motifConsultation, setMotifConsultation,
    niveauUrgence, setNiveauUrgence,
    typeConsultation, setTypeConsultation,
    notesConfidentielles, setNotesConfidentielles,

    // Actions
    createConsultation,
    createConsultationFromModele,
    updateConsultationStatus,
    deleteConsultation,
    generateRapport,
    resetForm,
    navigate
  } = useConsultationsPage();

  const getStatusIcon = (status) => {
    switch (status) {
      case 'en_cours':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'terminee':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'annulee':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_cours':
        return 'bg-blue-100 text-blue-800';
      case 'terminee':
        return 'bg-green-100 text-green-800';
      case 'annulee':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Libellé affiché — "En consultation" plutôt que "En cours" pour matcher le
  // vocabulaire déjà utilisé sur le tableau de bord médecin (carte "Patient
  // Actuel", compteur, salle d'attente). Voir FIX_ETAPE_2_MEDECIN.md point 3.
  const getStatusLabel = (status) => {
    switch (status) {
      case 'en_cours':
        return 'En consultation';
      case 'terminee':
        return 'Terminée';
      case 'annulee':
        return 'Annulée';
      default:
        return status;
    }
  };

  const getUrgenceColor = (urgence) => {
    switch (urgence) {
      case 'tres_urgente':
        return 'bg-red-100 text-red-800';
      case 'urgente':
        return 'bg-orange-100 text-orange-800';
      case 'normale':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const calculateAge = (dateNaissance) => {
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Consultations</h1>
            <p className="text-gray-600">Gérez vos consultations médicales avec des fonctionnalités avancées</p>
          </div>
          <div className="flex items-center gap-2">
            
            <button
              onClick={() => setShowModeleModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Star className="w-4 h-4" />
              Modèle
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle consultation
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques avancées */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Stethoscope className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">En consultation</p>
              <p className="text-2xl font-bold text-blue-600">{stats.enCours}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Terminées</p>
              <p className="text-2xl font-bold text-green-600">{stats.terminees}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Urgentes</p>
              <p className="text-2xl font-bold text-red-600">{stats.urgentes}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Durée moy.</p>
              <p className="text-2xl font-bold text-purple-600">{Math.round(stats.dureeMoyenne)}min</p>
            </div>
          </div>
        </div>
        
      </div>

      {/* Barre d'outils avancée */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher par patient, dossier ou motif..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="en_cours">En consultation</option>
              <option value="terminee">Terminées</option>
              <option value="annulee">Annulées</option>
            </select>
            
            <select
              value={urgenceFilter}
              onChange={(e) => setUrgenceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous niveaux</option>
              <option value="normale">Normale</option>
              <option value="urgente">Urgente</option>
              <option value="tres_urgente">Très urgente</option>
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous types</option>
              <option value="standard">Standard</option>
              <option value="suivi">Suivi</option>
              <option value="urgence">Urgence</option>
              <option value="preventif">Préventive</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Exporter
            </button>
          </div>
        </div>
      </div>

      {/* Liste des consultations */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motif
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Urgence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredConsultations.map((consultation) => (
                <tr key={consultation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {consultation.patients?.prenom} {consultation.patients?.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          Dossier: {consultation.patients?.numero_dossier} • 
                          {consultation.patients?.date_naissance && 
                            ` ${calculateAge(consultation.patients.date_naissance)} ans`
                          }
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(consultation.date_consultation)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {getConsultationMotif(consultation)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(consultation.statut)}`}>
                      {getStatusIcon(consultation.statut)}
                      <span className="ml-1">
                        {getStatusLabel(consultation.statut)}
                      </span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUrgenceColor(consultation.niveau_urgence)}`}>
                      {consultation.niveau_urgence.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getConsultationTypeLabel(consultation.type_consultation || consultation.type_rdv || consultation.rdv_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/consultation/${consultation.id}`)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Voir la consultation"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedConsultationId(consultation.id);
                          setShowVoirPlusModal(true);
                        }}
                        className="text-purple-600 hover:text-purple-900"
                        title="Voir plus - 8 sous-catégories"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => generateRapport(consultation.id, 'complet')}
                        className="text-green-600 hover:text-green-900"
                        title="Générer rapport complet"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      
                      {consultation.statut === 'en_cours' && (
                        <>
                          <button
                            onClick={() => updateConsultationStatus(consultation.id, 'terminee')}
                            className="text-green-600 hover:text-green-900"
                            title="Marquer comme terminée"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateConsultationStatus(consultation.id, 'annulee')}
                            className="text-red-600 hover:text-red-900"
                            title="Annuler"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => deleteConsultation(consultation.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredConsultations.length === 0 && (
          <div className="text-center py-12">
            <Stethoscope className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune consultation</h3>
            <p className="mt-1 text-sm text-gray-500">Commencez par créer une nouvelle consultation.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Nouvelle consultation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nouvelle Consultation */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Nouvelle Consultation</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient
                </label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif de consultation
                </label>
                <textarea
                  value={motifConsultation}
                  onChange={(e) => setMotifConsultation(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Décrivez le motif de la consultation..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Niveau d'urgence
                  </label>
                  <select
                    value={niveauUrgence}
                    onChange={(e) => setNiveauUrgence(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="normale">Normale</option>
                    <option value="urgente">Urgente</option>
                    <option value="tres_urgente">Très urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={typeConsultation}
                    onChange={(e) => setTypeConsultation(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="suivi">Suivi</option>
                    <option value="urgence">Urgence</option>
                    <option value="preventif">Préventive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes confidentielles (optionnel)
                </label>
                <textarea
                  value={notesConfidentielles}
                  onChange={(e) => setNotesConfidentielles(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Notes visibles uniquement par vous..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={createConsultation}
                disabled={!selectedPatient || !motifConsultation.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer la consultation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modèle */}
      {showModeleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Créer depuis un modèle</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient
                </label>
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.nom} {patient.prenom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modèle
                </label>
                <select
                  value={selectedModele}
                  onChange={(e) => setSelectedModele(e.target.value)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un modèle</option>
                  {modeles.map(modele => (
                    <option key={modele.id} value={modele.id}>
                      {modele.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModeleModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={createConsultationFromModele}
                disabled={!selectedPatient || !selectedModele}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Export (Placeholder) */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          {/* ... Contenu modal export ... */}
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
             <h3 className="text-lg font-medium mb-4">Exportation</h3>
             <p className="text-gray-500 mb-6">La fonctionnalité d'export sera bientôt disponible.</p>
             <button onClick={() => setShowExportModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Fermer</button>
          </div>
        </div>
      )}

      {/* Modal Voir Plus (Placeholder) */}
      {showVoirPlusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
           {/* ... Contenu modal voir plus ... */}
           <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
             <h3 className="text-lg font-medium mb-4">Détails Rapides</h3>
             <p className="text-gray-500 mb-6">Détails pour consultation {selectedConsultationId}</p>
             <button onClick={() => setShowVoirPlusModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Fermer</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Consultations;
