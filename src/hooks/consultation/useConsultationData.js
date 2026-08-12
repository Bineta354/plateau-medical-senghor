import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as consultationService from '../../services/consultation/consultationService';
import * as dossierMedicalService from '../../services/consultation/dossierMedicalService';
import * as referenceDataService from '../../services/consultation/referenceDataService';

export const useConsultationData = (id) => {
  const { userProfile } = useAuth();
  const [consultation, setConsultation] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // États pour les différentes sections
  const [antecedents, setAntecedents] = useState([]);
  const [constantes, setConstantes] = useState([]);
  const [signesCliniques, setSignesCliniques] = useState([]);
  const [examensAppareils, setExamensAppareils] = useState([]);
  const [syntheses, setSyntheses] = useState([]);
  const [autresSignes, setAutresSignes] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [actes, setActes] = useState([]);
  const [ordonnances, setOrdonnances] = useState([]);
  const [certificats, setCertificats] = useState([]);
  const [syntheseHistorique, setSyntheseHistorique] = useState([]);

  // États pour le dossier médical
  const [dossierMedical, setDossierMedical] = useState({
    consultationsPassees: [],
    documentsPatient: [],
    historiqueMedical: [],
    allergiesConnues: [],
    traitementsCours: []
  });

  // États pour les données de référence
  const [referenceData, setReferenceData] = useState({
    antecedentsRef: [],
    signesCliniquesRef: [],
    appareilsRef: [],
    elementsSyntheseRef: [],
    diagnosticsRef: [],
    actesRef: [],
    medicamentsRef: [],
    typesCertificatsRef: [],
  });
  const [modeles, setModeles] = useState([]);

  // Récupérer la spécialité du médecin connecté
  const specialiteId = userProfile?.specialite_id || null;
  
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      
      const consultationData = await consultationService.getConsultation(id);
      setConsultation(consultationData);
      const patientData = consultationData.patients;
      setPatient(patientData);

      if (patientData?.id) {
        const [
          dossier, 
          antecedentsData, 
          constantesData,
          signesData,
          examensData,
          synthesesData,
          autresSignesData,
          diagnosticsData,
          actesData,
          ordonnancesData,
          certificatsData,
          refData,
          modelesData
        ] = await Promise.all([
          dossierMedicalService.getDossierMedical(patientData.id, id),
          consultationService.getAntecedents(patientData.id),
          consultationService.getConstantes(id),
          consultationService.getSignesCliniques(id),
          consultationService.getExamensAppareils(id),
          consultationService.getSyntheses(id),
          consultationService.getAutresSignes(id),
          consultationService.getDiagnostics(id),
          consultationService.getActes(id),
          consultationService.getOrdonnances(id),
          consultationService.getCertificats(id),
          // 🔑 Passer la spécialité du médecin pour filtrer les référentiels
          referenceDataService.getReferenceData(specialiteId),
          referenceDataService.getModelesConsultation()
        ]);

        setDossierMedical(dossier);
        setAntecedents(antecedentsData);
        setConstantes(constantesData);
        setSignesCliniques(signesData);
        setExamensAppareils(examensData);
        setSyntheses(synthesesData);
        setAutresSignes(autresSignesData);
        setDiagnostics(diagnosticsData);
        setActes(actesData);
        setOrdonnances(ordonnancesData);
        setCertificats(certificatsData);
        setReferenceData(refData);
        setModeles(modelesData);
      }

    } catch (e) {
      console.error("Erreur lors de la récupération des données de consultation", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id, specialiteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchSyntheseHistorique = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      const data = await consultationService.getSyntheseHistorique(patientId, id);
      setSyntheseHistorique(data);
    } catch (e) {
      console.error("Erreur fetchSyntheseHistorique", e);
    }
  }, [id]);


  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Fonctions pour rafraîchir des parties spécifiques
  const refetchAntecedents = useCallback(async () => patient?.id && setAntecedents(await consultationService.getAntecedents(patient.id)), [patient?.id]);
  const refetchSignesCliniques = useCallback(async () => setSignesCliniques(await consultationService.getSignesCliniques(id)), [id]);
  const refetchExamensAppareils = useCallback(async () => setExamensAppareils(await consultationService.getExamensAppareils(id)), [id]);
  const refetchSyntheses = useCallback(async () => setSyntheses(await consultationService.getSyntheses(id)), [id]);
  const refetchAutresSignes = useCallback(async () => setAutresSignes(await consultationService.getAutresSignes(id)), [id]);
  const refetchDiagnostics = useCallback(async () => setDiagnostics(await consultationService.getDiagnostics(id)), [id]);
  const refetchActes = useCallback(async () => setActes(await consultationService.getActes(id)), [id]);
  const refetchOrdonnances = useCallback(async () => setOrdonnances(await consultationService.getOrdonnances(id)), [id]);
  const refetchCertificats = useCallback(async () => setCertificats(await consultationService.getCertificats(id)), [id]);


  return {
    consultation,
    setConsultation,
    patient,
    loading,
    error,
    antecedents,
    constantes,
    signesCliniques,
    examensAppareils,
    syntheses,
    autresSignes,
    diagnostics,
    actes,
    ordonnances,
    certificats,
    dossierMedical,
    referenceData,
    modeles,
    syntheseHistorique,
    fetchSyntheseHistorique,
    refetch,
    refetchFunctions: {
      refetchAntecedents,
      refetchSignesCliniques,
      refetchExamensAppareils,
      refetchSyntheses,
      refetchAutresSignes,
      refetchDiagnostics,
      refetchActes,
      refetchOrdonnances,
      refetchCertificats
    }
  };
};
