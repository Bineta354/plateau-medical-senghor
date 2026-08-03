import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, FileText, Printer } from 'lucide-react';
import SearchableSelect from '../../components/common/SearchableSelect';
import { formatMontant, formatNombre } from '../../utils/currency';

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
  const [filterCouverture, setFilterCouverture] = useState('');
  const [filterMedecin, setFilterMedecin] = useState('');
  const [patients, setPatients] = useState([]);
  const [assurances, setAssurances] = useState([]);
  const [medecins, setMedecins] = useState([]);
  const [cabinet, setCabinet] = useState(null);
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resumePatient, setResumePatient] = useState([]);
  const [resumeCouverture, setResumeCouverture] = useState([]);
  const [resumeMedecin, setResumeMedecin] = useState([]);
  const printRef = useRef(null);
  const [printSingleId, setPrintSingleId] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, a, m, cab] = await Promise.all([
        supabase.from('patients').select('id, nom, prenom, assurance_id, assurances ( id, nom, taux_remboursement )').order('nom').then((r) => r.data || []),
        supabase.from('assurances').select('id, nom, taux_remboursement').order('nom').then((r) => r.data || []),
        supabase.from('users').select('id, nom, prenom').eq('role', 'doctor').order('nom').then((r) => r.data || []),
        supabase.from('parametres_cabinet').select('nom_cabinet, adresse, ville, code_postal, telephone, email, logo_url').maybeSingle().then((r) => r.data || null),
      ]);
      setPatients(p);
      setAssurances(a);
      setMedecins(m);
      setCabinet(cab);
    })();
  }, []);

  const fetchRecap = async () => {
    setLoading(true);
    try {
      const { debut, fin } = getDateRange(period, dateDebut, dateFin);

      // Charger la couverture depuis la facture OU depuis le patient (liste assurances = source de vérité)
      let q = supabase
        .from('factures')
        .select(`
          id, numero_facture, date_facture, montant_ttc, montant_paye, montant_restant, statut_paiement,
          patient_id, assurance_id, consultation_id,
          patients ( id, nom, prenom, assurance_id, assurances ( id, nom ) ),
          assurances ( id, nom ),
          consultations ( id, medecin_id, medecin:medecin_id ( id, nom, prenom ) )
        `)
        .is('facture_parent_id', null);

      if (period !== 'all') {
        q = q.gte('date_facture', debut.toISOString().slice(0, 10)).lte('date_facture', fin.toISOString().slice(0, 10));
      }
      if (filterPatient) q = q.eq('patient_id', filterPatient);
      // Filtre couverture / médecin : on ne peut pas filtrer côté serveur (couverture peut être sur le
      // patient, médecin est sur la consultation liée) → on récupère la période puis on filtre en JS.

      const { data: rawData, error } = await q.order('date_facture', { ascending: false });

      if (error) throw error;

      // Couverture effective = celle de la facture si renseignée, sinon celle du patient (liste des assurances)
      const effectiveCouverture = (f) => {
        const aid = f.assurance_id ?? f.patients?.assurance_id;
        const nom = f.assurances?.nom ?? f.patients?.assurances?.nom ?? null;
        return { id: aid, nom: nom || 'Sans couverture' };
      };

      // Médecin = celui de la consultation liée à la facture (aujourd'hui, toutes les factures
      // sont rattachées à une consultation ; si ce n'est pas le cas, "Non attribué").
      const getMedecinFacture = (f) => {
        const medecin = f.consultations?.medecin;
        if (!medecin) return { id: 'non_attribue', nom: 'Non attribué' };
        return { id: medecin.id, nom: `${medecin.prenom || ''} ${medecin.nom || ''}`.trim() || `Médecin #${medecin.id}` };
      };

      let data = rawData || [];
      if (filterCouverture) {
        data = data.filter((f) => String(effectiveCouverture(f).id) === String(filterCouverture));
      }
      if (filterMedecin) {
        data = data.filter((f) => String(f.consultations?.medecin_id ?? '') === String(filterMedecin));
      }
      setFactures(data);

      const byPatient = {};
      const byCouverture = {};
      const byMedecin = {};
      data.forEach((f) => {
        const paye = parseFloat(f.montant_paye || 0);
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - paye));
        const pid = f.patient_id || f.patients?.id;
        const { nom: aNom, id: aid } = effectiveCouverture(f);
        const { nom: mNom, id: mid } = getMedecinFacture(f);

        if (!byMedecin[mid]) byMedecin[mid] = { nom: mNom, nbFactures: 0, totalPaye: 0, totalRestant: 0 };
        byMedecin[mid].nbFactures += 1;
        byMedecin[mid].totalPaye += paye;
        byMedecin[mid].totalRestant += restant;

        if (restant <= 0) return;

        if (pid) {
          if (!byPatient[pid]) byPatient[pid] = { patient: f.patients, totalRestant: 0, byCouverture: {} };
          byPatient[pid].totalRestant += restant;
          byPatient[pid].byCouverture[aNom] = (byPatient[pid].byCouverture[aNom] || 0) + restant;
        }
        if (aid !== null && aid !== undefined) {
          byCouverture[aNom] = (byCouverture[aNom] || 0) + restant;
        } else {
          byCouverture['Sans couverture'] = (byCouverture['Sans couverture'] || 0) + restant;
        }
      });

      setResumePatient(Object.values(byPatient).filter((r) => r.totalRestant > 0));
      setResumeCouverture(Object.entries(byCouverture).filter(([, t]) => t > 0).map(([nom, total]) => ({ nom, total })));
      setResumeMedecin(Object.values(byMedecin));
    } catch (e) {
      console.error('fetchRecap:', e);
      setFactures([]);
      setResumePatient([]);
      setResumeCouverture([]);
      setResumeMedecin([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecap();
  }, [period, dateDebut, dateFin, filterPatient, filterCouverture, filterMedecin]);

  const patientLabel = filterPatient ? patients.find((p) => String(p.id) === String(filterPatient)) : null;
  const couvertureLabel = filterCouverture ? assurances.find((a) => String(a.id) === String(filterCouverture)) : null;

  // Couverture effective : facture.assurance_id/assurances si renseignés, sinon patient.assurance_id/assurances (liste des couvertures = source de vérité)
  const getCouvertureFacture = (f) => {
    const id = f.assurance_id ?? f.patients?.assurance_id;
    const nom = f.assurances?.nom ?? f.patients?.assurances?.nom ?? null;
    return { id: id ?? 'sans', nom: nom || 'Sans couverture' };
  };

  // Médecin de la facture, via la consultation liée
  const getMedecinFacture = (f) => {
    const medecin = f.consultations?.medecin;
    if (!medecin) return { id: 'non_attribue', nom: 'Non attribué' };
    return { id: medecin.id, nom: `${medecin.prenom || ''} ${medecin.nom || ''}`.trim() || `Médecin #${medecin.id}` };
  };

  const printTitle = filterPatient && patientLabel
    ? `Facture – Patient: ${patientLabel.prenom} ${patientLabel.nom}`
    : filterCouverture && couvertureLabel
      ? `Facture – Couverture: ${couvertureLabel.nom}`
      : 'Factures (période / filtres)';

  const totalTTC = factures.reduce((s, f) => s + parseFloat(f.montant_ttc || 0), 0);
  const totalPaye = factures.reduce((s, f) => s + parseFloat(f.montant_paye || 0), 0);
  const totalRestant = factures.reduce((s, f) => s + parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0))), 0);

  // Pour le filtre patient : taux de couverture et montant à charge de la couverture
  const patientAssurance = patientLabel?.assurances || (patientLabel?.assurance_id ? assurances.find((a) => String(a.id) === String(patientLabel.assurance_id)) : null);
  const tauxCouverture = patientAssurance?.taux_remboursement != null ? parseFloat(patientAssurance.taux_remboursement) : 0;
  const montantChargeCouverture = tauxCouverture > 0 ? totalTTC * (tauxCouverture / 100) : 0;

  // Pour le filtre couverture : liste des patients concernés avec leurs montants
  const facturesByPatientCouverture = (() => {
    if (!filterCouverture || !factures.length) return [];
    const byPatient = {};
    factures.forEach((f) => {
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

  // Regroupement par couverture (pour section "Facture par couverture") — couverture = facture ou patient
  const facturesParCouverture = (() => {
    if (filterPatient || filterCouverture || !factures.length) return [];
    const byId = {};
    factures.forEach((f) => {
      const { id, nom } = getCouvertureFacture(f);
      const key = id === 'sans' ? 'sans' : id;
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
    const rows = factures.map((f) => {
      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
      const patientNom = f.patients ? `${f.patients.prenom || ''} ${f.patients.nom || ''}`.trim() : '–';
      return `<tr>
        <td>${f.numero_facture || ''}</td>
        <td>${f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}</td>
        <td>${patientNom}</td>
        <td style="text-align:right">${formatNombre(f.montant_ttc || 0)}</td>
        <td style="text-align:right">${formatNombre(f.montant_paye || 0)}</td>
        <td style="text-align:right">${formatNombre(restant)}</td>
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
      <thead><tr><th>N° facture</th><th>Date</th><th>Patient</th><th>TTC (F CFA)</th><th>Payé (F CFA)</th><th>Reste (F CFA)</th></tr></thead>
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
    const rows = Object.values(byPatient).map((row) => `
      <tr>
        <td>${row.patient?.prenom || ''} ${row.patient?.nom || ''}</td>
        <td style="text-align:right">${formatNombre(row.totalPaye)}</td>
        <td style="text-align:right">${formatNombre(row.totalRestant)}</td>
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
      tableRows = factures.map((f) => {
        const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
        return `<tr>
          <td>${f.numero_facture || ''}</td>
          <td>${f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}</td>
          <td style="text-align:right">${formatNombre(f.montant_paye || 0)}</td>
          <td style="text-align:right">${formatNombre(restant)}</td>
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
      tableRows = facturesByPatientCouverture.map((row) => `
        <tr>
          <td>${row.patient?.prenom || ''} ${row.patient?.nom || ''}</td>
          <td style="text-align:right">${formatNombre(row.totalPaye)}</td>
          <td style="text-align:right">${formatNombre(row.totalRestant)}</td>
        </tr>`).join('');
      const totalPayeCouv = facturesByPatientCouverture.reduce((s, r) => s + r.totalPaye, 0);
      const totalRestantCouv = facturesByPatientCouverture.reduce((s, r) => s + r.totalRestant, 0);
      totauxSection = `
        <p><strong>Total somme partielle :</strong> ${formatMontant(totalPayeCouv)}</p>
        <p><strong>Total reste à payer :</strong> ${formatMontant(totalRestantCouv)}</p>
        <p><strong>Somme totale due par la couverture :</strong> ${formatMontant(totalPayeCouv + totalRestantCouv)}</p>`;
    }

    const tableHeader = type === 'patient'
      ? '<tr><th>N° facture</th><th>Date</th><th>Somme partielle payée (F CFA)</th><th>Somme restante (F CFA)</th></tr>'
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

  const facturesToShow = printSingleId ? factures.filter((f) => f.id === printSingleId) : factures.slice(0, 200);
  const facturePartielle = printSingleId ? factures.find((f) => f.id === printSingleId) : null;
  const effectivePrintTitle = facturePartielle
    ? `Facture partielle – ${facturePartielle.numero_facture}`
    : printTitle;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <BarChart3 className="w-8 h-8 text-indigo-600" />
        Récapitulatif
      </h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Filtres</h2>
        <p className="text-sm text-gray-500 mb-4">Filtres disponibles : Par jour, Par mois, Par période (du … au …). Sélectionnez un patient ou une couverture pour afficher le détail et générer une facture.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {period === 'range' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Du</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Au</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
          <div>
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
          </div>
          <div>
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
          <div>
            <SearchableSelect
              label="Médecin"
              options={[
                { id: '', label: 'Tous' },
                ...medecins.map((m) => ({
                  id: m.id,
                  label: `${m.prenom || ''} ${m.nom || ''}`.trim() || `Médecin #${m.id}`,
                })),
              ]}
              value={filterMedecin}
              onChange={(id) => setFilterMedecin(id ?? '')}
              placeholder="Tous les médecins"
              searchPlaceholder="Taper pour filtrer (ex. A...)"
              emptyMessage="Aucun médecin trouvé"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={fetchRecap}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Reste à payer par patient
              </h3>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Patient</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Reste (F CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {resumePatient.length === 0 ? (
                      <tr><td colSpan={2} className="px-3 py-4 text-center text-gray-500">Aucun</td></tr>
                    ) : (
                      resumePatient.map((r, idx) => (
                        <tr key={r.patient?.id ?? `p-${idx}`} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{r.patient?.prenom} {r.patient?.nom}</td>
                          <td className="px-3 py-2 text-right font-medium text-amber-700">{formatNombre(r.totalRestant)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Reste à payer par couverture</h3>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Couverture</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Reste (F CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {resumeCouverture.length === 0 ? (
                      <tr><td colSpan={2} className="px-3 py-4 text-center text-gray-500">Aucun</td></tr>
                    ) : (
                      resumeCouverture.map((r) => (
                        <tr key={r.nom} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{r.nom}</td>
                          <td className="px-3 py-2 text-right font-medium text-amber-700">{formatNombre(r.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Facture totale – Tous les patients (visible sans filtre) */}
          {!filterPatient && !filterCouverture && factures.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-indigo-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Facture totale – Tous les patients
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Récapitulatif global de la période : {factures.length} facture(s). Génération d&apos;une facture globale.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-sm p-4 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-gray-800">Total TTC</p>
                  <p className="text-lg">{formatMontant(totalTTC)}</p>
                </div>
                <div className="text-sm p-4 bg-green-50 rounded-lg">
                  <p className="font-semibold text-gray-800">Total payé</p>
                  <p className="text-lg text-green-700">{formatMontant(totalPaye)}</p>
                </div>
                <div className="text-sm p-4 bg-amber-50 rounded-lg">
                  <p className="font-semibold text-gray-800">Total restant</p>
                  <p className="text-lg text-amber-700">{formatMontant(totalRestant)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
                <button type="button" onClick={handleGenererFactureTousPatients} className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50">
                  <FileText className="w-5 h-5" /> Générer facture globale
                </button>
                <button type="button" onClick={handlePrintFactureTousPatients} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Printer className="w-5 h-5" /> Imprimer facture globale
                </button>
              </div>
            </div>
          )}

          {/* Facture par couverture (visible sans filtre) */}
          {!filterPatient && !filterCouverture && facturesParCouverture.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-emerald-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Facture par couverture
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Total global par couverture pour la période. Générer ou imprimer une facture par couverture.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Couverture</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Nb factures</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Total payé (F CFA)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Total restant (F CFA)</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-700 border-b">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {facturesParCouverture.map((couv) => (
                      <tr key={couv.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{couv.nom}</td>
                        <td className="px-3 py-2 text-right">{couv.factures.length}</td>
                        <td className="px-3 py-2 text-right text-green-700">{formatNombre(couv.totalPaye)}</td>
                        <td className="px-3 py-2 text-right text-amber-700">{formatNombre(couv.totalRestant)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => handleGenererFactureCouverture(couv)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-emerald-600 text-emerald-600 rounded hover:bg-emerald-50">
                              <FileText className="w-4 h-4" /> Générer
                            </button>
                            <button type="button" onClick={() => handlePrintFactureCouverture(couv)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700">
                              <Printer className="w-4 h-4" /> Imprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recette par médecin (visible tant qu'aucun médecin précis n'est sélectionné) */}
          {!filterMedecin && resumeMedecin.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-teal-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Recette par médecin
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Répartition des factures de la période par médecin (via la consultation liée à chaque facture).
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Médecin</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Nb factures</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Total payé (F CFA)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Total restant (F CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {resumeMedecin.map((r, idx) => (
                      <tr key={idx} className={r.nom === 'Non attribué' ? 'text-gray-400 italic' : ''}>
                        <td className="px-3 py-2 font-medium">{r.nom}</td>
                        <td className="px-3 py-2 text-right">{r.nbFactures}</td>
                        <td className="px-3 py-2 text-right text-green-700">{formatNombre(r.totalPaye)}</td>
                        <td className="px-3 py-2 text-right text-amber-700">{formatNombre(r.totalRestant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filtre par Patient : liste factures, totaux, couverture %, actions */}
          {filterPatient && factures.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-indigo-100">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Filtre par Patient – {patientLabel ? `${patientLabel.prenom} ${patientLabel.nom}` : ''}
              </h3>
              <p className="text-sm text-gray-500 mb-4">Liste de toutes les factures (payées et restant à payer).</p>
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">N° facture</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Date</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Somme partielle payée (F CFA)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Somme restante à payer (F CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {factures.map((f) => {
                      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
                      return (
                        <tr key={f.id}>
                          <td className="px-3 py-2">{f.numero_facture}</td>
                          <td className="px-3 py-2">{f.date_facture ? new Date(f.date_facture).toLocaleDateString('fr-FR') : ''}</td>
                          <td className="px-3 py-2 text-right">{formatNombre(f.montant_paye || 0)}</td>
                          <td className="px-3 py-2 text-right font-medium text-amber-700">{formatNombre(restant)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="text-sm p-4 bg-gray-50 rounded-lg">
                  <p className="font-semibold text-gray-800 mb-2">Totaux globaux</p>
                  <p><strong>Total somme partielle payée :</strong> {formatMontant(totalPaye)}</p>
                  <p><strong>Total somme restante à payer :</strong> <span className="text-amber-700 font-semibold">{formatMontant(totalRestant)}</span></p>
                  <p><strong>Somme totale payée :</strong> {formatMontant(totalPaye)}</p>
                </div>
                {tauxCouverture > 0 && patientAssurance && (
                  <div className="text-sm p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-semibold text-gray-800 mb-2">Couverture médicale</p>
                    <p><strong>Couverture :</strong> {patientAssurance.nom}</p>
                    <p><strong>Pourcentage de couverture :</strong> {tauxCouverture} %</p>
                    <p><strong>Montant à charge de la couverture :</strong> {formatMontant(montantChargeCouverture)}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
                <button type="button" onClick={handleGenererFacture} className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50">
                  <FileText className="w-5 h-5" /> Générer Facture
                </button>
                <button type="button" onClick={handlePrintGlobale} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Printer className="w-5 h-5" /> Imprimer Facture
                </button>
              </div>
            </div>
          )}

          {/* Filtre par Couverture : liste patients, totaux, actions */}
          {filterCouverture && factures.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6 mb-6 border-2 border-emerald-100">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Filtre par Couverture médicale – {couvertureLabel?.nom || ''}
              </h3>
              <p className="text-sm text-gray-500 mb-4">Liste des patients concernés par cette couverture.</p>
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Patient</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Somme partielle payée (F CFA)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700 border-b">Reste à payer (F CFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {facturesByPatientCouverture.map((row, idx) => (
                      <tr key={row.patient?.id ?? idx}>
                        <td className="px-3 py-2">{row.patient?.prenom} {row.patient?.nom}</td>
                        <td className="px-3 py-2 text-right">{formatNombre(row.totalPaye)}</td>
                        <td className="px-3 py-2 text-right font-medium text-amber-700">{formatNombre(row.totalRestant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-sm p-4 bg-gray-50 rounded-lg mb-4">
                <p className="font-semibold text-gray-800 mb-2">Totaux globaux</p>
                <p><strong>Total somme partielle :</strong> {formatMontant(facturesByPatientCouverture.reduce((s, r) => s + r.totalPaye, 0))}</p>
                <p><strong>Total reste à payer :</strong> <span className="text-amber-700 font-semibold">{formatMontant(facturesByPatientCouverture.reduce((s, r) => s + r.totalRestant, 0))}</span></p>
                <p><strong>Somme totale due par la couverture :</strong> {formatMontant(facturesByPatientCouverture.reduce((s, r) => s + r.totalPaye + r.totalRestant, 0))}</p>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
                <button type="button" onClick={handleGenererFacture} className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50">
                  <FileText className="w-5 h-5" /> Générer Facture
                </button>
                <button type="button" onClick={handlePrintGlobale} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  <Printer className="w-5 h-5" /> Imprimer Facture
                </button>
              </div>
            </div>
          )}

          <div ref={printRef} className="bg-white rounded-xl shadow p-6 print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:block">
              <h3 className="font-semibold text-gray-900">{effectivePrintTitle}</h3>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {factures.length > 0 && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                  >
                    <Printer className="w-4 h-4" /> Imprimer la liste
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2 print:hidden">
              {filterPatient && patientLabel
                ? `Factures du patient (payées et restant à payer). Facture globale ci‑dessus ; facture partielle : icône imprimante par ligne.`
                : filterCouverture && couvertureLabel
                  ? `Factures de la couverture. Facture globale ci‑dessus ; facture partielle : icône par ligne.`
                  : 'Filtrez par patient ou par couverture pour afficher et imprimer une facture globale.'}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">N° facture</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Patient</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Médecin</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Couverture</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">TTC (F CFA)</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Payé (F CFA)</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Reste (F CFA)</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Statut</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {factures.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Aucune facture.</td></tr>
                  ) : (
                    facturesToShow.map((f) => {
                      const restant = parseFloat(f.montant_restant ?? (parseFloat(f.montant_ttc || 0) - parseFloat(f.montant_paye || 0)));
                      return (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{f.numero_facture}</td>
                          <td className="px-4 py-3">{f.date_facture}</td>
                          <td className="px-4 py-3">{f.patients?.prenom} {f.patients?.nom}</td>
                          <td className="px-4 py-3">{getMedecinFacture(f).nom}</td>
                          <td className="px-4 py-3">{getCouvertureFacture(f).nom}</td>
                          <td className="px-4 py-3 text-right">{formatNombre(f.montant_ttc || 0)}</td>
                          <td className="px-4 py-3 text-right">{formatNombre(f.montant_paye || 0)}</td>
                          <td className="px-4 py-3 text-right font-medium text-amber-700">{formatNombre(restant)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              f.statut_paiement === 'paye' ? 'bg-green-100 text-green-800' :
                              f.statut_paiement === 'partiel' ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {f.statut_paiement}
                            </span>
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <button
                              type="button"
                              onClick={() => handlePrintPartielle(f.id)}
                              title="Imprimer (facture partielle)"
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {factures.length > 200 && !printSingleId && (
              <p className="text-sm text-gray-500 mt-2">Affichage des 200 premières factures.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Recapitulatif;
