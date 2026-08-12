import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Search, Calendar } from 'lucide-react';

// Hooks
import { useConsultationWorkflow } from '../../hooks/consultation/useHistoriqueConsultations';

// Components
import ConsultationsTable from '../../components/consultation/ConsultationsTable';
import Pagination, { ItemsPerPageSelector } from '../../components/common/Pagination';

const ConsultationsTerminees = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { consultations, loading: loadingList, fetchConsultations } =
    useConsultationWorkflow();

  const safeconsultations = consultations || [];

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  // Redirection directe vers la fiche de consultation en lecture seule :
  // ConsultationDetail.jsx affiche déjà un bandeau "Lecture seule" et bloque
  // l'édition dès que consultation.statut === 'terminee', donc pas besoin
  // d'une modale séparée qui duplique cette vue.
  const handleViewDetails = (consultation) => {
    navigate(`/consultation/${consultation.id}`);
  };

  /* -------------------- FILTRAGE -------------------- */
  const filteredConsultations = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return safeconsultations.filter((c) => {
      const patient = `${c.patients?.prenom || ''} ${c.patients?.nom || ''}`.toLowerCase();
      const medecin = `${c.users?.prenom || ''} ${c.users?.nom || ''}`.toLowerCase();
      const motif = c.motif_consultation?.toLowerCase() || '';
      const dossier = c.patients?.numero_dossier?.toLowerCase() || '';

      const matchesSearch =
        patient.includes(term) ||
        medecin.includes(term) ||
        motif.includes(term) ||
        dossier.includes(term);

      // Filtre par date
      let matchesDate = true;
      if (dateStart) {
        const startDate = new Date(dateStart);
        startDate.setHours(0, 0, 0, 0);
        const consultationDate = new Date(c.date_consultation);
        matchesDate = matchesDate && consultationDate >= startDate;
      }
      if (dateEnd) {
        const endDate = new Date(dateEnd);
        endDate.setHours(23, 59, 59, 999);
        const consultationDate = new Date(c.date_consultation);
        matchesDate = matchesDate && consultationDate <= endDate;
      }

      return matchesSearch && matchesDate;
    });
  }, [consultations, searchTerm, dateStart, dateEnd]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateStart, dateEnd]);

  const totalPages = Math.max(1, Math.ceil(filteredConsultations.length / itemsPerPage));
  const paginatedConsultations = filteredConsultations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // N'afficher le loader qu'au tout premier chargement : si des consultations
  // sont déjà en mémoire, un refetch (realtime, remontage, etc.) ne doit pas
  // remplacer la table par un spinner plein écran.
  const showLoader = loadingList && safeconsultations.length === 0;

  /* -------------------- RENDER -------------------- */
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center">
          <Stethoscope className="w-8 h-8 mr-3 text-medical-primary" />
          Consultations Terminées
        </h1>
        <p className="text-gray-600">
          Historique des consultations terminées
        </p>
      </div>

      {/* Recherche */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Patient, médecin, motif, dossier..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-medical-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-medical-primary"
              placeholder="Date début"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-medical-primary"
              placeholder="Date fin"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            {filteredConsultations.length} consultation(s) trouvée(s)
          </h2>
          <ItemsPerPageSelector
            value={itemsPerPage}
            onChange={(size) => {
              setItemsPerPage(size);
              setCurrentPage(1);
            }}
          />
        </div>
        <ConsultationsTable
          consultations={paginatedConsultations}
          loading={showLoader}
          onViewDetails={handleViewDetails}
          searchTerm={searchTerm}
        />
        {!showLoader && filteredConsultations.length > 0 && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredConsultations.length}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationsTerminees;
