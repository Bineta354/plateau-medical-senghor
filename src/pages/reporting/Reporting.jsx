import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Stethoscope, 
  FileText, 
  Coins,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  PieChart,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { formatMontant } from '../../utils/currency';

const Reporting = () => {
  const { currentUser, userProfile } = useAuth();

  const userRole = userProfile?.role || currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
  const isAccounting = userRole === 'accounting';

  const [loading, setLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dateFin, setDateFin] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('resume');
  
  // États pour les données
  const [resumeGlobal, setResumeGlobal] = useState([]);
  const [consultationsSpecialites, setConsultationsSpecialites] = useState([]);
  const [consultationsMedecins, setConsultationsMedecins] = useState([]);
  const [actesTypes, setActesTypes] = useState([]);
  const [certificats, setCertificats] = useState([]);
  const [financesSpecialites, setFinancesSpecialites] = useState([]);
  const [financesMedecins, setFinancesMedecins] = useState([]);
  const [financesActes, setFinancesActes] = useState([]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    chargerDonnees();
  }, [dateDebut, dateFin]);

  const chargerDonnees = async () => {
    setLoading(true);
    try {
      await Promise.all([
        chargerResumeGlobal(),
        chargerConsultationsSpecialites(),
        chargerConsultationsMedecins(),
        chargerActesTypes(),
        chargerCertificats(),
        chargerFinancesSpecialites(),
        chargerFinancesMedecins(),
        chargerFinancesActes()
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const chargerResumeGlobal = async () => {
    const { data, error } = await supabase.rpc('get_resume_global', {
      date_debut: dateDebut,
      date_fin: dateFin
    });
    
    if (error) {
      console.error('Erreur lors du chargement du résumé global:', error);
      return;
    }
    
    setResumeGlobal(data || []);
  };

  const chargerConsultationsSpecialites = async () => {
    const { data, error } = await supabase
      .from('statistiques_consultations_specialites')
      .select('*')
      .gte('premiere_consultation', dateDebut)
      .lte('derniere_consultation', dateFin);

    if (error) {
      console.error('Erreur lors du chargement des consultations par spécialité:', error);
      return;
    }

    setConsultationsSpecialites(data || []);
  };

  const chargerConsultationsMedecins = async () => {
    const { data, error } = await supabase
      .from('statistiques_consultations_medecins')
      .select('*')
      .gte('premiere_consultation', dateDebut)
      .lte('derniere_consultation', dateFin)
      .limit(10);

    if (error) {
      console.error('Erreur lors du chargement des consultations par médecin:', error);
      return;
    }

    setConsultationsMedecins(data || []);
  };

  const chargerActesTypes = async () => {
    const { data, error } = await supabase
      .from('statistiques_actes_types')
      .select('*')
      .gt('nombre_actes', 0)
      .limit(10);

    if (error) {
      console.error('Erreur lors du chargement des actes par type:', error);
      return;
    }

    setActesTypes(data || []);
  };

  const chargerCertificats = async () => {
    const { data, error } = await supabase
      .from('statistiques_certificats')
      .select('*')
      .gt('nombre_certificats', 0);

    if (error) {
      console.error('Erreur lors du chargement des certificats:', error);
      return;
    }

    setCertificats(data || []);
  };

  const chargerFinancesSpecialites = async () => {
    const { data, error } = await supabase
      .from('statistiques_finances_specialites')
      .select('*')
      .gt('nombre_consultations', 0);

    if (error) {
      console.error('Erreur lors du chargement des finances par spécialité:', error);
      return;
    }

    setFinancesSpecialites(data || []);
  };

  const chargerFinancesMedecins = async () => {
    const { data, error } = await supabase
      .from('statistiques_finances_medecins')
      .select('*')
      .gt('nombre_consultations', 0)
      .limit(10);

    if (error) {
      console.error('Erreur lors du chargement des finances par médecin:', error);
      return;
    }

    setFinancesMedecins(data || []);
  };

  const chargerFinancesActes = async () => {
    const { data, error } = await supabase
      .from('statistiques_finances_actes')
      .select('*')
      .gt('nombre_actes', 0)
      .limit(10);

    if (error) {
      console.error('Erreur lors du chargement des finances par acte:', error);
      return;
    }

    setFinancesActes(data || []);
  };

  const formaterNombre = (nombre) => {
    return new Intl.NumberFormat('fr-FR').format(nombre || 0);
  };

  const formaterDuree = (minutes) => {
    if (!minutes) return '0 min';
    const heures = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return heures > 0 ? `${heures}h ${mins}min` : `${mins}min`;
  };

  const tabs = isAccounting
    ? [
        { id: 'resume', label: 'Résumé Financier', icon: Coins },
        { id: 'finances', label: 'Finances', icon: Coins }
      ]
    : [
        { id: 'resume', label: 'Résumé Global', icon: BarChart3 },
        { id: 'consultations', label: 'Consultations', icon: Stethoscope },
        { id: 'actes', label: 'Actes', icon: Activity },
        { id: 'certificats', label: 'Certificats', icon: FileText },
        { id: 'finances', label: 'Finances', icon: Coins }
      ];

  useEffect(() => {
    if (isAccounting) {
      setActiveTab('finances');
    }
  }, [isAccounting]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reporting & Statistiques</h1>
        <p className="text-gray-600">
          {isAccounting
            ? "Analyse financière : chiffre d'affaires, paiements et restants"
            : "Analyse complète des données du cabinet médical"}
        </p>
      </div>

      {/* Filtres de date */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Période :</span>
          </div>
          
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <button
            onClick={chargerDonnees}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'resume' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {isAccounting ? 'Résumé Financier' : 'Résumé Global'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {resumeGlobal.map((item, index) => (
                <div key={`resume-${index}`} className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-500">{item.metrique}</div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">
                    {item.valeur ? formaterNombre(item.valeur) : formatMontant(item.montant)}
                  </div>
                </div>
              ))}
            </div>

            {!isAccounting && (
              <>
                {/* Graphique des consultations par spécialité */}
                {consultationsSpecialites.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultations par Spécialité</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={consultationsSpecialites}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nom_specialite" />
                        <YAxis />
                        <Tooltip formatter={(value) => formaterNombre(value)} />
                        <Legend />
                        <Bar dataKey="nombre_consultations" fill="#0088FE" name="Consultations" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}

            {isAccounting && financesSpecialites.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chiffre d'Affaires par Spécialité</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={financesSpecialites}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nom_specialite" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatMontant(value)} />
                    <Legend />
                    <Bar dataKey="montant_total_consultations" fill="#8884D8" name="Chiffre d'Affaires" />
                    <Bar dataKey="montant_total_paye" fill="#82CA9D" name="Payé" />
                    <Bar dataKey="montant_restant_a_payer" fill="#EF4444" name="Restant" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === 'consultations' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Statistiques des Consultations</h2>
            
            {/* Consultations par spécialité */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultations par Spécialité</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Spécialité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consultations
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patients Uniques
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Durée Moyenne
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {consultationsSpecialites.map((item) => (
                      <tr key={item.specialite_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.nom_specialite}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formaterNombre(item.nombre_consultations)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formaterNombre(item.nombre_patients_uniques)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formaterDuree(item.duree_moyenne_minutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Consultations par médecin */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultations par Médecin</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={consultationsMedecins}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom_medecin" />
                  <YAxis />
                  <Tooltip formatter={(value) => formaterNombre(value)} />
                  <Legend />
                  <Bar dataKey="nombre_consultations" fill="#00C49F" name="Consultations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'actes' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Statistiques des Actes</h2>
            
            {/* Actes par type */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actes par Type</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={actesTypes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nom_type_acte" />
                      <YAxis />
                      <Tooltip formatter={(value) => formaterNombre(value)} />
                      <Legend />
                      <Bar dataKey="nombre_actes" fill="#FFBB28" name="Nombre d'actes" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={actesTypes}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ nom_type_acte, nombre_actes }) => `${nom_type_acte}: ${nombre_actes}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="nombre_actes"
                      >
                        {actesTypes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formaterNombre(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Tableau détaillé */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type d'Acte
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spécialité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre d'Actes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tarif Moyen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {actesTypes.map((item) => (
                    <tr key={item.type_acte_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.nom_type_acte}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.specialite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formaterNombre(item.nombre_actes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMontant(item.tarif_moyen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMontant(item.montant_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'certificats' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Statistiques des Certificats Médicaux</h2>
            
            {certificats.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={certificats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nom_type_certificat" />
                      <YAxis />
                      <Tooltip formatter={(value) => formaterNombre(value)} />
                      <Legend />
                      <Bar dataKey="nombre_certificats" fill="#FF8042" name="Certificats" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={certificats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ nom_type_certificat, nombre_certificats }) => `${nom_type_certificat}: ${nombre_certificats}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="nombre_certificats"
                      >
                        {certificats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formaterNombre(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun certificat médical trouvé pour cette période</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'finances' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Statistiques Financières</h2>
            
            {/* Finances par spécialité */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Chiffre d'Affaires par Spécialité</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={financesSpecialites}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom_specialite" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatMontant(value)} />
                  <Legend />
                  <Bar dataKey="montant_total_consultations" fill="#8884D8" name="Chiffre d'Affaires" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Finances par médecin */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Chiffre d'Affaires par Médecin</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={financesMedecins}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom_medecin" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatMontant(value)} />
                  <Legend />
                  <Bar dataKey="montant_total_consultations" fill="#82CA9D" name="Chiffre d'Affaires" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Finances par type d'acte */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenus par Type d'Acte</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={financesActes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nom_type_acte" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatMontant(value)} />
                  <Legend />
                  <Bar dataKey="montant_total_actes" fill="#FFC658" name="Revenus" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tableau récapitulatif financier */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spécialité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Consultations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chiffre d'Affaires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant Payé
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Restant à Payer
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {financesSpecialites.map((item) => (
                    <tr key={item.specialite_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.nom_specialite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formaterNombre(item.nombre_consultations)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMontant(item.montant_total_consultations)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMontant(item.montant_total_paye)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatMontant(item.montant_restant_a_payer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reporting;
