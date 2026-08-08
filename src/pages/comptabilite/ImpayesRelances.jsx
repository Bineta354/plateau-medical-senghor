import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Search, AlertTriangle, Bell, RefreshCw, ChevronDown, ChevronRight,
  Mail, Smartphone, TrendingUp, Users, ShieldCheck, Inbox
} from 'lucide-react';
import { formatMontant } from '../../utils/currency';
import KpiCard from '../../components/common/KpiCard';

/**
 * Impayés & Relances — fusion de AlertesImpayes.jsx (comptabilité) et
 * caissier/Relances.jsx (même requête factures en_attente/partiel dupliquée
 * en deux endroits). Ajoute un onglet "Créances assurance" : les deux écrans
 * fusionnés excluaient systématiquement les factures type='couverture'
 * (facture_parent_id renseigné), rendant la part assurance impayée invisible
 * partout dans l'application.
 *
 * Échéance calculée en dur à date_facture + 30 jours (aucune colonne
 * date_echeance en base actuellement — voir le chantier DB séparé).
 *
 * Présentation en cartes dépliables (une par débiteur) plutôt qu'un tableau
 * avec toutes les factures listées en ligne : un débiteur avec des dizaines
 * de factures (ex. un assureur) rendait ce tableau illisible.
 */

const SEVERITE_SEUILS = { critique: 60, eleve: 30 };

const computeSeverite = (retard) => {
  if (retard > SEVERITE_SEUILS.critique) return 'critique';
  if (retard > SEVERITE_SEUILS.eleve) return 'eleve';
  return 'moyen';
};

const getSeveriteColor = (severite) => {
  switch (severite) {
    case 'critique': return 'bg-red-100 text-red-800 border-red-200';
    case 'eleve': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'moyen': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSeveriteLabel = (severite) => {
  switch (severite) {
    case 'critique': return 'Critique';
    case 'eleve': return 'Élevée';
    default: return 'Moyenne';
  }
};

const getSeveriteAvatarColor = (severite) => {
  switch (severite) {
    case 'critique': return 'bg-red-100 text-red-700';
    case 'eleve': return 'bg-orange-100 text-orange-700';
    default: return 'bg-yellow-100 text-yellow-700';
  }
};

const initiales = (prenom, nom) => `${(prenom || '?')[0] || '?'}${(nom || '')[0] || ''}`.toUpperCase();

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const ExpandChevron = ({ open }) => (
  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
);

const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
    <Icon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
    <p className="font-medium text-gray-700">{title}</p>
    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

/** Carte dépliable pour une créance patient : identité + sévérité + détail des factures en liste défilante. */
const PatientCard = ({ item, expanded, onToggle, onRelanceEmail, onRelanceSms, sending }) => {
  const facturesTriees = [...item.factures].sort((a, b) => b.restant - a.restant);
  const isSendingThis = sending?.id === item.patient?.id;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 sm:gap-4 p-4 text-left hover:bg-gray-50 transition-colors">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${getSeveriteAvatarColor(item.severiteMax)}`}>
          {initiales(item.patient?.prenom, item.patient?.nom)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{item.patient?.prenom} {item.patient?.nom}</p>
          <p className="text-xs text-gray-500 truncate">{item.patient?.email || item.patient?.telephone || '—'}</p>
        </div>
        <span className={`hidden sm:inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border flex-shrink-0 ${getSeveriteColor(item.severiteMax)}`}>
          {getSeveriteLabel(item.severiteMax)}
        </span>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500">{item.factures.length} facture{item.factures.length > 1 ? 's' : ''}</p>
          <p className="font-semibold text-amber-700">{formatMontant(item.totalRestant)}</p>
        </div>
        <ExpandChevron open={expanded} />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Détail des factures</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onRelanceEmail(item)}
                disabled={!!sending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" /> {isSendingThis && sending?.type === 'email' ? 'Envoi…' : 'Relance email'}
              </button>
              <button
                type="button"
                onClick={() => onRelanceSms(item)}
                disabled={!!sending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
              >
                <Smartphone className="w-3.5 h-3.5" /> {isSendingThis && sending?.type === 'sms' ? 'Envoi…' : 'Relance SMS'}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {facturesTriees.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{f.numero_facture}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(f.date_facture)} · {f.retard > 0 ? `${f.retard} j de retard` : 'dans les délais'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${getSeveriteColor(f.severite)}`}>
                    {getSeveriteLabel(f.severite)}
                  </span>
                  <span className="font-medium text-gray-900">{formatMontant(f.restant)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Carte pour une créance assurance : résumé seulement, en un clic elle renvoie vers la
 * page de détail (patient / médecin / facture / montant en tableau complet) — inutile de
 * dupliquer cette liste ici en inline, elle peut compter des dizaines de factures.
 */
const AssuranceCard = ({ item }) => {
  const routeId = item.assurance?.id ?? 'sans_assurance';

  return (
    <Link
      to={`/comptabilite/impayes/assurance/${routeId}`}
      className="flex items-center gap-3 sm:gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all"
    >
      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
        <ShieldCheck className="w-5 h-5 text-purple-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate">{item.assurance?.nom || 'Assureur non renseigné'}</p>
        <p className="text-xs text-gray-500 truncate">{item.factures.length} facture{item.factures.length > 1 ? 's' : ''} de couverture en attente</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-gray-500">Reste dû</p>
        <p className="font-semibold text-amber-700">{formatMontant(item.totalRestant)}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </Link>
  );
};

const ImpayesRelances = () => {
  const [tab, setTab] = useState('patients'); // 'patients' | 'assurance'
  const [loading, setLoading] = useState(true);
  const [patientsItems, setPatientsItems] = useState([]);
  const [assuranceItems, setAssuranceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverite, setFilterSeverite] = useState('all');
  const [sending, setSending] = useState(null);
  const [toast, setToast] = useState(null);
  // Cartes dépliées (clé préfixée par onglet pour éviter toute collision d'id patient/assureur)
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  useEffect(() => {
    chargerCreances();
  }, []);

  const toggleExpand = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chargerCreances = async () => {
    setLoading(true);
    try {
      const [{ data: patientFactures, error: e1 }, { data: couvertureFactures, error: e2 }] = await Promise.all([
        supabase
          .from('factures')
          .select(`
            id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant,
            statut_paiement, patient_id, assurance_id,
            patients ( id, nom, prenom, email, telephone ),
            assurances ( id, nom )
          `)
          .is('facture_parent_id', null)
          .in('statut_paiement', ['en_attente', 'partiel'])
          .order('date_facture', { ascending: false })
          .limit(500),
        supabase
          .from('factures')
          .select(`
            id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant,
            statut_paiement, patient_id, assurance_id, facture_parent_id,
            patients ( id, nom, prenom ),
            assurances ( id, nom )
          `)
          .eq('type', 'couverture')
          .neq('statut_paiement', 'paye')
          .order('date_facture', { ascending: false })
          .limit(500),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;

      // --- Créances patients : groupées par patient ---
      const byPatient = {};
      (patientFactures || []).forEach((f) => {
        const pid = f.patient_id || f.patients?.id;
        if (!pid) return;
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        if (restant <= 0) return;

        const dateFacture = new Date(f.date_facture);
        const dateEcheance = new Date(dateFacture);
        dateEcheance.setDate(dateEcheance.getDate() + 30);
        const retard = Math.max(0, Math.floor((new Date() - dateEcheance) / (1000 * 60 * 60 * 24)));
        const severite = computeSeverite(retard);

        if (!byPatient[pid]) {
          byPatient[pid] = { patient: f.patients, factures: [], totalRestant: 0, severiteMax: 'moyen' };
        }
        byPatient[pid].factures.push({
          id: f.id,
          numero_facture: f.numero_facture,
          date_facture: f.date_facture,
          date_echeance: dateEcheance.toISOString().split('T')[0],
          montant_ttc: parseFloat(f.montant_ttc || 0),
          montant_paye: parseFloat(f.montant_paye || 0),
          restant,
          retard,
          severite,
        });
        byPatient[pid].totalRestant += restant;
        if (severite === 'critique') byPatient[pid].severiteMax = 'critique';
        else if (severite === 'eleve' && byPatient[pid].severiteMax !== 'critique') byPatient[pid].severiteMax = 'eleve';
      });
      setPatientsItems(Object.values(byPatient));

      // --- Créances assurance : groupées par assureur ---
      const byAssurance = {};
      (couvertureFactures || []).forEach((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        if (restant <= 0) return;
        const aid = f.assurance_id || 'sans_assurance';
        if (!byAssurance[aid]) {
          byAssurance[aid] = { assurance: f.assurances || { nom: 'Assureur non renseigné' }, factures: [], totalRestant: 0 };
        }
        byAssurance[aid].factures.push({
          id: f.id,
          numero_facture: f.numero_facture,
          date_facture: f.date_facture,
          patient: f.patients,
          montant_ttc: parseFloat(f.montant_ttc || 0),
          montant_paye: parseFloat(f.montant_paye || 0),
          restant,
        });
        byAssurance[aid].totalRestant += restant;
      });
      setAssuranceItems(Object.values(byAssurance));
    } catch (e) {
      console.error('Erreur lors du chargement des créances:', e);
      setPatientsItems([]);
      setAssuranceItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRelanceEmail = async (item) => {
    setSending({ type: 'email', id: item.patient?.id });
    try {
      // TODO: brancher edge function / API email — actuellement non implémenté.
      await new Promise((r) => setTimeout(r, 800));
      setToast({ type: 'info', msg: `Relance email préparée pour ${item.patient?.prenom} ${item.patient?.nom}. (Envoi à configurer.)` });
    } finally {
      setSending(null);
    }
  };

  const handleRelanceSms = async (item) => {
    setSending({ type: 'sms', id: item.patient?.id });
    try {
      // TODO: brancher edge function / API SMS — actuellement non implémenté.
      await new Promise((r) => setTimeout(r, 800));
      setToast({ type: 'info', msg: `Relance SMS préparée pour ${item.patient?.prenom} ${item.patient?.nom}. (Envoi à configurer.)` });
    } finally {
      setSending(null);
    }
  };

  const filteredPatients = patientsItems.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      `${item.patient?.prenom} ${item.patient?.nom}`.toLowerCase().includes(term) ||
      item.patient?.email?.toLowerCase().includes(term) ||
      item.patient?.telephone?.includes(term) ||
      item.factures.some((f) => f.numero_facture.toLowerCase().includes(term));
    const matchesSeverite = filterSeverite === 'all' || item.severiteMax === filterSeverite;
    return matchesSearch && matchesSeverite;
  }).sort((a, b) => b.totalRestant - a.totalRestant);

  const filteredAssurance = assuranceItems.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      item.assurance?.nom?.toLowerCase().includes(term) ||
      item.factures.some((f) => f.numero_facture.toLowerCase().includes(term) || `${f.patient?.prenom} ${f.patient?.nom}`.toLowerCase().includes(term))
    );
  }).sort((a, b) => b.totalRestant - a.totalRestant);

  const statsPatients = {
    total: patientsItems.length,
    critiques: patientsItems.filter((i) => i.severiteMax === 'critique').length,
    montantTotal: patientsItems.reduce((sum, i) => sum + i.totalRestant, 0),
  };
  const statsAssurance = {
    total: assuranceItems.length,
    factures: assuranceItems.reduce((sum, i) => sum + i.factures.length, 0),
    montantTotal: assuranceItems.reduce((sum, i) => sum + i.totalRestant, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">Chargement des créances...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-purple-600" />
            </span>
            Impayés & Relances
          </h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            Qui doit encore de l'argent au cabinet — patients et assurances — et depuis combien de temps.
          </p>
        </div>
        <button
          onClick={chargerCreances}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {toast && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 text-sm" role="alert">
          <span>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} className="font-medium text-blue-600 hover:text-blue-800 flex-shrink-0">Fermer</button>
        </div>
      )}

      {/* Onglets */}
      <div className="inline-flex gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-auto">
        <button
          onClick={() => setTab('patients')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'patients' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" /> Créances patients
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'patients' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
            {statsPatients.total}
          </span>
        </button>
        <button
          onClick={() => setTab('assurance')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'assurance' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Créances assurance
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === 'assurance' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
            {statsAssurance.total}
          </span>
        </button>
      </div>

      {tab === 'patients' ? (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={Users} label="Patients concernés" value={statsPatients.total} tone="purple" />
            <KpiCard icon={AlertTriangle} label="Situations critiques (> 60 j)" value={statsPatients.critiques} tone="red" />
            <KpiCard icon={TrendingUp} label="Montant total dû" value={formatMontant(statsPatients.montantTotal)} tone="blue" />
          </div>

          {/* Filtres */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Patient, facture, téléphone, email..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <select
                value={filterSeverite}
                onChange={(e) => setFilterSeverite(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">Toutes sévérités</option>
                <option value="critique">Critique</option>
                <option value="eleve">Élevée</option>
                <option value="moyen">Moyenne</option>
              </select>
            </div>
          </div>

          {/* Liste — une carte dépliable par patient */}
          {filteredPatients.length === 0 ? (
            <EmptyState
              icon={patientsItems.length === 0 ? Inbox : Search}
              title={patientsItems.length === 0 ? 'Aucune créance patient en cours' : 'Aucun résultat pour cette recherche'}
              subtitle={patientsItems.length === 0 ? 'Toutes les factures patients sont à jour.' : 'Essayez un autre nom, numéro de facture ou filtre.'}
            />
          ) : (
            <div className="space-y-3">
              {filteredPatients.map((item) => (
                <PatientCard
                  key={item.patient?.id}
                  item={item}
                  expanded={expandedKeys.has(`p-${item.patient?.id}`)}
                  onToggle={() => toggleExpand(`p-${item.patient?.id}`)}
                  onRelanceEmail={handleRelanceEmail}
                  onRelanceSms={handleRelanceSms}
                  sending={sending}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Statistiques assurance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={ShieldCheck} label="Assureurs concernés" value={statsAssurance.total} tone="purple" />
            <KpiCard icon={AlertTriangle} label="Factures en attente" value={statsAssurance.factures} tone="red" />
            <KpiCard icon={TrendingUp} label="Montant total dû" value={formatMontant(statsAssurance.montantTotal)} tone="blue" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="relative md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Assureur, facture, patient..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Liste — une carte dépliable par assureur */}
          {filteredAssurance.length === 0 ? (
            <EmptyState
              icon={assuranceItems.length === 0 ? Inbox : Search}
              title={assuranceItems.length === 0 ? 'Aucune créance assurance en cours' : 'Aucun résultat pour cette recherche'}
              subtitle={assuranceItems.length === 0 ? "Les factures de couverture n'apparaissaient auparavant dans aucun écran." : 'Essayez un autre nom d’assureur, de patient ou de facture.'}
            />
          ) : (
            <div className="space-y-3">
              {filteredAssurance.map((item, idx) => (
                <AssuranceCard key={item.assurance?.id ?? idx} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImpayesRelances;
