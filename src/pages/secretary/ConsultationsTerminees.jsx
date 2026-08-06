import React, { useState, useEffect, useMemo } from 'react';
import { Stethoscope, Search, Calendar } from 'lucide-react';

// Hooks
import { useConsultationWorkflow } from '../../hooks/consultation/useHistoriqueConsultations';

// Components
import ConsultationsTable from '../../components/consultation/ConsultationsTable';
import ConsultationDetailsModal from '../../components/consultation/modals/ConsultationDetailsModal';
import Pagination from '../../components/common/Pagination';

// Modals
import EditFactureModal from '../../components/secretary/modals/EditFactureModal';
import EditOrdonnanceModal from '../../components/secretary/modals/EditOrdonnanceModal';
import EditCertificatModal from '../../components/secretary/modals/EditCertificatModal';
import EditAnalyseModal from '../../components/secretary/modals/EditAnalyseModal';
import EditActeModal from '../../components/secretary/modals/EditActeModal';

const ITEMS_PER_PAGE = 20;

const ConsultationsTerminees = () => {
  /* -------------------- LISTE -------------------- */
  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { consultations, loading: loadingList, fetchConsultations } =
    useConsultationWorkflow();

  /* -------------------- CONSULTATION -------------------- */
  const [selectedConsultation, setSelectedConsultation] = useState(null);
 const safeconsultations =consultations ||[]
  const {
    workflows,
    facture,
    loadingDetails, // Changed from loading: loadingDetails
    loadConsultationDetails,
    generateFacture,
    resetWorkflow,
  } = useConsultationWorkflow();

  /* -------------------- MODALES -------------------- */
  const [modalsState, setModalsState] = useState({
    facture: false,
    ordonnance: false,
    certificat: false,
    analyse: false,
    acte: false,
  });

  const [selectedItem, setSelectedItem] = useState(null);

  /* -------------------- EFFECTS -------------------- */
  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  /* -------------------- HANDLERS -------------------- */
  const handleViewDetails = async (consultation) => {
    setSelectedConsultation(consultation);
    await loadConsultationDetails(consultation.id);
  };

  const handleCloseDetails = () => {
    setSelectedConsultation(null);
    resetWorkflow();
  };

  const openModal = (name, item = null) => {
    setSelectedItem(item);
    setModalsState((prev) => ({ ...prev, [name]: true }));
  };

  const closeModal = (name) => {
    setSelectedItem(null);
    setModalsState((prev) => ({ ...prev, [name]: false }));
  };

  const handleCreateFacture = async () => {
    await generateFacture(selectedConsultation);
    openModal('facture');
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

  const totalPages = Math.max(1, Math.ceil(filteredConsultations.length / ITEMS_PER_PAGE));
  const paginatedConsultations = filteredConsultations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
        <ConsultationsTable
          consultations={paginatedConsultations}
          loading={loadingList}
          onViewDetails={handleViewDetails}
          searchTerm={searchTerm}
        />
        {!loadingList && filteredConsultations.length > 0 && (
          <div className="border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Détails */}
      <ConsultationDetailsModal
        consultation={selectedConsultation}
        workflows={workflows}
        facture={facture}
        loading={loadingDetails}
        onClose={handleCloseDetails}
        actions={{
          onCreateFacture: handleCreateFacture,
          onEditFacture: () => openModal('facture'),
          onEditOrdonnance: (item) => openModal('ordonnance', item),
          onEditCertificat: (item) => openModal('certificat', item),
          onEditAnalyse: (item) => openModal('analyse', item),
          onEditActe: (item) => openModal('acte', item),
        }}
      />

      {/* MODALES */}
      {modalsState.facture && (
        <EditFactureModal
          facture={facture}
          consultation={selectedConsultation}
          onClose={() => closeModal('facture')}
          onSave={() => closeModal('facture')}
        />
      )}

      {modalsState.ordonnance && (
        <EditOrdonnanceModal
          ordonnance={selectedItem}
          consultation={selectedConsultation}
          onClose={() => closeModal('ordonnance')}
          onSave={() => closeModal('ordonnance')}
        />
      )}

      {modalsState.certificat && (
        <EditCertificatModal
          certificat={selectedItem}
          consultation={selectedConsultation}
          onClose={() => closeModal('certificat')}
          onSave={() => closeModal('certificat')}
        />
      )}

      {modalsState.analyse && (
        <EditAnalyseModal
          analyse={selectedItem}
          consultation={selectedConsultation}
          onClose={() => closeModal('analyse')}
          onSave={() => closeModal('analyse')}
        />
      )}

      {modalsState.acte && (
        <EditActeModal
          acte={selectedItem}
          consultation={selectedConsultation}
          onClose={() => closeModal('acte')}
          onSave={() => closeModal('acte')}
        />
      )}
    </div>
  );
};

export default ConsultationsTerminees;
