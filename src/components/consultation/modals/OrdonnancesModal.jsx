import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Pill, Plus } from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';
import QuickAddMedicamentModal from './QuickAddMedicamentModal';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import PropTypes from 'prop-types';


const OrdonnancesModal = ({
  id,
  setShowOrdonnanceModal,
  fetchOrdonnances,
  medicamentsRef,
  patient,
  calculateAge
}) => {

    const {  showSuccess , showError, showWarning} = useConfirmDialog();

    // Médicaments créés à la volée pendant cette ordonnance (absents du référentiel
    // chargé au début de la consultation) — fusionnés avec medicamentsRef pour l'affichage.
    const [extraMedicaments, setExtraMedicaments] = useState([]);
    const [quickAddForIndex, setQuickAddForIndex] = useState(null);
    const allMedicaments = [...medicamentsRef, ...extraMedicaments];

   const [ordonnanceForm, setOrdonnanceForm] = useState({
     instructions_generales: '',
     prochain_rdv: '',
     medicaments: []
   });

   // Même règle de choix de posologie que la sélection normale dans le select : selon
   // l'âge du patient (enfant/adulte), avec repli sur la posologie par défaut.
   const resolvePosologie = (selectedMedicament) => {
     if (!selectedMedicament) return '';
     const patientAge = patient?.date_naissance ? calculateAge(patient.date_naissance) : null;
     const isChild = patientAge !== null && patientAge < 18;

     if (isChild && selectedMedicament.posologie_enfant) return selectedMedicament.posologie_enfant;
     if (!isChild && selectedMedicament.posologie_adulte) return selectedMedicament.posologie_adulte;
     if (selectedMedicament.posologie_defaut) return selectedMedicament.posologie_defaut;
     return '';
   };

   const handleMedicamentCreated = (nouveauMedicament) => {
     // Si le médicament existait déjà (cas récupéré après une contrainte d'unicité côté
     // QuickAddMedicamentModal, qui affiche alors son propre message), ne pas le dupliquer
     // dans la liste des options.
     const dejaConnu = [...medicamentsRef, ...extraMedicaments].some((m) => m.id === nouveauMedicament.id);
     if (!dejaConnu) {
       setExtraMedicaments((prev) => [...prev, nouveauMedicament]);
       showSuccess('Médicament ajouté au référentiel et sélectionné.');
     }
     if (quickAddForIndex !== null) {
       const newMedicaments = [...ordonnanceForm.medicaments];
       newMedicaments[quickAddForIndex].medicament_id = String(nouveauMedicament.id);
       const posologie = resolvePosologie(nouveauMedicament);
       if (posologie) {
         newMedicaments[quickAddForIndex].posologie = posologie;
       }
       setOrdonnanceForm({ ...ordonnanceForm, medicaments: newMedicaments });
     }
     setQuickAddForIndex(null);
   };

  const saveOrdonnance = async () => {
    console.log('saveOrdonnance appelée');
    console.log('ordonnanceForm:', ordonnanceForm);
    console.log('Nombre de médicaments:', ordonnanceForm.medicaments.length);
    
    if (ordonnanceForm.medicaments.length === 0) {
      showWarning('Veuillez ajouter au moins un médicament');
      return;
    }

    // Vérifier que chaque médicament a une posologie renseignée
    const missingPosologie = ordonnanceForm.medicaments.findIndex(med => 
      !med.posologie || med.posologie.trim() === ''
    );
    if (missingPosologie !== -1) {
      showWarning('La posologie est obligatoire. Veuillez la renseigner avant de continuer.');
      return;
    }

    try {
      // Créer l'ordonnance
      console.log('Création ordonnance avec:', {
        consultation_id: parseInt(id),
        numero_ordonnance: `ORD-${Date.now()}`,
        date_prescription: new Date().toISOString().split('T')[0],
        instructions_generales: ordonnanceForm.instructions_generales || null,
        statut: 'active'
      });
      
      // Insérer l'ordonnance sans SELECT pour éviter les problèmes RLS
      const numeroOrdonnance = `ORD-${Date.now()}`;
      const { error: ordonnanceError } = await supabase
        .from('ordonnances')
        .insert({
          consultation_id: parseInt(id),
          numero_ordonnance: numeroOrdonnance,
          date_prescription: new Date().toISOString().split('T')[0],
          instructions_generales: ordonnanceForm.instructions_generales || null,
          prochain_rdv: ordonnanceForm.prochain_rdv || null,
          statut: 'active'
        });
      
      console.log('Après insert ordonnance, error:', ordonnanceError);
      
      if (ordonnanceError) {
        console.error('Erreur insert ordonnance:', ordonnanceError);
        throw ordonnanceError;
      }
      
      // Récupérer l'ordonnance créée
      const { data: ordonnanceData, error: selectError } = await supabase
        .from('ordonnances')
        .select('id')
        .eq('numero_ordonnance', numeroOrdonnance)
        .single();

      console.log('Résultat SELECT ordonnance:', { ordonnanceData, selectError });
      
      if (selectError) {
        console.error('Erreur SELECT ordonnance:', selectError);
        throw selectError;
      }
      
      if (!ordonnanceData) {
        throw new Error('Ordonnance créée mais impossible de la récupérer (problème RLS?)');
      }

      // Ajouter les lignes de médicaments
      if (ordonnanceForm.medicaments.length > 0) {
        const lignes = ordonnanceForm.medicaments.map(med => ({
          ordonnance_id: ordonnanceData.id,
          medicament_id: parseInt(med.medicament_id),
          posologie: med.posologie,
          quantite: parseInt(med.quantite),
          duree_traitement: parseInt(med.duree_traitement),
          instructions_particulieres: med.instructions_particulieres || null
        }));

        const { error: lignesError } = await supabase
          .from('lignes_ordonnance')
          .insert(lignes);

        if (lignesError) throw lignesError;
      }
      
      await fetchOrdonnances();
      setOrdonnanceForm({
        instructions_generales: '',
        prochain_rdv: '',
        medicaments: []
      });
      showSuccess('Ordonnance créée avec succès !');
      setShowOrdonnanceModal(false);
    } catch (error) {
      console.error('Erreur lors de la création de l\'ordonnance:', error);
      showError('Erreur lors de la création de l\'ordonnance: ' + error.message);
    }
  };


return (
      <>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Créer une ordonnance</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommandations
                  </label>
                  <textarea
                    value={ordonnanceForm.instructions_generales}
                    onChange={(e) => setOrdonnanceForm({...ordonnanceForm, instructions_generales: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Recommandations pour le patient..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prochain rendez-vous (optionnel) 📅
                  </label>
                  <input
                    type="text"
                    value={ordonnanceForm.prochain_rdv}
                    onChange={(e) => setOrdonnanceForm({...ordonnanceForm, prochain_rdv: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Dans 7 jours, Dans 2 semaines, Le 15/11/2025..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sera affiché sur l&apos;rdonnance pour rappeler au patient quand revenir
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-900">Médicaments</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newMedicament = {
                          medicament_id: '',
                          posologie: '',
                          quantite: '',
                          duree_traitement: '',
                          instructions_particulieres: ''
                        };
                        setOrdonnanceForm({
                          ...ordonnanceForm,
                          medicaments: [...ordonnanceForm.medicaments, newMedicament]
                        });
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      + Ajouter médicament
                    </button>
                  </div>

                  {ordonnanceForm.medicaments.map((medicament, index) => (
                    <div key={index} className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-blue-900 flex items-center">
                          <Pill className="w-4 h-4 mr-2" />
                          Médicament {index + 1}
                        </h5>
                        <button
                          type="button"
                          onClick={() => {
                            const newMedicaments = ordonnanceForm.medicaments.filter((_, i) => i !== index);
                            setOrdonnanceForm({...ordonnanceForm, medicaments: newMedicaments});
                          }}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col">
                        <SearchableSelect
                          label="Médicament"
                          required
                          options={allMedicaments.map(m => ({
                            id: m.id,
                            label: m.nom,
                            nom: m.nom,
                            forme: m.forme_pharmaceutique || m.forme,
                            dosage: m.dosage,
                            dci: m.dci,
                            voie_administration: m.voie_administration
                          }))}
                          value={medicament.medicament_id}
                          onChange={(value) => {
                            const newMedicaments = [...ordonnanceForm.medicaments];
                            newMedicaments[index].medicament_id = value;

                            // Remplir automatiquement les champs avec les données du médicament sélectionné
                            if (value) {
                              const selectedMedicament = allMedicaments.find(m => m.id === parseInt(value));
                              if (selectedMedicament) {
                                const posologie = resolvePosologie(selectedMedicament);
                                if (posologie) {
                                  newMedicaments[index].posologie = posologie;
                                }

                                // Note: Les contre-indications et interactions sont affichées dans le bloc d'information
                                // Le médecin peut les copier dans les instructions particulières s'il le souhaite
                              }
                            }
                            
                            setOrdonnanceForm({...ordonnanceForm, medicaments: newMedicaments});
                          }}
                          placeholder="Sélectionner un médicament"
                          searchPlaceholder="Rechercher par nom..."
                          emptyMessage="Aucun médicament trouvé"
                          renderOption={(option) => {
                            const medicamentData = allMedicaments.find(m => m.id === option.id);
                            return (
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {option.nom}
                                </span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {medicamentData?.dci && (
                                    <span className="text-xs text-gray-600 italic">
                                      DCI: {medicamentData.dci}
                                    </span>
                                  )}
                                  {option.forme && (
                                    <span className="text-xs text-blue-600">
                                      {option.forme}
                                    </span>
                                  )}
                                  {option.dosage && (
                                    <span className="text-xs text-green-600 font-medium">
                                      {option.dosage}
                                    </span>
                                  )}
                                  {medicamentData?.voie_administration && (
                                    <span className="text-xs text-purple-600">
                                      {medicamentData.voie_administration}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setQuickAddForIndex(index)}
                          className="mt-1 self-start flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800"
                        >
                          <Plus className="w-3 h-3" /> Nouveau médicament (absent de la liste)
                        </button>
                        </div>
                        {/* Affichage des informations du médicament sélectionné */}
                        {medicament.medicament_id && (() => {
                          const selectedMedicament = allMedicaments.find(m => m.id === parseInt(medicament.medicament_id));
                          if (selectedMedicament) {
                            return (
                              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {selectedMedicament.dosage && (
                                    <div>
                                      <span className="font-medium text-gray-700">Dosage: </span>
                                      <span className="text-gray-900">{selectedMedicament.dosage}</span>
                                    </div>
                                  )}
                                  {selectedMedicament.forme_pharmaceutique && (
                                    <div>
                                      <span className="font-medium text-gray-700">Forme: </span>
                                      <span className="text-gray-900">{selectedMedicament.forme_pharmaceutique}</span>
                                    </div>
                                  )}
                                  {selectedMedicament.dci && (
                                    <div>
                                      <span className="font-medium text-gray-700">DCI: </span>
                                      <span className="text-gray-600 italic">{selectedMedicament.dci}</span>
                                    </div>
                                  )}
                                  {selectedMedicament.voie_administration && (
                                    <div>
                                      <span className="font-medium text-gray-700">Voie: </span>
                                      <span className="text-gray-900">{selectedMedicament.voie_administration}</span>
                                    </div>
                                  )}
                                  {selectedMedicament.classe_therapeutique && (
                                    <div>
                                      <span className="font-medium text-gray-700">Classe: </span>
                                      <span className="text-gray-900">{selectedMedicament.classe_therapeutique}</span>
                                    </div>
                                  )}
                                </div>
                                {(selectedMedicament.contre_indications || selectedMedicament.interactions) && (
                                  <div className="mt-2 pt-2 border-t border-blue-300">
                                    {selectedMedicament.contre_indications && (
                                      <div className="text-xs">
                                        <span className="font-medium text-red-700">⚠️ Contre-indications: </span>
                                        <span className="text-red-600">{selectedMedicament.contre_indications}</span>
                                      </div>
                                    )}
                                    {selectedMedicament.interactions && (
                                      <div className="text-xs mt-1">
                                        <span className="font-medium text-orange-700">🔗 Interactions: </span>
                                        <span className="text-orange-600">{selectedMedicament.interactions}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Posologie *
                          </label>
                          <input
                            type="text"
                            value={medicament.posologie}
                            onChange={(e) => {
                              const newMedicaments = [...ordonnanceForm.medicaments];
                              newMedicaments[index].posologie = e.target.value;
                              setOrdonnanceForm({...ordonnanceForm, medicaments: newMedicaments});
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Ex: 1 cp matin et soir"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantité
                          </label>
                          <input
                            type="number"
                            value={medicament.quantite}
                            onChange={(e) => {
                              const newMedicaments = [...ordonnanceForm.medicaments];
                              newMedicaments[index].quantite = e.target.value;
                              setOrdonnanceForm({...ordonnanceForm, medicaments: newMedicaments});
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Ex: 30"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Durée (jours)
                          </label>
                          <input
                            type="number"
                            value={medicament.duree_traitement}
                            onChange={(e) => {
                              const newMedicaments = [...ordonnanceForm.medicaments];
                              newMedicaments[index].duree_traitement = e.target.value;
                              setOrdonnanceForm({...ordonnanceForm, medicaments: newMedicaments});
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Ex: 7"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Instructions particulières
                        </label>
                          <input
                            type="text"
                            value={medicament.instructions_particulieres}
                            onChange={(e) => {
                              const newMedicaments = [...ordonnanceForm.medicaments];
                              newMedicaments[index].instructions_particulieres = e.target.value;
                              setOrdonnanceForm({...ordonnanceForm, medicaments: newMedicaments});
                            }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Ex: À prendre avec les repas"
                          />
                        </div>
                    </div>
                  ))}

                  {ordonnanceForm.medicaments.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Aucun médicament ajouté. Cliquez sur "Ajouter médicament" pour commencer.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowOrdonnanceModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Annuler
                </button>
                <button
                  onClick={saveOrdonnance}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Créer l&apos;ordonnance
                </button>
              </div>
            </div>
          </div>
        </div>

        {quickAddForIndex !== null && (
          <QuickAddMedicamentModal
            onClose={() => setQuickAddForIndex(null)}
            onCreated={handleMedicamentCreated}
          />
        )}
      </>
      )
    };
export default OrdonnancesModal;

OrdonnancesModal.propTypes = {
  setShowOrdonnanceModal: PropTypes.func.isRequired,
  patient: PropTypes.object,
  calculateAge: PropTypes.func.isRequired,
  id: PropTypes.number.isRequired,
  medicamentsRef: PropTypes.array.isRequired,
  fetchOrdonnances: PropTypes.func.isRequired

};


