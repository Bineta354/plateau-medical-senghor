import React from 'react';
import { Download, FileText, Mail } from 'lucide-react';
import { formatMontant } from './currency';

// Utilitaire pour l'exportation des données
const ExportUtils = {
  // Exporter en CSV
  exportToCSV: (data, filename) => {
    if (!data || data.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    // Créer le contenu CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Échapper les virgules et guillemets
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Créer le blob et télécharger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
