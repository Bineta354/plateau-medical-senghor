import { useState, useEffect, useCallback } from 'react';
import { fetchParametres, saveParametres } from '../services/parametrageService';
import { useToast } from './useToast';
import { useAuth } from '../contexts/AuthContext';
import { PAGES_CONFIG as initialSettings } from '../data/pagesConfig.js';

export const useParametrage = () => {
  const { showSuccess, showError } = useToast();
  const { tenantId } = useAuth();

  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const fetchedSettings = await fetchParametres(tenantId);
        setSettings(prev => ({ ...prev, ...fetchedSettings }));
      } catch (error) {
        showError('Erreur lors du chargement des paramètres.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    // Se relance quand tenantId passe de null à sa vraie valeur (profil chargé
    // de façon asynchrone après le login), pour ne pas rester sur les valeurs
    // par défaut ni charger le cabinet d'un autre tenant.
  }, [showError, tenantId]);
  
  const handleInputChange = useCallback((field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  }, []);

  const handleHoraireChange = useCallback((jour, field, value) => {
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
  }, []);

  const applyCSSVariables = useCallback(() => {
    const root = document.documentElement;
    root.style.setProperty('--medical-primary', settings.couleur_principale);
    root.style.setProperty('--medical-secondary', settings.couleur_secondaire);
    root.style.setProperty('--medical-success', settings.couleur_success);
    root.style.setProperty('--medical-warning', settings.couleur_warning);
    root.style.setProperty('--medical-danger', settings.couleur_danger);
    root.style.setProperty('--medical-purple', settings.couleur_info);
    
    if (settings.favicon_url) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.favicon_url;
    }
    
    if (settings.titre_page) {
      document.title = settings.titre_page;
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await saveParametres(settings, tenantId);
      applyCSSVariables(); // Appliquer les changements dynamiques
      setHasChanges(false);
      showSuccess('Paramètres enregistrés avec succès !');
    } catch (error) {
      showError('Erreur lors de la sauvegarde des paramètres.');
    } finally {
      setSaving(false);
    }
  }, [settings, applyCSSVariables, showSuccess, showError, tenantId]);

  return {
    settings,
    loading,
    saving,
    hasChanges,
    handleInputChange,
    handleHoraireChange,
    handleSave,
    setSettings, // Exposer pour des cas plus complexes si nécessaire
  };
};
