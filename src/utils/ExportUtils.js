import React from 'react';
import { Download, FileText, Mail } from 'lucide-react';
import { formatMontant } from './currency';

// Utilitaire pour l'exportation des données
const ExportUtils = {
  // Exporter en CSV
  // `columns` (optionnel) : [{ key, label }] pour choisir l'ordre, les en-têtes français
  // et exclure des champs internes. Sans ce paramètre, retombe sur les clés brutes de
  // data[0] (comportement historique).
  exportToCSV: (data, filename, columns) => {
    if (!data || data.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const cols = columns && columns.length > 0
      ? columns
      : Object.keys(data[0]).map((key) => ({ key, label: key }));

    // Séparateur ';' (pas ',') : en locale fr-FR, Excel réserve la virgule au séparateur
    // décimal et n'ouvre pas correctement un CSV séparé par virgules en colonnes distinctes.
    const escapeCell = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      cols.map((c) => escapeCell(c.label)).join(';'),
      ...data.map((row) => cols.map((c) => escapeCell(row[c.key])).join(';')),
    ].join('\n');

    // BOM UTF-8 pour que les accents s'affichent correctement à l'ouverture dans Excel.
    const BOM = String.fromCharCode(0xFEFF);
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Exporter en JSON
  exportToJSON: (data, filename) => {
    if (!data) {
      alert('Aucune donnée à exporter');
      return;
    }

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Exporter en PDF (simulation)
  exportToPDF: (data, filename) => {
    alert(`Exportation PDF de ${filename} - Fonctionnalité à implémenter avec une bibliothèque comme jsPDF`);
    console.log('Données à exporter en PDF:', data);
  },

  // Exporter en Excel (simulation)
  exportToExcel: (data, filename) => {
    alert(`Exportation Excel de ${filename} - Fonctionnalité à implémenter avec une bibliothèque comme SheetJS`);
    console.log('Données à exporter en Excel:', data);
  },

  // Envoyer par email
  sendEmail: (data, recipient, subject) => {
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `Veuillez trouver ci-joint les données demandées.\n\n${JSON.stringify(data, null, 2)}`
    )}`;
    window.open(mailtoLink);
  },

  // Formater les données pour l'export
  formatDataForExport: (data, includeHeaders = true) => {
    if (!data || data.length === 0) return [];

    return data.map(item => {
      const formatted = { ...item };
      
      // Formater les montants
      Object.keys(formatted).forEach(key => {
        if (key.includes('montant') || key.includes('total') || key.includes('paye')) {
          if (typeof formatted[key] === 'number') {
            formatted[key] = formatMontant(formatted[key]);
          }
        }
        
        // Formater les dates
        if (key.includes('date') && formatted[key]) {
          if (typeof formatted[key] === 'string') {
            formatted[key] = new Date(formatted[key]).toLocaleDateString('fr-FR');
          }
        }
      });
      
      return formatted;
    });
  }
};

export default ExportUtils;
