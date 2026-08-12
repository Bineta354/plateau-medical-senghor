import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { printOrdonnances } from '../../services/impression/ordonnancePrint.js';
import { printFacture } from '../../services/impression/facturePrint.js';
import { generateCertificatsPDF } from '../../services/impression/certificatPdf.js';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  User,
  Activity,
  Printer,
  Save,
  CheckCircle,
  AlertCircle,
  Calendar,
  Loader,
  Plus,
  Edit3,
  File
} from 'lucide-react';
import { formatDoctorSpecialties } from '../../utils/doctorUtils';
import { formatMontant } from '../../utils/currency';

const ConsultationCompletion = () => {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useAuth();

  // États principaux
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consultation, setConsultation] = useState(null);
  const [patient, setPatient] = useState(null);
  const [medecin, setMedecin] = useState(null);

  // États pour les données de consultation
  const [actes, setActes] = useState([]);
  const [ordonnances, setOrdonnances] = useState([]);
  const [certificats, setCertificats] = useState([]);
  const [facture, setFacture] = useState(null);

  // États pour la facturation
  const [prixConsultation, setPrixConsultation] = useState(6000);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceGenerated, setInvoiceGenerated] = useState(false);

  // État pour la création de rendez-vous
  const [creatingAppointment, setCreatingAppointment] = useState(false);

  // Charger les données de la consultation
  useEffect(() => {
    if (consultationId) {
      fetchConsultationData();
    }
  }, [consultationId]);

  const fetchConsultationData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Chargement des données de consultation:', consultationId);

      // Charger la consultation avec patient et médecin
      const { data: consultationData, error: consultationError } = await supabase
        .from('consultations')
        .select(`
          *,
          patients (
            id,
            nom,
            prenom,
            date_naissance,
            sexe,
            telephone,
            email,
            numero_dossier,
            adresse,
            assurances (
              nom,
              taux_remboursement
            )
          ),
          users (
            id,
            nom,
            prenom,
            specialite,
            telephone,
            email
          )
        `)
        .eq('id', consultationId)
        .single();

      if (consultationError) throw consultationError;

      if (!consultationData) {
        throw new Error('Consultation non trouvée');
      }

      // Vérifier que la consultation est terminée
      if (consultationData.statut !== 'terminee') {
        setError('Cette consultation n\'est pas encore terminée');
        setLoading(false);
        return;
      }

      setConsultation(consultationData);
      setPatient(consultationData.patients);
      setMedecin(consultationData.users);

      // Charger les actes, ordonnances, certificats en parallèle
      await Promise.all([
        fetchActes(),
        fetchOrdonnances(),
        fetchCertificats(),
        fetchFacture()
      ]);

      setLoading(false);
    } catch (err) {
      console.error('❌ Erreur chargement consultation:', err);
      setError(err.message || 'Erreur lors du chargement de la consultation');
      setLoading(false);
    }
  };

  const fetchActes = async () => {
    try {
      const { data, error } = await supabase
        .from('actes_consultation')
        .select(`
          *,
          types_actes (
            nom,
            description,
            tarif_defaut
          )
        `)
        .eq('consultation_id', consultationId);

      if (error) throw error;
      setActes(data || []);
      console.log('✅ Actes chargés:', data?.length || 0);
    } catch (err) {
      console.error('❌ Erreur chargement actes:', err);
    }
  };

  const fetchOrdonnances = async () => {
    try {
      const { data, error } = await supabase
        .from('ordonnances')
        .select(`
          *,
          lignes_ordonnance (
            *,
            medicaments (
              nom,
              posologie_defaut
            )
          )
        `)
        .eq('consultation_id', consultationId);

      if (error) throw error;
      setOrdonnances(data || []);
      console.log('✅ Ordonnances chargées:', data?.length || 0);
    } catch (err) {
      console.error('❌ Erreur chargement ordonnances:', err);
    }
  };

  const fetchCertificats = async () => {
    try {
      const { data, error } = await supabase
        .from('certificats_medicaux')
        .select(`
          *,
          types_certificats (
            nom,
            description
          )
        `)
        .eq('consultation_id', consultationId);

      if (error) throw error;
      setCertificats(data || []);
      console.log('✅ Certificats chargés:', data?.length || 0);
    } catch (err) {
      console.error('❌ Erreur chargement certificats:', err);
    }
  };

  const fetchFacture = async () => {
    try {
      console.log('🔄 [Facture] Début récupération facture pour consultation:', consultationId);
      
      // Récupérer la facture (sans .single() pour éviter l'erreur 406 si aucune facture)
      console.log('📋 [Facture] Requête factures pour consultation_id:', consultationId);
      const { data: facturesData, error: factureError } = await supabase
        .from('factures')
        .select('*')
        .eq('consultation_id', consultationId);

      console.log('📊 [Facture] Résultat requête factures:', {
        data: facturesData,
        error: factureError,
        count: facturesData?.length || 0
      });

      if (factureError) {
        console.error('❌ [Facture] Erreur récupération factures:', factureError);
        throw factureError;
      }

      if (!facturesData || facturesData.length === 0) {
        console.log('ℹ️ [Facture] Aucune facture trouvée pour consultation:', consultationId);
        return; // Pas de facture trouvée
      }

      const factureData = facturesData[0]; // Prendre la première facture
      console.log('✅ [Facture] Facture trouvée:', {
        id: factureData.id,
        numero: factureData.numero_facture,
        montant_ttc: factureData.montant_ttc
      });

      // Récupérer les lignes de facture séparément
      console.log('📋 [Facture] Récupération lignes pour facture_id:', factureData.id);
      const { data: lignesData, error: lignesError } = await supabase
        .from('lignes_facture')
        .select('*')
        .eq('facture_id', factureData.id);

      console.log('📊 [Facture] Résultat requête lignes:', {
        data: lignesData,
        error: lignesError,
        count: lignesData?.length || 0
      });

      if (lignesError) {
        console.error('❌ [Facture] Erreur chargement lignes facture:', lignesError);
        // Ne pas throw, continuer sans les lignes
      }

      // Si des lignes ont un acte_consultation_id, charger les détails des actes
      const lignesAvecActes = lignesData?.filter(l => l.acte_consultation_id) || [];
      console.log('📊 [Facture] Lignes avec actes:', lignesAvecActes.length);
      
      let actesData = null;
      if (lignesAvecActes.length > 0) {
        const acteIds = lignesAvecActes.map(l => l.acte_consultation_id);
        console.log('📋 [Facture] Récupération actes pour IDs:', acteIds);
        
        const { data: actes, error: actesError } = await supabase
          .from('actes_consultation')
          .select(`
            *,
            types_actes (
              nom,
              description
            )
          `)
          .in('id', acteIds);

        console.log('📊 [Facture] Résultat requête actes:', {
          data: actes,
          error: actesError,
          count: actes?.length || 0
        });

        if (actesError) {
          console.warn('⚠️ [Facture] Erreur chargement actes:', actesError);
        } else {
          actesData = actes;
        }
      }

      // Construire l'objet facture avec les lignes enrichies
      const facture = {
        ...factureData,
        lignes_facture: (lignesData || []).map(ligne => {
          if (ligne.acte_consultation_id && actesData) {
            const acte = actesData.find(a => a.id === ligne.acte_consultation_id);
            return {
              ...ligne,
              actes_consultation: acte
            };
          }
          return ligne;
        })
      };

      console.log('✅ [Facture] Facture complète construite:', {
        id: facture.id,
        numero: facture.numero_facture,
        lignes_count: facture.lignes_facture?.length || 0
      });

      setFacture(facture);
      setInvoiceGenerated(true);
      console.log('✅ [Facture] Facture chargée avec succès');
    } catch (err) {
      console.error('❌ [Facture] Erreur chargement facture:', err);
      console.error('❌ [Facture] Détails erreur:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      });
    }
  };

  // Calculer le total des actes
  const calculateActesTotal = () => {
    return actes.reduce((total, acte) => {
      const montant = acte.montant_total || (acte.tarif_unitaire * (acte.quantite || 1));
      return total + (parseFloat(montant) || 0);
    }, 0);
  };

  // Calculer le total général
  const calculateTotal = () => {
    return parseFloat(prixConsultation) + calculateActesTotal();
  };

  // Générer la facture
  const generateInvoice = async () => {
    try {
      setGeneratingInvoice(true);

      // const totalActes = calculateActesTotal(); // Unused
      const totalGeneral = calculateTotal();

      // Créer la facture (sans montant_restant car c'est une colonne générée)
      console.log('🔄 [Facture] Génération facture pour consultation:', consultationId);
      const { data: factureData, error: factureError } = await supabase
        .from('factures')
        .insert({
          consultation_id: consultationId,
          patient_id: patient.id,
          numero_facture: `FAC-${Date.now()}`,
          date_facture: new Date().toISOString().split('T')[0],
          montant_ht: totalGeneral,
          tva: 0,
          montant_ttc: totalGeneral,
          montant_paye: 0,
          // montant_restant est une colonne générée, ne pas l'insérer
          statut_paiement: 'en_attente',
          assurance_id: patient.assurances?.id || null
        })
        .select()
        .single();

      if (factureError) {
        console.error('❌ [Facture] Erreur création facture:', factureError);
        throw factureError;
      }

      console.log('✅ [Facture] Facture créée:', factureData.id);

      // Créer les lignes de facture
      const lignesFacture = [];

      // Ligne pour la consultation
      if (prixConsultation > 0) {
        lignesFacture.push({
          facture_id: factureData.id,
          description: 'Consultation médicale',
          quantite: 1,
          prix_unitaire: prixConsultation
          // montant_ligne est une colonne générée, ne pas l'insérer
        });
      }

      // Lignes pour les actes
      actes.forEach((acte) => {
        lignesFacture.push({
          facture_id: factureData.id,
          acte_consultation_id: acte.id,
          description: acte.types_actes?.nom || 'Acte médical',
          quantite: acte.quantite || 1,
          prix_unitaire: acte.tarif_unitaire
          // montant_ligne est une colonne générée, ne pas l'insérer
        });
      });

      console.log('📋 [Facture] Lignes à insérer:', lignesFacture.length);

      // Insérer les lignes de facture
      if (lignesFacture.length > 0) {
        console.log('📋 [Facture] Insertion des lignes de facture...');
        const { error: lignesError } = await supabase
          .from('lignes_facture')
          .insert(lignesFacture);

        if (lignesError) {
          console.error('❌ [Facture] Erreur insertion lignes:', lignesError);
          throw lignesError;
        }
        console.log('✅ [Facture] Lignes insérées avec succès');
      }

      // Recharger la facture avec les lignes
      await fetchFacture();
      
      unifiedNotificationService.success('Facture générée avec succès !');
    } catch (err) {
      console.error('❌ Erreur génération facture:', err);
      unifiedNotificationService.error('Erreur lors de la génération de la facture: ' + err.message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handlePrintOrdonnances = async () => {
    const { success, error } = await printOrdonnances(supabase, ordonnances, patient, medecin, consultation, tenantId);
    if (!success) {
      unifiedNotificationService.error(`Erreur lors de l'impression des ordonnances: ${error}`);
    }
  };

  const handlePrintCertificats = async () => {
    const { success, error } = await generateCertificatsPDF(supabase, certificats, patient, medecin, tenantId);
    if (!success) {
      unifiedNotificationService.error(`Erreur lors de l'impression des certificats: ${error}`);
    }
  };

  const handlePrintFacture = async () => {
    const { success, error } = await printFacture(supabase, facture, patient, medecin, tenantId);
    if (!success) {
      unifiedNotificationService.error(`Erreur lors de l'impression de la facture: ${error}`);
    }
  };

  // Planifier un rendez-vous à partir de la date de suivi d'une ordonnance
  const handleCreateAppointmentFromOrdonnance = async (ordonnance) => {
    if (!ordonnance.prochain_rdv || !patient || !medecin) {
      unifiedNotificationService.error('Données manquantes pour planifier le rendez-vous');
      return;
    }

    setCreatingAppointment(true);
    try {
      // Parser la date de suivi (peut être une date ou un texte comme "Dans 7 jours")
      let appointmentDate = null;
      const prochainRdvText = ordonnance.prochain_rdv.toLowerCase().trim();
      
      // Essayer de parser différentes formats
      if (prochainRdvText.includes('dans')) {
        // Format "Dans X jours"
        const daysMatch = prochainRdvText.match(/dans\s+(\d+)\s+jour/i);
        if (daysMatch) {
          const days = parseInt(daysMatch[1]);
          appointmentDate = new Date();
          appointmentDate.setDate(appointmentDate.getDate() + days);
        }
      } else if (prochainRdvText.includes('semaine')) {
        // Format "Dans X semaines"
        const weeksMatch = prochainRdvText.match(/dans\s+(\d+)\s+semaine/i);
        if (weeksMatch) {
          const weeks = parseInt(weeksMatch[1]);
          appointmentDate = new Date();
          appointmentDate.setDate(appointmentDate.getDate() + (weeks * 7));
        }
      } else {
        // Essayer de parser comme une date
        const parsedDate = new Date(ordonnance.prochain_rdv);
        if (!isNaN(parsedDate.getTime())) {
          appointmentDate = parsedDate;
        }
      }

      // Si on n'a pas pu parser, utiliser une date par défaut (7 jours)
      if (!appointmentDate) {
        appointmentDate = new Date();
        appointmentDate.setDate(appointmentDate.getDate() + 7);
      }

      // Définir l'heure par défaut (9h00)
      appointmentDate.setHours(9, 0, 0, 0);

      // Créer le rendez-vous
      const appointmentData = {
        patient_id: patient.id,
        medecin_id: medecin.id,
        date_heure: appointmentDate.toISOString(),
        motif: `Suivi - ${ordonnance.prochain_rdv}`,
        duree: 30,
        statut: 'confirme',
        priorite: 'normale',
        notes: `Rendez-vous de suivi créé depuis l'ordonnance ${ordonnance.numero_ordonnance}`,
        type_rdv: 'suivi',
        created_at: new Date().toISOString()
      };

      const { data: newAppointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select()
        .single();

      if (appointmentError) {
        console.error('❌ Erreur création rendez-vous:', appointmentError);
        throw appointmentError;
      }

      // Ajouter à la file d'attente si nécessaire
      try {
        const { data: currentQueue } = await supabase
          .from('waiting_queue')
          .select('order_position')
          .eq('medecin_id', medecin.id)
          .order('order_position', { ascending: false })
          .limit(1);

        const nextPosition = currentQueue && currentQueue.length > 0 
          ? currentQueue[0].order_position + 1 
          : 1;

        await supabase
          .from('waiting_queue')
          .insert([{
            patient_id: patient.id,
            medecin_id: medecin.id,
            appointment_id: newAppointment.id,
            status: 'waiting',
            priority: 'normale',
            arrived_at: new Date().toISOString(),
            order_position: nextPosition
          }]);
      } catch (queueError) {
        console.warn('⚠️ Erreur ajout file d\'attente (non bloquant):', queueError);
      }

      unifiedNotificationService.success(
        `Rendez-vous créé pour le ${appointmentDate.toLocaleDateString('fr-FR')} à ${appointmentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      );

      // Rediriger vers la page de rendez-vous ou rafraîchir
      setTimeout(() => {
        navigate('/rendez-vous');
      }, 1500);

    } catch (err) {
      console.error('❌ Erreur création rendez-vous:', err);
      unifiedNotificationService.error('Erreur lors de la création du rendez-vous: ' + (err.message || err));
    } finally {
      setCreatingAppointment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-violet-500 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Chargement des données de consultation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-[20px] shadow-sm p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Erreur</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/secretary-dashboard')}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const actesTotal = calculateActesTotal();
  const total = calculateTotal();
  const patientInitials = `${patient?.prenom?.[0] || ''}${patient?.nom?.[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 px-6 sm:px-10 py-8 pb-14 font-sans">
      <div className="max-w-[1180px] mx-auto">
        {/* En-tête */}
        <button
          onClick={() => navigate('/secretary-dashboard')}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
        </button>

        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-gray-900 tracking-tight">Clôture de consultation</h1>
            <p className="mt-1 text-[13px] text-gray-500">
              Consultation du {new Date(consultation.date_consultation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · N° {consultationId}
            </p>
          </div>
          <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-700 rounded-full text-xs font-medium">
            Terminée
          </span>
        </div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          {/* Colonne principale - Détails */}
          <div className="flex flex-col gap-5">
            {/* Informations patient et médecin */}
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
              <p className="m-0 mb-4 text-[11px] font-semibold tracking-[.12em] uppercase text-zinc-400 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-violet-700" strokeWidth={1.5} />
                Informations
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-400 text-white flex items-center justify-center text-sm font-semibold flex-none">
                    {patientInitials || '—'}
                  </div>
                  <div>
                    <p className="m-0 text-sm font-semibold text-gray-900">{patient?.prenom} {patient?.nom}</p>
                    <p className="mt-0.5 text-xs text-gray-500">Dossier {patient?.numero_dossier}</p>
                    {patient?.assurances && (
                      <p className="mt-0.5 text-xs text-gray-500">{patient.assurances.nom}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="m-0 mb-1 text-[11px] text-gray-400">Médecin</p>
                  <p className="m-0 text-[13.5px] font-medium text-gray-900">{medecin?.prenom} {medecin?.nom}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{formatDoctorSpecialties(medecin)}</p>
                </div>
              </div>
            </div>

            {/* Actes de consultation */}
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
              <div className="px-[22px] py-4 border-b border-gray-100 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-700" strokeWidth={1.5} />
                <p className="m-0 text-[13px] font-semibold text-gray-900">Actes de consultation</p>
              </div>
              {actes.length > 0 ? (
                actes.map((acte) => (
                  <div key={acte.id} className="flex justify-between items-center px-[22px] py-3.5 border-b border-gray-100 last:border-b-0">
                    <div>
                      <p className="m-0 text-[13.5px] font-medium text-gray-900">{acte.types_actes?.nom || 'Acte'}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {acte.types_actes?.description}{acte.types_actes?.description ? ' · ' : ''}Quantité : {acte.quantite || 1}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="m-0 text-[13.5px] font-semibold text-emerald-700">
                        {formatMontant(acte.montant_total || (acte.tarif_unitaire * (acte.quantite || 1)))}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-gray-400">
                        {formatMontant(acte.tarif_unitaire)} / unité
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm text-center py-6">Aucun acte enregistré</p>
              )}
            </div>

            {/* Ordonnances */}
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
              <div className="px-[22px] py-4 border-b border-gray-100 flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5 text-violet-700" strokeWidth={1.5} />
                <p className="m-0 text-[13px] font-semibold text-gray-900">Ordonnances ({ordonnances.length})</p>
              </div>
              {ordonnances.length > 0 ? (
                ordonnances.map((ordonnance) => (
                  <div key={ordonnance.id} className="px-[22px] py-4 border-b border-gray-100 last:border-b-0">
                    <p className="m-0 text-[13.5px] font-semibold text-gray-900">Ordonnance #{ordonnance.numero_ordonnance}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ordonnance.lignes_ordonnance?.length || 0} médicament(s) · {new Date(ordonnance.date_prescription).toLocaleDateString('fr-FR')}
                    </p>
                    {ordonnance.prochain_rdv && (
                      <div className="mt-2.5 px-3 py-2.5 bg-violet-50 border border-violet-100 rounded-xl">
                        <div className="flex items-center gap-1.5 text-xs text-violet-700">
                          <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="font-semibold">Suivi :</span> {ordonnance.prochain_rdv}
                        </div>
                        <button
                          onClick={() => handleCreateAppointmentFromOrdonnance(ordonnance)}
                          disabled={creatingAppointment}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white rounded-[9px] text-[11.5px] font-medium hover:bg-violet-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {creatingAppointment ? (
                            <>
                              <Loader className="w-3 h-3 animate-spin" />
                              Création...
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              Planifier rendez-vous
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm text-center py-6">Aucune ordonnance</p>
              )}
            </div>
          </div>

          {/* Colonne latérale - Facturation et Actions */}
          <div className="flex flex-col gap-5">
            {/* Section Facturation */}
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
              <p className="m-0 mb-4 text-[11px] font-semibold tracking-[.12em] uppercase text-zinc-400 flex items-center gap-2">
                <File className="w-3.5 h-3.5 text-orange-700" strokeWidth={1.5} />
                Facturation
              </p>

              {invoiceGenerated && facture ? (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3.5 mb-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-[15px] h-[15px] text-emerald-600" strokeWidth={1.5} />
                      <span className="text-[13px] font-semibold text-emerald-800">Facture générée</span>
                    </div>
                    <p className="m-0 text-xs text-emerald-700">
                      N° {facture.numero_facture} · {new Date(facture.date_facture).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {facture.lignes_facture && facture.lignes_facture.length > 0 && (
                    <div className="flex flex-col gap-2 pb-3.5 border-b border-gray-100 mb-3.5">
                      {facture.lignes_facture.map((ligne, idx) => (
                        <div key={idx} className="flex justify-between text-[13px]">
                          <span className="text-gray-600">{ligne.description}</span>
                          <span className="font-semibold text-gray-900">{formatMontant(ligne.montant_ligne)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handlePrintFacture}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-medium hover:bg-gray-800"
                  >
                    <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Imprimer la facture
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Prix de la consultation (F CFA)
                  </label>
                  <input
                    type="text"
                    value={new Intl.NumberFormat('fr-FR', {
                      maximumFractionDigits: 0,
                      useGrouping: true
                    }).format(prixConsultation).replace(/\u00A0/g, ' ')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\s/g, '');
                      const numValue = parseFloat(value) || 0;
                      setPrixConsultation(numValue);
                    }}
                    className="w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-[13.5px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                    placeholder="0"
                  />

                  <div className="flex flex-col gap-2 mt-4 pt-3.5 border-t border-gray-100">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-gray-500">Consultation</span>
                      <span className="text-gray-900">{formatMontant(prixConsultation)}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-gray-500">Actes ({actes.length})</span>
                      <span className="text-gray-900">{formatMontant(actesTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-gray-900">{formatMontant(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={generateInvoice}
                    disabled={generatingInvoice || total === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-4 bg-violet-500 text-white rounded-xl text-[13px] font-medium hover:bg-violet-600 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(139,92,246,.35)]"
                  >
                    {generatingInvoice ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Générer la facture
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Section Impression */}
            {(ordonnances.length > 0 || certificats.length > 0) && (
              <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
                <p className="m-0 mb-3.5 text-[11px] font-semibold tracking-[.12em] uppercase text-zinc-400 flex items-center gap-2">
                  <Printer className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.5} />
                  Impression
                </p>
                <div className="flex flex-col gap-2.5">
                  {ordonnances.length > 0 && (
                    <button
                      onClick={handlePrintOrdonnances}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-50 text-violet-700 rounded-xl text-[13px] font-medium hover:bg-violet-100"
                    >
                      <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Imprimer ordonnance(s)
                    </button>
                  )}
                  {certificats.length > 0 && (
                    <button
                      onClick={handlePrintCertificats}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-[13px] font-medium hover:bg-gray-200"
                    >
                      <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Imprimer certificat(s)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultationCompletion;

