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
  Pill,
  Activity,
  Receipt,
  Printer,
  Save,
  CheckCircle,
  AlertCircle,
  Calendar,
  Loader,
  Plus
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
  const [prixConsultation, setPrixConsultation] = useState(0);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des données de consultation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Erreur</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/secretary-dashboard')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* En-tête */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/secretary-dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Retour à l'accueil
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Completion de Consultation</h1>
          <p className="text-gray-600 mt-2">
            Consultation du {new Date(consultation.date_consultation).toLocaleDateString('fr-FR')}
          </p>
        </div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale - Détails */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations patient et médecin */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Informations
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Patient</h3>
                  <p className="text-gray-900">{patient?.prenom} {patient?.nom}</p>
                  <p className="text-sm text-gray-600">Dossier: {patient?.numero_dossier}</p>
                  {patient?.assurances && (
                    <p className="text-sm text-gray-600">Assurance: {patient.assurances.nom}</p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Spécialité</h3>
                  <p className="text-gray-900">{formatDoctorSpecialties(medecin)}</p>
                </div>
              </div>
            </div>

            {/* Actes de consultation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-green-600" />
                Actes de Consultation
              </h2>
              {actes.length > 0 ? (
                <div className="space-y-3">
                  {actes.map((acte) => (
                    <div key={acte.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{acte.types_actes?.nom || 'Acte'}</p>
                          {acte.types_actes?.description && (
                            <p className="text-sm text-gray-600">{acte.types_actes.description}</p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">
                            Quantité: {acte.quantite || 1}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {formatMontant(acte.montant_total || (acte.tarif_unitaire * (acte.quantite || 1)))}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatMontant(acte.tarif_unitaire)} / unité
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun acte enregistré</p>
              )}
            </div>

            {/* Ordonnances */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Pill className="w-5 h-5 mr-2 text-purple-600" />
                Ordonnances ({ordonnances.length})
              </h2>
              {ordonnances.length > 0 ? (
                <div className="space-y-3">
                  {ordonnances.map((ordonnance) => (
                    <div key={ordonnance.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">Ordonnance #{ordonnance.numero_ordonnance}</p>
                          <p className="text-sm text-gray-600">
                            {ordonnance.lignes_ordonnance?.length || 0} médicament(s)
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Date: {new Date(ordonnance.date_prescription).toLocaleDateString('fr-FR')}
                          </p>
                          {ordonnance.prochain_rdv && (
                            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center text-sm text-blue-900">
                                <Calendar className="w-4 h-4 mr-2" />
                                <span className="font-medium">Date de suivi:</span>
                                <span className="ml-2">{ordonnance.prochain_rdv}</span>
                              </div>
                              <button
                                onClick={() => handleCreateAppointmentFromOrdonnance(ordonnance)}
                                disabled={creatingAppointment}
                                className="mt-2 flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {creatingAppointment ? (
                                  <>
                                    <Loader className="w-3 h-3 mr-1 animate-spin" />
                                    Création...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 mr-1" />
                                    Planifier rendez-vous
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune ordonnance</p>
              )}
            </div>
          </div>

          {/* Colonne latérale - Facturation et Actions */}
          <div className="space-y-6">
            {/* Section Facturation */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Receipt className="w-5 h-5 mr-2 text-orange-600" />
                Facturation
              </h2>

              {invoiceGenerated && facture ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="font-semibold text-green-900">Facture générée</span>
                    </div>
                    <p className="text-sm text-green-700">N° {facture.numero_facture}</p>
                    <p className="text-sm text-green-700">
                      Date: {new Date(facture.date_facture).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="border-t pt-4">
                    {facture.lignes_facture && facture.lignes_facture.length > 0 && (
                      <>
                        {facture.lignes_facture.map((ligne, idx) => (
                          <div key={idx} className="flex justify-between mb-2 text-sm">
                            <span>{ligne.description}:</span>
                            <span className="font-semibold">
                              {formatMontant(ligne.montant_total)}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <button
                    onClick={handlePrintFacture}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimer la facture
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prix de la consultation (FCFA)
                    </label>
                    <input
                      type="number"
                      value={prixConsultation}
                      onChange={(e) => setPrixConsultation(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Consultation:</span>
                      <span>{formatMontant(prixConsultation)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Actes ({actes.length}):</span>
                      <span>{formatMontant(calculateActesTotal())}</span>
                    </div>
                  </div>

                  <button
                    onClick={generateInvoice}
                    disabled={generatingInvoice || calculateTotal() === 0}
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {generatingInvoice ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Générer la facture
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Section Impression */}
            {(ordonnances.length > 0 || certificats.length > 0) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Printer className="w-5 h-5 mr-2 text-gray-600" />
                  Impression
                </h2>
                <div className="space-y-3">
                  {ordonnances.length > 0 && (
                    <button
                      onClick={handlePrintOrdonnances}
                      className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimer ordonnance(s)
                    </button>
                  )}
                  {certificats.length > 0 && (
                    <button
                      onClick={handlePrintCertificats}
                      className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Printer className="w-4 h-4 mr-2" />
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

