import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchParametres, saveParametres } from '../services/parametrageService';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../contexts/AuthContext';


const PersonnalisationContext = createContext();

export const usePersonnalisation = () => {
  const context = useContext(PersonnalisationContext);
  if (!context) {
    throw new Error('usePersonnalisation must be used within PersonnalisationProvider');
  }
  return context;
};

// ============================================================================
// VALEURS PAR DÉFAUT (INITIALES)
// ============================================================================

const INITIAL_SETTINGS = {
  // Général - Informations de la structure
  nom_cabinet: '',
  adresse: '',
  ville: '',
  code_postal: '',
  pays: 'Niger',
  telephone: '',
  email: '',
  site_web: '',
  numero_agrement: '',
  ninea: '',
  registre_commerce: '',
  tva: 0,

  // Général - Gestion des patients et rémunération
  jours_inactivite: 365,
  taux_retrocession_medecin: null,

  // Général - Horaires
  horaires_ouverture: {
    lundi: { ouvert: true, debut: '08:00', fin: '18:00' },
    mardi: { ouvert: true, debut: '08:00', fin: '18:00' },
    mercredi: { ouvert: true, debut: '08:00', fin: '18:00' },
    jeudi: { ouvert: true, debut: '08:00', fin: '18:00' },
    vendredi: { ouvert: true, debut: '08:00', fin: '18:00' },
    samedi: { ouvert: false, debut: '08:00', fin: '12:00' },
    dimanche: { ouvert: false, debut: '', fin: '' }
  },
  
  // Général - Localisation et Formats
  langue: 'fr',
  fuseau_horaire: 'Africa/Niamey',
  format_date: 'DD/MM/YYYY',
  format_heure: 'HH:mm',
  devise: 'FCFA',
  symbole_devise: 'FCFA',
  
  // Apparence - Identité visuelle
  logo_url: '',
  favicon_url: '',
  titre_page: 'Cabinet Médical',
  
  // Apparence - Couleurs principales
  couleur_principale: '#3B82F6',
  couleur_secondaire: '#6366F1',
  couleur_accent: '#10B981',
  couleur_success: '#10B981',
  couleur_warning: '#F59E0B',
  couleur_danger: '#EF4444',
  couleur_info: '#8B5CF6',
  
  // Apparence - Couleurs de l'interface
  couleur_background: '#F9FAFB',
  couleur_surface: '#FFFFFF',
  couleur_texte: '#111827',
  couleur_texte_secondaire: '#6B7280',
  couleur_bordure: '#E5E7EB',
  
  // Apparence - Sidebar
  couleur_sidebar_fond: '#1E293B',
  couleur_sidebar_texte: '#F1F5F9',
  titre_sidebar: 'Cabinet Médical',
  
  // Apparence - Header
  couleur_header_fond: '#FFFFFF',
  couleur_header_texte: '#111827',
  afficher_logo_header: true,
  afficher_nom_cabinet_header: true,
  
  // Apparence - Login
  couleur_login_gradient_debut: '#3B82F6',
  couleur_login_gradient_milieu: '#6366F1',
  couleur_login_gradient_fin: '#10B981',
  
  // Apparence - Typographie
  police_famille: 'Inter',
  taille_police_base: 16,
  
  // Apparence - Thème
  theme: 'light',
  
  // Documents - En-tête et identité
  document_logo_url: '',
  document_cachet_url: '',
  document_lieu_par_defaut: '',
  document_afficher_logo: true,
  document_afficher_cachet: true,
  document_afficher_adresse_complete: true,
  
  // Documents - Couleurs
  document_couleur_principale: '#4f46e5',
  document_couleur_secondaire: '#7c3aed',
  document_couleur_bordure: '#4f46e5',
  
  // Documents - Certificats
  certificat_titre: 'CERTIFICAT MÉDICAL',
  certificat_texte_introduction: 'Je soussigné, Docteur [NOM_MEDECIN], certifie avoir examiné ce jour :',
  certificat_texte_mention: 'Certificat établi à la demande de l\'intéressé(e) et remis en main propre pour faire valoir ce que de droit.',
  certificat_footer_texte: 'Ce document est un certificat médical officiel.',
  certificat_afficher_numero_dossier: true,
  certificat_afficher_date_emission: true,
  
  // Documents - Ordonnances
  ordonnance_titre: 'ORDONNANCE MÉDICALE',
  ordonnance_footer_texte: 'Ce document est une ordonnance médicale - À conserver',
  ordonnance_afficher_numero: true,
  ordonnance_afficher_date_prescription: true,
  ordonnance_afficher_prochain_rdv: true,
  
  // Documents - Format et style
  document_police: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  document_taille_police: 14,
  document_marge_haut: 40,
  document_marge_bas: 40,
  document_marge_gauche: 60,
  document_marge_droite: 60,
  document_largeur_max: 900,
  document_afficher_fond: true,
  document_couleur_fond: '#FFFFFF',
  
  // Documents - Informations complémentaires
  document_texte_footer_general: 'Document généré le [DATE]',
  document_afficher_telephone: true,
  document_afficher_email: true,
  document_afficher_site_web: false,
  document_afficher_numero_agrement: false,
};

export const PersonnalisationProvider = ({ children }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { currentUser, tenantId } = useAuth();

  const [settings, setSettings] = useState(INITIAL_SETTINGS);

 useEffect(() => {
  if (currentUser) {
    loadSettings();
  } else {
    setLoading(false);
  }
  // Se relance aussi quand tenantId passe de null à sa vraie valeur (le profil
  // se charge de façon asynchrone juste après le login) — sinon on resterait
  // bloqué sur les valeurs par défaut faute de savoir quel cabinet charger.
}, [currentUser, tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchParametres(tenantId);
      
      // Fusionner avec les valeurs par défaut pour garantir la structure complète
      let mergedSettings = {
          ...INITIAL_SETTINGS,
          ...data,
          // Fusion profonde pour les horaires
          horaires_ouverture: {
              ...INITIAL_SETTINGS.horaires_ouverture,
              ...(data.horaires_ouverture || {})
          }
      };

      setSettings(mergedSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
      showError('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await saveParametres(settings, tenantId);

      applyCSSVariables();
      setHasChanges(false);
      showSuccess('Paramètres enregistrés avec succès !');
      
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showError('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  // Alias pour la compatibilité avec le code existant si nécessaire
  const fetchSettings = loadSettings;

  const applyCSSVariables = () => {
    const root = document.documentElement;
    // Couleurs globales (Charte Graphique)
    // Fonctions utilitaires
    const hexToRgb = (hex) => {
      let c;
      if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
          c = hex.substring(1).split('');
          if(c.length === 3){
              c = [c[0], c[0], c[1], c[1], c[2], c[2]];
          }
          c = '0x' + c.join('');
          return [(c>>16)&255, (c>>8)&255, c&255].join(' ');
      }
      return null;
    };

    const setMedicalColor = (name, value) => {
      if (!value) return;
      root.style.setProperty(name, value);
      const rgb = hexToRgb(value);
      if (rgb) {
        root.style.setProperty(`${name}-rgb`, rgb);
      }
    };

    // Couleurs globales (Charte Graphique)
    setMedicalColor('--medical-primary', settings.couleur_principale);
    setMedicalColor('--medical-secondary', settings.couleur_secondaire);
    setMedicalColor('--medical-success', settings.couleur_success);
    setMedicalColor('--medical-warning', settings.couleur_warning);
    setMedicalColor('--medical-danger', settings.couleur_danger);
    setMedicalColor('--medical-info', settings.couleur_info);
    
    // Couleurs Sidebar & Header (déjà gérées dans les composants, mais on peut aussi les exposer si besoin)
    if (settings.couleur_sidebar_fond) root.style.setProperty('--sidebar-bg', settings.couleur_sidebar_fond);
    if (settings.couleur_sidebar_texte) root.style.setProperty('--sidebar-text', settings.couleur_sidebar_texte);
    
    if (settings.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
      link.rel = 'icon';
      link.href = settings.favicon_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    if (settings.titre_page) {
      document.title = settings.titre_page;
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleHoraireChange = (jour, field, value) => {
    setSettings(prev => ({
      ...prev,
      horaires_ouverture: {
        ...prev.horaires_ouverture,
        [jour]: {
          ...prev.horaires_ouverture[jour],
          [field]: value
        }
      }
    }));
    setHasChanges(true);
  };

  const value = {
    settings,
    loading,
    saving,
    hasChanges,
    handleInputChange,
    handleHoraireChange,
    handleSave,
    fetchSettings,
    resetSettings: async () => {
        await fetchSettings();
    }
  };

  return (
    <PersonnalisationContext.Provider value={value}>
      {children}
    </PersonnalisationContext.Provider>
  );
};
