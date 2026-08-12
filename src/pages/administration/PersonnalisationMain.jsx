import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, FileCheck, Settings2 } from 'lucide-react';

const PersonnalisationMain = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'apparence',
      title: 'Apparence & Marque',
      description: "Définissez votre identité visuelle : logo, couleurs, typographie et thèmes de l'interface.",
      icon: Palette,
      path: '/administration/personnalisation/apparence',
      iconColor: '#6d28d9',
      iconBg: 'rgba(139,92,246,.12)'
    },
    {
      id: 'documents',
      title: 'Documents & Impressions',
      description: 'Personnalisez vos ordonnances, certificats et autres documents générés.',
      icon: FileCheck,
      path: '/administration/personnalisation/documents',
      iconColor: '#047857',
      iconBg: 'rgba(52,211,153,.14)'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
      <div className="max-w-[1180px] mx-auto">

        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center flex-none">
            <Settings2 className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-[26px] font-semibold text-gray-900 tracking-tight m-0">
            Personnalisation
          </h1>
        </div>
        <p className="text-sm text-gray-500 max-w-xl leading-relaxed mb-7">
          Configurez l'identité visuelle et les documents générés par votre cabinet. Les changements sont appliqués en temps réel.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => navigate(section.path)}
              className="text-left cursor-pointer bg-white border border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 flex flex-col gap-3.5"
            >
              <div
                className="w-[42px] h-[42px] rounded-xl flex items-center justify-center"
                style={{ background: section.iconBg }}
              >
                <section.icon className="w-[19px] h-[19px]" style={{ color: section.iconColor }} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[14.5px] font-semibold text-gray-900 mb-1">
                  {section.title}
                </h3>
                <p className="text-[12.5px] text-gray-500 leading-relaxed">
                  {section.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PersonnalisationMain;
