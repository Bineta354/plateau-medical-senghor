import React, { useEffect, useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { constantesService } from '../../lib/services';
import { useAlert } from '../../contexts/AlertContext';

// Helper pour identifier les constantes principales par leur nom
const isMainConstante = (nom) => {
  if (!nom) return false;
  const lowerNom = nom.toLowerCase();
  return (
    lowerNom.includes('température') ||
    lowerNom === 'température' ||
    lowerNom.includes('poids') ||
    lowerNom === 'poids' ||
    (lowerNom.includes('tension') && lowerNom.includes('systolique')) ||
    (lowerNom.includes('tension') && lowerNom.includes('diastolique'))
  );
};

// Helper pour identifier le type de constante principale
const getMainConstanteType = (nom) => {
  if (!nom) return null;
  const lowerNom = nom.toLowerCase();
  if (lowerNom.includes('température') || lowerNom === 'température') return 'temperature';
  if (lowerNom.includes('poids') || lowerNom === 'poids') return 'poids';
  if (lowerNom.includes('tension') && lowerNom.includes('systolique')) return 'tensionSystolique';
  if (lowerNom.includes('tension') && lowerNom.includes('diastolique')) return 'tensionDiastolique';
  return null;
};

// Composant pour les autres constantes avec état local contrôlé
const AutreConstanteInput = ({ constante, saving, onValueChange, onDelete, isTerminated }) => {
  // État local pour la valeur de l'input - initialisé avec la valeur enregistrée
  const [inputValue, setInputValue] = useState(
    constante.valeur_mesuree !== null && constante.valeur_mesuree !== undefined
      ? constante.valeur_mesuree.toString()
      : ''
  );

  // Mettre à jour l'état local quand la valeur de la constante change (ex: après rechargement)
  useEffect(() => {
    const newValue = constante.valeur_mesuree !== null && constante.valeur_mesuree !== undefined
      ? constante.valeur_mesuree.toString()
      : '';
    setInputValue(newValue);
  }, [constante.valeur_mesuree]);

  return (
    <div className="border rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <label className="text-sm font-semibold text-gray-900 w-full sm:w-auto sm:flex-1 sm:min-w-[150px]">
          {constante.constantes?.nom}
        </label>
        <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-xs">
          <input
            type="number"
            step="0.1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={(e) => {
              const currentValue = constante.valeur_mesuree !== null && constante.valeur_mesuree !== undefined
                ? constante.valeur_mesuree.toString()
                : '';
              if (e.target.value !== currentValue) {
                onValueChange(
                  constante.id || constante.constante_id,
                  e.target.value,
                  null,
                  constante.constante_id,
                  constante.unite || constante.constantes?.unite,
                  constante.id === null
                );
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder="Saisir la valeur"
            disabled={saving || isTerminated}
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {constante.unite || constante.constantes?.unite || ''}
          </span>
          {!isTerminated && (
            <button
              onClick={() => onDelete(constante)}
              className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
              title="Supprimer"
              disabled={saving}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ConstantesTab = ({
  consultationId,
  activeTab,
  showAddModal,
  onCloseAddModal,
  onOpenAddModal,
  isTerminated = false
}) => {
  const { showSuccess, showWarning, showError, showInfo } = useAlert();

  // États internes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [constantesRef, setConstantesRef] = useState([]);
  const [constantes, setConstantes] = useState([]);
  const [pendingConstanteChanges, setPendingConstanteChanges] = useState(new Map());
  const [pendingDeleteConstanteChanges, setPendingDeleteConstanteChanges] = useState(new Set());

  // État pour les valeurs des constantes principales (température, poids, tension)
  const [constantesValues, setConstantesValues] = useState({
    temperature: { valeur: '', unite: '°C', constanteId: null, constanteConsultationId: null, min: null, max: null },
    poids: { valeur: '', unite: 'kg', constanteId: null, constanteConsultationId: null, min: null, max: null },
    tensionSystolique: { valeur: '', unite: 'mmHg', constanteId: null, constanteConsultationId: null, min: null, max: null },
    tensionDiastolique: { valeur: '', unite: 'mmHg', constanteId: null, constanteConsultationId: null, min: null, max: null }
  });

  // Ref pour stocker l'onglet précédent
  const prevActiveTabRef = useRef();

  // Refs pour accéder aux valeurs actuelles dans le cleanup (évite les closures stales)
  const pendingChangesRef = useRef(pendingConstanteChanges);
  const pendingDeletesRef = useRef(pendingDeleteConstanteChanges);
  const consultationIdRef = useRef(consultationId);

  // Synchroniser les refs avec les états
  useEffect(() => {
    pendingChangesRef.current = pendingConstanteChanges;
  }, [pendingConstanteChanges]);

  useEffect(() => {
    pendingDeletesRef.current = pendingDeleteConstanteChanges;
  }, [pendingDeleteConstanteChanges]);

  useEffect(() => {
    consultationIdRef.current = consultationId;
  }, [consultationId]);

  // Sauvegarder les constantes lors du démontage du composant
  useEffect(() => {
    return () => {
      const changes = pendingChangesRef.current;
      const deletes = pendingDeletesRef.current;
      const consId = consultationIdRef.current;

      if (changes.size > 0 || deletes.size > 0) {
        console.log(`[CONSTANTES_TAB] Démontage du composant - Sauvegarde automatique`, {
          consultationId: consId,
          changesCount: changes.size,
          deletesCount: deletes.size,
          changes: Array.from(changes.entries()).map(([key, value]) => ({
            key,
            constante_id: value.constante_id,
            valeur_mesuree: value.valeur_mesuree
          })),
          timestamp: new Date().toISOString()
        });

        // Sauvegarde synchrone via batchSave (fire and forget)
        constantesService.batchSave(changes, deletes, parseInt(consId))
          .then((result) => {
            console.log(`[CONSTANTES_TAB] Sauvegarde au démontage réussie`, result);
          })
          .catch((error) => {
            console.error(`[CONSTANTES_TAB] Erreur sauvegarde au démontage:`, error);
          });
      } else {
        console.log(`[CONSTANTES_TAB] Démontage du composant - Aucune modification à sauvegarder`);
      }
    };
  }, []); // Dépendances vides = exécuté seulement au démontage

  // Charger les données de référence au montage
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const refData = await constantesService.getAll();
        setConstantesRef(refData);

        // Initialiser les constantes principales avec les valeurs dynamiques de la BDD
        const tempRef = refData.find(c => getMainConstanteType(c.nom) === 'temperature');
        const poidsRef = refData.find(c => getMainConstanteType(c.nom) === 'poids');
        const tensionSysRef = refData.find(c => getMainConstanteType(c.nom) === 'tensionSystolique');
        const tensionDiaRef = refData.find(c => getMainConstanteType(c.nom) === 'tensionDiastolique');

        setConstantesValues(prev => ({
          temperature: {
            ...prev.temperature,
            unite: tempRef?.unite || tempRef?.unite || '°C',
            constanteId: tempRef?.id || null,
            min: tempRef?.valeur_min ?? null,
            max: tempRef?.valeur_max ?? null
          },
          poids: {
            ...prev.poids,
            unite: poidsRef?.unite || poidsRef?.unite || 'kg',
            constanteId: poidsRef?.id || null,
            min: poidsRef?.valeur_min ?? null,
            max: poidsRef?.valeur_max ?? null
          },
          tensionSystolique: {
            ...prev.tensionSystolique,
            unite: tensionSysRef?.unite || tensionSysRef?.unite || 'mmHg',
            constanteId: tensionSysRef?.id || null,
            min: tensionSysRef?.valeur_min ?? null,
            max: tensionSysRef?.valeur_max ?? null
          },
          tensionDiastolique: {
            ...prev.tensionDiastolique,
            unite: tensionDiaRef?.unite || tensionDiaRef?.unite || 'mmHg',
            constanteId: tensionDiaRef?.id || null,
            min: tensionDiaRef?.valeur_min ?? null,
            max: tensionDiaRef?.valeur_max ?? null
          }
        }));
      } catch (error) {
        console.error('Erreur chargement constantes de référence:', error);
        showError('Erreur lors du chargement des constantes');
      }
    };

    loadReferenceData();
  }, []);

  // Charger les constantes de la consultation
  useEffect(() => {
    if (!consultationId) return;

    const loadConsultationConstantes = async () => {
      setLoading(true);
      setPendingConstanteChanges(new Map());
      setPendingDeleteConstanteChanges(new Set());

      try {
        const data = await constantesService.getByConsultation(consultationId);
        setConstantes(data);

        // Mettre à jour les valeurs des constantes principales
        const temperature = data.find(c => getMainConstanteType(c.constantes?.nom) === 'temperature');
        const poids = data.find(c => getMainConstanteType(c.constantes?.nom) === 'poids');
        const tensionSystolique = data.find(c => getMainConstanteType(c.constantes?.nom) === 'tensionSystolique');
        const tensionDiastolique = data.find(c => getMainConstanteType(c.constantes?.nom) === 'tensionDiastolique');

        setConstantesValues(prev => ({
          temperature: {
            ...prev.temperature,
            valeur: temperature?.valeur_mesuree ?? '',
            constanteConsultationId: temperature?.id || null,
            constanteId: temperature?.constantes?.id || prev.temperature.constanteId,
            min: temperature?.constantes?.valeur_min ?? prev.temperature.min,
            max: temperature?.constantes?.valeur_max ?? prev.temperature.max
          },
          poids: {
            ...prev.poids,
            valeur: poids?.valeur_mesuree ?? '',
            constanteConsultationId: poids?.id || null,
            constanteId: poids?.constantes?.id || prev.poids.constanteId,
            min: poids?.constantes?.valeur_min ?? prev.poids.min,
            max: poids?.constantes?.valeur_max ?? prev.poids.max
          },
          tensionSystolique: {
            ...prev.tensionSystolique,
            valeur: tensionSystolique?.valeur_mesuree ?? '',
            constanteConsultationId: tensionSystolique?.id || null,
            constanteId: tensionSystolique?.constantes?.id || prev.tensionSystolique.constanteId,
            min: tensionSystolique?.constantes?.valeur_min ?? prev.tensionSystolique.min,
            max: tensionSystolique?.constantes?.valeur_max ?? prev.tensionSystolique.max
          },
          tensionDiastolique: {
            ...prev.tensionDiastolique,
            valeur: tensionDiastolique?.valeur_mesuree ?? '',
            constanteConsultationId: tensionDiastolique?.id || null,
            constanteId: tensionDiastolique?.constantes?.id || prev.tensionDiastolique.constanteId,
            min: tensionDiastolique?.constantes?.valeur_min ?? prev.tensionDiastolique.min,
            max: tensionDiastolique?.constantes?.valeur_max ?? prev.tensionDiastolique.max
          }
        }));
      } catch (error) {
        console.error('Erreur chargement constantes consultation:', error);
        showError('Erreur lors du chargement des constantes');
      } finally {
        setLoading(false);
      }
    };

    loadConsultationConstantes();
  }, [consultationId]);

  // Sauvegarder les constantes en lot lorsque l'onglet change
  useEffect(() => {
    const prevActiveTab = prevActiveTabRef.current;

    // Log du changement d'onglet
    if (prevActiveTab !== activeTab) {
      console.log(`[CONSTANTES_TAB] Changement d'onglet détecté`, {
        de: prevActiveTab || 'initial',
        vers: activeTab,
        consultationId,
        timestamp: new Date().toISOString()
      });
    }

    if (prevActiveTab === 'constantes' && activeTab !== 'constantes') {
      if (pendingConstanteChanges.size > 0 || pendingDeleteConstanteChanges.size > 0) {
        console.log(`[CONSTANTES_TAB] Sauvegarde automatique déclenchée lors du changement d'onglet`, {
          changesCount: pendingConstanteChanges.size,
          deletesCount: pendingDeleteConstanteChanges.size,
          consultationId,
          timestamp: new Date().toISOString()
        });
        batchSaveConstantes();
      } else {
        console.log(`[CONSTANTES_TAB] Aucune modification en attente, pas de sauvegarde nécessaire`, {
          consultationId,
          timestamp: new Date().toISOString()
        });
      }
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  // Fonction centralisée pour gérer les changements de valeur des constantes
  const handleConstanteChange = (constanteIdentifier, valeur, type = null, constanteId = null, unite = null, isNew = false) => {
    console.log('handleConstanteChange called with:', { constanteIdentifier, valeur, type, constanteId, unite, isNew });

    if (valeur === null || valeur === '') {
      // Si la valeur est vide, retirer des pending changes
      setPendingConstanteChanges(prev => {
        const newState = new Map(prev);
        if (newState.has(constanteIdentifier)) {
          newState.delete(constanteIdentifier);
        }
        return newState;
      });

      if (type) {
        setConstantesValues(prev => ({
          ...prev,
          [type]: { ...prev[type], valeur: '' }
        }));
      } else {
        setConstantes(prev => prev.map(c =>
          (c.id === constanteIdentifier || (c.id === null && c.constante_id === constanteIdentifier))
            ? { ...c, valeur_mesuree: null }
            : c
        ));
      }
      return;
    }

    let constanteValue = parseFloat(valeur);
    if (isNaN(constanteValue)) {
      showWarning('Veuillez saisir une valeur numérique valide');
      return;
    }

    let constanteRef = null;
    let actualConstanteId = constanteId;
    let constanteConsultationId = null;

    // Si c'est une constante principale
    if (type) {
      actualConstanteId = constantesValues[type].constanteId;
      constanteConsultationId = constantesValues[type].constanteConsultationId;
    } else {
      // Pour les autres constantes
      const foundInConstantes = constantes.find(c =>
        c.id === constanteIdentifier || (c.id === null && c.constante_id === constanteIdentifier)
      );
      if (foundInConstantes) {
        actualConstanteId = foundInConstantes.constante_id;
        constanteConsultationId = foundInConstantes.id;
        unite = unite || foundInConstantes.unite || foundInConstantes.constantes?.unite;
      }
    }

    if (!actualConstanteId) {
      console.error('ID de référence de constante manquant pour la validation');
      return;
    }

    // Récupérer les informations de la constante de référence pour validation
    const foundConstanteRef = constantesRef.find(c => c.id === actualConstanteId);
    if (foundConstanteRef) {
      constanteRef = foundConstanteRef;
    }

    // Validation de la valeur par rapport aux limites min/max
    if (constanteRef) {
      const labels = {
        temperature: 'Température',
        poids: 'Poids',
        tensionSystolique: 'Tension artérielle systolique',
        tensionDiastolique: 'Tension artérielle diastolique'
      };
      const constanteNom = constanteRef.nom || (type ? labels[type] : 'Constante');

      let adjustedValue = constanteValue;
      let valueAdjusted = false;

      if (constanteRef.valeur_min !== null && adjustedValue < constanteRef.valeur_min) {
        adjustedValue = constanteRef.valeur_min;
        valueAdjusted = true;
        showWarning(`La valeur saisie (${constanteValue}) pour ${constanteNom} est inférieure à la limite minimale (${constanteRef.valeur_min}). La valeur a été ajustée à ${adjustedValue}.`);
      }
      if (constanteRef.valeur_max !== null && adjustedValue > constanteRef.valeur_max) {
        adjustedValue = constanteRef.valeur_max;
        valueAdjusted = true;
        showWarning(`La valeur saisie (${constanteValue}) pour ${constanteNom} est supérieure à la limite maximale (${constanteRef.valeur_max}). La valeur a été ajustée à ${adjustedValue}.`);
      }

      if (valueAdjusted) {
        if (type) {
          setConstantesValues(prev => ({
            ...prev,
            [type]: { ...prev[type], valeur: adjustedValue.toString() }
          }));
        } else {
          setConstantes(prev => prev.map(c =>
            (c.id === constanteIdentifier || (c.id === null && c.constante_id === constanteIdentifier))
              ? { ...c, valeur_mesuree: adjustedValue }
              : c
          ));
        }
      }

      constanteValue = adjustedValue;

      // Vérifier si la valeur est en dehors de la plage normale (avertissement uniquement)
      if (constanteRef.valeur_normale_min !== null && constanteRef.valeur_normale_max !== null) {
        if (constanteValue < constanteRef.valeur_normale_min || constanteValue > constanteRef.valeur_normale_max) {
          showWarning(`Attention : La valeur ${constanteValue} est en dehors de la plage normale (${constanteRef.valeur_normale_min} - ${constanteRef.valeur_normale_max}) pour ${constanteNom}`);
        }
      }
    }

    // Mettre à jour l'état local pour l'affichage immédiat
    if (type) {
      setConstantesValues(prev => ({
        ...prev,
        [type]: { ...prev[type], valeur: valeur }
      }));
    } else {
      setConstantes(prev => prev.map(c =>
        (c.id === constanteIdentifier || (c.id === null && c.constante_id === constanteIdentifier))
          ? { ...c, valeur_mesuree: constanteValue }
          : c
      ));
    }

    // Ajouter aux modifications en attente
    setPendingConstanteChanges(prev => {
      const newState = new Map(prev);
      const dataToSave = {
        consultation_id: parseInt(consultationId),
        constante_id: actualConstanteId,
        valeur_mesuree: constanteValue,
        unite: unite || constanteRef?.unite || null,
        commentaires: null,
        constanteConsultationId: constanteConsultationId,
        isNew: isNew
      };
      newState.set(constanteIdentifier, dataToSave);
      return newState;
    });
  };

  // Fonction pour ajouter une constante à la liste
  const addConstanteToList = (constanteId) => {
    const constanteExists = constantes.some(c => c.constante_id === constanteId);
    if (constanteExists) {
      showWarning('Cette constante est déjà dans la liste');
      return;
    }

    const selectedConstante = constantesRef.find(c => c.id === constanteId);
    if (!selectedConstante) {
      showError('Constante non trouvée');
      return;
    }

    // Vérifier si c'est une constante principale
    if (isMainConstante(selectedConstante.nom)) {
      showWarning('Cette constante est déjà disponible dans les constantes principales');
      return;
    }

    const nouvelleConstante = {
      id: null,
      constante_id: constanteId,
      consultation_id: parseInt(consultationId),
      valeur_mesuree: null,
      unite: selectedConstante.unite || selectedConstante.unite || null,
      commentaires: null,
      constantes: {
        id: selectedConstante.id,
        nom: selectedConstante.nom,
        unite: selectedConstante.unite || selectedConstante.unite
      }
    };

    setConstantes(prev => [...prev, nouvelleConstante]);
    setPendingConstanteChanges(prev => {
      const newState = new Map(prev);
      newState.set(constanteId, {
        consultation_id: parseInt(consultationId),
        constante_id: constanteId,
        valeur_mesuree: null,
        unite: selectedConstante.unite || selectedConstante.unite || null,
        commentaires: null,
        constanteConsultationId: null,
        isNew: true
      });
      return newState;
    });

    showInfo(`Constante "${selectedConstante.nom}" ajoutée localement. Saisissez une valeur pour l'enregistrer.`);
    if (onCloseAddModal) onCloseAddModal();
  };

  // Fonction pour sauvegarder les constantes en lot
  const batchSaveConstantes = async () => {
    if (pendingConstanteChanges.size === 0 && pendingDeleteConstanteChanges.size === 0) {
      console.log(`[CONSTANTES_TAB] batchSaveConstantes: Aucune modification à sauvegarder`);
      return;
    }

    console.log(`[CONSTANTES_TAB] batchSaveConstantes: Début de la sauvegarde`, {
      consultationId,
      changesCount: pendingConstanteChanges.size,
      deletesCount: pendingDeleteConstanteChanges.size,
      changes: Array.from(pendingConstanteChanges.entries()).map(([key, value]) => ({
        key,
        constante_id: value.constante_id,
        valeur_mesuree: value.valeur_mesuree,
        isNew: value.isNew || !value.constanteConsultationId
      })),
      deletes: Array.from(pendingDeleteConstanteChanges),
      timestamp: new Date().toISOString()
    });

    setSaving(true);
    try {
      const result = await constantesService.batchSave(pendingConstanteChanges, pendingDeleteConstanteChanges, parseInt(consultationId));

      console.log(`[CONSTANTES_TAB] batchSaveConstantes: Sauvegarde réussie`, {
        consultationId,
        result,
        timestamp: new Date().toISOString()
      });

      if (result.success && result.count > 0) {
        showSuccess(`${result.count} opération(s) sur les constantes sauvegardée(s) avec succès !`);
      }

      setPendingConstanteChanges(new Map());
      setPendingDeleteConstanteChanges(new Set());

      // Recharger les constantes depuis la BDD (forceRefresh pour bypasser le cache)
      console.log(`[CONSTANTES_TAB] Rechargement des constantes depuis la BDD après sauvegarde`);
      const data = await constantesService.getByConsultation(consultationId, { forceRefresh: true });
      setConstantes(data);

      // Mettre à jour les valeurs des constantes principales
      const temperature = data.find(c => getMainConstanteType(c.constantes?.nom) === 'temperature');
      const poids = data.find(c => getMainConstanteType(c.constantes?.nom) === 'poids');
      const tensionSystolique = data.find(c => getMainConstanteType(c.constantes?.nom) === 'tensionSystolique');
      const tensionDiastolique = data.find(c => getMainConstanteType(c.constantes?.nom) === 'tensionDiastolique');

      setConstantesValues(prev => ({
        temperature: {
          ...prev.temperature,
          valeur: temperature?.valeur_mesuree ?? '',
          constanteConsultationId: temperature?.id || null
        },
        poids: {
          ...prev.poids,
          valeur: poids?.valeur_mesuree ?? '',
          constanteConsultationId: poids?.id || null
        },
        tensionSystolique: {
          ...prev.tensionSystolique,
          valeur: tensionSystolique?.valeur_mesuree ?? '',
          constanteConsultationId: tensionSystolique?.id || null
        },
        tensionDiastolique: {
          ...prev.tensionDiastolique,
          valeur: tensionDiastolique?.valeur_mesuree ?? '',
          constanteConsultationId: tensionDiastolique?.id || null
        }
      }));
    } catch (error) {
      console.error(`[CONSTANTES_TAB] batchSaveConstantes: Erreur lors de la sauvegarde`, {
        consultationId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      showError('Erreur lors de la sauvegarde des constantes: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtrer les autres constantes (non principales)
  const autresConstantes = constantes.filter(c => !isMainConstante(c.constantes?.nom));

  // Filtrer les constantes disponibles pour l'ajout
  const constantesDisponibles = constantesRef.filter(c => {
    if (isMainConstante(c.nom)) return false;
    return !constantes.some(x => x.constante_id === c.id);
  });

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Constantes vitales</h2>
        {!isTerminated && (
          <button
            onClick={onOpenAddModal}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm w-full sm:w-auto justify-center"
            disabled={saving}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </button>
        )}
      </div>

      {/* Liste des constantes principales */}
      <div className="space-y-4">
        {/* Température */}
        <div className="border rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <label className="text-sm font-semibold text-gray-900 w-full sm:w-auto sm:flex-1">
              Température
            </label>
            <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-xs">
              <input
                type="number"
                step="0.1"
                value={constantesValues.temperature.valeur}
                min={constantesValues.temperature.min ?? undefined}
                max={constantesValues.temperature.max ?? undefined}
                onChange={(e) => {
                  setConstantesValues(prev => ({
                    ...prev,
                    temperature: { ...prev.temperature, valeur: e.target.value }
                  }));
                }}
                onBlur={() => {
                  if (constantesValues.temperature.constanteId) {
                    handleConstanteChange(
                      'temperature',
                      constantesValues.temperature.valeur,
                      'temperature',
                      constantesValues.temperature.constanteId,
                      constantesValues.temperature.unite,
                      constantesValues.temperature.constanteConsultationId === null
                    );
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                placeholder="Ex: 37.2"
                disabled={saving || isTerminated}
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {constantesValues.temperature.unite}
              </span>
            </div>
          </div>
        </div>

        {/* Poids */}
        <div className="border rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <label className="text-sm font-semibold text-gray-900 w-full sm:w-auto sm:flex-1">
              Poids
            </label>
            <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-xs">
              <input
                type="number"
                step="0.1"
                value={constantesValues.poids.valeur}
                min={constantesValues.poids.min ?? undefined}
                max={constantesValues.poids.max ?? undefined}
                onChange={(e) => {
                  setConstantesValues(prev => ({
                    ...prev,
                    poids: { ...prev.poids, valeur: e.target.value }
                  }));
                }}
                onBlur={() => {
                  if (constantesValues.poids.constanteId) {
                    handleConstanteChange(
                      'poids',
                      constantesValues.poids.valeur,
                      'poids',
                      constantesValues.poids.constanteId,
                      constantesValues.poids.unite,
                      constantesValues.poids.constanteConsultationId === null
                    );
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                placeholder="Ex: 70.5"
                disabled={saving || isTerminated}
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {constantesValues.poids.unite}
              </span>
            </div>
          </div>
        </div>

        {/* Tension Artérielle */}
        <div className="border rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <label className="text-sm font-semibold text-gray-900 w-full sm:w-auto sm:flex-1 sm:min-w-0">
              Tension Artérielle
            </label>
            <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-xs min-w-0">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="number"
                  step="1"
                  value={constantesValues.tensionSystolique.valeur}
                  min={constantesValues.tensionSystolique.min ?? undefined}
                  max={constantesValues.tensionSystolique.max ?? undefined}
                  onChange={(e) => {
                    setConstantesValues(prev => ({
                      ...prev,
                      tensionSystolique: { ...prev.tensionSystolique, valeur: e.target.value }
                    }));
                  }}
                  onBlur={() => {
                    if (constantesValues.tensionSystolique.constanteId) {
                      handleConstanteChange(
                        'tensionSystolique',
                        constantesValues.tensionSystolique.valeur,
                        'tensionSystolique',
                        constantesValues.tensionSystolique.constanteId,
                        constantesValues.tensionSystolique.unite,
                        constantesValues.tensionSystolique.constanteConsultationId === null
                      );
                    }
                  }}
                  className="flex-1 min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  placeholder="Systolique"
                  disabled={saving || isTerminated}
                />
                <span className="text-gray-400 flex-shrink-0">/</span>
                <input
                  type="number"
                  step="1"
                  value={constantesValues.tensionDiastolique.valeur}
                  min={constantesValues.tensionDiastolique.min ?? undefined}
                  max={constantesValues.tensionDiastolique.max ?? undefined}
                  onChange={(e) => {
                    setConstantesValues(prev => ({
                      ...prev,
                      tensionDiastolique: { ...prev.tensionDiastolique, valeur: e.target.value }
                    }));
                  }}
                  onBlur={() => {
                    if (constantesValues.tensionDiastolique.constanteId) {
                      handleConstanteChange(
                        'tensionDiastolique',
                        constantesValues.tensionDiastolique.valeur,
                        'tensionDiastolique',
                        constantesValues.tensionDiastolique.constanteId,
                        constantesValues.tensionDiastolique.unite,
                        constantesValues.tensionDiastolique.constanteConsultationId === null
                      );
                    }
                  }}
                  className="flex-1 min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  placeholder="Diastolique"
                  disabled={saving || isTerminated}
                />
              </div>
              <span className="text-sm text-gray-500 whitespace-nowrap flex-shrink-0">
                {constantesValues.tensionSystolique.unite}
              </span>
            </div>
          </div>
        </div>

        {/* Liste des autres constantes ajoutées */}
        {autresConstantes.length > 0 && (
          <div className="mt-6">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3">Autres constantes</h3>
            <div className="space-y-3">
              {autresConstantes.map((constante, index) => (
                <AutreConstanteInput
                  key={constante.id || `temp_${constante.constante_id}_${index}`}
                  constante={constante}
                  saving={saving}
                  isTerminated={isTerminated}
                  onValueChange={handleConstanteChange}
                  onDelete={(c) => {
                    if (confirm('Êtes-vous sûr de vouloir supprimer cette constante ?')) {
                      if (!c.id) {
                        // Constante temporaire (pas encore en base)
                        setConstantes(prev => prev.filter(item =>
                          item.id !== null || item.constante_id !== c.constante_id
                        ));
                        setPendingConstanteChanges(prev => {
                          const newState = new Map(prev);
                          newState.delete(c.constante_id);
                          return newState;
                        });
                        showSuccess('Constante supprimée de la liste !');
                      } else {
                        // Constante existante, marquer pour suppression
                        setPendingDeleteConstanteChanges(prev => new Set(prev).add(c.id));
                        setConstantes(prev => prev.filter(item => item.id !== c.id));
                        showInfo('Constante marquée pour suppression lors de la prochaine sauvegarde.');
                      }
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal d'ajout de constante */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Ajouter une constante</h3>
              <button
                onClick={onCloseAddModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {constantesDisponibles.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Toutes les constantes disponibles ont déjà été ajoutées.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Sélectionnez une constante à ajouter :
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {constantesDisponibles.map(constante => (
                    <button
                      key={constante.id}
                      onClick={() => addConstanteToList(constante.id)}
                      className="w-full text-left px-4 py-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <span className="font-medium">{constante.nom}</span>
                      {constante.unite && (
                        <span className="text-gray-500 ml-2">({constante.unite})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={onCloseAddModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstantesTab;
