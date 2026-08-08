import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Heart, Calendar, FileText, RefreshCw } from 'lucide-react';
import KpiCard from '../../components/common/KpiCard';

/**
 * Page de test isolée pour le composant KpiCard.
 *
 * KpiCard est un composant "bête" : il n'a aucune idée de la couleur, de la
 * donnée affichée, de l'icône ou du message de survol — c'est CETTE page qui
 * décide de tout et le passe en props (className, iconClassName, icon,
 * hoverMessage...). Reprend les 4 indicateurs de src/pages/Patients.jsx pour
 * comparer visuellement l'ancien code (cartes en dur) et le composant
 * factorisé, plus une variante cliquable (redirection) et une en chargement.
 */
const TestKpiCard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Test KpiCard</h1>
              <p className="text-sm text-gray-600">
                Composant présentationnel — couleur, icône et message de survol sont
                décidés ici, pas dans le composant.
              </p>
            </div>
            <button onClick={simulateLoading} className="btn btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Simuler un chargement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            1. Reproduction des 4 KPI de /patients
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard
              icon={Users}
              tone="blue"
              label="Total Patients"
              value={128}
              loading={loading}
              hoverMessage="Nombre total de patients enregistrés"
            />
            <KpiCard
              icon={Heart}
              tone="green"
              label="Patients Actifs"
              value={104}
              loading={loading}
              hoverMessage="Patients dont le dossier est actif"
            />
            <KpiCard
              icon={Calendar}
              tone="yellow"
              label="Nouveaux ce mois"
              value={12}
              loading={loading}
              hoverMessage="Patients créés depuis le 1er du mois"
            />
            <KpiCard
              icon={FileText}
              tone="purple"
              label="Consultations"
              value={57}
              loading={loading}
              hoverMessage="Nombre de consultations liées à ces patients"
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            2. Variante cliquable (redirection)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            La page passe <code>onClick</code>, <code>icon</code> et <code>hoverMessage</code> :
            le composant ne sait pas que ça mène vers /patients, il exécute juste la fonction reçue.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard
              icon={Users}
              iconClassName="text-red-600"
              className="card card-danger"
              label="Voir tous les patients"
              value="→"
              hoverMessage="Aller à la page Patients"
              onClick={() => navigate('/patients')}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            3. Carte avec sous-texte (hint)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard
              icon={FileText}
              iconClassName="text-green-600"
              className="card card-success"
              label="Taux de recouvrement"
              value="82%"
              hint="Sur les 30 derniers jours"
              hoverMessage="Montant encaissé / montant facturé"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default TestKpiCard;
