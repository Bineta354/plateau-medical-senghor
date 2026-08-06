import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Eye,
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  FileText,
  X,
  CreditCard,
  TrendingUp,
  RefreshCw,
  Banknote,
  CreditCard as CardIcon,
  Smartphone,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../contexts/AlertContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatMontant } from '../../utils/currency';
import { getStatusColor, getStatusLabel } from '../../utils/factureStatus';
import { MODES_PAIEMENT, getModePaiementLabel } from '../../config/modesPaiement';
import { enregistrerPaiement } from '../../services/paiementService';

/**
 * Corrections comptables — écran réservé à la comptabilité/admin pour ajuster
 * une facture a posteriori (correction d'encaissement, décaissement),
 * en dehors du guichet de caisse quotidien (voir src/pages/secretary/Caisse.jsx).
 * Utilise le même moteur d'encaissement (paiementService.enregistrerPaiement)
 * pour ne jamais désynchroniser factures/paiements.
 */
const EncaissementFactures = () => {
  const { showError, showSuccess, showWarning } = useAlert();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('outstanding'); // Par défaut : à encaisser
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [showDetails, setShowDetails] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentData, setPaymentData] = useState({
    montant_paye: 0,
    mode_paiement: 'especes',
    notes: ''
  });

  useEffect(() => {
    fetchFactures();
  }, [selectedStatus, selectedPeriod]);

  const fetchFactures = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('factures')
        .select(`
          id,
          numero_facture,
          date_facture,
          montant_ht,
          tva,
          montant_ttc,
          montant_paye,
          montant_restant,
          statut_paiement,
          mode_paiement,
          notes,
          created_at,
          updated_at,
          patients (
            id,
            nom,
            prenom,
            telephone,
            email
          ),
          consultations (
            id,
            date_consultation,
            medecin_id,
            users (
              id,
              nom,
              prenom
            )
          )
        `)
        .order('date_facture', { ascending: false });

      if (selectedStatus === 'outstanding') {
        query = query.in('statut_paiement', ['en_attente', 'partiel']);
      } else if (selectedStatus !== 'all') {
        query = query.eq('statut_paiement', selectedStatus);
      }

      const today = new Date();
      if (selectedPeriod === 'today') {
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        query = query.gte('date_facture', startOfDay.toISOString()).lt('date_facture', endOfDay.toISOString());
      } else if (selectedPeriod === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        query = query.gte('date_facture', startOfWeek.toISOString());
      } else if (selectedPeriod === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        query = query.gte('date_facture', startOfMonth.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      setFactures(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredFactures = factures.filter(facture => {
    return (
      facture.numero_facture?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${facture.patients?.prenom} ${facture.patients?.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facture.consultations?.users?.nom?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalFactures = factures.length;
  const totalChiffre = factures.reduce((sum, f) => sum + (f.montant_ttc || 0), 0);
  const totalEncaisse = factures.reduce((sum, f) => sum + (f.montant_paye || 0), 0);
  const totalRestant = factures.reduce((sum, f) => sum + (f.montant_restant || 0), 0);
  const facturesPayees = factures.filter(f => f.statut_paiement === 'paye').length;

  const getPaymentModeIcon = (mode) => {
    switch (mode) {
      case 'especes': return Banknote;
      case 'carte': return CardIcon;
      case 'cheque': return FileText;
      case 'monnaie_electronique':
      case 'orange_money':
      case 'wave':
      case 'yas':
        return Smartphone;
      default: return CreditCard;
    }
  };

  const handleEncaisser = (facture) => {
    setSelectedFacture(facture);
    setPaymentData({
      montant_paye: facture.montant_restant || 0,
      mode_paiement: 'especes',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedFacture) return;
    const amount = parseFloat(paymentData.montant_paye) || 0;
    const isDecaissement = amount < 0;

    if (amount === 0) {
      showWarning('Veuillez saisir un montant différent de 0');
      return;
    }

    setSubmitting(true);
    try {
      await enregistrerPaiement({
        factureId: selectedFacture.id,
        montant: amount,
        modePaiement: paymentData.mode_paiement,
        notes: paymentData.notes
          ? `${selectedFacture.notes || ''}\n${paymentData.notes}`.trim()
          : selectedFacture.notes,
        caissierId: userProfile?.id ?? null,
      });

      showSuccess(
        isDecaissement
          ? `Décaissement enregistré (${formatMontant(Math.abs(amount))})`
          : `Encaissement enregistré (${formatMontant(amount)})`,
      );
      setShowPaymentModal(false);
      setSelectedFacture(null);
      fetchFactures();
    } catch (error) {
      console.error("Erreur lors de l'encaissement:", error);
      showError("Erreur lors de l'encaissement : " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = (facture) => {
    setShowDetails(facture);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des factures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-purple-600" />
            Corrections comptables
          </h1>
          <p className="text-gray-600 mt-2">
            Ajustez un encaissement a posteriori (correction, décaissement) — hors guichet de caisse quotidien
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => fetchFactures()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          Erreur de chargement : {error}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total factures</p>
              <p className="text-2xl font-bold text-gray-900">{totalFactures}</p>
            </div>
            <Receipt className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Chiffre d'affaires</p>
              <p className="text-2xl font-bold text-gray-900">{formatMontant(totalChiffre)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Encaissé</p>
              <p className="text-2xl font-bold text-green-600">{formatMontant(totalEncaisse)}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Reste à encaisser</p>
              <p className="text-2xl font-bold text-orange-600">{formatMontant(totalRestant)}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Factures payées</p>
              <p className="text-2xl font-bold text-gray-900">{facturesPayees}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une facture (numéro, patient, médecin)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="outstanding">À encaisser</option>
              <option value="en_attente">En attente</option>
              <option value="partiel">Partiellement payées</option>
              <option value="paye">Payées</option>
              <option value="impaye">Impayées</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="all">Toutes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des factures */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Factures</h2>
          <p className="text-sm text-gray-600">{filteredFactures.length} facture(s) trouvée(s)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facture</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Médecin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFactures.map((facture) => {
                const PaymentIcon = getPaymentModeIcon(facture.mode_paiement);
                return (
                  <tr key={facture.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{facture.numero_facture}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(facture.date_facture).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {facture.patients?.prenom} {facture.patients?.nom}
                        </p>
                        {facture.patients?.telephone && (
                          <p className="text-xs text-gray-500">{facture.patients.telephone}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">
                        Dr. {facture.consultations?.users?.prenom} {facture.consultations?.users?.nom}
                      </p>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatMontant(facture.montant_ttc)}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600">
                            Payé: {formatMontant(facture.montant_paye)}
                          </span>
                          {facture.montant_restant > 0 && (
                            <span className="text-orange-600">
                              Reste: {formatMontant(facture.montant_restant)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(facture.statut_paiement)}`}>
                        {getStatusLabel(facture.statut_paiement)}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(facture)}
                          className="p-2 text-purple-600 rounded-lg hover:bg-purple-50"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {facture.statut_paiement !== 'paye' && (
                          <button
                            onClick={() => handleEncaisser(facture)}
                            className="p-2 text-green-600 rounded-lg hover:bg-green-50"
                            title="Corriger"
                          >
                            <Coins className="w-4 h-4" />
                          </button>
                        )}

                        {facture.mode_paiement && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <PaymentIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredFactures.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Aucune facture trouvée</p>
          </div>
        )}
      </div>

      {/* Modal de correction */}
      {showPaymentModal && selectedFacture && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Corriger la facture</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Facture {selectedFacture.numero_facture}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedFacture.patients?.prenom} {selectedFacture.patients?.nom}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Total: {formatMontant(selectedFacture.montant_ttc)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Déjà payé: {formatMontant(selectedFacture.montant_paye)}
                  </p>
                  <p className="text-sm font-medium text-orange-600">
                    Reste à payer: {formatMontant(selectedFacture.montant_restant)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant ({'>'}0 = encaissement, {'<'}0 = décaissement)
                </label>
                <input
                  type="number"
                  value={paymentData.montant_paye}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, montant_paye: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={-(parseFloat(selectedFacture.montant_paye) || 0)}
                  max={parseFloat(selectedFacture.montant_restant) || 0}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mode de paiement
                </label>
                <select
                  value={paymentData.mode_paiement}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, mode_paiement: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {MODES_PAIEMENT.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows="3"
                  placeholder="Motif de la correction..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                onClick={handlePaymentSubmit}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Enregistrement...' : "Valider l'opération"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Détails de la facture</h3>
              <button
                onClick={() => setShowDetails(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Numéro</p>
                  <p className="text-lg font-semibold">{showDetails.numero_facture}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Date</p>
                  <p className="text-lg">{new Date(showDetails.date_facture).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Patient</p>
                  <p className="text-lg">
                    {showDetails.patients?.prenom} {showDetails.patients?.nom}
                  </p>
                  {showDetails.patients?.telephone && (
                    <p className="text-sm text-gray-500">{showDetails.patients.telephone}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Médecin</p>
                  <p className="text-lg">
                    Dr. {showDetails.consultations?.users?.prenom} {showDetails.consultations?.users?.nom}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant HT:</span>
                    <span className="font-medium">{formatMontant(showDetails.montant_ht)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TVA:</span>
                    <span className="font-medium">{showDetails.tva?.toLocaleString()}%</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Montant TTC:</span>
                    <span>{formatMontant(showDetails.montant_ttc)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Montant payé:</span>
                    <span className="font-medium text-green-600">{formatMontant(showDetails.montant_paye)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reste à payer:</span>
                    <span className="font-medium text-orange-600">{formatMontant(showDetails.montant_restant)}</span>
                  </div>
                  {showDetails.mode_paiement && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dernier mode de paiement:</span>
                      <span className="font-medium">{getModePaiementLabel(showDetails.mode_paiement)}</span>
                    </div>
                  )}
                </div>
              </div>

              {showDetails.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Notes</p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded">{showDetails.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              {showDetails.statut_paiement !== 'paye' && (
                <button
                  onClick={() => {
                    setShowDetails(null);
                    handleEncaisser(showDetails);
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Corriger
                </button>
              )}
              <button
                onClick={() => setShowDetails(null)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncaissementFactures;
