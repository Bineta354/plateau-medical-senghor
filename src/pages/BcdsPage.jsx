import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  Brain,
  Lightbulb,
  AlertTriangle,
  Save,
  X,
  Eye,
  Tag,
  Stethoscope,
  Pill,
  ClipboardList,
  Activity,
  FileText,
  ChevronDown
} from 'lucide-react';
import Dropdown from '../components/common/Dropdown';

const categories = [
  'Cardiologie',
  'Pneumologie',
  'Gastro-entérologie',
  'Neurologie',
  'Dermatologie',
  'ORL',
  'Ophtalmologie',
  'Urgences',
  'Médecine Générale'
];

const CATEGORY_PILL = {
  'Cardiologie': 'bg-red-50 text-red-700',
  'Pneumologie': 'bg-blue-50 text-blue-700',
  'Gastro-entérologie': 'bg-emerald-50 text-emerald-700',
  'Neurologie': 'bg-violet-50 text-violet-700',
  'Dermatologie': 'bg-pink-50 text-pink-700',
  'ORL': 'bg-amber-100 text-amber-800',
  'Ophtalmologie': 'bg-indigo-50 text-indigo-700',
  'Urgences': 'bg-orange-50 text-orange-700',
  'Médecine Générale': 'bg-gray-100 text-gray-600'
};

const CATEGORY_ICON = {
  'Cardiologie': Activity,
  'Pneumologie': Stethoscope,
  'Gastro-entérologie': ClipboardList,
  'Neurologie': Brain,
  'Dermatologie': Tag,
  'ORL': Stethoscope,
  'Ophtalmologie': Eye,
  'Urgences': AlertTriangle,
  'Médecine Générale': FileText
};

const initialFormState = {
  titre: '', categorie: '', symptomes: '', diagnostic: '',
  traitement: '', recommandations: '', references: ''
};

const bcdsEntries = [
  {
    id: 1,
    titre: 'Douleur thoracique aiguë',
    categorie: 'Cardiologie',
    symptomes: 'Douleur thoracique sévère, oppressive, irradiation bras gauche, sueurs, dyspnée',
    diagnostic: 'Suspicion de syndrome coronarien aigu (SCA)',
    traitement: 'Aspirine 300mg, Clopidogrel 300mg, Morphine si douleur intense, Oxygène si SpO2<90%, Transport urgent SAMU',
    recommandations: 'ECG en urgence, Troponine, Surveillance continue, Coronarographie si STEMI',
    references: 'ESC Guidelines 2023 - Acute Coronary Syndromes',
    auteur: 'Dr. Martin',
    dateCreation: '2024-01-15'
  },
  {
    id: 2,
    titre: 'Dyspnée aiguë',
    categorie: 'Pneumologie',
    symptomes: 'Essoufflement soudain, toux, sibilants possibles, cyanose',
    diagnostic: 'Exacerbation asthme / BPCO / OAP / Embolie pulmonaire',
    traitement: 'Oxygène, Bronchodilatateurs, Corticoïdes si nécessaire',
    recommandations: 'Gaz du sang, Radio thorax, BNP si suspicion OAP, D-dimères si EP',
    references: 'GOLD Guidelines 2023',
    auteur: 'Dr. Dubois',
    dateCreation: '2024-01-20'
  },
  {
    id: 3,
    titre: 'Céphalées sévères brutales',
    categorie: 'Neurologie',
    symptomes: 'Céphalée en coup de tonnerre, début brutal, intensité maximale immédiate',
    diagnostic: 'Suspicion hémorragie méningée',
    traitement: 'Repos strict, Antalgiques, Scanner cérébral sans injection en urgence',
    recommandations: 'PL si scanner négatif, Consultation neurochirurgicale',
    references: 'AHA/ASA Guidelines',
    auteur: 'Dr. Bernard',
    dateCreation: '2024-02-01'
  }
];

const formatDate = (dateString) => new Date(dateString).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'long', year: 'numeric'
});

const BcdsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [bcdsData, setBcdsData] = useState(initialFormState);

  const filteredBCDS = bcdsEntries.filter(entry => {
    const matchesSearch = entry.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.symptomes.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.diagnostic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.categorie.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || entry.categorie === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBcdsData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Nouvelle BCDS:', bcdsData);
    setShowForm(false);
    setBcdsData(initialFormState);
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-none">
            <BookOpen className="text-violet-700" size={21} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Base de connaissances et décisions de soins</h1>
            <p className="text-sm text-gray-500 mt-0.5">Guide clinique et aide à la décision médicale</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors"
        >
          <Plus size={16} />
          Nouvelle BCDS
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <p className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-gray-400 mb-1.5">Total BCDS</p>
          <p className="text-2xl font-semibold text-gray-900">{bcdsEntries.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <p className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-gray-400 mb-1.5">Spécialités</p>
          <p className="text-2xl font-semibold text-gray-900">{categories.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <p className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-gray-400 mb-1.5">Validées</p>
          <p className="text-2xl font-semibold text-emerald-700">{bcdsEntries.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <p className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-gray-400 mb-1.5">Consultations</p>
          <p className="text-2xl font-semibold text-gray-900">156</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par titre, symptômes, diagnostic…"
                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Spécialité</label>
            <Dropdown
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={[
                { value: 'all', label: 'Toutes les spécialités' },
                ...categories.map(category => ({ value: category, label: category })),
              ]}
              size="md"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout BCDS */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">Nouvelle entrée BCDS</h3>
            <button
              onClick={() => setShowForm(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Titre *</label>
                <input
                  type="text"
                  name="titre"
                  value={bcdsData.titre}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  placeholder="Douleur thoracique aiguë"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Spécialité *</label>
                <select
                  name="categorie"
                  value={bcdsData.categorie}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all bg-white"
                >
                  <option value="">Sélectionner</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                <AlertTriangle size={13} className="text-orange-500" />
                Symptômes *
              </label>
              <textarea
                name="symptomes"
                value={bcdsData.symptomes}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                placeholder="Décrivez les symptômes principaux…"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                <Brain size={13} className="text-violet-500" />
                Diagnostic *
              </label>
              <textarea
                name="diagnostic"
                value={bcdsData.diagnostic}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                placeholder="Diagnostic suspecté ou confirmé…"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                <Pill size={13} className="text-emerald-500" />
                Traitement *
              </label>
              <textarea
                name="traitement"
                value={bcdsData.traitement}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                placeholder="Traitement recommandé…"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                <Lightbulb size={13} className="text-amber-500" />
                Recommandations
              </label>
              <textarea
                name="recommandations"
                value={bcdsData.recommandations}
                onChange={handleInputChange}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
                placeholder="Recommandations particulières…"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                <BookOpen size={13} className="text-blue-500" />
                Références
              </label>
              <input
                type="text"
                name="references"
                value={bcdsData.references}
                onChange={handleInputChange}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="Guidelines, publications…"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-colors"
              >
                <Save size={14} />
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des BCDS */}
      <div className="flex flex-col gap-3.5">
        {filteredBCDS.length === 0 ? (
          <div className="text-center py-16 px-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <Search className="mx-auto mb-2.5 text-gray-300" size={30} strokeWidth={1.5} />
            <p className="text-sm text-gray-400">
              {searchTerm || selectedCategory !== 'all' ? 'Aucune entrée ne correspond à ces filtres' : 'Aucune BCDS trouvée'}
            </p>
          </div>
        ) : (
          filteredBCDS.map((bcds) => {
            const Icon = CATEGORY_ICON[bcds.categorie] || FileText;
            const expanded = expandedId === bcds.id;
            return (
              <div key={bcds.id} className="group bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div
                  className="flex items-start justify-between gap-4 flex-wrap px-5 py-4 cursor-pointer"
                  onClick={() => toggleExpand(bcds.id)}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-[11px] bg-violet-100 text-violet-700 flex items-center justify-center flex-none">
                      <Icon size={17} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-gray-900">{bcds.titre}</h3>
                      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${CATEGORY_PILL[bcds.categorie] || 'bg-gray-100 text-gray-600'}`}>
                          {bcds.categorie}
                        </span>
                        <span className="text-[11.5px] text-gray-400">{bcds.auteur} · {formatDate(bcds.dateCreation)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-none">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="p-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors"
                        title="Modifier"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); }}
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 mt-1 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5 pt-4 border-t border-gray-100 flex flex-col gap-3.5">
                    <div>
                      <p className="text-[11px] font-semibold tracking-wider uppercase text-orange-700 mb-1">Symptômes</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{bcds.symptomes}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wider uppercase text-violet-700 mb-1">Diagnostic</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{bcds.diagnostic}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-wider uppercase text-emerald-700 mb-1">Traitement</p>
                      <p className="text-[13px] text-gray-700 leading-relaxed">{bcds.traitement}</p>
                    </div>
                    {bcds.recommandations && (
                      <div>
                        <p className="text-[11px] font-semibold tracking-wider uppercase text-amber-700 mb-1">Recommandations</p>
                        <p className="text-[13px] text-gray-700 leading-relaxed">{bcds.recommandations}</p>
                      </div>
                    )}
                    {bcds.references && (
                      <p className="text-xs text-gray-400 italic">Réf. {bcds.references}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BcdsPage;
