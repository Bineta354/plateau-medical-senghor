import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService, appointmentService } from '../../lib/services';
import * as consultationService from '../../services/consultation/consultationService';
import { getDossierMedical } from '../../services/consultation/dossierMedicalService';
import { getReferenceData } from '../../services/consultation/referenceDataService';
import documentUploadService from '../../services/documentUploadService';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import AntecedentsMedicaux from '../../components/consultation/AntecedentsMedicaux';
import PatientDocumentsViewer from '../../components/doctor/PatientDocumentsViewer';
import PatientDocumentUploader from '../../components/secretary/PatientDocumentUploader';
import {
  ArrowLeft,
  Edit,
  Calendar,
  Phone,
  AlertCircle,
  Stethoscope,
  Plus,
  Camera,
  Loader
} from 'lucide-react';

// Bucket Supabase Storage dédié à la photo patient — à créer une fois via
// supabase/create_patient_photos_bucket.sql (public, images uniquement, 5 Mo max).
const PATIENT_PHOTOS_BUCKET = 'patient-photos';

const PatientDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('apercu');

  // Dossier médical réel du patient (antécédents, consultations passées,
  // traitements en cours...) — mêmes services que ConsultationDetail.jsx,
  // voir Devin_pages_reference/DEVIN_IMPLEMENTATION_PAGES_REFERENCE.md.
  const [antecedents, setAntecedents] = useState([]);
  const [antecedentsRef, setAntecedentsRef] = useState([]);
  const [consultationsPassees, setConsultationsPassees] = useState([]);
  const [traitementsCours, setTraitementsCours] = useState([]);
  const [latestConstantes, setLatestConstantes] = useState([]);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (id) {
      loadPatient();
    }
  }, [id]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const data = await patientService.getByIdWithAssurance(id);
      setPatient(data);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setError('Erreur lors du chargement du patient');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patient?.id) {
      loadDossierMedical(patient.id);
    }
  }, [patient?.id]);

  // Upload de la photo patient — même schéma que Profile.jsx (handlePhotoUpload
  // pour users.photo_url), appliqué à patients.photo_url. Nécessite le bucket
  // Supabase Storage `patient-photos` (voir supabase/create_patient_photos_bucket.sql).
  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (!file.type.startsWith('image/')) {
      unifiedNotificationService.error('Veuillez sélectionner une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      unifiedNotificationService.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setUploadingPhoto(true);
    try {
      const result = await documentUploadService.uploadFile(PATIENT_PHOTOS_BUCKET, file, {
        folder: `patient-${id}`,
        upsert: true
      });

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de l'upload");
      }

      const photoUrl = result.data.publicUrl;
      const updated = await patientService.update(id, { photo_url: photoUrl });
      setPatient((prev) => ({ ...prev, photo_url: updated?.photo_url || photoUrl }));
      unifiedNotificationService.success('Photo du patient mise à jour');
    } catch (error) {
      console.error('Erreur lors de l\'upload de la photo patient:', error);
      unifiedNotificationService.error(
        `Erreur lors de l'upload de la photo — vérifiez que le bucket "${PATIENT_PHOTOS_BUCKET}" existe (voir supabase/create_patient_photos_bucket.sql)`
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fetchAntecedents = async (patientId) => {
    setAntecedents(await consultationService.getAntecedents(patientId));
  };

  const loadDossierMedical = async (patientId) => {
    try {
      // 0 : aucune consultation à exclure ici (getDossierMedical est aussi
      // utilisé par la page consultation, qui exclut la consultation en cours).
      const [antecedentsData, dossier, refData, appointmentsData] = await Promise.all([
        consultationService.getAntecedents(patientId),
        getDossierMedical(patientId, 0),
        getReferenceData(null),
        appointmentService.getByPatient(patientId)
      ]);

      setAntecedents(antecedentsData || []);
      setAntecedentsRef(refData?.antecedentsRef || []);
      setConsultationsPassees(dossier?.consultationsPassees || []);
      setTraitementsCours(dossier?.traitementsCours || []);

      const now = new Date();
      const upcoming = (appointmentsData || [])
        .filter((a) => a.statut !== 'annule' && new Date(a.date_heure) >= now)
        .sort((a, b) => new Date(a.date_heure) - new Date(b.date_heure));
      setNextAppointment(upcoming[0] || null);

      const latestConsultationId = dossier?.consultationsPassees?.[0]?.id;
      if (latestConsultationId) {
        setLatestConstantes(await consultationService.getConstantes(latestConsultationId));
      } else {
        setLatestConstantes([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du dossier médical:', error);
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

  // Ouvre la page Consultations avec ce patient préselectionné et le modal de
  // création déjà ouvert (voir Consultations.jsx, même schéma que le
  // ?patientId= de "Prise RDV" ci-dessus).
  const handleStartConsultation = () => {
    navigate(`/consultations?patientId=${id}`);
  };

  const getTabStyle = (tabName) => {
    const baseStyle = 'padding:10px 2px;border:0;background:transparent;font-size:14px;cursor:pointer;font-family:inherit;border-bottom:2px solid ';
    return activeTab === tabName
      ? baseStyle + '#0f172a;color:#0f172a;font-weight:700'
      : baseStyle + 'transparent;color:#94a3b8;font-weight:500';
  };

  const getConsultationStatusStyle = (statut) => {
    switch (statut) {
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

  // Détecter le type de couverture du patient — même logique que l'ancienne
  // version de cette page (voir commits "Corrige la récupération de l'assurance
  // du patient" / "Affiche l'assurance dans la fiche patient"), pour ne pas
  // faire disparaître le fallback "legacy" (nom_assurance) des patients dont
  // l'assurance n'a pas encore été migrée vers la table `assurances`.
  const getTypeCouverture = () => {
    if (patient?.assurance_id && patient?.assurances) return 'assurance';
    if (patient?.nom_assurance) return 'legacy';
    return null;
  };

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

  const typeCouverture = getTypeCouverture();
  const dernierTraitement = traitementsCours[0];
  const dernierTraitementMedicament = dernierTraitement?.lignes_ordonnance?.[0];
  const derniereConsultation = consultationsPassees[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 flex-wrap">
          <button type="button" onClick={handleBack} className="text-gray-500 hover:text-gray-900 bg-transparent border-0 p-0 cursor-pointer">Patients</button>
          <ArrowLeft className="w-4 h-4" />
          <span className="text-gray-900 font-medium">{patient?.prenom} {patient?.nom}</span>
          <span className="text-gray-300">•</span>
          <span>{patient?.numero_dossier}</span>
        </div>

        {/* Patient Header Card */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white p-7 mb-4">
          <div className="flex items-start gap-7 flex-wrap">
            {/* Photo patient — patients.photo_url, uploadée vers le bucket Storage
                `patient-photos` (voir supabase/create_patient_photos_bucket.sql). */}
            <div className="relative w-32 h-40 flex-shrink-0 rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 overflow-hidden group">
              {patient?.photo_url ? (
                <img src={patient.photo_url} alt={`${patient.prenom} ${patient.nom}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xs font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded text-center">
                    Aucune photo
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                title={patient?.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors cursor-pointer border-0"
              >
                {uploadingPhoto ? (
                  <Loader className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {/* Patient Info */}
            <div className="flex-1 min-w-72">
              <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-slate-200 text-xs font-medium">
                  Dossier créé le {formatDate(patient?.created_at)}
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight mb-4">{patient?.prenom} {patient?.nom}</h1>
              <div className="flex gap-7 flex-wrap">
                <div>
                  <p className="text-xs tracking-widest uppercase text-slate-400">Âge</p>
                  <p className="text-lg font-semibold mt-0.5">{calculateAge(patient?.date_naissance)}</p>
                </div>
                <div>
                  <p className="text-xs tracking-widest uppercase text-slate-400">Née le</p>
                  <p className="text-lg font-semibold mt-0.5">{formatDate(patient?.date_naissance)}</p>
                </div>
                <div>
                  <p className="text-xs tracking-widest uppercase text-slate-400">Sexe</p>
                  <p className="text-lg font-semibold mt-0.5">{patient?.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                </div>
                <div>
                  <p className="text-xs tracking-widest uppercase text-slate-400">Dossier</p>
                  <p className="text-lg font-semibold mt-0.5">{patient?.numero_dossier}</p>
                </div>
                <div>
                  <p className="text-xs tracking-widest uppercase text-slate-400">Téléphone</p>
                  <p className="text-lg font-semibold mt-0.5">{patient?.telephone || '-'}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 min-w-48">
              <button
                onClick={handleStartConsultation}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border-0 rounded-xl bg-white text-slate-900 text-sm font-semibold cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <Stethoscope className="w-4 h-4" />
                Démarrer une consultation
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleNewAppointment}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border border-white/25 rounded-xl bg-white/10 text-white text-sm font-medium cursor-pointer hover:bg-white/20 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  RDV
                </button>
                <button
                  onClick={handleEdit}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border border-white/25 rounded-xl bg-white/10 text-white text-sm font-medium cursor-pointer hover:bg-white/20 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Modifier
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs tracking-widest uppercase text-slate-400 font-semibold">Groupe sanguin</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1.5">{patient?.groupe_sanguin || 'Non renseigné'}</p>
          </div>

          <div className={`rounded-xl p-4 border ${patient?.allergies ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
            <p className={`text-xs tracking-widest uppercase font-bold flex items-center gap-1.5 ${patient?.allergies ? 'text-red-700' : 'text-slate-400'}`}>
              <AlertCircle className="w-3.5 h-3.5" />
              Allergies
            </p>
            <p className={`text-sm font-semibold mt-1.5 leading-relaxed ${patient?.allergies ? 'text-red-900' : 'text-slate-500'}`}>
              {patient?.allergies || 'Aucune allergie connue'}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs tracking-widest uppercase text-slate-400 font-semibold">Traitement en cours</p>
            {dernierTraitement ? (
              <>
                <p className="text-base font-bold text-slate-900 mt-1.5">
                  {dernierTraitementMedicament?.medicament?.nom || dernierTraitement.numero_ordonnance || 'Ordonnance active'}
                </p>
                {dernierTraitementMedicament?.posologie && (
                  <p className="text-sm text-slate-600 mt-0.5">{dernierTraitementMedicament.posologie}</p>
                )}
                <p className="text-xs text-slate-500 mt-1.5">Prescrit le {formatDate(dernierTraitement.date_prescription)}</p>
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-1.5">Aucun traitement actif</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs tracking-widest uppercase text-slate-400 font-semibold">Couverture santé</p>
            {typeCouverture === 'assurance' ? (
              <>
                <span className={`inline-block mt-1.5 px-2 py-0.5 ${getAssuranceTypeBadge(patient.assurances.type_assurance).color} text-white text-[10px] font-bold rounded-full`}>
                  {getAssuranceTypeBadge(patient.assurances.type_assurance).label}
                </span>
                <p className="text-base font-bold text-slate-900 mt-1.5">{patient.assurances.nom}</p>
                {patient.assurances.taux_remboursement > 0 && (
                  <div className="flex items-center gap-2.5 mt-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${patient.assurances.taux_remboursement}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-green-600">{patient.assurances.taux_remboursement}%</span>
                  </div>
                )}
                {patient.numero_assurance && (
                  <p className="text-xs text-slate-500 mt-1.5">N° {patient.numero_assurance}</p>
                )}
              </>
            ) : typeCouverture === 'legacy' ? (
              <>
                <p className="text-base font-bold text-slate-900 mt-1.5">{patient.nom_assurance}</p>
                {patient.numero_assurance && <p className="text-xs text-slate-500 mt-1">N° {patient.numero_assurance}</p>}
                <p className="text-xs text-amber-600 mt-1.5">⚠️ Ancien système — à mettre à jour</p>
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-1.5">Aucune couverture santé enregistrée</p>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex gap-6 items-start flex-wrap">
          {/* Main Content */}
          <div className="flex-1 min-w-0 lg:min-w-96">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-5">
              <nav className="flex gap-7 flex-wrap mb-[-1px]">
                <button
                  onClick={() => setActiveTab('apercu')}
                  style={getTabStyle('apercu')}
                >
                  Aperçu
                </button>
                <button
                  onClick={() => setActiveTab('antecedents')}
                  style={getTabStyle('antecedents')}
                >
                  Antécédents
                </button>
                <button
                  onClick={() => setActiveTab('consultations')}
                  style={getTabStyle('consultations')}
                >
                  Consultations
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  style={getTabStyle('documents')}
                >
                  Documents
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'apercu' && (
              <div className="flex flex-col gap-4">
                {/* Civil State */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-base font-bold text-slate-900 mb-3.5">État civil et coordonnées</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Lieu de naissance</p>
                      <p className="text-sm text-slate-900 mt-0.5">{patient?.lieu_naissance || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Nationalité</p>
                      <p className="text-sm text-slate-900 mt-0.5">{patient?.nationalite || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Situation familiale</p>
                      <p className="text-sm text-slate-900 mt-0.5">{patient?.situation_familiale || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Profession</p>
                      <p className="text-sm text-slate-900 mt-0.5">{patient?.profession || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Email</p>
                      <p className="text-sm text-slate-900 mt-0.5">{patient?.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Adresse</p>
                      <p className="text-sm text-slate-900 mt-0.5">{patient?.adresse || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Vital Signs — constantes de la dernière consultation enregistrée */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-base font-bold text-slate-900 mb-3.5">
                    Dernières constantes
                    {derniereConsultation && (
                      <span className="font-normal text-slate-400"> — relevées le {formatDate(derniereConsultation.date_consultation)}</span>
                    )}
                  </h3>
                  {latestConstantes.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {latestConstantes.map((c) => (
                        <div key={c.id} className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs text-slate-400">{c.constantes?.nom || '-'}</p>
                          <p className="text-xl font-bold mt-1">
                            {c.valeur_mesuree ?? '-'}{c.unite ? ` ${c.unite}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Aucune constante enregistrée pour ce patient.</p>
                  )}
                </div>

                {/* Notes */}
                {patient?.notes && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-900 mb-3.5">Notes du praticien</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{patient.notes}</p>
                    <p className="text-xs text-slate-400 mt-3">Mis à jour le {formatDate(patient.updated_at)}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'antecedents' && (
              <AntecedentsMedicaux
                antecedents={antecedents}
                fetchAntecedents={fetchAntecedents}
                antecedentsRef={antecedentsRef}
                patient={patient}
                isTerminated={false}
              />
            )}

            {activeTab === 'consultations' && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4.5 py-3.5 border-b border-gray-200">
                  <p className="text-sm text-slate-500">{consultationsPassees.length} consultation(s) — cliquez pour ouvrir le dossier</p>
                </div>
                {consultationsPassees.length > 0 ? consultationsPassees.map((consultation) => (
                  <button
                    key={consultation.id}
                    onClick={() => navigate(`/consultation/${consultation.id}`)}
                    className={`w-full flex items-center gap-4 px-4.5 py-4 border-b border-slate-100 border-0 text-left cursor-pointer ${
                      consultation.statut === 'en_cours' ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-13 flex-shrink-0 text-center">
                      <span className="block text-xl font-extrabold text-slate-900">
                        {new Date(consultation.date_consultation).getDate()}
                      </span>
                      <span className="block text-xs text-slate-400 uppercase">
                        {new Date(consultation.date_consultation).toLocaleString('fr-FR', { month: 'short' })}
                      </span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{consultation.motif_consultation || 'Consultation'}</span>
                      <span className="block text-sm text-slate-600">
                        {consultation.medecin ? `Dr ${consultation.medecin.prenom} ${consultation.medecin.nom}` : 'Médecin non renseigné'}
                        {consultation.type_consultation && ` • ${consultation.type_consultation}`}
                      </span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${getConsultationStatusStyle(consultation.statut)}`}>
                      {(consultation.statut || 'terminee').replace('_', ' ').toUpperCase()}
                    </span>
                  </button>
                )) : (
                  <div className="p-6 text-center text-sm text-slate-500">Aucune consultation enregistrée pour ce patient.</div>
                )}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-gray-200 gap-3 flex-wrap">
                  <p className="text-sm text-slate-500">Documents du dossier patient</p>
                  <button
                    onClick={() => setShowUploader(true)}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 border-0 rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Déposer un document
                  </button>
                </div>
                <div className="p-4">
                  <PatientDocumentsViewer key={documentsRefreshKey} patient={patient} />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex-0 min-w-72 max-w-xs flex flex-col gap-4">
            {/* Next Appointment */}
            <div className="bg-slate-900 text-white rounded-xl p-4.5">
              <p className="text-xs tracking-widest uppercase text-slate-400 font-semibold">Prochain rendez-vous</p>
              {nextAppointment ? (
                <>
                  <p className="text-xl font-bold mt-2">
                    {new Date(nextAppointment.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    {' — '}
                    {new Date(nextAppointment.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    {nextAppointment.motif || 'Consultation'}
                    {nextAppointment.medecin && ` • Dr ${nextAppointment.medecin.prenom} ${nextAppointment.medecin.nom}`}
                  </p>
                  <button
                    onClick={handleNewAppointment}
                    className="w-full mt-3.5 py-2 border-0 rounded-lg bg-white text-slate-900 text-sm font-semibold cursor-pointer hover:bg-slate-100"
                  >
                    Gérer le rendez-vous
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 mt-2">Aucun rendez-vous à venir</p>
                  <button
                    onClick={handleNewAppointment}
                    className="w-full mt-3.5 py-2 border-0 rounded-lg bg-white text-slate-900 text-sm font-semibold cursor-pointer hover:bg-slate-100"
                  >
                    Prendre un rendez-vous
                  </button>
                </>
              )}
            </div>

            {/* Contact Person */}
            <div className="bg-white border border-gray-200 rounded-xl p-4.5">
              <h3 className="text-sm font-bold tracking-widest uppercase text-slate-400 mb-3">Personne à contacter</h3>
              <p className="text-base font-bold text-slate-900">{patient?.personne_contact || '-'}</p>
              <p className="text-sm text-slate-600 mt-0.5">{patient?.lien_contact || '-'}</p>
              {patient?.telephone_contact && (
                <a href={`tel:${patient.telephone_contact}`} className="flex items-center gap-2 mt-3 text-sm font-medium">
                  <Phone className="w-3.5 h-3.5" />
                  {patient.telephone_contact}
                </a>
              )}
            </div>

            {/* Footer */}
            <p className="text-xs text-slate-400 text-center">
              Créé le {formatDate(patient?.created_at)} • Modifié le {formatDate(patient?.updated_at)}
            </p>
          </aside>
        </div>
      </div>

      {showUploader && (
        <PatientDocumentUploader
          patient={patient}
          onClose={() => setShowUploader(false)}
          onUploadSuccess={() => {
            setShowUploader(false);
            setDocumentsRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
};

export default PatientDetailsPage;
