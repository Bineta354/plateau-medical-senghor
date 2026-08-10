import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchParametres } from '../parametrageService.js';
import { formatMontant } from '../../utils/currency';

const numeroAdherent = (patient) => patient?.numero_mutuelle || patient?.numero_ipm || '—';

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const slugify = (s) => (s || 'assureur').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');

/**
 * Génère un bordereau PDF regroupant toutes les factures de couverture dues à un assureur :
 * récapitulatif (facture/patient/n° adhérent/montant) puis, pour chaque facture, le détail des
 * actes facturés. Les actes ne sont jamais portés par la facture "couverture" elle-même (voir
 * Caisse.jsx, la scission ne copie pas les lignes_facture sur la facture -C) : ils sont donc
 * récupérés sur la facture patient parente via facture_parent_id.
 *
 * Ne contient volontairement aucun diagnostic ni motif de consultation (secret médical) — juste
 * les actes facturés et leurs montants, ce dont un assureur a besoin pour rembourser un dossier.
 */
export const generateDossierAssurancePDF = async (supabase, { assurance, factures }, tenantId = null) => {
  try {
    if (!factures || factures.length === 0) {
      return { success: false, error: 'Aucune facture à inclure dans le dossier.' };
    }

    const settings = await fetchParametres(tenantId);

    const parentIds = [...new Set(factures.map((f) => f.facture_parent_id).filter(Boolean))];
    let lignesParFacture = {};
    if (parentIds.length > 0) {
      const { data: lignes, error: lignesError } = await supabase
        .from('lignes_facture')
        .select('facture_id, description, quantite, prix_unitaire, montant_ligne')
        .in('facture_id', parentIds);
      if (lignesError) throw lignesError;
      lignesParFacture = (lignes || []).reduce((acc, l) => {
        (acc[l.facture_id] = acc[l.facture_id] || []).push(l);
        return acc;
      }, {});
    }

    const doc = new jsPDF();
    const primaryColor = [124, 58, 237]; // Purple-600, cohérent avec l'accent visuel de la page assurance
    const grayColor = [107, 114, 128];
    const pageWidth = doc.internal.pageSize.width;

    let yPos = 20;

    if (settings?.logo_url) {
      try {
        doc.addImage(settings.logo_url, 'PNG', 20, yPos, 25, 25);
      } catch (e) {
        console.warn('Impossible d\'ajouter le logo:', e);
      }
    }

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text(settings?.nom_cabinet || 'Cabinet Médical', pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    if (settings?.adresse || settings?.ville) {
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      const adresse = [settings?.adresse, settings?.ville, settings?.code_postal].filter(Boolean).join(', ');
      doc.text(adresse, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }

    yPos += 4;
    doc.setFontSize(15);
    doc.setTextColor(...primaryColor);
    doc.text('BORDEREAU DE FACTURES', pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.setFont(undefined, 'bold');
    doc.text('Assureur :', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(assurance?.nom || 'Assureur', 55, yPos);

    doc.setFont(undefined, 'bold');
    doc.text('Taux remb. :', 130, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(assurance?.taux_remboursement != null ? `${assurance.taux_remboursement}%` : '—', 160, yPos);
    yPos += 6;

    doc.setFont(undefined, 'bold');
    doc.text('Date d\'émission :', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(new Date().toLocaleDateString('fr-FR'), 55, yPos);

    doc.setFont(undefined, 'bold');
    doc.text('Nb factures :', 130, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(String(factures.length), 160, yPos);
    yPos += 10;

    const totalGeneral = factures.reduce((sum, f) => sum + (f.restant || 0), 0);

    // --- Tableau récapitulatif ---
    autoTable(doc, {
      startY: yPos,
      head: [['N° Facture', 'Date', 'Patient', 'N° Adhérent', 'Montant réclamé']],
      body: factures.map((f) => [
        f.numero_facture,
        formatDate(f.date_facture),
        `${f.patient?.prenom || ''} ${f.patient?.nom || ''}`.trim(),
        numeroAdherent(f.patient),
        formatMontant(f.restant),
      ]),
      foot: [['', '', '', 'Total', formatMontant(totalGeneral)]],
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [245, 243, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        4: { halign: 'right' },
      },
    });

    // --- Détail des actes, facture par facture ---
    doc.addPage();
    let detailY = 20;
    doc.setFontSize(13);
    doc.setTextColor(...primaryColor);
    doc.text('Détail des actes par facture', 20, detailY);
    detailY += 8;
    doc.setDrawColor(...primaryColor);
    doc.line(20, detailY, pageWidth - 20, detailY);
    detailY += 8;

    factures.forEach((f, idx) => {
      const lignes = lignesParFacture[f.facture_parent_id] || [];
      const rows = lignes.length > 0
        ? lignes.map((l) => [l.description, l.quantite, formatMontant(l.prix_unitaire), formatMontant(l.montant_ligne)])
        : [['Détail non disponible', '—', '—', formatMontant(f.restant)]];

      if (detailY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        detailY = 20;
      }

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(
        `${f.numero_facture} — ${f.patient?.prenom || ''} ${f.patient?.nom || ''} (N° adhérent : ${numeroAdherent(f.patient)})`,
        20,
        detailY
      );
      detailY += 4;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayColor);
      doc.text(
        `${formatDate(f.date_facture)}${f.medecin ? ` · Dr. ${f.medecin.prenom} ${f.medecin.nom}` : ''}`,
        20,
        detailY
      );
      doc.setTextColor(0, 0, 0);
      detailY += 4;

      autoTable(doc, {
        startY: detailY,
        head: [['Acte', 'Qté', 'Prix unitaire', 'Montant']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 3: { halign: 'right' } },
        margin: { left: 20, right: 20 },
      });

      detailY = (doc.lastAutoTable?.finalY || detailY + 20) + (idx < factures.length - 1 ? 10 : 0);
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(...grayColor);
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — numéros d'adhérent à vérifier avant envoi`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    const fileName = `Bordereau_${slugify(assurance?.nom)}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la génération du dossier assurance:', error);
    return { success: false, error: error.message };
  }
};
