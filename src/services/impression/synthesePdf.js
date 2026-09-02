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

        const escapeHtml = (value) => String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');

        const renderLine = (label, value) => {
          if (!value && value !== 0) return '';
          return `<div class="fact-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
        };

        const sectionBlocks = [
          {
            title: 'Antécédents significatifs',
            items: (antecedents || []).map((ant) => {
              const nom = ant.antecedents?.nom || ant.antecedent || 'Antécédent';
              const date = ant.date_decouverte ? ` (${new Date(ant.date_decouverte).toLocaleDateString('fr-FR')})` : '';
              const commentaires = ant.commentaires ? ` — ${ant.commentaires}` : '';
              return `${nom}${date}${commentaires}`;
            })
          },
          {
            title: 'Constantes vitales',
            items: (constantes || []).map((const_) => {
              const unite = const_.unite || const_.constantes?.unite || '';
              return `${const_.constantes?.nom || 'Constante'} : ${const_.valeur_mesuree}${unite ? ` ${unite}` : ''}`;
            })
          },
          {
            title: 'Observations cliniques',
            items: [
              ...(signesCliniques || []).map((signe) => {
                const nom = signe.signes_cliniques?.nom || 'Signe clinique';
                const intensite = signe.intensite && signe.intensite !== 'faible' ? ` (${signe.intensite})` : '';
                const commentaires = signe.commentaires ? ` — ${signe.commentaires}` : '';
                return `${nom}${intensite}${commentaires}`;
              }),
              ...(examensAppareils || []).map((examen) => {
                const result = `${examen.appareils?.nom || 'Examen'} : ${examen.resultat_examen || ''}`;
                const anomalies = examen.anomalies_detectees ? ` — Anomalies : ${examen.anomalies_detectees}` : '';
                return `${result}${anomalies}`;
              })
            ]
          },
          {
            title: 'Diagnostics',
            items: (diagnostics || []).map((diag) => {
              const nom = diag.diagnostics?.nom || 'Diagnostic';
              const certitude = diag.certitude ? ` (${diag.certitude})` : '';
              const commentaires = diag.commentaires ? ` — ${diag.commentaires}` : '';
              return `${nom}${certitude}${commentaires}`;
            })
          },
          {
            title: 'Prescriptions',
            items: (ordonnances || []).flatMap((ord) => {
              const lines = (ord.lignes_ordonnance || []).map((ligne) => {
                const medicament = ligne.medicaments?.nom || 'Médicament';
                const posologie = ligne.posologie ? ` — ${ligne.posologie}` : '';
                const duree = ligne.duree_traitement ? ` (${ligne.duree_traitement} jours)` : '';
                return `${medicament}${posologie}${duree}`;
              });
              const generaux = ord.instructions_generales ? [`Instructions : ${ord.instructions_generales}`] : [];
              return [...generaux, ...lines];
            })
          },
          {
            title: 'Certificats émis',
            items: (certificats || []).map((cert) => {
              const type = cert.types_certificats?.nom || 'Certificat médical';
              const dateDebut = cert.date_debut ? new Date(cert.date_debut).toLocaleDateString('fr-FR') : '—';
              const duree = cert.duree_jours ? `${cert.duree_jours} jour${cert.duree_jours > 1 ? 's' : ''}` : '—';
              const motif = cert.motif ? ` — ${cert.motif}` : '';
              return `${type} (${duree}, du ${dateDebut})${motif}`;
            })
          }
        ].filter((section) => section.items && section.items.length > 0);

        const formattedContent = sectionBlocks.length > 0
          ? sectionBlocks
              .map((section) => `
                <section class="clinical-section">
                  <h2>${escapeHtml(section.title)}</h2>
                  <ul>
                    ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                  </ul>
                </section>
              `)
              .join('')
          : '<section class="clinical-section empty-state"><h2>Informations médicales</h2><p>Aucune donnée clinique renseignée pour cette consultation.</p></section>';

        const win = window.open('', '_blank');
        if (!win) throw new Error("La fenêtre d'impression a été bloquée par le navigateur.");
        win.document.open();
        win.document.write(`
        <html>
            <head>
                <title>Synthèse de consultation - ${patient?.prenom || ''} ${patient?.nom || ''}</title>
                <style>
                @page { size: A4; margin: 14mm; }
                * { box-sizing: border-box; }
                body {
                  color: #1e293b; font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; line-height: 1.55;
                  margin: 0; background: linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%);
                }
                .page {
                  background: #edf5f2; border: 1px solid #c8ded7; border-radius: 0; box-shadow: none;
                  margin: 0 auto; max-width: 210mm; padding: 0 0 14mm; min-height: 267mm; overflow: hidden;
                }
                .header-band {
                  background: #eef6f3; border-bottom: 3px solid #0e8d82; color: #0b6d63; padding: 14px 18px 10px; position: relative;
                }
                .cabinet {
                  align-items: center; display: flex; gap: 12px; margin-bottom: 8px;
                }
                .cabinet-logo { height: 52px; max-width: 96px; object-fit: contain; border-radius: 8px; background: rgba(13, 148, 136, 0.08); padding: 4px; }
                .cabinet-name { font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.2px; }
                .cabinet-details { font-size: 9px; margin: 2px 0 0; color: #345d56; }
                .document-title {
                  color: #0b7a70; font-size: 23px; font-weight: 800; letter-spacing: 1px; margin: 0; text-align: center; text-transform: uppercase;
                }
                .subtitle {
                  display: none;
                }
                .content {
                  padding: 14px 18px 0;
                }
                .patient-summary {
                  background: #dfeeea; border: 1px solid #bfe0d5; border-radius: 0; display: flex; flex-direction: column; gap: 8px; margin: 14px 0 18px; padding: 12px 14px 10px;
                }
                .fact-line {
                  display: grid; grid-template-columns: 1fr 1.4fr; gap: 16px; align-items: center; padding: 2px 0;
                }
                .fact-line span {
                  color: #0a5d54; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
                }
                .fact-line strong {
                  color: #163c3a; font-size: 13px; font-weight: 600; text-align: left;
                }
                .clinical-section {
                  break-inside: avoid; border: 0; border-radius: 0; margin: 8px 0 0; padding: 0; background: transparent;
                }
                .clinical-section h2 {
                  background: transparent; border: 0; border-bottom: 0; color: #0a5d54; font-size: 15px; margin: 0 0 8px; padding: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;
                }
                .clinical-section ul {
                  list-style: none; margin: 0; padding: 0 0 0 16px; display: flex; flex-direction: column; gap: 4px;
                }
                .clinical-section li {
                  border-bottom: 0; padding: 0 0 0 4px; color: #1f2f2c; font-size: 12px; line-height: 1.5;
                }
                .clinical-section li::before { color: #0a5d54; content: '•'; font-weight: bold; margin-right: 8px; }
                .empty-state p { color: #64748b; font-style: italic; margin: 0; padding: 12px 11px; }
                .footer {
                  border-top: 1px dashed #8ab6ad; color: #5f7a74; font-size: 9px; margin-top: 18px; padding: 10px 18px 0; text-align: center;
                }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header-band">
                        <div class="cabinet">
                          ${settings.logo_url ? `<img class="cabinet-logo" src="${settings.logo_url}" alt="Logo du cabinet" />` : ''}
                          <div>
                            <p class="cabinet-name">${settings.nom_cabinet || 'Cabinet médical'}</p>
                            <p class="cabinet-details">${[settings.adresse, settings.code_postal, settings.ville].filter(Boolean).join(', ')}</p>
                            <p class="cabinet-details">${[settings.telephone && `Tél. ${settings.telephone}`, settings.email].filter(Boolean).join(' • ')}</p>
                          </div>
                        </div>

                        <h1 class="document-title">Synthèse de consultation</h1>
                        <div class="subtitle">Cabinet médical • document de suivi</div>
                    </div>

                    <div class="content">
                        <section class="patient-summary">
                          ${renderLine('Date', new Date().toLocaleDateString('fr-FR'))}
                          ${renderLine('Patient', `${patient?.prenom || ''} ${patient?.nom || ''}`.trim() || '—')}
                          ${renderLine('Dossier', patient?.numero_dossier || '—')}
                          ${renderLine('Motif', getConsultationMotif(consultation) || consultation?.motif_consultation || 'Non renseigné')}
                        </section>

                        ${formattedContent}
                    </div>

                    <div class="footer">
                        Document généré automatiquement le ${new Date().toLocaleString('fr-FR')}
                    </div>
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
