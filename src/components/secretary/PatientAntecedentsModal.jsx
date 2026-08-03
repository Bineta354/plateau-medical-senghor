import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as consultationService from '../../services/consultation/consultationService';
import AntecedentsMedicaux from '../consultation/AntecedentsMedicaux';

// Permet à la secrétaire de saisir les antécédents médicaux d'un patient dès l'accueil
// (ex: carnet de santé apporté par le patient), pour que le médecin les retrouve déjà
// renseignés à l'ouverture de la consultation. Réutilise le même composant que celui
// utilisé côté médecin (AntecedentsMedicaux/AntecedentModal) : une seule source de vérité.
const PatientAntecedentsModal = ({ patient, onClose }) => {
  const [antecedents, setAntecedents] = useState([]);
  const [antecedentsRef, setAntecedentsRef] = useState([]);
  const [loading, setLoading] = useState(true);
  const antecedentsRefLoaded = useRef(false);

  const fetchAntecedents = useCallback(async (patientId) => {
    const data = await consultationService.getAntecedents(patientId);
    setAntecedents(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const tasks = [fetchAntecedents(patient.id)];
        if (!antecedentsRefLoaded.current) {
          tasks.push(
            supabase
              .from('antecedents')
              .select('*')
              .eq('actif', true)
              .order('nom')
              .then(({ data, error }) => {
                if (error) throw error;
                antecedentsRefLoaded.current = true;
                setAntecedentsRef(data || []);
              })
          );
        }
        await Promise.all(tasks);
      } finally {
        setLoading(false);
      }
    })();
  }, [patient.id, fetchAntecedents]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center">
      <div className="relative top-10 mx-auto w-full max-w-2xl bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Antécédents – {patient.prenom} {patient.nom}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AntecedentsMedicaux
            antecedents={antecedents}
            fetchAntecedents={fetchAntecedents}
            antecedentsRef={antecedentsRef}
            patient={patient}
          />
        )}
      </div>
    </div>
  );
};

export default PatientAntecedentsModal;
