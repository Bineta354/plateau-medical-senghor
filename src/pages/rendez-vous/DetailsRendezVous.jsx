import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Eye, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  X, 
  Printer,
  Edit2,
  FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Pagination, { ItemsPerPageSelector } from '../../components/common/Pagination';

const DetailsRendezVous = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(id, nom, prenom, telephone, sexe, date_naissance),
          medecin:users!inner(id, nom, prenom, actif)
        `)
        .order('date_heure', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return 'N/A';
    const birthDate = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getStatusBadge = (statut) => {
    const statusConfig = {
      en_attente: { label: 'En attente', class: 'bg-yellow-100 text-yellow-800' },
      confirme: { label: 'Confirmé', class: 'bg-green-100 text-green-800' },
      termine: { label: 'Terminé', class: 'bg-blue-100 text-blue-800' },
      annule: { label: 'Annulé', class: 'bg-red-100 text-red-800' },
    };
    const config = statusConfig[statut] || statusConfig.en_attente;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAppointment(null);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtrage
  const filteredAppointments = appointments.filter(app => {
    const patient = app.patient || {};
    const searchLower = searchTerm.toLowerCase();
    return (
      (patient.nom || '').toLowerCase().includes(searchLower) ||
      (patient.prenom || '').toLowerCase().includes(searchLower) ||
      (patient.telephone || '').toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Détails des Rendez-vous</h1>
        <p className="text-gray-600">Consultez tous les rendez-vous enregistrés</p>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Rechercher par nom ou téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Tableau des rendez-vous */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            {filteredAppointments.length} rendez-vous trouvé(s)
          </p>
          <ItemsPerPageSelector
            value={itemsPerPage}
            onChange={(size) => {
              setItemsPerPage(size);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date RDV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heure RDV
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
              {paginatedAppointments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    Aucun rendez-vous trouvé
                  </td>
                </tr>
              ) : (
                paginatedAppointments.map((appointment) => {
                  const patient = appointment.patient || {};
                  const dateHeure = appointment.date_heure ? new Date(appointment.date_heure) : null;
                  return (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {patient.nom || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.prenom || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.telephone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {dateHeure 
                          ? format(dateHeure, 'dd/MM/yyyy', { locale: fr })
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {dateHeure 
                          ? format(dateHeure, 'HH:mm', { locale: fr })
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getStatusBadge(appointment.statut)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleViewDetails(appointment)}
                          className="text-medical-primary hover:text-medical-secondary transition-colors"
                          title="Voir les détails"
                        >
                          <Eye size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredAppointments.length > 0 && (
          <div className="bg-gray-50 border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredAppointments.length}
            />
          </div>
        )}
      </div>

      {/* Modal de détails */}
      <AnimatePresence>
        {showModal && selectedAppointment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-medical-primary to-medical-secondary text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Détails du Rendez-vous</h2>
                    <p className="text-white/80">
                      {selectedAppointment.patient?.prenom} {selectedAppointment.patient?.nom}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-white hover:text-white/80 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Informations du patient */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <User className="mr-2" size={20} />
                    Informations du patient
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Nom complet</p>
                      <p className="font-medium text-gray-800">
                        {selectedAppointment.patient?.prenom} {selectedAppointment.patient?.nom}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Numéro de téléphone</p>
                      <p className="font-medium text-gray-800 flex items-center">
                        <Phone className="mr-1" size={16} />
                        {selectedAppointment.patient?.telephone || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sexe</p>
                      <p className="font-medium text-gray-800">
                        {selectedAppointment.patient?.sexe || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Âge</p>
                      <p className="font-medium text-gray-800">
                        {calculateAge(selectedAppointment.patient?.date_naissance)} ans
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informations du rendez-vous */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Calendar className="mr-2" size={20} />
                    Informations du rendez-vous
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Date du rendez-vous</p>
                      <p className="font-medium text-gray-800">
                        {selectedAppointment.date_heure 
                          ? format(new Date(selectedAppointment.date_heure), 'dd/MM/yyyy', { locale: fr })
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Heure du rendez-vous</p>
                      <p className="font-medium text-gray-800 flex items-center">
                        <Clock className="mr-1" size={16} />
                        {selectedAppointment.date_heure 
                          ? format(new Date(selectedAppointment.date_heure), 'HH:mm', { locale: fr })
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Motif de consultation</p>
                      <p className="font-medium text-gray-800">
                        {selectedAppointment.motif || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Médecin concerné</p>
                      <p className="font-medium text-gray-800">
                        {selectedAppointment.medecin 
                          ? `Dr. ${selectedAppointment.medecin.prenom} ${selectedAppointment.medecin.nom}`
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Statut du rendez-vous</p>
                      <div className="mt-1">
                        {getStatusBadge(selectedAppointment.statut)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes ou commentaires */}
                {selectedAppointment.notes && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                      <FileText className="mr-2" size={20} />
                      Notes ou commentaires
                    </h3>
                    <p className="text-gray-700">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-secondary transition-colors flex items-center"
                >
                  <Printer className="mr-2" size={18} />
                  Imprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DetailsRendezVous;
