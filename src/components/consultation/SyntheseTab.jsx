import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import PropTypes from 'prop-types';
import { Activity, AlertCircle, Award, Brain, Calendar, ChevronDown, ChevronUp, Eye, FileText, Heart, Pill, Plus, User } from 'lucide-react';
import { generateSynthesisPDF } from '../../services/impression/synthesePdf';
import { useAlert } from '../../contexts/AlertContext';
import { useAuth } from '../../contexts/AuthContext';
import SyntheseModal from './modals/SyntheseModal';
import SyntheseEntryCard, { TYPE_META, DEFAULT_TYPE_META, groupByType } from './SyntheseEntryCard';

const HistorySection = ({ title, children }) => (
  <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h5>
    <div className="space-y-1.5 text-sm text-slate-700">{children}</div>
  </section>
);

HistorySection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const ConsultationHistoryDetails = ({ observations }) => {
  const details = observations || {};
  const hasDetails = Object.values(details).some((items) => items?.length > 0);
  if (!hasDetails) return <p className="px-1 text-sm italic text-gray-500">Aucune observation clinique saisie pour cette consultation.</p>;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {details.constantes?.length > 0 && (
        <HistorySection title="Constantes vitales">
          {details.constantes.map((item) => (
            <p key={item.id}><span className="font-medium">{item.constantes?.nom} :</span> {item.valeur_mesuree} {item.unite || item.constantes?.unite || ''}</p>
          ))}
        </HistorySection>
      )}
      {(details.signesCliniques?.length > 0 || details.autresSignes?.length > 0) && (
        <HistorySection title="Observations cliniques">
          {details.signesCliniques?.map((item) => (
            <p key={item.id}><span className="font-medium">{item.signes_cliniques?.nom}</span>{item.intensite ? ` — ${item.intensite}` : ''}{item.localisation ? `, ${item.localisation}` : ''}{item.commentaires ? ` : ${item.commentaires}` : ''}</p>
          ))}
          {details.autresSignes?.map((item) => <p key={item.id}>{item.description}</p>)}
        </HistorySection>
      )}
      {details.examensAppareils?.length > 0 && (
        <HistorySection title="Examens d'appareils">
          {details.examensAppareils.map((item) => (
            <p key={item.id}><span className="font-medium">{item.appareils?.nom} :</span> {item.resultat_examen}{item.anomalies_detectees ? ` — Anomalies : ${item.anomalies_detectees}` : ''}</p>
          ))}
        </HistorySection>
      )}
      {details.diagnostics?.length > 0 && (
        <HistorySection title="Diagnostics">
          {details.diagnostics.map((item) => (
            <p key={item.id}><span className="font-medium">{item.diagnostics?.nom}</span>{item.certitude ? ` (${item.certitude})` : ''}{item.commentaires ? ` : ${item.commentaires}` : ''}</p>
          ))}
        </HistorySection>
      )}
      {details.ordonnances?.length > 0 && (
        <HistorySection title="Prescriptions">
          {details.ordonnances.map((item) => (
            <div key={item.id}>
              <p className="font-medium">Ordonnance {item.numero_ordonnance || ''}</p>
              {item.lignes_ordonnance?.map((ligne) => <p key={ligne.id} className="pl-2">• {ligne.medicaments?.nom}{ligne.posologie ? ` — ${ligne.posologie}` : ''}</p>)}
            </div>
          ))}
        </HistorySection>
      )}
      {details.antecedents?.length > 0 && (
        <HistorySection title="Antécédents ajoutés">
          {details.antecedents.map((item) => <p key={item.id}>{item.antecedents?.nom}{item.commentaires ? ` : ${item.commentaires}` : ''}</p>)}
        </HistorySection>
      )}
    </div>
  );
};

ConsultationHistoryDetails.propTypes = {
  observations: PropTypes.object,
};

export default function SyntheseTab(
  {
    id,
    patient,
    consultation,
    antecedents,
    constantes,
    signesCliniques,
    examensAppareils,
    diagnostics,
    ordonnances,
    certificats,
    syntheses,
    syntheseHistorique,
    elementsSyntheseRef,
    fetchSyntheses,
    syntheseMode,
    setSyntheseMode,
    isTerminated = false
  }
) {
  const { tenantId } = useAuth();
  const { showError, showInfo, showSuccess, showWarning } = useAlert();

  const [showSyntheseModal, setShowSyntheseModal] = useState(false)
  const [editingSynthese, setEditingSynthese] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const handleAddSynthese = () => {
    setEditingSynthese(null);
    setShowSyntheseModal(true);
  };
  const handleEditSynthese = (synthese) => {
    setEditingSynthese(synthese);
    setShowSyntheseModal(true);
  };
  const handleDeleteSynthese = async (synthese) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément de synthèse ?')) return;
    try {
      const { error } = await supabase
        .from('syntheses_consultation')
        .delete()
        .eq('id', synthese.id);
      if (error) throw error;
      await fetchSyntheses();
      showSuccess('Élément de synthèse supprimé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la suppression de la synthèse:', error);
      showError('Erreur lors de la suppression de la synthèse: ' + error.message);
    }
  };
    // Fonction pour générer automatiquement une synthèse basée sur les données collectées.
  // Répartit le texte par type_element (observation/prescription/recommandation) plutôt que
  // de tout regrouper sous un seul élément — le type_element est une valeur fixe (contrainte
  // CHECK en base), donc fiable même si le cabinet a renommé ses éléments de synthèse.
  const generateAutoSynthesis = async () => {
    if (isTerminated) {
      showWarning('La consultation est terminée : sa synthèse ne peut plus être modifiée.');
      return;
    }
    try {
      const textsByType = { observation: '', prescription: '', recommandation: '' };

      // Observations : antécédents, constantes, signes cliniques, examens d'appareils, diagnostics
      if (antecedents && antecedents.length > 0) {
        const antecedentsList = antecedents.map(ant => ant.antecedents?.nom || ant.antecedent).join(', ');
        textsByType.observation += `Antécédents significatifs : ${antecedentsList}. `;
      }

      if (constantes && constantes.length > 0) {
        const constantesList = constantes.map(const_ =>
          `${const_.constantes?.nom}: ${const_.valeur_mesuree} ${const_.unite || const_.constantes?.unite || ''}`
        ).join(', ');
        textsByType.observation += `Constantes vitales : ${constantesList}. `;
      }

      if (signesCliniques && signesCliniques.length > 0) {
        const signesList = signesCliniques.map(signe => {
          let desc = signe.signes_cliniques?.nom;
          if (signe.intensite && signe.intensite !== 'faible') {
            desc += ` (${signe.intensite})`;
          }
          return desc;
        }).join(', ');
        textsByType.observation += `Signes cliniques observés : ${signesList}. `;
      }

      if (examensAppareils && examensAppareils.length > 0) {
        const examensList = examensAppareils.map(examen => {
          let desc = `${examen.appareils?.nom}: ${examen.resultat_examen}`;
          if (examen.anomalies_detectees) {
            desc += ` (Anomalies: ${examen.anomalies_detectees})`;
          }
          return desc;
        }).join('; ');
        textsByType.observation += `Examens d'appareils : ${examensList}. `;
      }

      if (diagnostics && diagnostics.length > 0) {
        const diagnosticsList = diagnostics.map(diag =>
          `${diag.diagnostics?.nom} (${diag.certitude})`
        ).join(', ');
        textsByType.observation += `Diagnostics posés : ${diagnosticsList}. `;
      }

      // Prescriptions : ordonnances
      if (ordonnances && ordonnances.length > 0) {
        const totalMedicaments = ordonnances.reduce((total, ord) =>
          total + (ord.lignes_ordonnance?.length || 0), 0
        );
        textsByType.prescription += `${ordonnances.length} ordonnance(s) prescrite(s) avec ${totalMedicaments} médicament(s). `;
      }

      // Recommandations : certificats
      if (certificats && certificats.length > 0) {
        const certificatsList = certificats.map(cert =>
          `${cert.types_certificats?.nom || 'Certificat médical'} (${cert.duree_jours} jour${cert.duree_jours > 1 ? 's' : ''})`
        ).join(', ');
        textsByType.recommandation += `Certificats émis : ${certificatsList}. `;
      }

      const hasContent = Object.values(textsByType).some((text) => text.trim() !== '');
      if (!hasContent) {
        showInfo('Aucune donnée disponible pour générer une synthèse automatique. Veuillez remplir les autres onglets d\'abord.');
        return;
      }

      if (!elementsSyntheseRef || elementsSyntheseRef.length === 0) {
        showWarning('Aucun élément de synthèse disponible dans la base de données. Veuillez contacter l\'administrateur.');
        return;
      }

      // Un élément par type, avec repli sur un élément "observation" (ou à défaut le premier
      // disponible) si le cabinet n'a pas configuré d'élément de ce type précis.
      const findElementByType = (type) => elementsSyntheseRef.find((el) => el.type_element === type);
      const fallbackElement = findElementByType('observation') || elementsSyntheseRef[0];

      const generatedAt = new Date().toLocaleString('fr-FR');
      const rows = Object.entries(textsByType)
        .filter(([, text]) => text.trim() !== '')
        .map(([type, text]) => {
          const element = findElementByType(type) || fallbackElement;
          return {
            consultation_id: parseInt(id),
            element_synthese_id: element.id,
            commentaires: `[Synthèse automatique générée le ${generatedAt}]\n\n${text.trim()}`
          };
        });

      // Une nouvelle génération remplace uniquement les anciennes synthèses
      // automatiques. Les éléments ajoutés manuellement restent intacts.
      const { data: existingRows, error: existingError } = await supabase
        .from('syntheses_consultation')
        .select('id, commentaires')
        .eq('consultation_id', parseInt(id));
      if (existingError) throw existingError;

      const autoRows = (existingRows || []).filter((row) =>
        row.commentaires?.startsWith('[Synthèse automatique générée le ')
      );
      if (autoRows.length > 0) {
        const shouldReplace = window.confirm(
          'Une synthèse automatique existe déjà. Voulez-vous la remplacer avec les données actuelles ?'
        );
        if (!shouldReplace) return;
        const { error: deleteError } = await supabase
          .from('syntheses_consultation')
          .delete()
          .in('id', autoRows.map((row) => row.id));
        if (deleteError) throw deleteError;
      }

      const { error } = await supabase
        .from('syntheses_consultation')
        .insert(rows);

      if (error) throw error;

      // Recharger les synthèses
      await fetchSyntheses();
      showSuccess('Synthèse automatique générée avec succès !');

    } catch (error) {
      console.error('Erreur lors de la génération de la synthèse:', error);
      showError('Erreur lors de la génération de la synthèse: ' + error.message);
    }
  };
  
  const handleGenerateSynthesisPDF = async () => {
    const { success, error } = await generateSynthesisPDF(
      supabase,
      patient,
      consultation,
      antecedents,
      constantes,
      signesCliniques,
      examensAppareils,
      diagnostics,
      ordonnances,
      certificats,
      tenantId
    );
    if (!success) {
      showError(`Erreur lors de la génération du PDF: ${error}`);
    }
  }

  return (
  <>
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Synthèse de la consultation</h2>
          <div className="flex gap-3">
            <button
              onClick={generateAutoSynthesis}
              disabled={isTerminated}
              title={isTerminated ? 'La consultation est terminée' : undefined}
              className={`px-4 py-2 rounded-lg flex items-center text-sm ${
                isTerminated
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <Brain className="w-4 h-4 mr-2" />
              Sauvegarder synthèse
            </button>
            <button 
              onClick={handleGenerateSynthesisPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center text-sm"
            >
              <FileText className="w-4 h-4 mr-2" />
              Générer PDF
            </button>
          </div>
        </div>
    
        {/* Aperçu des données collectées — replié par défaut : c'est un aperçu de ce que
            "Sauvegarder synthèse" va enregistrer, pas le contenu de référence (qui est la
            liste "Éléments de synthèse" plus bas une fois généré/ajouté). */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <Brain className="w-4 h-4 mr-2 text-gray-500" />
              Aperçu des données collectées dans cette consultation
            </span>
            {showPreview ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showPreview && (
          <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Antécédents significatifs */}
              {antecedents && antecedents.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2 text-blue-600" />
                    Antécédents significatifs
                  </h4>
                  <div className="space-y-2">
                    {antecedents.slice(0, 3).map((ant, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium text-gray-900">
                          {ant.antecedents?.nom}
                        </span>
                        {ant.date_decouverte && (
                          <span className="text-gray-500 text-xs ml-2">
                            ({new Date(ant.date_decouverte).toLocaleDateString('fr-FR')})
                          </span>
                        )}
                      </div>
                    ))}
                    {antecedents.length > 3 && (
                      <p className="text-xs text-blue-600">
                        +{antecedents.length - 3} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              )}
    
              {/* Constantes vitales */}
              {constantes && constantes.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-red-600" />
                    Constantes vitales
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {constantes.slice(0, 6).map((const_, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-gray-600 truncate">
                          {const_.constantes?.nom}:
                        </span>
                        <span className="font-medium text-gray-900">
                          {const_.valeur_mesuree} {const_.unite || const_.constantes?.unite}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
    
              {/* Signes cliniques */}
              {signesCliniques && signesCliniques.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <Eye className="w-4 h-4 mr-2 text-yellow-600" />
                    Signes cliniques
                  </h4>
                  <div className="space-y-2">
                    {signesCliniques.slice(0, 4).map((signe, idx) => (
                      <div key={idx} className="flex items-center text-sm">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          signe.intensite === 'forte' ? 'bg-red-500' :
                          signe.intensite === 'moderee' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}></div>
                        <span className="text-gray-900">
                          {signe.signes_cliniques?.nom}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
    
              {/* Examens d'appareils */}
              {examensAppareils && examensAppareils.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <Heart className="w-4 h-4 mr-2 text-purple-600" />
                    Examens d&apos;appareils
                  </h4>
                  <div className="space-y-2">
                    {examensAppareils.slice(0, 3).map((examen, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="font-medium text-gray-900">
                          {examen.appareils?.nom}
                        </div>
                        <div className="text-gray-600 truncate">
                          {examen.resultat_examen.substring(0, 50)}
                          {examen.resultat_examen.length > 50 && '...'}
                        </div>
                        {examen.anomalies_detectees && (
                          <div className="text-red-600 text-xs flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Anomalies détectées
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
    
              {/* Diagnostics */}
              {diagnostics && diagnostics.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-indigo-600" />
                    Diagnostics
                  </h4>
                  <div className="space-y-2">
                    {diagnostics.slice(0, 3).map((diag, idx) => (
                      <div key={idx} className="text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          diag.certitude === 'certain' ? 'bg-green-100 text-green-800' :
                          diag.certitude === 'probable' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {diag.diagnostics?.nom}
                        </span>
                        {diag.commentaires && (
                          <p className="text-gray-600 text-xs mt-1">
                            {diag.commentaires.substring(0, 60)}
                            {diag.commentaires.length > 60 && '...'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
    
              {/* Prescriptions */}
              {ordonnances && ordonnances.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <Pill className="w-4 h-4 mr-2 text-green-600" />
                    Prescriptions
                  </h4>
                  <div className="space-y-2">
                    {ordonnances.slice(0, 2).map((ord, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="font-medium text-gray-900">
                          Ordonnance #{ord.numero_ordonnance}
                        </div>
                        <div className="text-gray-600">
                          {ord.lignes_ordonnance?.length || 0} médicament(s)
                        </div>
                        {ord.instructions_generales && (
                          <p className="text-gray-500 text-xs italic">
                            {ord.instructions_generales.substring(0, 50)}
                            {ord.instructions_generales.length > 50 && '...'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
    
              {/* Certificats */}
              {certificats && certificats.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <Award className="w-4 h-4 mr-2 text-orange-600" />
                    Certificats
                  </h4>
                  <div className="space-y-2">
                    {certificats.slice(0, 3).map((cert, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="font-medium text-gray-900">
                          {cert.types_certificats?.nom}
                        </div>
                        <div className="text-gray-600">
                          {cert.duree_jours} jour(s) • 
                          {new Date(cert.date_debut).toLocaleDateString('fr-FR')} - 
                          {new Date(new Date(cert.date_debut).getTime() + cert.duree_jours * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
                        </div>
                        {cert.motif && (
                          <p className="text-gray-500 text-xs">
                            {cert.motif}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
    
            {/* Message si aucune donnée */}
            {(!antecedents || antecedents.length === 0) && (!constantes || constantes.length === 0) && 
             (!signesCliniques || signesCliniques.length === 0) && 
             (!examensAppareils || examensAppareils.length === 0) && 
             (!diagnostics || diagnostics.length === 0) && 
             (!ordonnances || ordonnances.length === 0) && 
             (!certificats || certificats.length === 0) && (
              <div className="text-center py-8">
                <Brain className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée disponible</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Remplissez les autres onglets pour voir apparaître la synthèse automatique.
                </p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Éléments de synthèse enregistrés (ajoutés manuellement ou via "Sauvegarder synthèse") */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Éléments de synthèse</h3>
              {/* Toggle Mode */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSyntheseMode('current')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    syntheseMode === 'current'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Consultation actuelle
                </button>
                <button
                  onClick={() => setSyntheseMode('history')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    syntheseMode === 'history'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Historique complet
                </button>
              </div>
            </div>
            {!isTerminated && (
              <button 
                onClick={handleAddSynthese}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ajouter manuel
              </button>
            )}
          </div>
    
          {/* Vue consultation actuelle : regroupée par type (Observation / Prescription /
              Recommandation / Conclusion) pour une lecture plus organisée qu'une liste plate. */}
          {syntheseMode === 'current' && (
            <>
              {syntheses && syntheses.length > 0 ? (
                <div className="space-y-5">
                  {groupByType(syntheses, (s) => s.elements_synthese?.type_element).map(({ type, items }) => (
                    <div key={type || 'autres'}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                        {(TYPE_META[type] || DEFAULT_TYPE_META).label}{items.length > 1 ? 's' : ''}
                      </p>
                      <div className="space-y-3">
                        {items.map((synthese) => (
                          <SyntheseEntryCard
                            key={synthese.id}
                            nom={synthese.elements_synthese?.nom}
                            description={synthese.elements_synthese?.description}
                            type={synthese.elements_synthese?.type_element}
                            commentaires={synthese.commentaires}
                            createdAt={synthese.created_at}
                            onEdit={!isTerminated ? () => handleEditSynthese(synthese) : undefined}
                            onDelete={!isTerminated ? () => handleDeleteSynthese(synthese) : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun élément de synthèse</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Cliquez sur &quot;Ajouter manuel&quot; ou &quot;Sauvegarder synthèse&quot; pour en ajouter.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Vue historique complet */}
          {syntheseMode === 'history' && (
            <>
              {syntheseHistorique && syntheseHistorique.length > 0 ? (
                <div className="space-y-6">
                  {syntheseHistorique.map((consultation, idx) => (
                    <div key={consultation.consultation_id} className="relative">
                      {/* Séparateur entre consultations */}
                      {idx > 0 && (
                        <div className="absolute left-0 right-0 -top-3 flex items-center">
                          <div className="flex-1 border-t-2 border-gray-300"></div>
                        </div>
                      )}

                      {/* Header de consultation */}
                      <div className={`rounded-lg border-2 ${
                        consultation.is_current
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white'
                      } p-4 mb-3`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className={`w-5 h-5 ${
                              consultation.is_current ? 'text-blue-600' : 'text-gray-600'
                            }`} />
                            <div>
                              <h4 className={`font-semibold ${
                                consultation.is_current ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {new Date(consultation.date_consultation).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </h4>
                              <p className="text-sm text-gray-600">
                                Dr {consultation.medecin_prenom || 'Non renseigné'} {consultation.medecin_nom || ''}
                              </p>
                              {consultation.motif_consultation && (
                                <p className="mt-1 text-sm text-gray-500">
                                  <span className="font-medium">Motif :</span> {consultation.motif_consultation}
                                </p>
                              )}
                            </div>
                          </div>
                          {consultation.is_current && (
                            <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                              Consultation actuelle
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Synthèses de cette consultation */}
                      <div className="space-y-4 pl-8">
                        <ConsultationHistoryDetails observations={consultation.observations} />

                        {consultation.syntheses.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Synthèse enregistrée</p>
                            {consultation.syntheses.map((synthese) => (
                              <SyntheseEntryCard
                                key={synthese.id}
                                nom={synthese.element_nom}
                                description={synthese.element_description}
                                type={synthese.element_type}
                                commentaires={synthese.commentaires}
                                createdAt={synthese.created_at}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune synthèse dans l&apos;historique</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Ce patient n&apos;a aucune synthèse enregistrée dans ses consultations précédentes.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showSyntheseModal && (
        <SyntheseModal
        setShowSyntheseModal={setShowSyntheseModal}
        id={id}
        fetchSyntheses={fetchSyntheses}
        elementsSyntheseRef={elementsSyntheseRef}
        editingSynthese={editingSynthese}
         />)}
  </>
    )}

    SyntheseTab.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  patient: PropTypes.object,
  consultation: PropTypes.object,
  antecedents: PropTypes.array,
  constantes: PropTypes.array,
  signesCliniques: PropTypes.array,
  examensAppareils: PropTypes.array,
  diagnostics: PropTypes.array,
  ordonnances: PropTypes.array,
  certificats: PropTypes.array,
  syntheses: PropTypes.array,
  syntheseHistorique: PropTypes.array,
  elementsSyntheseRef: PropTypes.array,
  fetchSyntheses: PropTypes.func,
  syntheseMode: PropTypes.string,
  setSyntheseMode: PropTypes.func
};

SyntheseTab.defaultProps = {
  patient: null,
  consultation: null,
  antecedents: [],
  constantes: [],
  signesCliniques: [],
  examensAppareils: [],
  diagnostics: [],
  ordonnances: [],
  certificats: [],
  syntheses: [],
  syntheseHistorique: [],
  elementsSyntheseRef: [],
  fetchSyntheses: () => {},
  syntheseMode: 'current',
  setSyntheseMode: () => {}
};
