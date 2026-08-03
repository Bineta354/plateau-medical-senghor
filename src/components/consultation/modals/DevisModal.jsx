import React, { useState } from 'react';
import { useTypesActes } from '../../../hooks/useTypesActes';
import { supabase } from '../../../lib/supabase';
import { generateDevisPDF } from '../../../services/impression/devisPdf';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../contexts/AuthContext';
import { formatMontantDecimal } from '../../../utils/currency';
import { 
  X, 
  Plus, 
  Trash2, 
  FileText, 
  Download, 
  Printer, 
  Calculator,
  Check,
  AlertCircle
} from 'lucide-react';
import SearchableSelect from '../../common/SearchableSelect';

const DevisModal = ({ 
  patientId, 
  patientNom, 
  patientPrenom, 
  medecinId, 
  medecinNom,
  onClose 
}) => {
  const { tenantId } = useAuth();
  const { typesActes, loading: loadingActes } = useTypesActes();
  const { showSuccess, showError, showWarning } = useToast();
  
  const [actesSelectionnes, setActesSelectionnes] = useState([]);
  const [remise, setRemise] = useState(0);
  const [observations, setObservations] = useState('');
  const [loading, setLoading] = useState(false);

  // Ajouter un acte au devis
  const ajouterActe = (acte) => {
    const existeDeja = actesSelectionnes.find(a => a.id === acte.id);
    if (existeDeja) {
      showWarning('Cet acte est déjà dans le devis');
      return;
    }

    const nouvelActe = {
      id: acte.id,
      acte: {
        id: acte.id,
        code: acte.code_ccam || `ACT-${acte.id}`,
        libelle: acte.nom,
        description: acte.description
      },
      quantite: 1,
      tarifUnitaire: acte.tarif_defaut || 0
    };

    setActesSelectionnes([...actesSelectionnes, nouvelActe]);
    showSuccess('Acte ajouté au devis');
  };

  // Supprimer un acte du devis
  const supprimerActe = (acteId) => {
    setActesSelectionnes(actesSelectionnes.filter(a => a.id !== acteId));
  };

  // Mettre à jour la quantité
  const updateQuantite = (acteId, quantite) => {
    setActesSelectionnes(actesSelectionnes.map(a => 
      a.id === acteId ? { ...a, quantite: parseInt(quantite) || 1 } : a
    ));
  };

  // Mettre à jour le tarif unitaire
  const updateTarif = (acteId, tarif) => {
    setActesSelectionnes(actesSelectionnes.map(a => 
      a.id === acteId ? { ...a, tarifUnitaire: parseFloat(tarif) || 0 } : a
    ));
  };

  // Calculer les totaux
  const calculerTotaux = () => {
    const sousTotal = actesSelectionnes.reduce((sum, acte) => 
      sum + (acte.quantite * acte.tarifUnitaire), 0
    );
    
    const montantRemise = (sousTotal * remise) / 100;
    const total = sousTotal - montantRemise;

    return {
      sousTotal,
      montantRemise,
      total
    };
  };

  // Générer et télécharger le PDF
  const handleDownloadPDF = async () => {
    if (actesSelectionnes.length === 0) {
      showWarning('Veuillez ajouter au moins un acte au devis');
      return;
    }

    setLoading(true);
    try {
      const totaux = calculerTotaux();
      const numeroDevis = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const devisData = {
        numero: numeroDevis,
        date: new Date().toISOString(),
        patient: {
          id: patientId,
          nom: patientNom,
          prenom: patientPrenom,
          tauxCouverture: 0 // À adapter si on récupère l'assurance
        },
        medecin: `Dr. ${medecinNom}`,
        actes: actesSelectionnes,
        sousTotal: totaux.sousTotal,
        remise: remise,
        total: totaux.total,
        montantAssurance: 0,
        montantPatient: totaux.total,
        observations
      };

      const result = await generateDevisPDF(supabase, devisData, false, tenantId);
      if (result.success) {
        showSuccess('Devis généré avec succès');
      } else {
        showError('Erreur lors de la génération du PDF: ' + result.error);
      }
    } catch (error) {
      showError('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Imprimer le devis
  const handlePrintPDF = async () => {
    if (actesSelectionnes.length === 0) {
      showWarning('Veuillez ajouter au moins un acte au devis');
      return;
    }

    setLoading(true);
    try {
      const totaux = calculerTotaux();
      const numeroDevis = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const devisData = {
        numero: numeroDevis,
        date: new Date().toISOString(),
        patient: {
          id: patientId,
          nom: patientNom,
          prenom: patientPrenom,
          tauxCouverture: 0
        },
        medecin: `Dr. ${medecinNom}`,
        actes: actesSelectionnes,
        sousTotal: totaux.sousTotal,
        remise: remise,
        total: totaux.total,
        montantAssurance: 0,
        montantPatient: totaux.total,
        observations
      };

      const result = await generateDevisPDF(supabase, devisData, true, tenantId);
      if (result.success) {
        showSuccess('Devis envoyé à l\'impression');
      } else {
        showError('Erreur lors de l\'impression: ' + result.error);
      }
    } catch (error) {
      showError('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const totaux = calculerTotaux();

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Créer un Devis
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Patient: {patientPrenom} {patientNom}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche: Sélection des actes */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ajouter des actes au devis
                </label>
                {loadingActes ? (
                  <div className="flex items-center justify-center p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm text-gray-600">Chargement des actes...</span>
                  </div>
                ) : (
                  <SearchableSelect
                    options={typesActes?.map(acte => ({
                      id: acte.id,
                      label: `${acte.code_ccam || `ACT-${acte.id}`} - ${acte.nom}`,
                      ...acte
                    })) || []}
                    value=""
                    onChange={(value) => {
                      const acte = typesActes.find(a => a.id === parseInt(value));
                      if (acte) ajouterActe(acte);
                    }}
                    placeholder="Rechercher et ajouter un acte..."
                    searchPlaceholder="Rechercher par code ou libellé..."
                    emptyMessage="Aucun acte trouvé"
                  />
                )}
              </div>

              {/* Liste des actes sélectionnés */}
              <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                <h4 className="font-medium text-gray-900 mb-3">Actes sélectionnés ({actesSelectionnes.length})</h4>
                {actesSelectionnes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Aucun acte dans le devis</p>
                    <p className="text-sm">Ajoutez des actes en utilisant le champ de recherche ci-dessus</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {actesSelectionnes.map((acte) => (
                      <div key={acte.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{acte.acte.libelle}</p>
                            <p className="text-sm text-gray-500">{acte.acte.code}</p>
                          </div>
                          <button
                            onClick={() => supprimerActe(acte.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Quantité</label>
                            <input
                              type="number"
                              min="1"
                              value={acte.quantite}
                              onChange={(e) => updateQuantite(acte.id, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Tarif unitaire</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={acte.tarifUnitaire}
                              onChange={(e) => updateTarif(acte.id, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                        <div className="text-right mt-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatMontantDecimal(acte.quantite * acte.tarifUnitaire)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne droite: Résumé et options */}
            <div className="space-y-4">
              {/* Remise */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remise (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={remise}
                  onChange={(e) => setRemise(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Observations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observations</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Notes ou conditions particulières..."
                />
              </div>

              {/* Résumé financier */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Résumé du devis
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sous-total:</span>
                    <span className="font-medium">{formatMontantDecimal(totaux.sousTotal)}</span>
                  </div>
                  {totaux.montantRemise > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Remise ({remise}%):</span>
                      <span className="font-medium">-{formatMontantDecimal(totaux.montantRemise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Total:</span>
                    <span className="font-bold text-lg">{formatMontantDecimal(totaux.total)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleDownloadPDF}
                  disabled={loading || actesSelectionnes.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  {loading ? 'Génération...' : 'Télécharger le PDF'}
                </button>
                <button
                  onClick={handlePrintPDF}
                  disabled={loading || actesSelectionnes.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  {loading ? 'Impression...' : 'Imprimer le devis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevisModal;
