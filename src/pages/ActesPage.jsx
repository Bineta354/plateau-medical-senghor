import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarCheck,
  Search,
  Filter,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTypesActes } from '../hooks/useTypesActes';
import { formatMontant } from '../utils/currency';
import Dropdown from '../components/common/Dropdown';
import Pagination from '../components/common/Pagination';

const ITEMS_PER_PAGE = 10;

const ActesPage = () => {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [actes, setActes] = useState([]);
  const [specialiteInfo, setSpecialiteInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const tarifMoyen = actes.length > 0
    ? actes.reduce((sum, acte) => sum + acte.tarif_base, 0) / actes.length
    : 0;

  const totalPages = Math.ceil(filteredActes.length / ITEMS_PER_PAGE);
  const paginatedActes = filteredActes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-none">
            <CalendarCheck className="text-violet-700" size={21} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Catalogue des actes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {specialiteInfo
                ? `Actes de la spécialité : ${specialiteInfo.nom}`
                : 'Liste des actes médicaux disponibles'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchActes}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Search & filters */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:p-6 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Rechercher un acte</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par code, libellé ou description…"
                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Catégorie</label>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center flex-none">
            <Calendar className="text-violet-700" size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total actes</p>
            <p className="text-[22px] font-semibold text-gray-900 leading-tight">{actes.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-none">
            <Clock className="text-emerald-700" size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Tarif moyen</p>
            <p className="text-[22px] font-semibold text-gray-900 leading-tight">{formatMontant(tarifMoyen)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center flex-none">
            <Filter className="text-orange-700" size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Résultats filtrés</p>
            <p className="text-[22px] font-semibold text-gray-900 leading-tight">{filteredActes.length}</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Liste des actes</p>
          <p className="text-xs text-gray-500 mt-0.5">{filteredActes.length} acte(s) trouvé(s)</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-violet-600 animate-spin" />
          </div>
        ) : filteredActes.length === 0 ? (
          <div className="text-center py-16 px-5">
            <Search className="mx-auto mb-2.5 text-gray-300" size={30} strokeWidth={1.5} />
            <p className="text-sm text-gray-400">
              {searchTerm || selectedCategory !== 'all'
                ? 'Aucun acte ne correspond à ces filtres'
                : 'Aucun acte trouvé pour cette spécialité'}
            </p>
          </div>
        ) : (
          <>
            <div>
              {paginatedActes.map((acte) => (
                <div
                  key={acte.id}
                  className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                >
                  <span className="px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full text-[11.5px] font-semibold font-mono flex-none">
                    {acte.code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-gray-900 truncate">{acte.libelle}</p>
                    {acte.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{acte.description}</p>
                    )}
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11.5px] font-medium flex-none">
                    {acte.categorie}
                  </span>
                  <span className="text-[13.5px] font-semibold text-gray-900 flex-none w-28 text-right">
                    {formatMontant(acte.tarif_base)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActesPage;
