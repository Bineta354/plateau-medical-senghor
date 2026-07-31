import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import MouthCanvas from '../dental-chart/MouthCanvas';
import ToothLegend from '../dental-chart/ToothLegend';
import ToothDetailsModal from '../dental-chart/ToothDetailsModal';
import { useToothSelector } from '../dental-chart/useToothSelector';
import { updateDentalState } from '../../services/consultation/consultationService';
import { useAlert } from '../../contexts/AlertContext';
import { useToothStates } from '../../hooks/useToothStates';
import { supabase } from '../../lib/supabase';

const ConsultationDentalChart = ({ consultationId, initialDentalState, fetchActes, patientId, isTerminated = false, onSaved }) => {
    const { showError, showSuccess } = useAlert();
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedToothId, setSelectedToothId] = useState(null);
    const teethRef = useRef(null);
    const hasChangesRef = useRef(false);
    const saveTimeoutRef = useRef(null);

    // Charger les états dentaires dynamiques
    const { formattedStates, refresh: refreshStates, createState } = useToothStates();

    // Initialiser le sélecteur avec l'état sauvegardé ou vide
    const { teeth, setToothState, handleToothClick: originalHandleToothClick, updateToothData, mergeTeethData } = useToothSelector(
        initialDentalState || {},
        (newState) => {
             hasChangesRef.current = true;
             // Trigger auto-save with debounce
             triggerAutoSave();
        }
    );

    // Charger l'historique des actes dentaires depuis la base de données
    useEffect(() => {
        const loadDentalHistory = async () => {
            if (!patientId) return;

            try {
                // FIX: consultations!inner force un vrai INNER JOIN, sinon le filtre
                // .eq('consultations.patient_id', ...) sur une relation LEFT JOIN
                // n'est pas fiable et peut retourner des résultats incohérents.
                const { data: dentalActs, error } = await supabase
                    .from('actes_consultation')
                    .select(`
                        dent_id,
                        dent_nom,
                        tarif_unitaire,
                        notes,
                        created_at,
                        consultations!inner (
                            id,
                            date_consultation,
                            statut
                        ),
                        types_actes (
                            nom
                        )
                    `)
                    .not('dent_id', 'is', null)
                    .eq('consultations.patient_id', patientId)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('[DentalChart] Erreur chargement historique dentaire:', error);
                    return;
                }

                if (dentalActs && dentalActs.length > 0) {
                    // Construire l'historique par dent
                    const historyByTooth = {};
                    dentalActs.forEach(act => {
                        const toothId = act.dent_id;
                        if (!toothId) return;

                        if (!historyByTooth[toothId]) {
                            historyByTooth[toothId] = [];
                        }

                        historyByTooth[toothId].push({
                            date: act.created_at,
                            type: 'PROCEDURE',
                            code: act.types_actes?.nom || 'ACTE',
                            name: act.types_actes?.nom || 'Acte dentaire',
                            note: act.notes,
                            consultationId: act.consultations?.id,
                            consultationDate: act.consultations?.date_consultation,
                            price: act.tarif_unitaire
                        });
                    });

                    // FIX: on ne dépend plus de "teeth" (capturé au moment de la création
                    // de l'effet, donc potentiellement obsolète / stale). On construit
                    // seulement les mises à jour ; c'est mergeTeethData (via setState
                    // fonctionnel) qui se charge de fusionner avec la version la plus
                    // récente de l'état des dents.
                    const updates = {};
                    Object.keys(historyByTooth).forEach(toothId => {
                        const mergedHistory = historyByTooth[toothId]
                            .slice()
                            .sort((a, b) => new Date(b.date) - new Date(a.date));

                        updates[toothId] = {
                            history: mergedHistory
                        };

                        // Mettre à jour l'état visuel si des actes existent
                        if (mergedHistory.length > 0) {
                            // Vérifier si c'est une extraction
                            const hasExtraction = mergedHistory.some(h =>
                                h.name.toLowerCase().includes('extraction')
                            );
                            if (hasExtraction) {
                                updates[toothId].state = 'EXTRACTED';
                            }
                        }
                    });

                    mergeTeethData(updates);
                    console.log('[DentalChart] Historique dentaire chargé pour', Object.keys(historyByTooth).length, 'dents');
                }
            } catch (err) {
                console.error('[DentalChart] Erreur lors du chargement de l\'historique:', err);
            }
        };

        loadDentalHistory();
    }, [patientId, consultationId]);

    // Garder la ref à jour avec le dernier état
    useEffect(() => {
        teethRef.current = teeth;
    }, [teeth]);

    // Auto-save avec debounce
    const triggerAutoSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            await performAutoSave();
        }, 800); // 800ms debounce
    }, [consultationId]);

    const performAutoSave = async () => {
        if (!consultationId || !teethRef.current) return;

        try {
            setSaveStatus('saving');
            setIsSaving(true);
            const updated = await updateDentalState(consultationId, teethRef.current);
            hasChangesRef.current = false;
            setSaveStatus('saved');
            onSaved?.(updated);
            
            // Reset to idle after 2 seconds
            setTimeout(() => {
                setSaveStatus('idle');
            }, 2000);
        } catch (error) {
            console.error('Erreur sauvegarde automatique:', error);
            setSaveStatus('error');
            showError('Erreur lors de la sauvegarde automatique. Réessayez manuellement.');
        } finally {
            setIsSaving(false);
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Sauvegarde automatique au démontage (quand on quitte l'onglet)
    useEffect(() => {
        return () => {
            if (hasChangesRef.current && teethRef.current && consultationId) {
                updateDentalState(consultationId, teethRef.current).catch((err) =>
                    console.error('Erreur sauvegarde automatique schéma dentaire:', err)
                );
            }
        };
    }, [consultationId]);

    const handleToothClick = (toothId) => {
        if (isTerminated) return;
        setSelectedToothId(toothId);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedToothId(null);
    };

    const handleUpdateTooth = (toothId, newData) => {
        updateToothData(toothId, newData);
        // Trigger auto-save after update
        triggerAutoSave();
    };

    const handleSave = async () => {
        try {
            setSaveStatus('saving');
            setIsSaving(true);
            const updated = await updateDentalState(consultationId, teeth);
            hasChangesRef.current = false;
            setSaveStatus('saved');
            showSuccess('État dentaire sauvegardé avec succès');
            onSaved?.(updated);
            
            setTimeout(() => {
                setSaveStatus('idle');
            }, 2000);
        } catch (error) {
            console.error(error);
            setSaveStatus('error');
            showError('Erreur lors de la sauvegarde de l\'état dentaire');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRetrySave = () => {
        performAutoSave();
    };

    const getStatusIndicator = () => {
        switch (saveStatus) {
            case 'saving':
                return (
                    <div className="flex items-center gap-2 text-blue-600">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Enregistrement...</span>
                    </div>
                );
            case 'saved':
                return (
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Enregistré ✓</span>
                    </div>
                );
            case 'error':
                return (
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">Erreur - </span>
                        <button
                            onClick={handleRetrySave}
                            className="text-sm underline hover:text-red-700"
                        >
                            Réessayer
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">Schéma Dentaire</h3>
                        <p className="text-sm text-gray-500">Cliquez sur une dent pour modifier son état.</p>
                    </div>
                    {getStatusIndicator()}
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    title="Sauvegarde manuelle (optionnel)"
                >
                    {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full h-[600px] flex justify-center items-center relative">
                    <MouthCanvas
                        teeth={teeth}
                        onToothClick={handleToothClick}
                        toothStates={formattedStates}
                    />
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="font-medium mb-3 text-gray-900">Légende</h4>
                    <ToothLegend toothStates={formattedStates} />
                </div>
            </div>

            <ToothDetailsModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                toothId={selectedToothId}
                toothData={selectedToothId ? teeth[selectedToothId] : null}
                onUpdateTooth={handleUpdateTooth}
                toothStates={formattedStates}
                onStateCreated={refreshStates}
                onCreateState={createState}
                consultationId={consultationId}
                fetchActes={fetchActes}
            />
        </div>
    );
};

export default ConsultationDentalChart;