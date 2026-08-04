import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchParametres } from '../parametrageService.js';
import { formatMontant } from '../../utils/currency';

/**
 * Génère un PDF pour un devis (similaire à facture mais avec statut "Devis")
 * @param {Object} supabase - Client Supabase
 * @param {Object} devisData - Données du devis
 * @param {boolean} print - Si true, ouvre la boîte de dialogue d'impression
 * @param {string} tenantId - Tenant ID du cabinet
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const generateDevisPDF = async (supabase, devisData, print = false, tenantId = null) => {
  try {
    // Récupérer les paramètres du cabinet avec tenantId
    const settings = await fetchParametres(tenantId);

    const doc = new jsPDF();
    let yPos = 20;

    // Logo et nom du cabinet
    if (settings.document_afficher_logo && (settings.document_logo_url || settings.logo_url)) {
      try {
        const logoUrl = settings.document_logo_url || settings.logo_url;
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = resolve;
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        doc.addImage(reader.result, 'PNG', 15, 15, 30, 30);
        yPos = 55;
      } catch (e) {
        console.warn('Impossible d\'ajouter le logo:', e);
      }
    }

    // Nom du cabinet
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(settings.nom_cabinet || 'Cabinet Médical', 105, yPos, { align: 'center' });
    yPos += 10;

    // Adresse et contact
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const adresse = [settings.adresse, settings.ville, settings.code_postal, settings.pays].filter(Boolean).join(', ');
    doc.text(adresse, 105, yPos, { align: 'center' });
    yPos += 5;
    const contact = [settings.telephone && `Tél: ${settings.telephone}`, settings.email].filter(Boolean).join(' | ');
    doc.text(contact, 105, yPos, { align: 'center' });
    yPos += 15;

    // En-tête devis
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('DEVIS', 105, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Numéro: ${devisData.numero}`, 20, yPos);
    yPos += 10;
    doc.text(`Date: ${new Date(devisData.date).toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 10;
    doc.text(`Patient: ${devisData.patient.prenom} ${devisData.patient.nom}`, 20, yPos);
    yPos += 10;
    doc.text(`Médecin: ${devisData.medecin}`, 20, yPos);
    yPos += 10;

    // Informations du devis
    doc.setFontSize(10);
    doc.text(`Statut: DEVIS`, 150, 35);
    doc.text(`Validité: 30 jours`, 150, 45);

    // Tableau des actes
    const tableData = devisData.actes.map(acte => [
      acte.acte.code || `ACT-${acte.acte.id}`,
      acte.acte.libelle,
      acte.quantite.toString(),
      `${acte.tarifUnitaire.toFixed(2)} FCFA`,
      `${(acte.quantite * acte.tarifUnitaire).toFixed(2)} FCFA`
    ]);

    autoTable(doc, {
      head: [['Code', 'Libellé', 'Qté', 'Tarif Unitaire', 'Total']],
      body: tableData,
      startY: 80,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Totaux
    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(10);
    doc.text(`Sous-total: ${devisData.sousTotal.toFixed(2)} FCFA`, 150, finalY);
    
    if (devisData.remise > 0) {
      doc.text(`Remise (${devisData.remise}%): -${((devisData.sousTotal * devisData.remise) / 100).toFixed(2)} FCFA`, 150, finalY + 10);
    }
    
    doc.setFontSize(12);
    doc.text(`Total: ${devisData.total.toFixed(2)} FCFA`, 150, finalY + 20);

    if (devisData.montantAssurance > 0) {
      doc.setFontSize(10);
      doc.text(`Part assurance (${devisData.patient.tauxCouverture}%): ${devisData.montantAssurance.toFixed(2)} FCFA`, 150, finalY + 30);
      doc.text(`Part patient: ${devisData.montantPatient.toFixed(2)} FCFA`, 150, finalY + 40);
    }

    // Pied de page
    doc.setFontSize(8);
    doc.text('Ce devis est valable pour une durée de 30 jours.', 105, 280, { align: 'center' });
    doc.text('En cas d\'acceptation, veuillez signer et retourner ce devis.', 105, 285, { align: 'center' });

    // Signature
    doc.text('Signature du patient:', 20, 250);
    doc.line(20, 255, 80, 255);
    doc.text('Date:', 20, 265);

    if (print) {
      // Ouvrir la boîte de dialogue d'impression
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    } else {
      // Téléchargement
      doc.save(`devis-${devisData.numero}.pdf`);
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la génération du PDF du devis:', error);
    return { success: false, error: error.message };
  }
};
