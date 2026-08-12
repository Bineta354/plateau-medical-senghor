import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Activity,
  Shield,
  Settings,
  Pill,
  Smile,
  Building2,
  ListChecks
} from 'lucide-react';

const ParametragePage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Cabinet & Équipe',
      items: [
        {
          name: 'Spécialités',
          description: 'Spécialités médicales du cabinet',
          path: '/parametrage/specialites',
          icon: Award,
          iconColor: '#6d28d9',
          iconBg: 'rgba(139,92,246,.12)'
        },
        {
          name: 'Médicaments',
          description: 'Référentiel des médicaments (ordonnances)',
          path: '/parametrage/medicaments',
          icon: Pill,
          iconColor: '#be123c',
          iconBg: 'rgba(251,113,133,.16)'
        },
        {
          name: 'Paramètres du cabinet',
          description: 'Coordonnées, logo, horaires et rétrocession',
          path: '/administration/personnalisation/general',
          icon: Building2,
          iconColor: '#1d4ed8',
          iconBg: 'rgba(96,165,250,.16)'
        },
      ]
    },
    {
      title: 'Actes & Tarifs',
      items: [
        {
          name: 'Catalogue des actes',
          description: "Types d'actes, codes CCAM et tarifs",
          path: '/parametrage/types-actes',
          icon: Activity,
          iconColor: '#047857',
          iconBg: 'rgba(52,211,153,.14)'
        },
        {
          name: 'États dentaires',
          description: "États de l'odontogramme utilisés en consultation",
          path: '/parametrage/etats-dentaires',
          icon: Smile,
          iconColor: '#be185d',
          iconBg: 'rgba(244,114,182,.16)'
        },
        {
          name: 'Assurances',
          description: 'Organismes et couvertures',
          path: '/parametrage/assurances',
          icon: Shield,
          iconColor: '#0e7490',
          iconBg: 'rgba(45,212,191,.16)'
        },
        {
          name: 'Listes de référence',
          description: 'Antécédents, signes cliniques, diagnostics, appareils, médicaments, constantes, documents',
          path: '/parametrage/listes-reference',
          icon: ListChecks,
          iconColor: '#0369a1',
          iconBg: 'rgba(56,189,248,.16)'
        }
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
      <div className="max-w-[1180px] mx-auto">

        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center flex-none">
            <Settings className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-[26px] font-semibold text-gray-900 tracking-tight m-0">
            Paramétrage
          </h1>
        </div>
        <p className="text-sm text-gray-500 max-w-xl leading-relaxed mb-7">
          Centre de configuration de votre application. Gérez l'organisation du cabinet, les actes médicaux et les préférences globales.
        </p>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[15px] font-semibold text-gray-900 m-0">{section.title}</h2>
                <span className="flex-1 h-px bg-gray-200"></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className="text-left cursor-pointer bg-white border border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 flex flex-col gap-3.5"
                  >
                    <div
                      className="w-[42px] h-[42px] rounded-xl flex items-center justify-center"
                      style={{ background: item.iconBg }}
                    >
                      <item.icon className="w-[19px] h-[19px]" style={{ color: item.iconColor }} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-[14.5px] font-semibold text-gray-900 mb-1">
                        {item.name}
                      </h3>
                      <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParametragePage;
