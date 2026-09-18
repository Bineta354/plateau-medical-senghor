import React, { useState, useEffect } from 'react';
import { User, FileText, Stethoscope, Image as ImageIcon, X, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { patientService } from '../../lib/services';
import AntecedentsMedicaux from './AntecedentsMedicaux';
import PatientDocumentsViewer from '../doctor/PatientDocumentsViewer';
import { buildAllergiesList } from '../../utils/patientAllergies';

const TABS = [
  { id: 'infos', label: 'Infos', icon: User },
  { id: 'antecedents', label: 'Antécédents', icon: FileText },
  { id: 'consultations', label: 'Consultations', icon: Stethoscope },
  { id: 'documents', label: 'Documents', icon: ImageIcon }
];

const STATUT_STYLES = {
  en_cours: { label: 'En consultation', className: 'bg-blue-100 text-blue-800', Icon: Clock },
  terminee: { label: 'Terminée', className: 'bg-green-100 text-green-800', Icon: CheckCircle }
};

const ASSURANCE_BADGES = {
  mutuelle: { label: 'MUTUELLE', color: 'bg-purple-600' },
  securite_sociale: { label: 'SÉCURITÉ SOCIALE', color: 'bg-blue-600' },
  privee: { label: 'ASSURANCE PRIVÉE', color: 'bg-green-600' },
  autre: { label: 'AUTRE', color: 'bg-gray-600' }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  const date = d.toLocaleDateString('fr-FR');
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${date} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : date;
};

const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-400 font-medium">{label}</p>
    <p className="text-sm text-slate-900 mt-0.5 break-words">{value || '-'}</p>
  </div>
);

const PatientFileModal = ({
  patient,
  consultation,
  antecedents,
  antecedentsRef,
  refetchAntecedents,
  consultationsPassees = [],
  traitementsCours = [],
  isTerminated,
  documentsRefreshKey,
  calculateAge,
  onClose,
  onUploadClick,
  onOpenConsultation
}) => {
  const [activeTab, setActiveTab] = useState('infos');
  // Le patient chargé avec la consultation ne porte que l'identité : coordonnées,
  // contact d'urgence et couverture sont lus ici, à l'ouverture du dossier.
  const [fullPatient, setFullPatient] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!patient?.id) return undefined;
    patientService
      .getByIdWithAssurance(patient.id)
      .then((data) => {
        if (!cancelled) setFullPatient(data);
      })
      .catch((error) => console.error('Erreur chargement dossier patient:', error));
    return () => {
      cancelled = true;
    };
  }, [patient?.id]);

  const p = { ...patient, ...(fullPatient || {}) };
  const allergies = buildAllergiesList(p, antecedents);
  const traitement = traitementsCours?.[0];
  const traitementMedicament = traitement?.lignes_ordonnance?.[0];
  const statut = STATUT_STYLES[consultation?.statut] || null;
  const assurance = fullPatient?.assurances || null;
  const badge = assurance ? ASSURANCE_BADGES[assurance.type_assurance] || { label: 'ASSURANCE', color: 'bg-green-600' } : null;

  const historique = [
    ...(consultation ? [consultation] : []),
    ...consultationsPassees.filter((c) => c.id !== consultation?.id)
  ];

  return (
    <div className="fixed inset-2.5 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative flex-1 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <User className="text-blue-600" />
              Dossier patient
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {p.prenom} {p.nom}
              {consultation?.date_consultation &&
                ` — consultation du ${new Date(consultation.date_consultation).toLocaleDateString('fr-FR')}`}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="p-2 border-0 bg-transparent rounded-lg cursor-pointer text-gray-600 hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 items-stretch overflow-hidden">
          <aside className="flex-none w-1/3 min-w-64 border-r border-gray-200 bg-gray-50 p-6 overflow-y-auto">
            <div className="w-full max-w-44 aspect-[4/5] rounded-xl border border-gray-200 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center mb-4">
              {p.photo_url ? (
                <img src={p.photo_url} alt={`${p.prenom} ${p.nom}`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-mono text-slate-500 bg-white/85 px-2 py-1 rounded">Aucune photo</span>
              )}
            </div>

            <h3 className="text-[22px] leading-7 font-bold text-gray-900">{p.prenom} {p.nom}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {p.date_naissance ? `${calculateAge(p.date_naissance)} ans` : '-'} • {p.sexe === 'M' ? 'Masculin' : 'Féminin'}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">Dossier: {p.numero_dossier}</p>
            {statut && (
              <div className="mt-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statut.className}`}>
                  <statut.Icon className="w-3.5 h-3.5" />
                  <span className="ml-1">{statut.label}</span>
                </span>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-gray-200 flex flex-col gap-3">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-600">Groupe sanguin</span>
                <span className="text-xl font-bold text-gray-900">{p.groupe_sanguin || 'Non renseigné'}</span>
              </div>

              <div className={`rounded-lg p-4 border ${allergies.length ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className={`w-5 h-5 ${allergies.length ? 'text-red-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-semibold uppercase tracking-wider ${allergies.length ? 'text-red-800' : 'text-slate-500'}`}>Allergies</span>
                </div>
                {allergies.length ? (
                  <ul className="list-disc pl-4 text-sm leading-relaxed text-red-800 space-y-0.5">
                    {allergies.map((a) => (
                      <li key={a.label}>
                        {a.label}
                        {a.detail ? ` (${a.detail})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Aucune allergie connue</p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-600">Traitement en cours</p>
                {traitement ? (
                  <p className="text-sm text-gray-900 mt-1">
                    {traitementMedicament?.medicament?.nom || traitement.numero_ordonnance || 'Ordonnance active'}
                    {traitementMedicament?.posologie && ` — ${traitementMedicament.posologie}`}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1">Aucun traitement actif</p>
                )}
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="border-b border-gray-200 px-6 flex-shrink-0">
              <nav className="flex gap-7 flex-wrap -mb-px">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`py-2.5 px-1 border-b-2 font-medium text-sm flex items-center gap-2 bg-transparent ${
                      activeTab === id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {activeTab === 'infos' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-900 mb-3.5">Coordonnées</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoRow label="Téléphone" value={p.telephone} />
                      <InfoRow label="Email" value={p.email} />
                      <InfoRow label="Adresse" value={p.adresse} />
                      <InfoRow label="Profession" value={p.profession} />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-900 mb-3.5">Contact d&apos;urgence</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <InfoRow label="Nom" value={p.personne_contact} />
                      <InfoRow label="Téléphone" value={p.telephone_contact} />
                      <InfoRow label="Lien" value={p.lien_contact} />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-900 mb-3.5">Couverture santé</h3>
                    {assurance ? (
                      <>
                        <span className={`inline-block px-2 py-0.5 ${badge.color} text-white text-[10px] font-bold rounded-full`}>
                          {badge.label}
                        </span>
                        {Number(assurance.taux_remboursement) > 0 && (
                          <span className="ml-2 text-sm text-slate-600">{assurance.taux_remboursement}% de remboursement</span>
                        )}
                        <p className="text-base font-bold text-slate-900 mt-2">{assurance.nom}</p>
                        {p.assurance_numero && <p className="text-xs text-slate-500 mt-1">N° {p.assurance_numero}</p>}
                        {Number(assurance.taux_remboursement) > 0 && (
                          <div className="flex items-center gap-2.5 mt-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${assurance.taux_remboursement}%` }}></div>
                            </div>
                            <span className="text-sm font-bold text-green-600">{assurance.taux_remboursement}%</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">Aucune couverture santé enregistrée</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'antecedents' && (
                <AntecedentsMedicaux
                  antecedents={antecedents}
                  fetchAntecedents={refetchAntecedents}
                  antecedentsRef={antecedentsRef}
                  patient={patient}
                  isTerminated={isTerminated}
                />
              )}

              {activeTab === 'consultations' && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Historique des consultations</h3>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    {historique.length} consultation{historique.length > 1 ? 's' : ''} • cliquez pour ouvrir le dossier de consultation
                  </p>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {historique.length === 0 && (
                      <p className="p-6 text-center text-sm text-slate-500">Aucune consultation enregistrée pour ce patient.</p>
                    )}
                    {historique.map((c) => {
                      const st = STATUT_STYLES[c.statut] || { label: c.statut, className: 'bg-gray-100 text-gray-800' };
                      const isCurrent = c.id === consultation?.id;
                      const doctor = c.medecin || c.users;
                      return (
                        <button
                          key={c.id}
                          onClick={() => onOpenConsultation(c.id)}
                          className={`w-full flex items-center gap-4 px-4 py-3.5 text-left border-0 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                            isCurrent ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">
                              {formatDateTime(c.date_consultation)} — {c.motif_consultation || 'Consultation'}
                            </span>
                            <span className="block text-sm text-slate-600">
                              {doctor ? `Dr ${doctor.prenom || ''} ${doctor.nom || ''}`.replace(/\s+/g, ' ').trim() : 'Médecin non renseigné'}
                              {c.type_consultation && ` • ${c.type_consultation}`}
                              {isCurrent && c.statut === 'en_cours' && ' • consultation en cours'}
                            </span>
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${st.className}`}>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <PatientDocumentsViewer
                  key={documentsRefreshKey}
                  patient={patient}
                  consultationId={consultation?.id || null}
                  showUploadButton={!isTerminated}
                  onUploadClick={onUploadClick}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PatientFileModal;
