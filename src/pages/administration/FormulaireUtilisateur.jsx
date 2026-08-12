import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ArrowLeft,
  Users, 
  Edit, 
  Eye,
  EyeOff,
  Shield,
  Stethoscope,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  Key,
  Copy,
  RotateCcw,
  Save,
  Lock,
  Unlock,
  User,
  Award,
  Calculator
} from 'lucide-react';
import { ROLES, getRoleDisplayName } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast.jsx';

const FormulaireUtilisateur = ({ preselectedRole = null }) => {
  const { currentUser, tenantId, userProfile } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  
  const [utilisateur, setUtilisateur] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    nom: '',
    prenom: '',
    username: '', // Ajout du champ username
    role: ROLES.SECRETARY,
    specialite: '',
    specialite_id: null,
    specialite_ids: [], // Pour les spécialités multiples
    telephone: '',
    actif: true,
    password: '', // Mot de passe pour les nouveaux utilisateurs
    authMethod: 'manual' // 'manual' ou 'supabase'
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [specialites, setSpecialites] = useState([]);
  const [parentSpecialites, setParentSpecialites] = useState([]);
  const [subSpecialites, setSubSpecialites] = useState([]); 
  const [filteredSubSpecialites, setFilteredSubSpecialites] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [medecinSpecialites, setMedecinSpecialites] = useState([]); // Spécialités associées au médecin
  const isNewUser = !id || id === 'nouveau';
  
  // Fonction pour générer un username à partir du nom et prénom
  const generateUsername = (prenom, nom) => {
    if (!prenom || !nom) return '';
    
    // Nettoyer les caractères spéciaux et mettre en minuscule
    const cleanPrenom = prenom.toLowerCase()
      .replace(/[àáâäãåą]/g, 'a')
      .replace(/[çčć]/g, 'c')
      .replace(/[èéêëě]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[ñň]/g, 'n')
      .replace(/[òóôöõø]/g, 'o')
      .replace(/[ùúûüů]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ž]/g, 'z')
      .replace(/[^a-z0-9]/g, '');
    
    const cleanNom = nom.toLowerCase()
      .replace(/[àáâäãåą]/g, 'a')
      .replace(/[çčć]/g, 'c')
      .replace(/[èéêëě]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[ñň]/g, 'n')
      .replace(/[òóôöõø]/g, 'o')
      .replace(/[ùúûüů]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ž]/g, 'z')
      .replace(/[^a-z0-9]/g, '');
    
    // Générer username format: prenom.nom
    return `${cleanPrenom}.${cleanNom}`;
  };

  // Effet pour générer automatiquement le username quand nom/prénom changent
  useEffect(() => {
    if (formData.prenom && formData.nom && !formData.username) {
      const generatedUsername = generateUsername(formData.prenom, formData.nom);
      setFormData(prev => ({
        ...prev,
        username: generatedUsername
      }));
    }
  }, [formData.prenom, formData.nom]);

  // Détecter le type de page depuis l'URL
  const getPageType = () => {
    const path = location.pathname || window.location.hash;
    if (path.includes('/gestion-medecins/')) return 'medecin';
    if (path.includes('/gestion-caissiers/')) return 'caissier';
    return 'utilisateur';
  };

  const pageType = getPageType();

  // Déterminer la route de retour et le titre selon le type
  const getReturnRoute = () => {
    switch (pageType) {
      case 'medecin': return '/administration/gestion-medecins';
      case 'caissier': return '/administration/gestion-caissiers';
      default: return '/administration/gestion-utilisateurs';
    }
  };

  const getPageTitle = () => {
    switch (pageType) {
      case 'medecin': return isNewUser ? 'Nouveau Médecin' : 'Détails Médecin';
      case 'caissier': return isNewUser ? 'Nouveau Caissier' : 'Détails Caissier';
      default: return isNewUser ? 'Nouvel Utilisateur' : 'Détails Utilisateur';
    }
  };

  const getListTitle = () => {
    switch (pageType) {
      case 'medecin': return 'Gestion des Médecins';
      case 'caissier': return 'Gestion des Caissiers';
      default: return 'Gestion des Utilisateurs';
    }
  };

  useEffect(() => {
    if (!isNewUser) {
      fetchUtilisateur();
    } else {
      setLoading(false);
      setEditMode(true);
      // Définir le rôle par défaut selon le type de page
      if (pageType === 'medecin') {
        setFormData(prev => ({ ...prev, role: ROLES.DOCTOR }));
      } else if (pageType === 'caissier') {
        setFormData(prev => ({ ...prev, role: ROLES.CAISSIER }));
      }
    }
    fetchSpecialites();
  }, [id, isNewUser, pageType]);

  const fetchSpecialites = async () => {
    try {
      const { data, error } = await supabase
        .from('specialites')
        .select('*')
        .eq('actif', true)
        .order('nom');
      
      if (error) throw error;
      setSpecialites(data || []);
      
      const parents = data.filter(s => !s.parent_id);
      const subs = data.filter(s => s.parent_id);
      
      setParentSpecialites(parents);
      setSubSpecialites(subs);
      return { parents, subs, all: data };
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités:', error);
      return { parents: [], subs: [], all: [] };
    }
  };

  // Filtre les spécialités dentaires uniquement si ce déploiement le demande
  // (cabinet principal = true, cabinets non-dentaires comme Ngor = false)
  const getDentalSpecialites = () => {
    const filterDental = import.meta.env.VITE_FILTER_DENTAL_SPECIALITES === 'true';
    if (!filterDental) return specialites;
    const dentalSpecialiteIds = [12, 17, 16, 14, 15, 18, 19, 13]; // IDs des spécialités dentaires (cabinet principal)
    return specialites.filter(s => dentalSpecialiteIds.includes(s.id));
  };

  const fetchUtilisateur = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      setUtilisateur(data);
      
      // Si c'est un médecin, charger ses spécialités associées
      let specialiteIds = [];
      if (data.role === ROLES.DOCTOR) {
        const { data: specialitesData, error: specialitesError } = await supabase
          .from('medecin_specialites')
          .select('specialite_id, specialites:specialite_id(id, nom)')
          .eq('medecin_id', id);
        
        if (!specialitesError && specialitesData) {
          specialiteIds = specialitesData.map(item => item.specialite_id);
          setMedecinSpecialites(specialitesData.map(item => item.specialites).filter(Boolean));
        }
      }
      
      setFormData({
        email: data.email || '',
        nom: data.nom || '',
        prenom: data.prenom || '',
        role: data.role || ROLES.SECRETARY,
        specialite: data.specialite || '',
        specialite_id: data.specialite_id || null,
        specialite_ids: specialiteIds,
        telephone: data.telephone || '',
        actif: data.actif !== undefined ? data.actif : true,
        authMethod: data.auth_method || 'manual'
      });
      
      // Initialize hierarchy selection if it's a doctor
      if (data.role === ROLES.DOCTOR && data.specialite_id) {
          // fetchSpecialites is async, so we might need to rely on the state if it's already populated,
          // or re-process the data. Since fetchUtilisateur is called after mount, specialites state *might* not be ready if they run in parallel.
          // However, to be safe, let's re-derive from the fetched data if possible or wait.
          // Ideally, we should chain properly. For now, let's assume specialites might be populated OR we call it.
          // BUT, fetchSpecialites is called in useEffect parallel to this.
          // Let's rely on the fact that we can re-find the object in the full list if we had it.
          // A safer way is to fetch specialites INSIDE here if needed, or pass them.
          // Given the structure, let's just use the logic to set it:
          
           const { data: allSpecs } = await supabase.from('specialites').select('*'); // Quick re-fetch to be safe and simple
           if(allSpecs) {
               const spec = allSpecs.find(s => s.id === data.specialite_id);
               if (spec) {
                 if (spec.parent_id) {
                    setSelectedParentId(spec.parent_id);
                    setFilteredSubSpecialites(allSpecs.filter(s => s.parent_id === spec.parent_id));
                 } else {
                    setSelectedParentId(spec.id);
                    setFilteredSubSpecialites(allSpecs.filter(s => s.parent_id === spec.id));
                 }
               }
           }
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showError('Utilisateur non trouvé');
      navigate(getReturnRoute());
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (isNewUser) {
        // Validation du mot de passe pour les nouveaux utilisateurs
        if (!formData.password || formData.password.length < 6) {
          showWarning('Le mot de passe doit contenir au moins 6 caractères');
          setSaving(false);
          return;
        }

        // Utiliser l'edge function manage-users pour créer l'utilisateur
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          showError('Vous devez être connecté pour créer un utilisateur');
          setSaving(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/manage-users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'create',
            email: formData.email,
            password: formData.password,
            nom: formData.nom,
            prenom: formData.prenom,
            username: formData.username, // Ajout du username
            role: formData.role,
            tenant_id: tenantId, // Passer le tenant_id actif
            specialite: formData.specialite || null,
            telephone: formData.telephone || null,
            specialite_id: formData.specialite_id || null
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erreur lors de la création de l\'utilisateur');
        }

        showSuccess('Utilisateur créé avec succès');
        
        // Si c'est un médecin avec des spécialités, les associer
        if (formData.role === ROLES.DOCTOR && result.user && formData.specialite_ids && formData.specialite_ids.length > 0) {
          const { error: specialitesError } = await supabase.rpc('sync_medecin_specialites', {
            p_medecin_id: result.user.id,
            p_specialite_ids: formData.specialite_ids
          });
          if (specialitesError) {
            console.error('Erreur lors de l\'association des spécialités:', specialitesError);
            showWarning('Utilisateur créé mais erreur lors de l\'association des spécialités');
          }
        }
      } else {
        // Mise à jour d'un utilisateur existant
        const { password, authMethod, specialite_ids, ...updateData } = formData;
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', id);
        if (error) throw error;
        
        // Si c'est un médecin, synchroniser les spécialités
        if (formData.role === ROLES.DOCTOR) {
          const { error: specialitesError } = await supabase.rpc('sync_medecin_specialites', {
            p_medecin_id: parseInt(id),
            p_specialite_ids: formData.specialite_ids || []
          });
          if (specialitesError) {
            console.error('Erreur lors de la synchronisation des spécialités:', specialitesError);
            showWarning('Utilisateur modifié mais erreur lors de la mise à jour des spécialités');
          }
        }
        
        showSuccess('Utilisateur modifié avec succès');
      }
      
      navigate(getReturnRoute());
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      showError('Erreur lors de la sauvegarde: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setGeneratedPassword(password);
    setShowPassword(true);
  };

  // Fonction pour générer un mot de passe pour les nouveaux utilisateurs
  const generatePasswordForNewUser = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({...formData, password: password});
    setShowNewUserPassword(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showInfo('Copié dans le presse-papiers !');
    }).catch(err => {
      console.error('Erreur lors de la copie:', err);
      showError('Erreur lors de la copie');
    });
  };

  const resetPassword = async () => {
    if (!generatedPassword) {
      showWarning('Veuillez d\'abord générer un mot de passe');
      return;
    }

    if (!generatedPassword || generatedPassword.length < 6) {
      showWarning('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      // Vérifier que l'utilisateur a un auth_id (utilise Supabase Auth)
      if (!utilisateur?.auth_id) {
        showError('Cet utilisateur n\'a pas de compte Supabase Auth. Impossible de modifier le mot de passe.');
        return;
      }

      // Récupérer le token d'accès
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Vous devez être connecté pour modifier un mot de passe');
        return;
      }

      // Appeler l'edge function pour modifier le mot de passe
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update-password',
          userEmail: utilisateur.email,
          newPassword: generatedPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la modification du mot de passe');
      }

      showSuccess('Mot de passe modifié avec succès');
      setGeneratedPassword('');
      setShowPassword(false);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      showError('Erreur lors de la réinitialisation du mot de passe: ' + error.message);
    }
  };

  const toggleUserStatus = async () => {
    if (isNewUser) return;
    
    try {
      const newStatus = !formData.actif;
      const { error } = await supabase
        .from('users')
        .update({ actif: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setFormData({ ...formData, actif: newStatus });
      if (utilisateur) {
        setUtilisateur({ ...utilisateur, actif: newStatus });
      }
      showSuccess(`Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      showError('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const handleParentChange = (e) => {
    const parentId = parseInt(e.target.value);
    setSelectedParentId(parentId);
    
    if (parentId) {
        const relatedSubs = subSpecialites.filter(s => s.parent_id === parentId);
        setFilteredSubSpecialites(relatedSubs);
        
        // Find the parent object in dental specialites
        const parentObj = getDentalSpecialites().find(p => p.id === parentId);
        
        setFormData(prev => ({
            ...prev,
            specialite_id: parentId,
            specialite: parentObj ? parentObj.nom : ''
        }));
    } else {
        setFilteredSubSpecialites([]);
        setFormData(prev => ({
            ...prev,
            specialite_id: null,
            specialite: ''
        }));
    }
  };

  const handleSubChange = (e) => {
    const subId = parseInt(e.target.value);
    if (subId) {
        const subObj = filteredSubSpecialites.find(s => s.id === subId);
        setFormData(prev => ({
            ...prev,
            specialite_id: subId,
            specialite: subObj ? subObj.nom : prev.specialite
        }));
    } else {
        const parentObj = getDentalSpecialites().find(p => p.id === selectedParentId);
        setFormData(prev => ({
            ...prev,
            specialite_id: selectedParentId,
            specialite: parentObj ? parentObj.nom : ''
        }));
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case ROLES.ADMIN: return Shield;
      case ROLES.DOCTOR: return Stethoscope;
      case ROLES.SECRETARY: return UserCheck;
      case ROLES.ACCOUNTING: return Award;
      case ROLES.CASHIER: return Calculator;
      default: return Users;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const RoleIcon = getRoleIcon(formData.role);

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-6xl mx-auto">
        {/* Header avec navigation */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(getReturnRoute())}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Retour à la liste"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1">
            <nav className="text-sm text-gray-500 mb-1">
              <span 
                onClick={() => navigate(getReturnRoute())}
                className="cursor-pointer hover:text-gray-700"
              >
                {getListTitle()}
              </span>
              <span className="mx-2">›</span>
              <span className="text-gray-900">
                {getPageTitle()}
              </span>
            </nav>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-medical-primary to-medical-secondary rounded-full flex items-center justify-center text-white font-semibold text-lg">
                {isNewUser ? <RoleIcon className="w-6 h-6" /> : (
                  <>
                    {formData.prenom?.[0] || '?'}
                    {formData.nom?.[0] || '?'}
                  </>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <RoleIcon className="w-8 h-8 text-medical-primary" />
                  {isNewUser ? getPageTitle() : `${formData.prenom} ${formData.nom}`}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-600">{getRoleDisplayName(formData.role)}</span>
                  {!isNewUser && (
                    <div className="flex items-center gap-2">
                      {formData.actif ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 shadow-sm">
                          <XCircle className="w-3 h-3" />
                          Inactif
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              {!isNewUser && !editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Modifier
                </button>
              )}
              
              {!isNewUser && (
                <button
                  onClick={toggleUserStatus}
                  className={`btn flex items-center gap-2 ${
                    formData.actif ? 'btn-warning' : 'btn-success'
                  }`}
                >
                  {formData.actif ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {formData.actif ? 'Désactiver' : 'Activer'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulaire principal */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isNewUser ? 'Informations du nouvel utilisateur' : 'Informations personnelles'}
                </h2>
                {!isNewUser && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </button>
                )}
              </div>

              {!isNewUser && !editMode ? (
                // Mode consultation
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium text-gray-900">{formData.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Nom complet</p>
                        <p className="font-medium text-gray-900">{formData.prenom} {formData.nom}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Rôle</p>
                        <p className="font-medium text-gray-900">{getRoleDisplayName(formData.role)}</p>
                      </div>
                    </div>

                    {formData.specialite && (
                      <div className="flex items-center gap-3">
                        <Award className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Spécialité (texte)</p>
                          <p className="font-medium text-gray-900">{formData.specialite}</p>
                        </div>
                      </div>
                    )}
                    
                    {medecinSpecialites.length > 0 && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        <Award className="w-5 h-5 text-gray-400 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 mb-2">Spécialités associées</p>
                          <div className="flex flex-wrap gap-2">
                            {medecinSpecialites.map(spec => (
                              <span
                                key={spec.id}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                              >
                                {spec.nom}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.telephone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Téléphone</p>
                          <p className="font-medium text-gray-900">{formData.telephone}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Statut</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          formData.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {formData.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">Authentification</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          formData.authMethod === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {formData.authMethod === 'manual' ? 'Manuelle' : 'Supabase Auth'}
                        </span>
                      </div>
                    </div>

                    {utilisateur?.created_at && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Créé le</p>
                          <p className="font-medium text-gray-900">
                            {new Date(utilisateur.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Mode édition
                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    {/* Section 1: Informations Personnelles */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Informations Personnelles
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                          <input
                            type="text"
                            value={formData.prenom}
                            onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                            required
                            className="input-field"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                          <input
                            type="text"
                            value={formData.nom}
                            onChange={(e) => setFormData({...formData, nom: e.target.value})}
                            required
                            className="input-field"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            required
                            className="input-field"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                          <input
                            type="tel"
                            value={formData.telephone}
                            onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                            className="input-field"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Informations de Compte */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Informations de Compte
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur *</label>
                          <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            required
                            placeholder="prenom.nom"
                            className="input-field"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Format: prenom.nom (sera utilisé pour la connexion)
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                          <select
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({...formData, role: e.target.value})}
                            required
                            className="form-select"
                          >
                            <option value={ROLES.SECRETARY}>Secrétaire</option>
                            <option value={ROLES.DOCTOR}>Médecin</option>
                            <option value={ROLES.ADMIN}>Administrateur</option>
                            <option value={ROLES.CAISSIER}>Caissier</option>
                            <option value={ROLES.ACCOUNTING}>Comptabilité</option>
                          </select>
                        </div>
                        
                        {/* Champ mot de passe pour les nouveaux utilisateurs */}
                        {isNewUser && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Mot de passe *
                            </label>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input
                                  type={showNewUserPassword ? "text" : "password"}
                                  value={formData.password}
                                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                                  required
                                  className="input-field pr-10"
                                  placeholder="Saisir le mot de passe..."
                                  minLength={6}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                  {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={generatePasswordForNewUser}
                                className="btn btn-secondary flex items-center gap-2 whitespace-nowrap"
                                title="Générer un mot de passe"
                              >
                                <Key className="w-4 h-4" />
                                Générer
                              </button>
                              {formData.password && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(formData.password)}
                                  className="btn btn-secondary flex items-center gap-2"
                                  title="Copier le mot de passe"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Le mot de passe doit contenir au moins 6 caractères. L'utilisateur pourra le modifier après sa première connexion.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 3: Spécialités (uniquement pour médecins) */}
                    {formData.role === ROLES.DOCTOR && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Award className="w-4 h-4" />
                          Spécialités Dentaires
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité Principale</label>
                            <select
                              value={selectedParentId || ''}
                              onChange={handleParentChange}
                              className="form-select"
                            >
                              <option value="">Sélectionner une spécialité</option>
                              {getDentalSpecialites().map((spec) => (
                                <option key={spec.id} value={spec.id}>
                                  {spec.nom}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {filteredSubSpecialites.length > 0 && (
                            <div className="animate-fade-in">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Sous-spécialité</label>
                              <select
                                value={formData.specialite_id || ''}
                                onChange={handleSubChange}
                                className="form-select bg-blue-50 border-blue-200"
                              >
                                <option value={selectedParentId}>-- Générale --</option>
                                {filteredSubSpecialites.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.nom}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Spécialités Additionnelles (sélection multiple)
                            </label>
                            
                            {/* Liste des spécialités disponibles à sélectionner */}
                            <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 mb-3">
                              {getDentalSpecialites().map((specialite) => {
                                const isPrimarySpeciality = specialite.id === formData.specialite_id;
                                const isSelected = formData.specialite_ids.includes(specialite.id);
                                return (
                                  <label 
                                    key={specialite.id} 
                                    className={`flex items-center space-x-2 p-1 rounded ${
                                      isPrimarySpeciality 
                                        ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                                        : isSelected
                                          ? 'bg-blue-50 cursor-pointer hover:bg-blue-100'
                                          : 'cursor-pointer hover:bg-gray-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setFormData(prev => ({
                                            ...prev,
                                            specialite_ids: [...prev.specialite_ids, specialite.id]
                                          }));
                                        } else {
                                          setFormData(prev => ({
                                            ...prev,
                                            specialite_ids: prev.specialite_ids.filter(id => id !== specialite.id)
                                          }));
                                        }
                                      }}
                                      disabled={isPrimarySpeciality}
                                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {specialite.nom}
                                      {isPrimarySpeciality && <span className="ml-2 text-xs text-gray-500">(Spécialité principale)</span>}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            
                            {/* Affichage des spécialités sélectionnées avec croix pour supprimer */}
                            {formData.specialite_ids.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {formData.specialite_ids.map((specialiteId) => {
                                  const specialite = getDentalSpecialites().find(s => s.id === specialiteId);
                                  if (!specialite) return null;
                                  const isPrimarySpeciality = specialite.id === formData.specialite_id;
                                  return (
                                    <div
                                      key={specialite.id}
                                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                                        isPrimarySpeciality
                                          ? 'bg-gray-200 text-gray-700'
                                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                                      }`}
                                    >
                                      <span>{specialite.nom}</span>
                                      {!isPrimarySpeciality && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFormData(prev => ({
                                              ...prev,
                                              specialite_ids: prev.specialite_ids.filter(id => id !== specialite.id)
                                            }));
                                          }}
                                          className="text-blue-600 hover:text-blue-800 focus:outline-none"
                                          title="Supprimer"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      )}
                                      {isPrimarySpeciality && (
                                        <span className="text-xs text-gray-500">(Principale)</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-500 mt-1">
                              Sélectionnez toutes les spécialités dentaires additionnelles que ce médecin peut pratiquer. La spécialité principale ne peut pas être désélectionnée.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 4: Statut */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Statut
                      </h3>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.actif}
                          onChange={(e) => setFormData({...formData, actif: e.target.checked})}
                          className="mr-2 rounded"
                        />
                        <label className="text-sm text-gray-700">Utilisateur actif</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-6">
                    {!isNewUser && (
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        className="btn btn-secondary"
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(getReturnRoute())}
                      className="btn btn-secondary"
                    >
                      {isNewUser ? 'Annuler' : 'Retour'}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Enregistrement...' : (isNewUser ? 'Créer' : 'Enregistrer')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Gestion du mot de passe */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {isNewUser ? 'Création du Compte' : 'Gestion du Mot de Passe'}
              </h2>

              {isNewUser ? (
                // Section pour les nouveaux utilisateurs
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Création du compte</p>
                        <p className="text-sm text-blue-700">
                          Un compte Supabase Auth sera créé automatiquement avec les informations saisies.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-gray-50 border rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Instructions</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Saisissez un mot de passe temporaire (min. 6 caractères)</li>
                        <li>• Ou utilisez le générateur pour créer un mot de passe sécurisé</li>
                        <li>• L'utilisateur recevra un email de confirmation</li>
                        <li>• Il pourra modifier son mot de passe après connexion</li>
                      </ul>
                    </div>

                    {formData.password && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Mot de passe défini</span>
                        </div>
                        <p className="text-xs text-green-700">
                          N'oubliez pas de communiquer le mot de passe à l'utilisateur de manière sécurisée.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Section pour les utilisateurs existants
                <div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Sécurité</p>
                        <p className="text-sm text-yellow-700">
                          Les mots de passe ne sont pas affichés. Générez un nouveau mot de passe temporaire.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="w-full btn btn-primary flex items-center justify-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Générer un Nouveau Mot de Passe
                    </button>

                    {generatedPassword && (
                      <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700">
                            Mot de passe généré :
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={generatedPassword}
                            readOnly
                            className="flex-1 p-2 border rounded bg-white font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(generatedPassword)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="Copier"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={generatePassword}
                            className="flex-1 btn btn-secondary flex items-center justify-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Régénérer
                          </button>
                          <button
                            type="button"
                            onClick={resetPassword}
                            className="flex-1 btn btn-primary"
                          >
                            Appliquer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {utilisateur && (
                    <div className="mt-6 pt-4 border-t">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Informations</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Créé le :</span>
                          <span className="font-medium">
                            {utilisateur.created_at ? 
                              new Date(utilisateur.created_at).toLocaleDateString('fr-FR') : 
                              'Non disponible'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaireUtilisateur;
