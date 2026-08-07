import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, X } from 'lucide-react';
import AntecedentsMedicaux from '../consultation/AntecedentsMedicaux';
import * as consultationService from '../../services/consultation/consultationService';
import { supabase } from '../../lib/supabase';

const PatientAntecedentsModal = ({ patient, onClose }) => {
  const [antecedents, setAntecedents] = useState([]);
  const [antecedentsRef, setAntecedentsRef] = useState([]);
  const [loading, setLoading] = useState(true);
  const antecedentsRefLoaded = useRef(false);

  useEffect(() => {
    if (patient?.id) {
      loadAntecedents();
    }
  }, [patient?.id]);

  const loadAntecedents = async () => {
    try {
      setLoading(true);
      const [antecedentsData, refData] = await Promise.all([
        consultationService.getAntecedents(patient.id),
        antecedentsRefLoaded.current ? Promise.resolve([]) : loadAntecedentsRef()
      ]);
      setAntecedents(antecedentsData || []);
    } catch (error) {
      console.error('Erreur lors du chargement des antécédents:', error);
      setAntecedents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAntecedentsRef = async () => {
    try {
      // `consultationService` n'exporte pas `supabase` — l'appel passait
      // par `consultationService.supabase` (undefined), échouait
      // silencieusement (catch ci-dessous) et laissait `antecedentsRef`
      // vide en permanence : la secrétaire ne pouvait sélectionner aucun
      // antécédent à ajouter. Utilise le client `supabase` importé
      // directement, comme partout ailleurs dans l'app.
      const { data, error } = await supabase
        .from('antecedents')
        .select('*')
        .eq('actif', true)
        .order('nom');

      if (error) throw error;
      setAntecedentsRef(data || []);
      antecedentsRefLoaded.current = true;
      return data || [];
    } catch (error) {
      console.error('Erreur lors du chargement des références d\'antécédents:', error);
      return [];
    }
  };

  const fetchAntecedents = async (patientId) => {
    const data = await consultationService.getAntecedents(patientId);
    setAntecedents(data || []);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Antécédents médicaux
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Patient : <span className="font-medium">{patient?.prenom} {patient?.nom}</span>
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AntecedentsMedicaux
              antecedents={antecedents}
              fetchAntecedents={fetchAntecedents}
              antecedentsRef={antecedentsRef}
              patient={patient}
              isTerminated={false}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientAntecedentsModal;
