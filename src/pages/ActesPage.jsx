import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Coins,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { unifiedNotificationService } from '../services/unifiedNotificationService';
import { useTypesActes } from '../hooks/useTypesActes';
import { formatMontant } from '../utils/currency';
import Dropdown from '../components/common/Dropdown';

const ActesPage = () => {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [actes, setActes] = useState([]);
  const [specialiteInfo, setSpecialiteInfo] = useState(null);

  // Utiliser le hook useTypesActes pour récupérer la liste des actes
  const { typesActes, loading: loadingActes, refetch: refetchActes } = useTypesActes();

  // On garde un état local pour les actes formatés pour l'affichage
  useEffect(() => {
    if (typesActes) {
        const formatted = typesActes.map(acte => {
            // Extraire le code de la description si présent (format: "CODE - description")
            const codeMatch = acte.description?.match(/^([A-Z0-9]+)\s*-/);
            return {
              ...acte,
              code: codeMatch ? codeMatch[1] : 'N/A',
              libelle: acte.nom,
              categorie: 'Acte médical',
              tarif_base: acte.tarifs_actes?.[0]?.tarif_base || acte.tarif_defaut || 0
            };
        });
        setActes(formatted);
    }
  }, [typesActes]);

  // Récupérer les informations sur la spécialité du médecin connecté
  useEffect(() => {
    const fetchSpecialiteInfo = async () => {
        if (userProfile?.specialite_id) {
            try {
                const { data, error } = await supabase
                  .from('specialites')
                  .select('id, nom, description')
                  .eq('id', userProfile.specialite_id)
                  .single();
                
                if (error) throw error;
                if (data) setSpecialiteInfo(data);
            } catch (error) {
                console.error('Erreur lors du chargement de la spécialité:', error);
            }
        }
    };
    fetchSpecialiteInfo();
  }, [userProfile]);
  
  // Utiliser le loading du hook pour l'état de chargement global de la page
  useEffect(() => {
      setIsLoading(loadingActes);
  }, [loadingActes]);

  const fetchActes = async () => {
      await refetchActes();
  };

  const categories = [
    'Consultation',
    'Examen clinique',
    'Acte technique',
    'Soins',
    'Vaccination',
    'Certificat'
  ];

  const filteredActes = actes.filter(acte => {
    const matchesSearch = acte.libelle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         acte.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (acte.description && acte.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || acte.categorie === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catalogue des Actes</h1>
          <p className="text-gray-600">
            {specialiteInfo 
              ? `Actes de la spécialité : ${specialiteInfo.nom}`
              : 'Liste des actes médicaux disponibles'}
          </p>
        </div>
        <button
          onClick={fetchActes}
          className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher un acte</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par code, libellé ou description..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
            <Dropdown
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={[
                { value: 'all', label: 'Toutes les catégories' },
                ...categories.map(category => ({ value: category, label: category })),
              ]}
              size="md"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="w-8 h-8 text-medical-primary" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total actes</p>
              <p className="text-2xl font-semibold text-gray-900">{actes.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Coins className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tarif moyen</p>
              <p className="text-2xl font-semibold text-gray-900">
                {actes.length > 0 ? formatMontant(actes.reduce((sum, acte) => sum + acte.tarif_base, 0) / actes.length) : formatMontant(0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Filter className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Résultats filtrés</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredActes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des actes */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Liste des actes</h2>
          <p className="text-sm text-gray-600">{filteredActes.length} acte(s) trouvé(s)</p>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-medical-primary animate-spin" />
          </div>
        ) : filteredActes.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Aucun acte ne correspond à votre recherche' : 'Aucun acte trouvé pour cette spécialité'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Libellé
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarif
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredActes.map((acte) => (
                  <tr key={acte.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {acte.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{acte.libelle}</div>
                        {acte.description && (
                          <div className="text-sm text-gray-500">{acte.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {acte.categorie}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatMontant(acte.tarif_base)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActesPage;
