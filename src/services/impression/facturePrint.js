import { fetchParametres } from '../parametrageService.js';
import { formatMontant } from '../../utils/currency';

export const printFacture = async (supabase, facture, patient, medecin, tenantId = null) => {
    if (!facture) return { success: false, error: "Facture non disponible" };

    try {
      const { data: medecinData } = await supabase
        .from('users')
        .select('nom, prenom, specialite, telephone, email, signature_url')
        .eq('id', medecin?.id)
        .single();

      // Utiliser le service centralisé pour récupérer tous les paramètres (y compris styles) avec tenantId
      const settings = await fetchParametres(tenantId);

      const win = window.open('', '_blank');
      win.document.open();
      
      // Préparation des styles dynamiques
      const fontFamily = settings.document_police || 'sans-serif';
      const primaryColor = settings.document_couleur_principale || '#000000';
      const borderColor = settings.document_couleur_bordure || '#e5e7eb';
      const fontSize = settings.document_taille_police || 14;
      
      // Formatage des montants
      const devise = settings.devise || 'FCFA';
      
      win.document.write(`
        <html>
          <head>
            <title>Facture ${facture.numero_facture}</title>
            <meta charset="UTF-8">
            <style>
              @page {
                size: A4;
                margin: 0;
              }
              body {
                font-family: "${fontFamily}", sans-serif;
                font-size: ${fontSize}px;
                color: #1f2937;
                line-height: 1.5;
                margin: 0;
                padding: 40px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .header-container {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid ${borderColor};
              }
              .logo {
                max-width: 150px;
                max-height: 80px;
                object-fit: contain;
              }
              .cabinet-info h1 {
                margin: 0;
                font-size: 1.2em;
                color: ${primaryColor};
                text-transform: uppercase;
              }
              .cabinet-info p {
                margin: 2px 0;
                font-size: 0.8em;
                color: #6b7280;
              }
              .invoice-title {
                text-align: center;
                margin: 40px 0;
              }
              .invoice-title h2 {
                font-size: 1.8em;
                color: ${primaryColor};
                text-transform: uppercase;
                letter-spacing: 2px;
                margin: 0;
              }
              .invoice-meta {
                display: flex;
                justify-content: space-between;
                margin-bottom: 40px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
              }
              .meta-group h3 {
                font-size: 0.9em;
                text-transform: uppercase;
                color: #9ca3af;
                margin: 0 0 10px 0;
              }
              .meta-group p {
                margin: 2px 0;
                font-weight: 600;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
              }
              th {
                text-align: left;
                padding: 12px;
                background-color: ${primaryColor};
                color: white;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 0.8em;
              }
              td {
                padding: 12px;
                border-bottom: 1px solid ${borderColor};
              }
              tr:last-child td {
                border-bottom: none;
              }
              .amount-col {
                text-align: right;
                font-family: monospace;
              }
              .totals-section {
                display: flex;
                justify-content: flex-end;
                margin-top: 20px;
              }
              .totals-table {
                width: 300px;
              }
              .totals-table td {
                padding: 8px;
                text-align: right;
              }
              .total-final {
                font-size: 1.2em;
                font-weight: bold;
                color: ${primaryColor};
                border-top: 2px solid ${borderColor};
              }
              .footer {
                position: fixed;
                bottom: 40px;
                left: 40px;
                right: 40px;
                text-align: center;
                font-size: 0.7em;
                color: #9ca3af;
                border-top: 1px solid ${borderColor};
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header-container">
              <div class="cabinet-info">
                ${settings.document_afficher_logo && (settings.document_logo_url || settings.logo_url) ? 
                  `<img src="${settings.document_logo_url || settings.logo_url}" alt="Logo" class="logo" />` : 
                  `<h1>${settings.nom_cabinet || 'Cabinet Médical'}</h1>`
                }
                ${settings.document_afficher_logo && (settings.document_logo_url || settings.logo_url) ? 
                  `<h1 style="margin-top: 10px;">${settings.nom_cabinet || ''}</h1>` : ''
                }
                <p>${settings.adresse || ''}</p>
                <p>${settings.code_postal || ''} ${settings.ville || ''}</p>
                <p>Tél: ${settings.telephone || ''} | Email: ${settings.email || ''}</p>
              </div>
              <div class="cabinet-info" style="text-align: right;">
                <p><strong>Médecin traitant</strong></p>
                <p>Dr. ${medecinData?.prenom || medecin?.prenom || ''} ${medecinData?.nom || medecin?.nom || ''}</p>
                <p>${medecinData?.specialite || ''}</p>
              </div>
            </div>

            <div class="invoice-title">
              <h2>Facture</h2>
              <p style="color: #6b7280; font-size: 0.9em; margin-top: 5px;">
                N° ${facture.numero_facture}
              </p>
            </div>

            <div class="invoice-meta">
              <div class="meta-group">
                <h3>Facturé à</h3>
                <p>${patient?.prenom} ${patient?.nom}</p>
                <p>Dossier N° ${patient?.numero_dossier}</p>
                ${patient?.adresse ? `<p>${patient.adresse}</p>` : ''}
              </div>
              <div class="meta-group" style="text-align: right;">
                <h3>Informations</h3>
                <p>Date: ${new Date(facture.date_facture).toLocaleDateString('fr-FR')}</p>
                <p>Statut: ${facture.statut_paiement === 'paye' ? 'PAYÉE' : 'EN ATTENTE'}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 60%">Description</th>
                  <th style="width: 10%; text-align: center">Qté</th>
                  <th style="width: 15%; text-align: right">Prix Unit.</th>
                  <th style="width: 15%; text-align: right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${facture.lignes_facture?.map(ligne => `
                  <tr>
                    <td>
                      <strong>${ligne.description}</strong>
                    </td>
                    <td style="text-align: center">${ligne.quantite}</td>
                    <td class="amount-col">${formatMontant(parseFloat(ligne.prix_unitaire))}</td>
                    <td class="amount-col">${formatMontant(ligne.prix_unitaire * ligne.quantite)}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>

            <div class="totals-section">
              <table class="totals-table">
                <tr>
                  <td>Total HT</td>
                  <td class="amount-col">${formatMontant(parseFloat(facture.montant_ht))}</td>
                </tr>
                ${facture.tva > 0 ? `
                  <tr>
                    <td>TVA (${facture.taux_tva || 0}%)</td>
                    <td class="amount-col">${formatMontant(parseFloat(facture.tva))}</td>
                  </tr>
                ` : ''}
                <tr>
                  <td class="total-final">Total TTC</td>
                  <td class="total-final amount-col">${formatMontant(parseFloat(facture.montant_ttc))}</td>
                </tr>
              </table>
            </div>

            <div class="footer">
              <p>${settings.document_footer_texte || `Document généré le ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`}</p>
              <p style="margin-top: 5px;">
                ${settings.nom_cabinet} - ${settings.adresse}, ${settings.ville}
                ${settings.ninea ? ` | NINEA: ${settings.ninea}` : ''}
                ${settings.registre_commerce ? ` | RC: ${settings.registre_commerce}` : ''}
              </p>
            </div>

            <script>
              window.onload = function() {
                setTimeout(() => { window.print(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      win.document.close();
      return { success: true };
    } catch (err) {
      console.error('Erreur impression facture:', err);
      return { success: false, error: err.message };
    }
};
