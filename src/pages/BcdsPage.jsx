import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2,
  BookOpen,
  Brain,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Save,
  X,
  User,
  Calendar,
  RefreshCw,
  Eye,
  Tag,
  Stethoscope,
  Pill,
  ClipboardList,
  Activity
} from 'lucide-react';
import KpiCard from '../components/common/KpiCard';

const BcdsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedBCDS, setSelectedBCDS] = useState(null);
  const [bcdsData, setBcdsData] = useState({
    titre: '',
    categorie: '',
    symptomes: '',
    diagnostic: '',
    traitement: '',
    recommandations: '',
    references: ''
  });

  // Catégories de BCDS
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

  // Données mockées pour démonstration
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

  // Fonction pour obtenir la couleur selon la catégorie
  const getCategoryColor = (category) => {
    const colors = {
      'Cardiologie': 'bg-red-100 text-red-700 border-red-300',
      'Pneumologie': 'bg-blue-100 text-blue-700 border-blue-300',
      'Gastro-entérologie': 'bg-green-100 text-green-700 border-green-300',
      'Neurologie': 'bg-purple-100 text-purple-700 border-purple-300',
      'Dermatologie': 'bg-pink-100 text-pink-700 border-pink-300',
      'ORL': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Ophtalmologie': 'bg-indigo-100 text-indigo-700 border-indigo-300',
      'Urgences': 'bg-orange-100 text-orange-700 border-orange-300',
      'Médecine Générale': 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return colors[category] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  // Fonction pour obtenir l'icône selon la catégorie
  const getCategoryIcon = (category) => {
    const icons = {
      'Cardiologie': <Activity className="w-5 h-5" />,
      'Pneumologie': <Stethoscope className="w-5 h-5" />,
      'Gastro-entérologie': <ClipboardList className="w-5 h-5" />,
      'Neurologie': <Brain className="w-5 h-5" />,
      'Dermatologie': <Tag className="w-5 h-5" />,
      'ORL': <Stethoscope className="w-5 h-5" />,
      'Ophtalmologie': <Eye className="w-5 h-5" />,
      'Urgences': <AlertTriangle className="w-5 h-5" />,
      'Médecine Générale': <FileText className="w-5 h-5" />
    };
    return icons[category] || <FileText className="w-5 h-5" />;
  };

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
    setBcdsData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Nouvelle BCDS:', bcdsData);
    setShowForm(false);
    setBcdsData({
      titre: '', categorie: '', symptomes: '', diagnostic: '',
      traitement: '', recommandations: '', references: ''
    });
  };

  const handleBCDSSelect = (bcds) => {
    setSelectedBCDS(bcds);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BookOpen className="w-8 h-8 mr-3 text-medical-primary" />
            Base de Connaissances et Décisions de Soins
          </h1>
          <p className="text-gray-600 mt-2">Guide clinique et aide à la décision médicale</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center px-6 py-3 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nouvelle BCDS
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard icon={FileText} tone="blue" label="Total BCDS" value={bcdsEntries.length} />

        <KpiCard icon={Brain} tone="purple" label="Spécialités" value={categories.length} />

        <KpiCard icon={CheckCircle} tone="green" label="Validées" value={bcdsEntries.length} />

        <KpiCard icon={Lightbulb} tone="yellow" label="Consultations" value={156} />
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par titre, symptômes, diagnostic ou spécialité..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Spécialité</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent appearance-none bg-white cursor-pointer"
              >
                <option value="all">Toutes les spécialités</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout BCDS */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <Plus className="w-6 h-6 mr-2 text-medical-primary" />
              Nouvelle entrée BCDS
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titre *</label>
                <input
                  type="text"
                  name="titre"
                  value={bcdsData.titre}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                  placeholder="Douleur thoracique aiguë"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Spécialité *</label>
                <select
                  name="categorie"
                  value={bcdsData.categorie}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                >
                  <option value="">Sélectionner</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                Symptômes *
              </label>
              <textarea
                name="symptomes"
                value={bcdsData.symptomes}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Décrivez les symptômes principaux..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Brain className="w-4 h-4 mr-2 text-indigo-500" />
                Diagnostic *
              </label>
              <textarea
                name="diagnostic"
                value={bcdsData.diagnostic}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Diagnostic suspecté ou confirmé..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Pill className="w-4 h-4 mr-2 text-green-500" />
                Traitement *
              </label>
              <textarea
                name="traitement"
                value={bcdsData.traitement}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Traitement recommandé..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Lightbulb className="w-4 h-4 mr-2 text-yellow-500" />
                Recommandations
              </label>
              <textarea
                name="recommandations"
                value={bcdsData.recommandations}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Recommandations particulières..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <BookOpen className="w-4 h-4 mr-2 text-blue-500" />
                Références
              </label>
              <input
                type="text"
                name="references"
                value={bcdsData.references}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
                placeholder="Guidelines, publications..."
              />
            </div>
            
            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center px-6 py-2 bg-medical-primary text-white rounded-lg hover:bg-medical-primary-dark transition-colors shadow-md hover:shadow-lg"
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des BCDS */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <BookOpen className="w-6 h-6 mr-2 text-medical-primary" />
            Base de connaissances
          </h2>
          <p className="text-sm text-gray-600 mt-1">{filteredBCDS.length} entrée(s) trouvée(s)</p>
        </div>
        
        {filteredBCDS.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'Aucune BCDS ne correspond à votre recherche' : 'Aucune BCDS trouvée'}
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredBCDS.map((bcds) => (
                <div 
                  key={bcds.id} 
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    selectedBCDS?.id === bcds.id
                      ? 'border-medical-primary bg-medical-primary bg-opacity-5 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-medical-primary hover:shadow-md'
                  }`}
                  onClick={() => handleBCDSSelect(bcds)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 rounded-lg ${getCategoryColor(bcds.categorie)}`}>
                          {getCategoryIcon(bcds.categorie)}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">{bcds.titre}</h3>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${getCategoryColor(bcds.categorie)}`}>
                        {bcds.categorie}
                      </span>
                    </div>
                    {selectedBCDS?.id === bcds.id && (
                      <CheckCircle className="w-6 h-6 text-medical-primary flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Symptômes</p>
                      <p className="text-sm text-gray-700 line-clamp-2">{bcds.symptomes}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Diagnostic</p>
                      <p className="text-sm text-gray-700 line-clamp-1">{bcds.diagnostic}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {bcds.auteur}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(bcds.dateCreation)}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBCDSSelect(bcds);
                        }}
                        className="p-2 text-medical-primary hover:bg-medical-primary hover:bg-opacity-10 rounded-lg transition-colors"
                        title="Voir les détails"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Détails de la BCDS sélectionnée - Modal */}
      {selectedBCDS && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl ${getCategoryColor(selectedBCDS.categorie)}`}>
                    {getCategoryIcon(selectedBCDS.categorie)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedBCDS.titre}</h3>
                    <span className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full border mt-2 ${getCategoryColor(selectedBCDS.categorie)}`}>
                      {selectedBCDS.categorie}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBCDS(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
                <h4 className="text-sm font-semibold text-orange-900 mb-2 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Symptômes
                </h4>
                <p className="text-sm text-orange-800">{selectedBCDS.symptomes}</p>
              </div>
              
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
                <h4 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center">
                  <Brain className="w-5 h-5 mr-2" />
                  Diagnostic
                </h4>
                <p className="text-sm text-indigo-800">{selectedBCDS.diagnostic}</p>
              </div>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <h4 className="text-sm font-semibold text-green-900 mb-2 flex items-center">
                  <Pill className="w-5 h-5 mr-2" />
                  Traitement
                </h4>
                <p className="text-sm text-green-800">{selectedBCDS.traitement}</p>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                <h4 className="text-sm font-semibold text-yellow-900 mb-2 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2" />
                  Recommandations
                </h4>
                <p className="text-sm text-yellow-800">{selectedBCDS.recommandations}</p>
              </div>
              
              {selectedBCDS.references && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <BookOpen className="w-5 h-5 mr-2" />
                    Références
                  </h4>
                  <p className="text-sm text-blue-800">{selectedBCDS.references}</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    {selectedBCDS.auteur}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(selectedBCDS.dateCreation)}
                  </span>
                </div>
                <div className="flex space-x-3">
                  <button className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </button>
                  <button className="flex items-center px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BcdsPage;
