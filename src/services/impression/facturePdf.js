import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchParametres } from '../parametrageService.js';
import { formatMontant } from '../../utils/currency';

export const generateFacturePDF = async (supabase, facture, forPrint = false, tenantId = null) => {
  try {
    // Récupérer les paramètres du cabinet avec tenantId
    const settings = await fetchParametres(tenantId);

    // Récupérer les informations du médecin depuis la consultation si disponible
    let medecinData = null;
    if (facture.consultation_id) {
      const { data: consultationData, error: medecinError } = await supabase
        .from('consultations')
        .select('medecin_id, users:medecin_id(nom, prenom, specialite, telephone, email)')
        .eq('id', facture.consultation_id)
        .single();

      if (medecinError) {
        console.error("Erreur lors de la récupération des informations du médecin:", medecinError);
      } else if (consultationData?.users) {
        medecinData = consultationData.users;
      }
    }

    const doc = new jsPDF();

    const primaryColor = [59, 130, 246]; // Blue-600
    const grayColor = [107, 114, 128]; // Gray-500

    let yPos = 20;

    if (settings?.logo_url) {
      try {
        doc.addImage(settings.logo_url, 'PNG', 20, yPos, 30, 30);
        yPos += 35;
      } catch (e) {
        console.warn('Impossible d\'ajouter le logo:', e);
        yPos += 5;
      }
    }

    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text(settings?.nom_cabinet || 'Cabinet Médical', 105, yPos, { align: 'center' });
    yPos += 8;

    if (settings?.adresse || settings?.ville) {
      doc.setFontSize(10);
      doc.setTextColor(...grayColor);
      const adresse = [settings?.adresse, settings?.ville, settings?.code_postal].filter(Boolean).join(', ');
      doc.text(adresse, 105, yPos, { align: 'center' });
      yPos += 5;
    }

    if (settings?.telephone || settings?.email) {
      doc.setFontSize(9);
      const contact = [settings?.telephone && `Tél: ${settings.telephone}`, settings?.email].filter(Boolean).join(' | ');
      doc.text(contact, 105, yPos, { align: 'center' });
      yPos += 5;
    }
    
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('FACTURE D\'ACTES MÉDICAUX', 105, yPos, { align: 'center' });
    yPos += 8;
    
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    doc.setFont(undefined, 'bold');
    doc.text('N° Facture:', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(facture.numero, 60, yPos);
    
    doc.setFont(undefined, 'bold');
    doc.text('Date:', 120, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(facture.date).toLocaleDateString('fr-FR'), 140, yPos);
    
    yPos += 10;
    
    doc.setFont(undefined, 'bold');
    doc.text('PATIENT', 20, yPos);
    yPos += 7;
    
    doc.setFont(undefined, 'normal');
    doc.text(`Nom: ${facture.patient.prenom} ${facture.patient.nom}`, 20, yPos);
    yPos += 6;
    
    doc.text(`Assurance: ${facture.patient.assurance}`, 20, yPos);
    if (facture.patient.tauxCouverture > 0) {
      doc.text(`Taux de remboursement: ${facture.patient.tauxCouverture}%`, 20, yPos + 6);
      yPos += 6;
    }
    yPos += 6;
    
    doc.setFont(undefined, 'bold');
    doc.text('MÉDECIN', 120, yPos - 13);
    doc.setFont(undefined, 'normal');
    if (medecinData) {
      doc.text(`Dr. ${medecinData.prenom || ''} ${medecinData.nom || ''}`, 120, yPos - 6);
      if (medecinData.telephone) {
        doc.text(`Tél: ${medecinData.telephone}`, 120, yPos);
        yPos += 6;
      }
      if (medecinData.email) {
        doc.text(`Email: ${medecinData.email}`, 120, yPos);
        yPos += 6;
      }
    } else {
      doc.text(facture.medecin || 'Médecin', 120, yPos - 6);
    }
    
    yPos += 10;

    // Gérer les deux formats de données: actes ou items
    const tableData = (facture.actes || facture.items || []).map((item, index) => {
      // Format actes (détail complet)
      if (item.acte) {
        return [
          index + 1,
          item.acte.code || '',
          item.acte.libelle || 'Acte médical',
          item.quantite || 1,
          `${formatMontant(item.tarifUnitaire || 0)}`,
          `${formatMontant((item.tarifUnitaire || 0) * (item.quantite || 1))}`
        ];
      }
      // Format items (simplifié - chaîne de caractères)
      const itemName = typeof item === 'string' ? item : (item.libelle || item.nom || 'Service');
      const itemPrice = typeof item === 'object' ? (item.prix || item.tarif || 0) : 0;
      const itemQty = typeof item === 'object' ? (item.quantite || 1) : 1;
      return [
        index + 1,
        '',
        itemName,
        itemQty,
        `${formatMontant(itemPrice)}`,
        `${formatMontant(itemPrice * itemQty)}`
      ];
    });
    
    let finalY = yPos + 50;
    
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Code', 'Libellé', 'Qté', 'Prix unitaire', 'Montant']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 60 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 35, halign: 'right' },
        5: { cellWidth: 35, halign: 'right' }
      }
    });
    finalY = doc.lastAutoTable?.finalY || yPos + 50;
    
    let currentY = finalY + 10;
    
    doc.setFont(undefined, 'bold');
    doc.text('DÉTAIL DES MONTANTS', 20, currentY);
    currentY += 8;
    
    doc.setFont(undefined, 'normal');
    doc.text('Sous-total:', 120, currentY);
    doc.text(`${formatMontant(facture.sousTotal)}`, 170, currentY, { align: 'right' });
    currentY += 6;
    
    if (facture.remise > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text('Remise:', 120, currentY);
      doc.text(`-${formatMontant(facture.remise)}`, 170, currentY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      currentY += 6;
    }
    
    doc.setFont(undefined, 'bold');
    doc.text('Total:', 120, currentY);
    doc.text(`${formatMontant(facture.total)}`, 170, currentY, { align: 'right' });
    currentY += 8;
    
    if (facture.patient.tauxCouverture > 0) {
      doc.setFont(undefined, 'normal');
      doc.setTextColor(59, 130, 246);
      doc.text(`Part assurance (${facture.patient.tauxCouverture}%):`, 120, currentY);
      doc.text(`${formatMontant(facture.montantAssurance)}`, 170, currentY, { align: 'right' });
      currentY += 6;
      
      doc.setTextColor(249, 115, 22);
      doc.text('Part patient:', 120, currentY);
      doc.text(`${formatMontant(facture.montantPatient)}`, 170, currentY, { align: 'right' });
      currentY += 6;
      doc.setTextColor(0, 0, 0);
    }
    
    currentY += 5;
    doc.setDrawColor(...grayColor);
    doc.line(20, currentY, 190, currentY);
    currentY += 10;
    
    doc.setFont(undefined, 'bold');
    doc.text('Statut:', 20, currentY);
    doc.setFont(undefined, 'normal');
    const statutText = facture.statut === 'payee' ? 'Payée' :
                       facture.statut === 'en_attente' ? 'En attente' :
                       facture.statut === 'impayee' ? 'Impayée' : facture.statut;
    doc.text(statutText, 50, currentY);
    
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('Merci de votre confiance', 105, pageHeight - 20, { align: 'center' });
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 105, pageHeight - 15, { align: 'center' });
    
    const fileName = `Facture_${facture.numero}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    if (forPrint) {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } else {
      doc.save(fileName);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    return { success: false, error: error.message };
  }
};
