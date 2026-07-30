import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { fetchParametres } from '../parametrageService.js';

const generatePDF = async (supabase, certificats, patient, medecin, tenantId = null) => {
  try {
    const doc = new jsPDF();

    // Fetch cabinet info and settings via centralized service with tenantId
    const settings = await fetchParametres(tenantId);
    
    // Extract styles
    const primaryColor = settings.document_couleur_principale || '#000000';
    // const secondaryColor = settings.document_couleur_secondaire || '#4f46e5'; // Unused
    // const fontFamily = settings.document_police || 'helvetica'; // jsPDF uses standard fonts by default

    let yPos = 20;

    // Cabinet Header
    if (settings) {
       // Helper to convert hex to RGB for jsPDF
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      const rgbPrimary = hexToRgb(primaryColor);

      if (settings.document_afficher_logo && (settings.document_logo_url || settings.logo_url)) {
        try {
          const logoUrl = settings.document_logo_url || settings.logo_url;
          // Assuming the logo is a public URL or base64
          // Note: fetching depends on CORS policies. 
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise((resolve, reject) => {
            reader.onload = resolve;
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          doc.addImage(reader.result, 'PNG', 15, 15, 30, 30);
        } catch (e) {
          console.warn('Impossible d\'ajouter le logo:', e);
        }
      }
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(rgbPrimary.r, rgbPrimary.g, rgbPrimary.b);
      doc.text(settings.nom_cabinet || 'Cabinet Médical', 105, yPos, { align: 'center' });
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100); // Gray for address
      const adresse = [settings.adresse, settings.ville, settings.code_postal, settings.pays].filter(Boolean).join(', ');
      doc.text(adresse, 105, yPos, { align: 'center' });
      yPos += 5;
      const contact = [settings.telephone && `Tél: ${settings.telephone}`, settings.email].filter(Boolean).join(' | ');
      doc.text(contact, 105, yPos, { align: 'center' });
      yPos += 15;
    }
    
    // Title
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    // Reset to primary color
    // Re-calculate rgbPrimary if scope issue, but it is available here
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };
    const rgbPrimary = hexToRgb(primaryColor);
      
    doc.setTextColor(rgbPrimary.r, rgbPrimary.g, rgbPrimary.b);
    doc.text(settings.certificat_titre || 'CERTIFICAT MÉDICAL', 105, yPos, { align: 'center' });
    yPos += 15;


    // Doctor and Patient Info
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0); // Black for text
    doc.text(`Médecin: Dr. ${medecin?.prenom || ''} ${medecin?.nom || ''}`, 20, yPos);
    doc.text(`Spécialité: ${medecin?.specialite || ''}`, 20, yPos + 6);
    
    doc.text(`Patient: ${patient?.prenom || ''} ${patient?.nom || ''}`, 130, yPos);
    doc.text(`Né(e) le: ${patient?.date_naissance ? new Date(patient.date_naissance).toLocaleDateString('fr-FR') : ''}`, 130, yPos + 6);
    yPos += 15;

    doc.setLineWidth(0.5);
    doc.setDrawColor(rgbPrimary.r, rgbPrimary.g, rgbPrimary.b);
    doc.line(20, yPos, 190, yPos);
    yPos += 15;


    certificats.forEach((certificat, index) => {
      if (index > 0) {
        doc.addPage();
        yPos = 20; // Reset y for new page
      }
      
      doc.setFontSize(12);
      
      if (settings.certificat_texte_introduction) {
          doc.setFont(undefined, 'normal');
          const nomMedecinComplet = `${medecin?.prenom || ''} ${medecin?.nom || ''}`.trim();
          const introTexte = settings.certificat_texte_introduction
            .replace(/\[NOM_MEDECIN\]/g, nomMedecinComplet)
            .replace(/\[DATE\]/g, new Date().toLocaleDateString('fr-FR'));
          const introLines = doc.splitTextToSize(introTexte, 170);
          doc.text(introLines, 20, yPos);
          yPos += introLines.length * 7 + 5;
      }
      
      doc.setFont(undefined, 'bold');
      doc.text(`Type: ${certificat.types_certificats?.nom || 'Certificat'}`, 20, yPos);
      yPos += 10;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Du: ${new Date(certificat.date_debut).toLocaleDateString('fr-FR')}`, 20, yPos);
      if (certificat.date_fin) {
        doc.text(`Au: ${new Date(certificat.date_fin).toLocaleDateString('fr-FR')}`, 80, yPos);
      }
      doc.text(`Durée: ${certificat.duree_jours} jour(s)`, 150, yPos);
      yPos += 12;

      if (certificat.motif) {
        doc.setFont(undefined, 'bold');
        doc.text('Motif:', 20, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        const motifLines = doc.splitTextToSize(certificat.motif, 170);
        doc.text(motifLines, 20, yPos);
        yPos += motifLines.length * 7 + 5;
      }
      
      if (certificat.restrictions) {
        doc.setFont(undefined, 'bold');
        doc.text('Restrictions / Commentaires:', 20, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        const restrictionLines = doc.splitTextToSize(certificat.restrictions, 170);
        doc.text(restrictionLines, 20, yPos);
        yPos += restrictionLines.length * 7 + 5;
      }
      
      if (settings.certificat_texte_mention) {
          yPos += 5;
          doc.setFont(undefined, 'italic');
          doc.setFontSize(10);
          const mentionLines = doc.splitTextToSize(settings.certificat_texte_mention, 170);
          doc.text(mentionLines, 20, yPos);
          // yPos += mentionLines.length * 5; 
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      
      // Signature area
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      doc.text(`Fait à ${settings.ville || '.........................'}, le ${new Date().toLocaleDateString('fr-FR')}`, 130, pageHeight - 50);
      doc.text('Signature et cachet', 140, pageHeight - 40);
      
      // Document Footer
      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(20, pageHeight - 15, 190, pageHeight - 15);
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      
      const footerTemplate = settings.certificat_footer_texte || settings.document_footer_texte || `Document généré le [DATE]`;
      const footerText = footerTemplate.replace(/\[DATE\]/g, new Date().toLocaleString('fr-FR'));
      doc.text(footerText, 105, pageHeight - 10, { align: 'center' });
    });

    doc.save(`certificat-${patient?.nom || 'patient'}.pdf`);
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la génération du PDF de certificat:", error);
    return { success: false, error: error.message };
  }
};

export const generateCertificatsPDF = async (supabase, certificats, patient, medecin, tenantId = null) => {
  if (!certificats || certificats.length === 0 || !patient || !medecin) {
    console.error("Données manquantes pour générer le PDF des certificats.");
    return { success: false, error: "Données manquantes" };
  }
  return await generatePDF(supabase, certificats, patient, medecin, tenantId);
};

export const generateSingleCertificatPDF = async (supabase, certificat, patient, medecin, tenantId = null) => {
  if (!certificat || !patient || !medecin) {
    console.error("Données manquantes pour générer le PDF du certificat.");
    return { success: false, error: "Données manquantes" };
  }
  return await generatePDF(supabase, [certificat], patient, medecin, tenantId);
};
