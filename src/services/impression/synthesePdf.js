import { fetchParametres } from '../parametrageService.js';
import { getConsultationMotif } from '../../utils/consultationUtils';

export const generateSynthesisPDF = async (
    supabase,
    patient,
    consultation,
    antecedents,
    constantes,
    signesCliniques,
    examensAppareils,
    diagnostics,
    ordonnances,
    certificats,
    tenantId = null
) => {
    try {
        const settings = await fetchParametres(tenantId);
        
        let syntheseContent = '';
      
        syntheseContent += `${settings.nom_cabinet || 'Cabinet Médical'}\n`;
        syntheseContent += `${settings.adresse || ''}\n`;
        syntheseContent += `${settings.code_postal || ''} ${settings.ville || ''}\n`;
        syntheseContent += `Tél: ${settings.telephone || ''} | Email: ${settings.email || ''}\n`;
        syntheseContent += `\n${'='.repeat(50)}\n\n`;
      
        syntheseContent += `SYNTHÈSE DE CONSULTATION\n`;
        syntheseContent += `Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
        syntheseContent += `Patient: ${patient?.prenom} ${patient?.nom}\n`;
        syntheseContent += `Dossier N°: ${patient?.numero_dossier}\n`;
        syntheseContent += `Motif: ${getConsultationMotif(consultation)}\n`;
        syntheseContent += `\n${'='.repeat(50)}\n\n`;

        if (antecedents.length > 0) {
            syntheseContent += `ANTÉCÉDENTS SIGNIFICATIFS:\n`;
            antecedents.forEach(ant => {
            syntheseContent += `• ${ant.antecedents?.nom || ant.antecedent}`;
            if (ant.date_decouverte) {
                syntheseContent += ` (${new Date(ant.date_decouverte).toLocaleDateString('fr-FR')})`;
            }
            if (ant.commentaires) {
                syntheseContent += ` - ${ant.commentaires}`;
            }
            syntheseContent += `\n`;
            });
            syntheseContent += `\n`;
        }

        if (constantes.length > 0) {
            syntheseContent += `CONSTANTES VITALES:\n`;
            constantes.forEach(const_ => {
            syntheseContent += `• ${const_.constantes?.nom}: ${const_.valeur_mesuree} ${const_.unite || const_.constantes?.unite || ''}\n`;
            });
            syntheseContent += `\n`;
        }

        if (signesCliniques.length > 0) {
            syntheseContent += `SIGNES CLINIQUES OBSERVÉS:\n`;
            signesCliniques.forEach(signe => {
            syntheseContent += `• ${signe.signes_cliniques?.nom}`;
            if (signe.intensite && signe.intensite !== 'faible') {
                syntheseContent += ` (${signe.intensite})`;
            }
            if (signe.commentaires) {
                syntheseContent += ` - ${signe.commentaires}`;
            }
            syntheseContent += `\n`;
            });
            syntheseContent += `\n`;
        }

        if (examensAppareils.length > 0) {
            syntheseContent += `EXAMENS d'APPAREILS:\n`;
            examensAppareils.forEach(examen => {
            syntheseContent += `• ${examen.appareils?.nom}:\n`;
            syntheseContent += `  Résultat: ${examen.resultat_examen}\n`;
            if (examen.anomalies_detectees) {
                syntheseContent += `  Anomalies: ${examen.anomalies_detectees}\n`;
            }
            });
            syntheseContent += `\n`;
        }

        if (diagnostics.length > 0) {
            syntheseContent += `DIAGNOSTICS:\n`;
            diagnostics.forEach(diag => {
            syntheseContent += `• ${diag.diagnostics?.nom} (${diag.certitude})`;
            if (diag.commentaires) {
                syntheseContent += `\n  Commentaires: ${diag.commentaires}`;
            }
            syntheseContent += `\n`;
            });
            syntheseContent += `\n`;
        }

        if (ordonnances.length > 0) {
            syntheseContent += `PRESCRIPTIONS:\n`;
            ordonnances.forEach(ord => {
            syntheseContent += `• Ordonnance ${ord.numero_ordonnance}\n`;
            if (ord.instructions_generales) {
                syntheseContent += `  Instructions: ${ord.instructions_generales}\n`;
            }
            if (ord.lignes_ordonnance && ord.lignes_ordonnance.length > 0) {
                syntheseContent += `  Médicaments:\n`;
                ord.lignes_ordonnance.forEach(ligne => {
                syntheseContent += `    - ${ligne.medicaments?.nom}: ${ligne.posologie}`;
                if (ligne.quantite) syntheseContent += ` (${ligne.quantite})`;
                if (ligne.duree_traitement) syntheseContent += ` - ${ligne.duree_traitement} jours`;
                syntheseContent += `\n`;
                });
            }
            });
            syntheseContent += `\n`;
        }

        if (certificats.length > 0) {
            syntheseContent += `CERTIFICATS ÉMIS:\n`;
            certificats.forEach(cert => {
            syntheseContent += `• ${cert.types_certificats?.nom || 'Certificat médical'}\n`;
            syntheseContent += `  Durée: ${cert.duree_jours} jour${cert.duree_jours > 1 ? 's' : ''}\n`;
            syntheseContent += `  Du ${new Date(cert.date_debut).toLocaleDateString('fr-FR')} au ${new Date(new Date(cert.date_debut).getTime() + cert.duree_jours * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}\n`;
            if (cert.motif) {
                syntheseContent += `  Motif: ${cert.motif}\n`;
            }
            if (cert.restrictions) {
                syntheseContent += `  Restrictions: ${cert.restrictions}\n`;
            }
            });
            syntheseContent += `\n`;
        }

        syntheseContent += `${'='.repeat(50)}\n`;
        syntheseContent += `Synthèse générée automatiquement le ${new Date().toLocaleString('fr-FR')}\n`;

        const win = window.open('', '_blank');
        win.document.open();
        win.document.write(`
        <html>
            <head>
                <title>Synthèse de consultation - ${patient?.prenom} ${patient?.nom}</title>
                <style>
                @page { size: A4; margin: 16mm; }
                * { box-sizing: border-box; }
                body { color: #1e293b; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.55; margin: 0; }
                h1 { color: #0f766e; font-size: 21px; letter-spacing: .7px; margin: 0 0 16px; padding-bottom: 10px; text-align: center; text-transform: uppercase; border-bottom: 3px solid #0f766e; }
                .header { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 9px; display: grid; grid-template-columns: 1fr 1fr; gap: 7px 18px; margin-bottom: 16px; padding: 13px 15px; }
                .header strong { color: #0f766e; font-size: 10px; letter-spacing: .3px; text-transform: uppercase; }
                pre { background: #fff; border: 1px solid #e2e8f0; border-radius: 9px; color: #334155; font-size: 11px; line-height: 1.6; margin: 0; padding: 14px; }
                .footer { border-top: 1px solid #cbd5e1; color: #64748b; font-size: 9px; margin-top: 22px; padding-top: 9px; text-align: center; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                <h1>SYNTHÈSE DE CONSULTATION</h1>
                <div class="header">
                <strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}<br>
                <strong>Patient:</strong> ${patient?.prenom} ${patient?.nom}<br>
                <strong>Dossier N°:</strong> ${patient?.numero_dossier}<br>
                <strong>Motif:</strong> ${consultation?.motif_consultation}
                </div>
                <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${syntheseContent.split('\n').slice(5).join('\n')}</pre>
                <div class="footer">
                Document généré automatiquement le ${new Date().toLocaleString('fr-FR')}
                </div>
                <script>
                window.onload = function() {
                    setTimeout(() => {
                    window.print();
                    }, 500);
                }
                </script>
            </body>
        </html>
        `);
        win.document.close();
        return { success: true };
    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        return { success: false, error: error.message };
    }
};
