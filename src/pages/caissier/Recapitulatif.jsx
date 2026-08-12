import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, FileText, Printer, Download, RefreshCw, X } from 'lucide-react';
import SearchableSelect from '../../components/common/SearchableSelect';
import Dropdown from '../../components/common/Dropdown';
import Pagination, { ItemsPerPageSelector } from '../../components/common/Pagination';
import { formatMontant } from '../../utils/currency';
import { getStatusColor, getStatusLabel, computeStatutPaiement } from '../../utils/factureStatus';
import { listFactures } from '../../services/paiementService';
import { listAssurances } from '../../services/assuranceService';
import { patientService } from '../../lib/services';
import { fetchParametres } from '../../services/parametrageService';
import ExportUtils from '../../utils/ExportUtils';

const PERIODS = [
  { value: 'all', label: 'Toutes les dates' },
  { value: 'day', label: 'Par jour' },
  { value: 'month', label: 'Par mois' },
  { value: 'range', label: 'Par période (du ... au ...)' },
];

const getDateRange = (period, dateDebut, dateFin) => {
  const now = new Date();
  let debut = new Date(0);
  let fin = new Date(now.getTime() + 86400000);
  if (period === 'day') {
    debut.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    debut.setHours(0, 0, 0, 0);
    fin = new Date(debut.getTime() + 86400000 - 1);
  } else if (period === 'month') {
    debut = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    fin = new Date(now);
  } else if (period === 'range' && dateDebut && dateFin) {
    debut = new Date(dateDebut);
    fin = new Date(dateFin);
    fin.setHours(23, 59, 59, 999);
  }
  return { debut, fin };
};

const Recapitulatif = () => {
  const { userProfile } = useAuth();
  const [period, setPeriod] = useState('month');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterMedecin, setFilterMedecin] = useState('');
  const [filterCouverture, setFilterCouverture] = useState('');
  const [patients, setPatients] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [assurances, setAssurances] = useState([]);
  const [cabinet, setCabinet] = useState(null);
  const [factures, setFactures] = useState([]);
  const [facturesCouverture, setFacturesCouverture] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resumePatient, setResumePatient] = useState([]);
  const [resumeCouverture, setResumeCouverture] = useState([]);
  const [revenuParMedecin, setRevenuParMedecin] = useState([]);
  const [factureView, setFactureView] = useState('couverture'); // 'couverture' | 'liste'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [resumePatientPage, setResumePatientPage] = useState(1);
  const [resumePatientPageSize, setResumePatientPageSize] = useState(10);
  const [resumeCouverturePage, setResumeCouverturePage] = useState(1);
  const [resumeCouverturePageSize, setResumeCouverturePageSize] = useState(10);
  const printRef = useRef(null);
  const [printSingleId, setPrintSingleId] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, a, cab] = await Promise.all([
        patientService.getAllWithAssurance().catch(() => []),
        listAssurances().catch(() => []),
        fetchParametres(userProfile?.tenant_id).catch(() => null),
      ]);
      setPatients(p);
      setAssurances(a);
      setCabinet(cab);
    })();
  }, []);

  const fetchRecap = async () => {
    setLoading(true);
    try {
      const { debut, fin } = getDateRange(period, dateDebut, dateFin);

      // Filtre couverture : on ne peut pas filtrer côté serveur (couverture peut être sur le
      // patient) → on récupère la période puis on filtre en JS. Filtre médecin délégué à
      // listFactures (medecinId), qui applique le même filtrage client-side sur
      // consultations.medecin_id que le code précédent.
      // Pas de .limit() par défaut ici (l'ancien appel natif n'en avait pas) : on force une
      // limite haute pour ne pas tronquer silencieusement le récapitulatif.
      // On ne passe plus excludeCouverture: true — on a besoin des factures -C (part assurance)
      // pour calculer ce que chaque couverture doit réellement, pas juste le reste dû du patient
      // réétiqueté avec le nom de son assureur.
      const rawData = await listFactures({
        periode: period !== 'all'
          ? { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) }
          : undefined,
        patientId: filterPatient || undefined,
        medecinId: filterMedecin || undefined,
        limit: 100000,
      });

      // Couverture effective = celle de la facture si renseignée, sinon celle du patient (liste des assurances)
      const effectiveCouverture = (f) => {
        const aid = f.assurance_id ?? f.patients?.assurance_id;
        const nom = f.assurances?.nom ?? f.patients?.assurances?.nom ?? null;
        return { id: aid, nom: nom || 'Sans couverture' };
      };

      // Séparation factures patient (facture_parent_id null) / factures couverture (-C, type='couverture')
      // — ces dernières portent le montant réellement dû par l'assureur, source autoritaire du split
      // (voir CLAUDE.md : modèle facture/paiement).
      let dataPatient = (rawData || []).filter((f) => f.type !== 'couverture');
      let dataCouv = (rawData || []).filter((f) => f.type === 'couverture');
      if (filterCouverture) {
        dataPatient = dataPatient.filter((f) => String(effectiveCouverture(f).id) === String(filterCouverture));
        dataCouv = dataCouv.filter((f) => String(f.assurance_id) === String(filterCouverture));
      }
      setFactures(dataPatient);
      setFacturesCouverture(dataCouv);

      // Reste à payer par patient (part patient) + part assurance restant due (depuis les -C liées),
      // sur la même règle de compensation (on additionne tout, trop-perçus compris, plutôt que de
      // faire disparaître silencieusement les factures en restant négatif).
      const byPatient = {};
      dataPatient.forEach((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        const pid = f.patient_id || f.patients?.id;
        if (!pid) return;
        if (!byPatient[pid]) byPatient[pid] = { patient: f.patients, totalRestant: 0, partAssurance: 0 };
        byPatient[pid].totalRestant += restant;
      });
      dataCouv.forEach((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        const pid = f.patient_id || f.patients?.id;
        if (!pid) return;
        if (!byPatient[pid]) byPatient[pid] = { patient: f.patients, totalRestant: 0, partAssurance: 0 };
        byPatient[pid].partAssurance += restant;
      });
      // N'affiche que les patients ayant eux-mêmes un manquement sur LEUR part (positif = ils
      // doivent encore, négatif = trop-perçu à afficher explicitement) — un patient qui a réglé
      // sa part ne doit plus apparaître ici même si l'assurance n'a pas encore payé la sienne
      // (ça, c'est le rôle du tableau "Reste à payer par couverture").
      setResumePatient(Object.values(byPatient).filter((r) => r.totalRestant !== 0));

      // Reste dû par couverture = calculé uniquement depuis les factures -C (ce que l'assureur
      // doit réellement), et non plus depuis le reste dû du patient réétiqueté. Même règle de
      // compensation que ci-dessus, et le total peut désormais rester visible même négatif
      // (trop-perçu de l'assureur) au lieu de disparaître silencieusement.
      const byCouverture = {};
      dataCouv.forEach((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        const aid = f.assurance_id;
        const nom = f.assurances?.nom || 'Sans couverture';
        const key = aid ?? 'sans';
        if (!byCouverture[key]) byCouverture[key] = { nom, total: 0 };
        byCouverture[key].total += restant;
      });
      setResumeCouverture(Object.values(byCouverture).filter((r) => r.total !== 0));

      // Revenus encaissés par médecin sur la période — somme des montant_paye des factures
      // patient ET couverture rattachées à ses consultations (l'argent réellement en caisse,
      // qu'il vienne du patient ou de l'assureur), base du calcul part médecin / part cabinet.
      const byMedecinRevenu = {};
      [...dataPatient, ...dataCouv].forEach((f) => {
        const medecin = f.consultations?.users;
        const paye = parseFloat(f.montant_paye || 0);
        if (!medecin?.id || paye <= 0) return;
        if (!byMedecinRevenu[medecin.id]) byMedecinRevenu[medecin.id] = { medecin, totalEncaisse: 0 };
        byMedecinRevenu[medecin.id].totalEncaisse += paye;
      });
      setRevenuParMedecin(Object.values(byMedecinRevenu).sort((a, b) => b.totalEncaisse - a.totalEncaisse));

      // Extraire les médecins uniques des factures affichées pour le filtre
      const medecinsMap = new Map();
      dataPatient.forEach(f => {
        const medecin = f.consultations?.users;
        if (medecin && medecin.id) {
          medecinsMap.set(medecin.id, medecin);
        }
      });
      const medecinsList = Array.from(medecinsMap.values()).sort((a, b) =>
        (a.nom || '').localeCompare(b.nom || '')
      );
      setMedecins(medecinsList);
    } catch (e) {
      console.error('fetchRecap:', e);
      setFactures([]);
      setFacturesCouverture([]);
      setResumePatient([]);
      setResumeCouverture([]);
      setRevenuParMedecin([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecap();
  }, [period, dateDebut, dateFin, filterPatient, filterMedecin, filterCouverture]);

  useEffect(() => {
    setCurrentPage(1);
    setResumePatientPage(1);
    setResumeCouverturePage(1);
  }, [period, dateDebut, dateFin, filterPatient, filterMedecin, filterCouverture]);

  const patientLabel = filterPatient ? patients.find((p) => String(p.id) === String(filterPatient)) : null;
  const couvertureLabel = filterCouverture ? assurances.find((a) => String(a.id) === String(filterCouverture)) : null;

  // Statut affiché = recalculé depuis les montants plutôt que la colonne statut_paiement stockée
  // (qui peut être restée figée sur "paye" alors que la facture est en réalité partielle — bug
  // constaté sur des données réelles). On respecte toutefois "impaye", seul statut qui n'est pas
  // dérivable des montants : c'est une marque manuelle (créance jugée irrécouvrable), pas un état
  // calculable via computeStatutPaiement (qui ne le retourne jamais).
  const getFactureStatut = (f) => (
    f.statut_paiement === 'impaye' ? 'impaye' : computeStatutPaiement(f.montant_paye, f.montant_ttc)
  );

  // Un total "reste à payer" agrégé peut être négatif (trop-perçu net) depuis qu'on compense
  // toutes les factures au lieu d'exclure silencieusement celles au reste négatif. On l'affiche
  // alors comme une ligne explicite plutôt que de la faire disparaître.
  const resteClass = (val) => (val < 0 ? 'text-blue-700' : 'text-orange-700');
  const resteLabel = (val) => `${formatMontant(val)}${val < 0 ? ' (trop-perçu)' : ''}`;

  // Couverture effective : facture.assurance_id/assurances si renseignés, sinon patient.assurance_id/assurances (liste des couvertures = source de vérité)
  const getCouvertureFacture = (f) => {
    const id = f.assurance_id ?? f.patients?.assurance_id;
    const nom = f.assurances?.nom ?? f.patients?.assurances?.nom ?? null;
    return { id: id ?? 'sans', nom: nom || 'Sans couverture' };
  };

  const totalTTC = factures.reduce((s, f) => s + parseFloat(f.montant_ttc || 0), 0);
  const totalPaye = factures.reduce((s, f) => s + parseFloat(f.montant_paye || 0), 0);
  const totalRestant = factures.reduce((s, f) => s + parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0))), 0);

  // Pour le filtre patient : taux de couverture et montant à charge de la couverture
  const patientAssurance = patientLabel?.assurances || (patientLabel?.assurance_id ? assurances.find((a) => String(a.id) === String(patientLabel.assurance_id)) : null);
  const tauxCouverture = patientAssurance?.taux_remboursement != null ? parseFloat(patientAssurance.taux_remboursement) : 0;
  const montantChargeCouverture = tauxCouverture > 0 ? totalTTC * (tauxCouverture / 100) : 0;

  // Pour le filtre couverture : liste des patients concernés, calculée depuis les factures -C
  // (montant réellement dû par l'assureur), pas depuis le reste dû du patient réétiqueté.
  const facturesByPatientCouverture = (() => {
    if (!filterCouverture || !facturesCouverture.length) return [];
    const byPatient = {};
    facturesCouverture.forEach((f) => {
      const pid = f.patient_id || f.patients?.id;
      if (!pid) return;
      const paye = parseFloat(f.montant_paye || 0);
      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - paye));
      if (!byPatient[pid]) byPatient[pid] = { patient: f.patients, totalPaye: 0, totalRestant: 0 };
      byPatient[pid].totalPaye += paye;
      byPatient[pid].totalRestant += restant;
    });
    return Object.values(byPatient);
  })();

  // Regroupement par couverture (pour section "Facture par couverture") — calculé depuis les
  // factures -C elles-mêmes (regroupées par assurance_id), donc un vrai "ce que chaque assureur
  // doit encore" plutôt qu'un doublon du tableau "par patient" réagrégé sous une autre clé.
  const facturesParCouverture = (() => {
    if (filterPatient || !facturesCouverture.length) return [];
    const byId = {};
    facturesCouverture.forEach((f) => {
      const key = f.assurance_id ?? 'sans';
      const nom = f.assurances?.nom || 'Sans couverture';
      if (!byId[key]) byId[key] = { id: key, nom, factures: [], totalPaye: 0, totalRestant: 0 };
      const paye = parseFloat(f.montant_paye || 0);
      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - paye));
      byId[key].factures.push(f);
      byId[key].totalPaye += paye;
      byId[key].totalRestant += restant;
    });
    return Object.values(byId);
  })();

  const factureCss = `
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; max-width: 800px; margin: 0 auto; }
    .header-info { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 24px; border-bottom: 2px solid #1e40af; padding-bottom: 16px; }
    .logo-container { flex-shrink: 0; }
    .cabinet-logo { max-height: 60px; max-width: 120px; object-fit: contain; }
    .header-content { flex: 1; }
    .cabinet-info h4 { margin: 0 0 8px 0; font-size: 18px; color: #1e40af; }
    .cabinet-info p { margin: 2px 0; color: #555; font-size: 11px; }
    .titre-doc { font-size: 18px; font-weight: bold; margin: 16px 0 12px 0; color: #1e3a5f; }
    .info-section { margin-bottom: 16px; }
    .info-section h3 { font-size: 13px; margin: 0 0 6px 0; color: #374151; }
    .info-section p { margin: 4px 0; }
    .couverture-section { margin: 16px 0; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f3f4f6; font-weight: bold; font-size: 11px; }
    .totaux { margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px; }
    .totaux p { margin: 6px 0; font-weight: bold; }
    .footer { margin-top: 28px; font-size: 10px; color: #6b7280; }
  `;

  const buildFactureHtmlTousPatients = (doPrint) => {
    if (!factures.length || filterPatient || filterCouverture) return null;
    const caissierLabel = userProfile ? `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || '–' : '–';
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const { debut, fin } = getDateRange(period, dateDebut, dateFin);
    const periodLabel = period === 'all' ? 'Toutes les dates' : period === 'day' ? 'Jour' : period === 'month' ? 'Mois' : `Du ${debut.toLocaleDateString('fr-FR')} au ${fin.toLocaleDateString('fr-FR')}`;
    const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
    const rows = factures.map((f) => {
      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
      const patientNom = f.patients ? `${f.patients.prenom || ''} ${f.patients.nom || ''}`.trim() : '–';
      const medecin = f.consultations?.users ? `${f.consultations.users.prenom || ''} ${f.consultations.users.nom || ''}`.trim() : '–';
      return `<tr>
        <td>${f.numero_facture || ''}</td>
        <td>${f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}</td>
        <td>${patientNom}</td>
        <td>${medecin}</td>
        <td style="text-align:right">${formatNumberOnly(parseFloat(f.montant_ttc || 0))}</td>
        <td style="text-align:right">${formatNumberOnly(parseFloat(f.montant_paye || 0))}</td>
        <td style="text-align:right">${formatNumberOnly(restant)}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture globale – Tous les patients</title><style>${factureCss}</style></head><body>
    <div class="header-info">
      ${cabinet?.logo_url ? `<div class="logo-container"><img src="${cabinet.logo_url}" alt="Logo" class="cabinet-logo" /></div>` : ''}
      <div class="header-content">
        <div class="cabinet-info">
          <h4>${cabinet?.nom_cabinet || 'Cabinet Médical'}</h4>
          ${cabinet?.adresse ? `<p>${cabinet.adresse}</p>` : ''}
          ${cabinet?.telephone ? `<p>Tél: ${cabinet.telephone}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="titre-doc">FACTURE GLOBALE – TOUS LES PATIENTS</div>
    <div class="info-section">
      <p><strong>Période :</strong> ${periodLabel}</p>
      <p><strong>Nombre de factures :</strong> ${factures.length}</p>
      <p>Caissier : ${caissierLabel}</p>
      <p>Date d'édition : ${dateStr}</p>
    </div>
    <table>
      <thead><tr><th>N° facture</th><th>Date</th><th>Patient</th><th>Médecin</th><th>TTC (F CFA)</th><th>Payé (F CFA)</th><th>Reste (F CFA)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totaux">
      <p><strong>Total TTC :</strong> ${formatMontant(totalTTC)}</p>
      <p><strong>Total payé :</strong> ${formatMontant(totalPaye)}</p>
      <p><strong>Total restant :</strong> ${formatMontant(totalRestant)}</p>
    </div>
    <div class="footer">Document généré depuis le récapitulatif caisse.</div>
    ${doPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script>' : ''}
    </body></html>`;
    return html;
  };

  const buildFactureHtmlForCouverture = (couvId, nom, listFactures, doPrint) => {
    if (!listFactures?.length) return null;
    const caissierLabel = userProfile ? `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || '–' : '–';
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const byPatient = {};
    listFactures.forEach((f) => {
      const pid = f.patient_id || f.patients?.id;
      if (!pid) return;
      const paye = parseFloat(f.montant_paye || 0);
      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - paye));
      if (!byPatient[pid]) byPatient[pid] = { patient: f.patients, totalPaye: 0, totalRestant: 0 };
      byPatient[pid].totalPaye += paye;
      byPatient[pid].totalRestant += restant;
    });
    const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
    const rows = Object.values(byPatient).map((row) => `
      <tr>
        <td>${row.patient?.prenom || ''} ${row.patient?.nom || ''}</td>
        <td style="text-align:right">${formatNumberOnly(row.totalPaye)}</td>
        <td style="text-align:right">${formatNumberOnly(row.totalRestant)}</td>
      </tr>`).join('');
    const totalPayeC = listFactures.reduce((s, f) => s + parseFloat(f.montant_paye || 0), 0);
    const totalRestantC = listFactures.reduce((s, f) => s + parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0))), 0);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture – ${nom}</title><style>${factureCss}</style></head><body>
    <div class="header-info">
      ${cabinet?.logo_url ? `<div class="logo-container"><img src="${cabinet.logo_url}" alt="Logo" class="cabinet-logo" /></div>` : ''}
      <div class="header-content">
        <div class="cabinet-info">
          <h4>${cabinet?.nom_cabinet || 'Cabinet Médical'}</h4>
          ${cabinet?.adresse ? `<p>${cabinet.adresse}</p>` : ''}
          ${cabinet?.telephone ? `<p>Tél: ${cabinet.telephone}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="titre-doc">FACTURE COUVERTURE MÉDICALE</div>
    <div class="info-section">
      <h3>Couverture</h3>
      <p><strong>${nom}</strong></p>
      <p>Date d'édition : ${dateStr}</p>
      <p>Caissier : ${caissierLabel}</p>
    </div>
    <table>
      <thead><tr><th>Patient</th><th>Somme partielle payée (F CFA)</th><th>Reste à payer (F CFA)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totaux">
      <p><strong>Total somme partielle :</strong> ${formatMontant(totalPayeC)}</p>
      <p><strong>Total reste à payer :</strong> ${formatMontant(totalRestantC)}</p>
      <p><strong>Somme totale due par la couverture :</strong> ${formatMontant(totalPayeC + totalRestantC)}</p>
    </div>
    <div class="footer">Document généré depuis le récapitulatif caisse.</div>
    ${doPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script>' : ''}
    </body></html>`;
    return html;
  };

  const buildFactureHtml = (doPrint) => {
    if (!(filterPatient || filterCouverture) || factures.length === 0) return;
    const type = filterPatient ? 'patient' : 'couverture';
    const caissierLabel = userProfile ? `${userProfile.prenom || ''} ${userProfile.nom || ''}`.trim() || '–' : '–';
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const datesConsultation = [...new Set(factures.map((f) => f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : '').filter(Boolean))].join(', ');

    let clientSection = '';
    let tableRows = '';
    let totauxSection = '';
    let couvertureSection = '';

    if (type === 'patient' && patientLabel) {
      clientSection = `
        <div class="info-section">
          <h3>Informations patient</h3>
          <p><strong>${patientLabel.prenom} ${patientLabel.nom}</strong></p>
          ${datesConsultation ? `<p><strong>Date(s) de facturation :</strong> ${datesConsultation}</p>` : ''}
        </div>`;
      const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
      tableRows = factures.map((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        const medecin = f.consultations?.users ? `${f.consultations.users.prenom || ''} ${f.consultations.users.nom || ''}`.trim() : '–';
        return `<tr>
          <td>${f.numero_facture || ''}</td>
          <td>${f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}</td>
          <td>${medecin}</td>
          <td style="text-align:right">${formatNumberOnly(parseFloat(f.montant_paye || 0))}</td>
          <td style="text-align:right">${formatNumberOnly(restant)}</td>
        </tr>`;
      }).join('');
      totauxSection = `
        <p><strong>Somme partielle payée :</strong> ${formatMontant(totalPaye)}</p>
        <p><strong>Somme restante à payer :</strong> ${formatMontant(totalRestant)}</p>
        <p><strong>Somme totale payée :</strong> ${formatMontant(totalPaye)}</p>
        <p><strong>Total TTC :</strong> ${formatMontant(totalTTC)}</p>`;
      if (tauxCouverture > 0 && patientAssurance) {
        couvertureSection = `
        <div class="couverture-section">
          <h3>Détails de couverture</h3>
          <p><strong>Couverture :</strong> ${patientAssurance.nom || '–'}</p>
          <p><strong>Pourcentage de couverture :</strong> ${tauxCouverture} %</p>
          <p><strong>Montant à charge de la couverture :</strong> ${formatMontant(montantChargeCouverture)}</p>
        </div>`;
      }
    } else if (type === 'couverture' && couvertureLabel) {
      clientSection = `
        <div class="info-section">
          <h3>Couverture médicale</h3>
          <p><strong>${couvertureLabel.nom}</strong></p>
          <p>Date d'édition : ${dateStr}</p>
          <p>Caissier : ${caissierLabel}</p>
        </div>`;
      const formatNumberOnly = (val) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, useGrouping: true }).format(val).replace(/\u00A0/g, ' ');
      tableRows = facturesByPatientCouverture.map((row) => `
        <tr>
          <td>${row.patient?.prenom || ''} ${row.patient?.nom || ''}</td>
          <td style="text-align:right">${formatNumberOnly(row.totalPaye)}</td>
          <td style="text-align:right">${formatNumberOnly(row.totalRestant)}</td>
        </tr>`).join('');
      const totalPayeCouv = facturesByPatientCouverture.reduce((s, r) => s + r.totalPaye, 0);
      const totalRestantCouv = facturesByPatientCouverture.reduce((s, r) => s + r.totalRestant, 0);
      totauxSection = `
        <p><strong>Total somme partielle :</strong> ${formatNumberOnly(totalPayeCouv)}</p>
        <p><strong>Total reste à payer :</strong> ${formatNumberOnly(totalRestantCouv)}</p>
        <p><strong>Somme totale due par la couverture :</strong> ${formatMontant(totalPayeCouv + totalRestantCouv)}</p>`;
    }

    const tableHeader = type === 'patient'
      ? '<tr><th>N° facture</th><th>Date</th><th>Médecin</th><th>Somme partielle payée (F CFA)</th><th>Somme restante (F CFA)</th></tr>'
      : '<tr><th>Patient</th><th>Somme partielle payée (F CFA)</th><th>Reste à payer (F CFA)</th></tr>';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture – ${type}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; max-width: 800px; margin: 0 auto; }
      .header-info { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 24px; border-bottom: 2px solid #1e40af; padding-bottom: 16px; }
      .logo-container { flex-shrink: 0; }
      .cabinet-logo { max-height: 60px; max-width: 120px; object-fit: contain; }
      .header-content { flex: 1; }
      .cabinet-info h4 { margin: 0 0 8px 0; font-size: 18px; color: #1e40af; }
      .cabinet-info p { margin: 2px 0; color: #555; font-size: 11px; }
      .titre-doc { font-size: 18px; font-weight: bold; margin: 16px 0 12px 0; color: #1e3a5f; }
      .info-section { margin-bottom: 16px; }
      .info-section h3 { font-size: 13px; margin: 0 0 6px 0; color: #374151; }
      .info-section p { margin: 4px 0; }
      .couverture-section { margin: 16px 0; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; }
      .couverture-section h3 { font-size: 13px; margin: 0 0 6px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
      th { background: #f3f4f6; font-weight: bold; font-size: 11px; }
      .totaux { margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 8px; }
      .totaux p { margin: 6px 0; font-weight: bold; }
      .footer { margin-top: 28px; font-size: 10px; color: #6b7280; }
    </style></head><body>
    <div class="header-info">
      ${cabinet?.logo_url ? `<div class="logo-container"><img src="${cabinet.logo_url}" alt="Logo" class="cabinet-logo" /></div>` : ''}
      <div class="header-content">
        <div class="cabinet-info">
          <h4>${cabinet?.nom_cabinet || 'Cabinet Médical'}</h4>
          ${cabinet?.adresse ? `<p>${cabinet.adresse}</p>` : ''}
          ${cabinet?.ville || cabinet?.code_postal ? `<p>${cabinet.ville || ''} ${cabinet.code_postal || ''}</p>` : ''}
          ${cabinet?.telephone ? `<p>Tél: ${cabinet.telephone}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="titre-doc">FACTURE ${type === 'patient' ? 'PATIENT' : 'COUVERTURE MÉDICALE'}</div>
    ${clientSection}
    ${type === 'patient' ? `<p>Caissier : ${caissierLabel}</p><p>Date d'édition : ${dateStr}</p>` : ''}
    <table>
      <thead>${tableHeader}</thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="totaux">${totauxSection}</div>
    ${couvertureSection}
    <div class="footer">Document généré depuis le récapitulatif caisse.</div>
    ${doPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script>' : ''}
    </body></html>`;
    return html;
  };

  const handleGenererFacture = () => {
    const html = buildFactureHtml(false);
    if (!html) return;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const handlePrintGlobale = () => {
    const html = buildFactureHtml(true);
    if (!html) return;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const openFactureWindow = (html, doPrint) => {
    if (!html) return;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const handleGenererFactureTousPatients = () => openFactureWindow(buildFactureHtmlTousPatients(false));
  const handlePrintFactureTousPatients = () => openFactureWindow(buildFactureHtmlTousPatients(true));

  const handleGenererFactureCouverture = (couv) => openFactureWindow(buildFactureHtmlForCouverture(couv.id, couv.nom, couv.factures, false));
  const handlePrintFactureCouverture = (couv) => openFactureWindow(buildFactureHtmlForCouverture(couv.id, couv.nom, couv.factures, true));

  const handlePrintPartielle = (factureId) => {
    setPrintSingleId(factureId);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintSingleId(null), 300);
    }, 100);
  };

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const handleExportResumePatient = () => {
    const rows = resumePatient.map((r) => ({
      patient: `${r.patient?.prenom || ''} ${r.patient?.nom || ''}`.trim(),
      reste: Math.round(r.totalRestant),
      partAssurance: Math.round(r.partAssurance || 0),
    }));
    ExportUtils.exportToCSV(rows, `reste_a_payer_par_patient_${todayStr()}`, [
      { key: 'patient', label: 'Patient' },
      { key: 'reste', label: 'Reste (FCFA)' },
      { key: 'partAssurance', label: 'Part assurance restant due (FCFA)' },
    ]);
  };

  const handleExportResumeCouverture = () => {
    const rows = resumeCouverture.map((r) => ({
      couverture: r.nom,
      reste: Math.round(r.total),
    }));
    ExportUtils.exportToCSV(rows, `reste_a_payer_par_couverture_${todayStr()}`, [
      { key: 'couverture', label: 'Couverture' },
      { key: 'reste', label: 'Reste (FCFA)' },
    ]);
  };

  const tauxRetrocession = cabinet?.taux_retrocession_medecin != null ? parseFloat(cabinet.taux_retrocession_medecin) : null;
  const partMedecin = (encaisse) => (tauxRetrocession != null ? encaisse * (tauxRetrocession / 100) : null);
  const partCabinet = (encaisse) => (tauxRetrocession != null ? encaisse * ((100 - tauxRetrocession) / 100) : null);
  const totalEncaisseMedecins = revenuParMedecin.reduce((s, r) => s + r.totalEncaisse, 0);

  const handleExportRevenuMedecin = () => {
    const rows = revenuParMedecin.map((r) => ({
      medecin: `${r.medecin?.prenom || ''} ${r.medecin?.nom || ''}`.trim(),
      encaisse: Math.round(r.totalEncaisse),
      partMedecin: tauxRetrocession != null ? Math.round(partMedecin(r.totalEncaisse)) : '',
      partCabinet: tauxRetrocession != null ? Math.round(partCabinet(r.totalEncaisse)) : '',
    }));
    ExportUtils.exportToCSV(rows, `revenus_par_medecin_${todayStr()}`, [
      { key: 'medecin', label: 'Médecin' },
      { key: 'encaisse', label: 'Total encaissé (FCFA)' },
      { key: 'partMedecin', label: `Part médecin (FCFA)${tauxRetrocession != null ? ` — ${tauxRetrocession}%` : ''}` },
      { key: 'partCabinet', label: `Part cabinet (FCFA)${tauxRetrocession != null ? ` — ${(100 - tauxRetrocession).toFixed(2)}%` : ''}` },
    ]);
  };

  const handleExportFacturesParCouverture = () => {
    const rows = facturesParCouverture.map((c) => ({
      couverture: c.nom,
      nbFactures: c.factures.length,
      totalPaye: Math.round(c.totalPaye),
      totalRestant: Math.round(c.totalRestant),
    }));
    ExportUtils.exportToCSV(rows, `facture_par_couverture_${todayStr()}`, [
      { key: 'couverture', label: 'Couverture' },
      { key: 'nbFactures', label: 'Nb factures' },
      { key: 'totalPaye', label: 'Total payé (FCFA)' },
      { key: 'totalRestant', label: 'Total restant (FCFA)' },
    ]);
  };

  const handleExportFactures = () => {
    const rows = factures.map((f) => {
      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
      const medecin = f.consultations?.users ? `${f.consultations.users.prenom || ''} ${f.consultations.users.nom || ''}`.trim() : '';
      return {
        numero: f.numero_facture || '',
        date: f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : '',
        patient: f.patients ? `${f.patients.prenom || ''} ${f.patients.nom || ''}`.trim() : '',
        medecin,
        couverture: getCouvertureFacture(f).nom,
        ttc: Math.round(parseFloat(f.montant_ttc || 0)),
        paye: Math.round(parseFloat(f.montant_paye || 0)),
        reste: Math.round(restant),
        statut: getStatusLabel(getFactureStatut(f)),
      };
    });
    // Exporte toutes les factures de la période (pas seulement les 200 premières affichées à l'écran).
    ExportUtils.exportToCSV(rows, `factures_${todayStr()}`, [
      { key: 'numero', label: 'N° facture' },
      { key: 'date', label: 'Date' },
      { key: 'patient', label: 'Patient' },
      { key: 'medecin', label: 'Médecin' },
      { key: 'couverture', label: 'Couverture' },
      { key: 'ttc', label: 'TTC (FCFA)' },
      { key: 'paye', label: 'Payé (FCFA)' },
      { key: 'reste', label: 'Reste (FCFA)' },
      { key: 'statut', label: 'Statut' },
    ]);
  };

  const totalPagesFactures = Math.max(1, Math.ceil(factures.length / itemsPerPage));
  const facturesToShow = printSingleId
    ? factures.filter((f) => f.id === printSingleId)
    : factures.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPagesResumePatient = Math.max(1, Math.ceil(resumePatient.length / resumePatientPageSize));
  const resumePatientToShow = resumePatient.slice(
    (resumePatientPage - 1) * resumePatientPageSize,
    resumePatientPage * resumePatientPageSize
  );

  const totalPagesResumeCouverture = Math.max(1, Math.ceil(resumeCouverture.length / resumeCouverturePageSize));
  const resumeCouvertureToShow = resumeCouverture.slice(
    (resumeCouverturePage - 1) * resumeCouverturePageSize,
    resumeCouverturePage * resumeCouverturePageSize
  );

  const activePeriodLabel = PERIODS.find((p) => p.value === period)?.label || '';

  return (
    <div className="p-6 max-w-[1280px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-medical-primary/10 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-medical-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Récapitulatif</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Suivi des factures, du reste à payer et des couvertures</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-6 mb-5">
        <p className="text-sm font-semibold text-gray-900 mb-1">Filtres</p>
        <p className="text-[12.5px] text-gray-500 mb-4">Sélectionnez un patient ou une couverture pour afficher le détail et générer une facture.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Dropdown
            label="Période"
            value={period}
            onChange={(v) => setPeriod(v || 'all')}
            options={PERIODS}
            size="md"
          />
          <SearchableSelect
            label="Patient"
            options={[
              { id: '', label: 'Tous' },
              ...patients.map((p) => ({
                id: p.id,
                label: `${p.prenom || ''} ${p.nom || ''}`.trim() || `Patient #${p.id}`,
                prenom: p.prenom,
                nom: p.nom,
              })),
            ]}
            value={filterPatient}
            onChange={(id) => setFilterPatient(id ?? '')}
            placeholder="Tous les patients"
            searchPlaceholder="Taper pour filtrer (ex. A...)"
            emptyMessage="Aucun patient trouvé"
          />
          <SearchableSelect
            label="Médecin"
            options={[
              { id: '', label: 'Tous' },
              ...medecins.map((m) => ({
                id: m.id,
                label: `${m.prenom || ''} ${m.nom || ''}`.trim() || `Médecin #${m.id}`,
                prenom: m.prenom,
                nom: m.nom,
              })),
            ]}
            value={filterMedecin}
            onChange={(id) => setFilterMedecin(id ?? '')}
            placeholder="Tous les médecins"
            searchPlaceholder="Taper pour filtrer (ex. A...)"
            emptyMessage="Aucun médecin trouvé"
          />
          <SearchableSelect
            label="Couverture"
            options={[
              { id: '', label: 'Toutes' },
              ...assurances.map((a) => ({
                id: a.id,
                label: a.nom || `Couverture #${a.id}`,
                nom: a.nom,
              })),
            ]}
            value={filterCouverture}
            onChange={(id) => setFilterCouverture(id ?? '')}
            placeholder="Toutes les couvertures"
            searchPlaceholder="Taper pour filtrer (ex. A...)"
            emptyMessage="Aucune couverture trouvée"
          />
        </div>

        {period === 'range' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Du</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Au</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs shadow-sm focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-medical-primary/10 text-medical-primary rounded-full text-xs font-medium">
              {activePeriodLabel}
              {period !== 'all' && (
                <button type="button" onClick={() => setPeriod('all')} className="hover:text-medical-primary-dark" title="Réinitialiser la période">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
            <span className="text-[12.5px] text-gray-500">
              → <strong className="text-gray-900 font-semibold">{factures.length} facture{factures.length > 1 ? 's' : ''}</strong> correspondent à ces filtres
            </span>
          </div>
          <button
            type="button"
            onClick={fetchRecap}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-medical-primary text-white rounded-xl text-sm font-medium hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5">
              <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-gray-400 mb-1.5">Total TTC</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatMontant(totalTTC)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5">
              <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-gray-400 mb-1.5">Total payé</p>
              <p className="text-2xl font-semibold text-emerald-700">
                {formatMontant(totalPaye)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-5">
              <p className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-gray-400 mb-1.5">Total restant</p>
              <p className="text-2xl font-semibold text-orange-700">
                {formatMontant(totalRestant)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[13px] font-semibold text-gray-900">Reste à payer par patient</p>
                <div className="flex items-center gap-2">
                  <ItemsPerPageSelector
                    value={resumePatientPageSize}
                    onChange={(size) => {
                      setResumePatientPageSize(size);
                      setResumePatientPage(1);
                    }}
                  />
                  {resumePatient.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportResumePatient}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-[11.5px] font-medium hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[240px]">
                <table className="min-w-full text-[13px]">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-semibold text-gray-500">Patient</th>
                      <th className="px-5 py-2.5 text-right text-[11.5px] font-semibold text-gray-500">Reste (F CFA)</th>
                      <th className="px-5 py-2.5 text-right text-[11.5px] font-semibold text-gray-500">Part assurance restant due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumePatient.length === 0 ? (
                      <tr><td colSpan={3} className="px-5 py-4 text-center text-gray-500">Aucun</td></tr>
                    ) : (
                      resumePatientToShow.map((r, idx) => (
                        <tr key={r.patient?.id ?? `p-${idx}`} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 text-gray-900">{r.patient?.prenom} {r.patient?.nom}</td>
                          <td className={`px-5 py-2.5 text-right font-medium ${resteClass(r.totalRestant)}`}>{resteLabel(r.totalRestant)}</td>
                          <td className="px-5 py-2.5 text-right text-gray-600">{r.partAssurance ? formatMontant(r.partAssurance) : '–'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {resumePatient.length > 0 && (
                <Pagination
                  currentPage={resumePatientPage}
                  totalPages={totalPagesResumePatient}
                  onPageChange={setResumePatientPage}
                  itemsPerPage={resumePatientPageSize}
                  totalItems={resumePatient.length}
                />
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[13px] font-semibold text-gray-900">Reste à payer par couverture</p>
                <div className="flex items-center gap-2">
                  <ItemsPerPageSelector
                    value={resumeCouverturePageSize}
                    onChange={(size) => {
                      setResumeCouverturePageSize(size);
                      setResumeCouverturePage(1);
                    }}
                  />
                  {resumeCouverture.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportResumeCouverture}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-[11.5px] font-medium hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[240px]">
                <table className="min-w-full text-[13px]">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-semibold text-gray-500">Couverture</th>
                      <th className="px-5 py-2.5 text-right text-[11.5px] font-semibold text-gray-500">Reste (F CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumeCouverture.length === 0 ? (
                      <tr><td colSpan={2} className="px-5 py-4 text-center text-gray-500">Aucun</td></tr>
                    ) : (
                      resumeCouvertureToShow.map((r) => (
                        <tr key={r.nom} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 text-gray-900">{r.nom}</td>
                          <td className={`px-5 py-2.5 text-right font-medium ${resteClass(r.total)}`}>{resteLabel(r.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {resumeCouverture.length > 0 && (
                <Pagination
                  currentPage={resumeCouverturePage}
                  totalPages={totalPagesResumeCouverture}
                  onPageChange={setResumeCouverturePage}
                  itemsPerPage={resumeCouverturePageSize}
                  totalItems={resumeCouverture.length}
                />
              )}
            </div>
          </div>

          {/* Revenus par médecin — encaissé (patient + assurance) par médecin sur la période, et
              répartition part médecin / part cabinet si le taux de rétrocession est configuré
              (Paramètres du cabinet). */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Revenus par médecin</p>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {tauxRetrocession != null
                    ? `Répartition selon le taux configuré : ${tauxRetrocession}% médecin / ${(100 - tauxRetrocession).toFixed(2)}% cabinet.`
                    : 'Taux de rétrocession non configuré — allez dans Paramètres du cabinet pour voir la répartition part médecin / part cabinet.'}
                </p>
              </div>
              {revenuParMedecin.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportRevenuMedecin}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-[11.5px] font-medium hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-semibold text-gray-500">Médecin</th>
                    <th className="px-5 py-2.5 text-right text-[11.5px] font-semibold text-gray-500">Total encaissé</th>
                    <th className="px-5 py-2.5 text-right text-[11.5px] font-semibold text-gray-500">Part médecin</th>
                    <th className="px-5 py-2.5 text-right text-[11.5px] font-semibold text-gray-500">Part cabinet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revenuParMedecin.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-4 text-center text-gray-500">Aucun encaissement sur cette période.</td></tr>
                  ) : (
                    revenuParMedecin.map((r) => (
                      <tr key={r.medecin.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-gray-900">Dr. {r.medecin?.prenom} {r.medecin?.nom}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-gray-900">{formatMontant(r.totalEncaisse)}</td>
                        <td className="px-5 py-2.5 text-right text-emerald-700">
                          {tauxRetrocession != null ? formatMontant(partMedecin(r.totalEncaisse)) : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-right text-blue-700">
                          {tauxRetrocession != null ? formatMontant(partCabinet(r.totalEncaisse)) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {revenuParMedecin.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-5 py-2.5 text-right font-medium text-gray-700">Total</td>
                      <td className="px-5 py-2.5 text-right font-bold text-gray-900">{formatMontant(totalEncaisseMedecins)}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-emerald-700">
                        {tauxRetrocession != null ? formatMontant(partMedecin(totalEncaisseMedecins)) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold text-blue-700">
                        {tauxRetrocession != null ? formatMontant(partCabinet(totalEncaisseMedecins)) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Facture totale – Tous les patients (visible sans filtre) */}
          {!filterPatient && !filterCouverture && factures.length > 0 && (
            <div className="bg-white border border-[#ece7fb] rounded-[20px] shadow-sm p-6 mb-5">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-medical-primary" />
                Facture totale — Tous les patients
              </p>
              <p className="text-[12.5px] text-gray-500 mb-4">
                Récapitulatif global de la période : {factures.length} facture{factures.length > 1 ? 's' : ''}.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleGenererFactureTousPatients}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-medical-primary text-medical-primary rounded-xl text-sm font-medium hover:bg-medical-primary/5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Générer facture globale
                </button>
                <button
                  type="button"
                  onClick={handlePrintFactureTousPatients}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-medical-primary text-white rounded-xl text-sm font-medium hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer facture globale
                </button>
              </div>
            </div>
          )}

          {/* Facture – patient ou couverture sélectionné(e) (mêmes handlers que la facture globale) */}
          {(filterPatient || filterCouverture) && factures.length > 0 && (
            <div className="bg-white border border-[#ece7fb] rounded-[20px] shadow-sm p-6 mb-5">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-medical-primary" />
                {filterPatient && patientLabel
                  ? `Facture — ${patientLabel.prenom} ${patientLabel.nom}`
                  : `Facture — ${couvertureLabel?.nom || ''}`}
              </p>
              <p className="text-[12.5px] text-gray-500 mb-4">
                {factures.length} facture{factures.length > 1 ? 's' : ''} correspondent à ce filtre.
              </p>
              {filterPatient && tauxCouverture > 0 && patientAssurance && (
                <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-[12.5px] text-blue-900">
                  Couverture <strong>{patientAssurance.nom}</strong> — {tauxCouverture}% pris en charge, soit{' '}
                  <strong>{formatMontant(montantChargeCouverture)}</strong> à la charge de la couverture.
                </div>
              )}
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleGenererFacture}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-medical-primary text-medical-primary rounded-xl text-sm font-medium hover:bg-medical-primary/5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Générer facture
                </button>
                <button
                  type="button"
                  onClick={handlePrintGlobale}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-medical-primary text-white rounded-xl text-sm font-medium hover:bg-medical-primary-dark transition-colors shadow-[0_4px_14px_rgb(var(--medical-primary-rgb)/0.35)]"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer facture
                </button>
              </div>
            </div>
          )}

          <div ref={printRef} className="bg-white border border-gray-200 rounded-[20px] shadow-sm overflow-hidden print:shadow-none print:border-0">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3 print:block">
              <div>
                <p className="text-sm font-semibold text-gray-900">Facturation</p>
                <p className="text-[12.5px] text-gray-500 mt-1">
                  {factureView === 'couverture'
                    ? 'Total global par couverture pour la période.'
                    : 'Toutes les factures de la période, filtrables par patient ou couverture.'}
                </p>
              </div>
              <div className="flex items-center gap-2.5 print:hidden">
                <div className="flex gap-0.5 bg-gray-100 rounded-full p-[3px]">
                  <button
                    type="button"
                    onClick={() => setFactureView('couverture')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      factureView === 'couverture' ? 'bg-white text-medical-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Par couverture
                  </button>
                  <button
                    type="button"
                    onClick={() => setFactureView('liste')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      factureView === 'liste' ? 'bg-white text-medical-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Liste des factures
                  </button>
                </div>
                {factureView === 'couverture' ? (
                  facturesParCouverture.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportFacturesParCouverture}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Exporter CSV
                    </button>
                  )
                ) : (
                  factures.length > 0 && (
                    <>
                      <ItemsPerPageSelector
                        value={itemsPerPage}
                        onChange={(size) => {
                          setItemsPerPage(size);
                          setCurrentPage(1);
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleExportFactures}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Exporter CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> Imprimer
                      </button>
                    </>
                  )
                )}
              </div>
            </div>

            {factureView === 'couverture' ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-gray-500">Couverture</th>
                      <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-gray-500">Nb factures</th>
                      <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-gray-500">Total payé</th>
                      <th className="px-5 py-3 text-right text-[11.5px] font-semibold text-gray-500">Total restant</th>
                      <th className="px-6 py-3 text-center text-[11.5px] font-semibold text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {facturesParCouverture.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Aucune couverture pour ces filtres.</td></tr>
                    ) : (
                      facturesParCouverture.map((couv) => (
                        <tr key={couv.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{couv.nom}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{couv.factures.length}</td>
                          <td className="px-5 py-3 text-right text-emerald-700">{formatMontant(couv.totalPaye)}</td>
                          <td className={`px-5 py-3 text-right font-medium ${resteClass(couv.totalRestant)}`}>{resteLabel(couv.totalRestant)}</td>
                          <td className="px-6 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleGenererFactureCouverture(couv)}
                                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[11.5px] font-medium hover:bg-gray-50 transition-colors"
                              >
                                Générer
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintFactureCouverture(couv)}
                                className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[11.5px] font-medium hover:bg-gray-800 transition-colors"
                              >
                                Imprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overflow-y-auto max-h-[280px] print:max-h-none print:overflow-visible">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10 print:static">
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">N° facture</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">Date</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Patient</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Médecin</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Couverture</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500">TTC</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500">Payé</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500">Reste</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Statut</th>
                        <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 print:hidden">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {factures.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Aucune facture.</td></tr>
                      ) : (
                        facturesToShow.map((f) => {
                          const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
                          const medecin = f.consultations?.users ? `${f.consultations.users.prenom || ''} ${f.consultations.users.nom || ''}`.trim() : '–';
                          return (
                            <tr key={f.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 text-gray-900">{f.numero_facture}</td>
                              <td className="px-4 py-3 text-gray-600">{f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}</td>
                              <td className="px-4 py-3 text-gray-900">{f.patients?.prenom} {f.patients?.nom}</td>
                              <td className="px-4 py-3 text-gray-600">{medecin}</td>
                              <td className="px-4 py-3 text-gray-600">{getCouvertureFacture(f).nom}</td>
                              <td className="px-4 py-3 text-right text-gray-900">{formatMontant(parseFloat(f.montant_ttc || 0))}</td>
                              <td className="px-4 py-3 text-right text-emerald-700">{formatMontant(parseFloat(f.montant_paye || 0))}</td>
                              <td className="px-4 py-3 text-right text-orange-700 font-medium">{formatMontant(restant)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusColor(getFactureStatut(f))}`}>
                                  {getStatusLabel(getFactureStatut(f))}
                                </span>
                              </td>
                              <td className="px-5 py-3 print:hidden">
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handlePrintPartielle(f.id)}
                                    title="Imprimer (facture partielle)"
                                    className="p-1.5 bg-medical-primary/10 text-medical-primary rounded-lg hover:bg-medical-primary/20 transition-colors"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {factures.length > 0 && !printSingleId && (
                  <div className="border-t border-gray-100 print:hidden">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPagesFactures}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={factures.length}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Recapitulatif;
