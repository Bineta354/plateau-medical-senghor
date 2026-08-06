// =====================================================
// PATCH POUR IntroductionPatientPage.jsx
// Ajout du bouton "Autoriser consultation"
// =====================================================

// AJOUTER CETTE FONCTION APRÈS handleConfirmPatientEntry (ligne ~206)

const handleAuthorizePatientConsultation = async (waitingQueueId) => {
  try {
    const { data, error } = await supabase.rpc('authorize_patient_consultation', {
      p_waiting_queue_id: waitingQueueId,
      p_secretaire_id: userProfile?.id
    });

    if (error) throw error;

    fetchWaitingQueue();
    alert('Patient autorisé à aller en consultation !');
  } catch (error) {
    console.error('Erreur lors de l\'autorisation:', error);
    alert('Erreur lors de l\'autorisation du patient.');
  }
};

// REMPLACER LA SECTION DES BOUTONS DANS LA FILE D'ATTENTE (lignes ~526-541)
// Remplacer cette partie :
/*
<div className="flex items-center space-x-2">
  {queueItem.medecin_disponible && queueItem.status === 'arrive' && (
    <button
      onClick={() => handleConfirmPatientEntry(queueItem.id)}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center"
    >
      <CheckSquare className="w-4 h-4 mr-2" />
      Confirmer entrée
    </button>
  )}
  {queueItem.status === 'arrive' && !queueItem.medecin_disponible && (
    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
      En attente du médecin
    </span>
  )}
</div>
*/

// PAR CETTE NOUVELLE VERSION :
<div className="flex items-center space-x-2">
  {/* Bouton Autoriser consultation pour patients en attente */}
  {queueItem.status === 'waiting' && (
    <button
      onClick={() => handleAuthorizePatientConsultation(queueItem.id)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
    >
      <CheckSquare className="w-4 h-4 mr-2" />
      Autoriser consultation
    </button>
  )}
  
  {/* Patient autorisé - en attente d'arrivée */}
  {queueItem.status === 'authorized' && (
    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
      <CheckCircle className="w-4 h-4 mr-1" />
      Autorisé - En attente d'arrivée
    </span>
  )}
  
  {/* Médecin disponible pour patient arrivé */}
  {queueItem.medecin_disponible && queueItem.status === 'present' && (
    <button
      onClick={() => handleConfirmPatientEntry(queueItem.id)}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center"
    >
      <CheckSquare className="w-4 h-4 mr-2" />
      Confirmer entrée
    </button>
  )}
  
  {/* Patient arrivé mais médecin pas encore disponible */}
  {queueItem.status === 'present' && !queueItem.medecin_disponible && (
    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
      En attente du médecin
    </span>
  )}
  
  {/* Patient en route vers consultation */}
  {queueItem.status === 'en_route' && (
    <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium flex items-center">
      <User className="w-4 h-4 mr-1" />
      En route vers médecin
    </span>
  )}
</div>

// AUSSI METTRE À JOUR LES STATUTS DANS LA SECTION BADGES (lignes ~492-504)
// Remplacer cette partie :
/*
<span className={`px-2 py-1 rounded-full text-xs font-medium ${
  queueItem.status === 'arrive' ? 'bg-orange-100 text-orange-800' :
  queueItem.status === 'appele' ? 'bg-blue-100 text-blue-800' :
  queueItem.status === 'entre' ? 'bg-purple-100 text-purple-800' :
  queueItem.status === 'en_consultation' ? 'bg-green-100 text-green-800' :
  'bg-gray-100 text-gray-800'
}`}>
  {queueItem.status === 'arrive' ? 'Arrivé' :
   queueItem.status === 'appele' ? 'Appelé' :
   queueItem.status === 'entre' ? 'En route' :
   queueItem.status === 'en_consultation' ? 'En consultation' :
   queueItem.status}
</span>
*/

// PAR CETTE VERSION ÉTENDUE :
<span className={`px-2 py-1 rounded-full text-xs font-medium ${
  queueItem.status === 'waiting' ? 'bg-gray-100 text-gray-800' :
  queueItem.status === 'authorized' ? 'bg-green-100 text-green-800' :
  queueItem.status === 'present' ? 'bg-orange-100 text-orange-800' :
  queueItem.status === 'medecin_pret' ? 'bg-blue-100 text-blue-800' :
  queueItem.status === 'en_route' ? 'bg-purple-100 text-purple-800' :
  queueItem.status === 'in_consultation' ? 'bg-green-100 text-green-800' :
  'bg-gray-100 text-gray-800'
}`}>
  {queueItem.status === 'waiting' ? 'En attente' :
   queueItem.status === 'authorized' ? 'Autorisé' :
   queueItem.status === 'present' ? 'Arrivé' :
   queueItem.status === 'medecin_pret' ? 'Médecin prêt' :
   queueItem.status === 'en_route' ? 'En route' :
   queueItem.status === 'in_consultation' ? 'En consultation' :
   queueItem.status}
</span>

// =====================================================
// INSTRUCTIONS D'APPLICATION :
// =====================================================

/*
1. Ouvrir src/pages/IntroductionPatientPage.jsx

2. Ajouter la fonction handleAuthorizePatientConsultation après la ligne ~206

3. Remplacer la section des boutons dans la file d'attente (lignes ~526-541)

4. Mettre à jour les badges de statuts (lignes ~492-504)

5. Sauvegarder le fichier

6. Exécuter amelioration_introduction_patient_workflow.sql dans Supabase

7. Tester le nouveau workflow :
   - Créer un RDV → Patient automatiquement en file avec statut "En attente"
   - Cliquer "Autoriser consultation" → Statut devient "Autorisé"
   - Patient arrive → Marquer arrivé → Statut "Arrivé"
   - Médecin disponible → Confirmer entrée → Workflow normal

NOUVEAU WORKFLOW COMPLET :
1. 📅 RDV créé → Patient automatiquement en file (waiting)
2. ✅ Secrétaire clique "Autoriser consultation" (authorized)
3. 🚶 Patient arrive → "Marquer arrivé" (present)
4. 👨‍⚕️ Médecin "Je suis disponible" (medecin_pret)
5. ✅ Secrétaire "Confirmer entrée" (en_route)
6. 🏥 Consultation normale (in_consultation → termine)
*/
