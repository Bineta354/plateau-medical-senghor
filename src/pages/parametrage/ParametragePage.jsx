import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Award,
  Activity,
  Shield,
  Settings,
  Stethoscope,
  ChevronRight,
  CreditCard,
  Pill
} from 'lucide-react';

const ParametragePage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Cabinet & Équipe',
      description: 'Gérez la structure de votre cabinet et vos collaborateurs',
      items: [
        { 
          name: 'Utilisateurs', 
          description: 'Comptes, rôles et accès',
          path: '/administration/gestion-utilisateurs', 
          icon: Users,
          color: 'bg-blue-500' 
        },
        { 
          name: 'Médecins', 
          description: 'Gestion des praticiens',
          path: '/administration/gestion-medecins', 
          icon: Stethoscope,
          color: 'bg-indigo-500' 
        },
        {
          name: 'Spécialités',
          description: 'Spécialités médicales du cabinet',
          path: '/parametrage/specialites',
          icon: Award,
          color: 'bg-purple-500'
        },
        {
          name: 'Médicaments',
          description: 'Référentiel des médicaments (ordonnances)',
          path: '/parametrage/medicaments',
          icon: Pill,
          color: 'bg-rose-500'
        },
      ]
    },
    {
      title: 'Actes & Tarifs',
      description: 'Configurez votre catalogue de soins et la facturation',
      items: [
        { 
          name: 'Catalogue des Actes', 
          description: 'Types d\'actes, codes CCAM et tarifs',
          path: '/parametrage/types-actes', 
          icon: Activity,
          color: 'bg-emerald-500' 
        },
        { 
          name: 'Assurances', 
          description: 'Organismes et couvertures',
          path: '/parametrage/assurances', 
          icon: Shield,
          color: 'bg-teal-500' 
        },
        {
          name: 'Tiers Payant',
          description: 'Gestion du tiers payant',
          path: '/parametrage/tiers-payant',
          icon: CreditCard,
          color: 'bg-cyan-500'
        }
      ]
    },
      ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-lg">
                <Settings className="w-8 h-8 text-white" />
            </div>
            Paramétrage
          </h1>
          <p className="text-lg text-gray-500 mt-2 max-w-2xl">
            Centre de configuration de votre application. Gérez les utilisateurs, les actes médicaux et les préférences globales.
          </p>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-12"
      >
        {sections.map((section, idx) => (
          <section key={idx} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-800">{section.title}</h2>
                <span className="h-px flex-1 bg-gray-200 ml-4"></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.items.map((item) => (
                <motion.button
                  key={item.name}
                  variants={itemVariants}
                  onClick={() => navigate(item.path)}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <item.icon className="w-24 h-24" />
                  </div>

                  <div className="relative z-10 flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${item.color} text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                    Configurer
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        ))}
      </motion.div>
    </div>
  );
};

export default ParametragePage;

