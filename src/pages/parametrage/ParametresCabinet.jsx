import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Building2, MapPin, Phone, Mail, Globe, FileText, Save, Upload, Image as ImageIcon, X, ChevronDown, ChevronUp, Users, Clock, Percent } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '../../utils/permissions';
import { useToast } from '../../hooks/useToast';
import patientInactivityService from '../../services/patientInactivityService.js';

const ParametresCabinet = () => {
  const { currentUser, userProfile, tenantId } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const canManageSettings = hasPermission(currentUser?.role, 'canManageSettings');
  const isAdmin = currentUser?.role === 'admin';

  // Rediriger si l'utilisateur n'est pas administrateur
  useEffect(() => {
    if (!isAdmin) {
      showError('Accès refusé. Seuls les administrateurs peuvent modifier les paramètres du cabinet.');
      navigate('/dashboard');
    }
  }, [isAdmin, navigate, showError]);
  
  const [settings, setSettings] = useState({
    nom_cabinet: '',
    adresse: '',
    ville: '',
    telephone: '',
    email: '',
    numero_agrement: '',
    ninea: '',
    registre_commerce: '',
    tva: 0,
    logo_url: '',
    devise: 'FCFA',
    fuseau_horaire: 'Africa/Niamey',
    langue: 'fr',
    format_date: 'DD/MM/YYYY',
    jours_inactivite: 365,
    taux_retrocession_medecin: null,
    horaires_ouverture: {
      lundi: { ouvert: true, debut: '08:00', fin: '22:00' },
      mardi: { ouvert: true, debut: '08:00', fin: '22:00' },
      mercredi: { ouvert: true, debut: '08:00', fin: '22:00' },
      jeudi: { ouvert: true, debut: '08:00', fin: '22:00' },
      vendredi: { ouvert: true, debut: '08:00', fin: '22:00' },
      samedi: { ouvert: true, debut: '08:00', fin: '22:00' },
      dimanche: { ouvert: false, debut: '', fin: '' }
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState(null); // Fichier sélectionné mais pas encore uploadé
  const [showLegalInfo, setShowLegalInfo] = useState(false); // État pour le dropdown des informations légales

  useEffect(() => {
    // Plusieurs cabinets partagent la table parametres_cabinet : sans
    // tenant_id on ne sait pas laquelle est la nôtre. On attend que le profil
    // (chargé de façon asynchrone après le login) ait fourni tenantId.
    if (tenantId) {
      fetchSettings();
    }
  }, [tenantId]);

  // Récupérer téléphone et email depuis le profil utilisateur
  useEffect(() => {
    if (userProfile) {
      setSettings(prev => ({
        ...prev,
        telephone: userProfile.telephone || prev.telephone,
        email: userProfile.email || prev.email
      }));
    }
  }, [userProfile]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('parametres_cabinet')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      // PGRST116 = aucun résultat trouvé (normal si première utilisation)
      // PGRST205 = table n'existe pas dans le schéma
      // 406 = Not Acceptable (problème de permissions RLS)
      if (error) {
        if (error.code === 'PGRST205') {
          console.error('Table parametres_cabinet non trouvée. Veuillez appliquer la migration SQL.');
          setMessage({ 
            type: 'error', 
            text: 'La table parametres_cabinet n\'existe pas. Veuillez exécuter la migration SQL dans Supabase.' 
          });
          return;
        }
        if (error.status === 406 || error.code === '42501') {
          console.error('Erreur de permissions RLS:', error);
          setMessage({ 
            type: 'error', 
            text: 'Erreur de permissions: Veuillez exécuter le script de correction SQL (supabase/fix_parametres_cabinet.sql) pour corriger les politiques RLS.' 
          });
          return;
        }
        if (error.code !== 'PGRST116') {
          console.error('Erreur lors du chargement:', error);
          // Ne pas bloquer l'application, continuer avec les valeurs par défaut
        }
      }
      
      if (data) {
        setSettings({
          ...settings,
          ...data,
          horaires_ouverture: data.horaires_ouverture || settings.horaires_ouverture
        });
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
      if (error.code === 'PGRST205') {
        setMessage({ 
          type: 'error', 
          text: 'La table parametres_cabinet n\'existe pas. Veuillez exécuter la migration SQL dans Supabase.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setUploadingLogo(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Uploader le logo si un nouveau fichier a été sélectionné
      let logoUrl = settings.logo_url;
      if (logoFile) {
        setMessage({ type: 'info', text: 'Upload du logo en cours...' });
        logoUrl = await uploadLogo();
        if (logoUrl) {
          setSettings({ ...settings, logo_url: logoUrl });
          setLogoFile(null); // Réinitialiser après upload réussi
        }
      }

      if (!tenantId) {
        setMessage({
          type: 'error',
          text: 'Impossible d\'enregistrer : tenant introuvable pour l\'utilisateur connecté.'
        });
        return;
      }

      // 2. Préparer les données avec l'URL du logo mise à jour
      const dataToSave = {
        ...settings,
        tenant_id: tenantId,
        logo_url: logoUrl
      };

      // 3. Vérifier si un enregistrement existe pour CE cabinet (tenant_id) —
      // plusieurs cabinets partagent cette table, il ne faut jamais mettre à
      // jour/créer une ligne sans ce filtre (sous peine d'écraser les
      // réglages d'un autre cabinet).
      const { data: existing, error: checkError } = await supabase
        .from('parametres_cabinet')
        .select('id')
        .eq('tenant_id', tenantId)
        .single();

      // Gérer les différentes erreurs possibles
      if (checkError) {
        if (checkError.code === 'PGRST205') {
          setMessage({ 
            type: 'error', 
            text: 'Erreur: La table parametres_cabinet n\'existe pas dans la base de données. Veuillez exécuter la migration SQL dans Supabase (fichier: supabase/migrations/20250102000019_create_parametres_cabinet.sql)' 
          });
          return;
        } else if (checkError.code === 'PGRST116') {
          // Aucun enregistrement trouvé, c'est normal pour la première utilisation
          // On continuera avec l'insertion
        } else if (checkError.status === 406 || checkError.code === '42501') {
          setMessage({ 
            type: 'error', 
            text: 'Erreur de permissions: Vous n\'avez pas les droits nécessaires. Veuillez vérifier vos permissions ou exécuter le script de correction SQL (supabase/fix_parametres_cabinet.sql)' 
          });
          return;
        } else {
          // Pour les autres erreurs, on continue et on essaie quand même l'insertion
          console.warn('Erreur lors de la vérification:', checkError);
        }
      }

      // 4. Sauvegarder les paramètres
      if (existing) {
        // Mise à jour
        const { error } = await supabase
          .from('parametres_cabinet')
          .update(dataToSave)
          .eq('id', existing.id);
        
        if (error) {
          if (error.code === 'PGRST205') {
            setMessage({ 
              type: 'error', 
              text: 'Erreur: La table parametres_cabinet n\'existe pas dans la base de données. Veuillez exécuter la migration SQL dans Supabase.' 
            });
            return;
          }
          throw error;
        }
      } else {
        // Insertion
        const { error } = await supabase
          .from('parametres_cabinet')
          .insert([dataToSave]);
        
        if (error) {
          if (error.code === 'PGRST205') {
            setMessage({ 
              type: 'error', 
              text: 'Erreur: La table parametres_cabinet n\'existe pas dans la base de données. Veuillez exécuter la migration SQL dans Supabase (fichier: supabase/migrations/20250102000019_create_parametres_cabinet.sql)' 
            });
            return;
          }
          throw error;
        }
      }

      // Afficher un toast de succès
      showSuccess('Paramètres et logo enregistrés avec succès !');
      
      // Rediriger après 1.5 secondes
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      if (error.code === 'PGRST205') {
        setMessage({ 
          type: 'error', 
          text: 'Erreur: La table parametres_cabinet n\'existe pas dans la base de données. Veuillez exécuter la migration SQL dans Supabase.' 
        });
      } else if (error.code === '22001') {
        // Si l'erreur persiste malgré la compression, essayer de compresser davantage
        if (settings.logo_url && settings.logo_url.startsWith('data:image')) {
          setMessage({ 
            type: 'error', 
            text: 'L\'image est encore trop grande après compression. Veuillez utiliser une image plus petite ou exécuter le script de correction SQL (supabase/fix_parametres_cabinet.sql).' 
          });
        } else {
          setMessage({ 
            type: 'error', 
            text: 'Erreur: La valeur du logo est trop longue. Veuillez utiliser une image plus petite ou exécuter le script de correction SQL (supabase/fix_parametres_cabinet.sql) pour augmenter la taille du champ.' 
          });
        }
      } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        const errorMsg = 'Erreur de permissions: Vous n\'avez pas les droits nécessaires pour modifier les paramètres. Veuillez vérifier vos permissions ou exécuter le script de correction SQL.';
        setMessage({ type: 'error', text: errorMsg });
        showError(errorMsg);
      } else {
        const errorMsg = `Erreur lors de la sauvegarde des paramètres: ${error.message || 'Erreur inconnue'}`;
        setMessage({ type: 'error', text: errorMsg });
        showError(errorMsg);
      }
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  };

  const handleHoraireChange = (jour, field, value) => {
    setSettings({
      ...settings,
      horaires_ouverture: {
        ...settings.horaires_ouverture,
        [jour]: {
          ...settings.horaires_ouverture[jour],
          [field]: value
        }
      }
    });
  };

  // Fonction pour compresser et redimensionner une image en JPEG
  const compressImageToJPEG = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculer les nouvelles dimensions en conservant le ratio
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // Créer un canvas pour redimensionner
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // Fond blanc pour les images transparentes (PNG, etc.)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Dessiner l'image redimensionnée
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en JPEG avec compression
          const base64String = canvas.toDataURL('image/jpeg', quality);

          // Vérifier la taille du base64 et ajuster si nécessaire
          if (base64String.length > 500000 && quality > 0.5) {
            // Réessayer avec une qualité plus faible
            const reducedQuality = Math.max(0.5, quality - 0.1);
            const compressedBase64 = canvas.toDataURL('image/jpeg', reducedQuality);
            resolve({ base64: compressedBase64, blob: base64ToBlob(compressedBase64) });
          } else if (base64String.length > 500000) {
            // Si c'est encore trop long même avec qualité 0.5, réduire encore la taille
            const smallerWidth = Math.floor(width * 0.8);
            const smallerHeight = Math.floor(height * 0.8);
            canvas.width = smallerWidth;
            canvas.height = smallerHeight;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, smallerWidth, smallerHeight);
            ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
            const finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
            resolve({ base64: finalBase64, blob: base64ToBlob(finalBase64) });
          } else {
            resolve({ base64: base64String, blob: base64ToBlob(base64String) });
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Fonction utilitaire pour convertir base64 en Blob
  const base64ToBlob = (base64String) => {
    const parts = base64String.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  };

  // Fonction pour sélectionner le logo (sans upload immédiat)
  const handleLogoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une image' });
      return;
    }

    try {
      // Stocker le fichier pour l'upload lors de la sauvegarde
      setLogoFile(file);
      
      // Créer un aperçu immédiat (sans upload)
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      setMessage({ type: 'info', text: 'Logo sélectionné. Il sera uploadé lors de la sauvegarde.' });
    } catch (error) {
      console.error('Erreur lors de la sélection du logo:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sélection du logo' });
    }
  };

  // Fonction pour uploader le logo (appelée lors de la sauvegarde)
  const uploadLogo = async () => {
    if (!logoFile) return null; // Pas de nouveau logo à uploader

    try {
      // Compresser l'image en JPEG avant l'upload
      console.log('Compression de l\'image en JPEG...');
      const { base64, blob } = await compressImageToJPEG(logoFile, 800, 800, 0.8);
      
      // Créer un nom unique pour le fichier (toujours en .jpg car compressé en JPEG)
      const fileName = `logo-${Date.now()}.jpg`;
      const filePath = `cabinet/${fileName}`;

      // Uploader la version compressée JPEG vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('cabinet-assets')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        // Si le bucket n'existe pas, utiliser le base64 comme solution de secours
        console.log('Upload vers Storage échoué, utilisation du base64 compressé...');
        return base64;
      }

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('cabinet-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Erreur lors de l\'upload du logo:', error);
      // En cas d'erreur, utiliser le base64 comme solution de secours
      const { base64 } = await compressImageToJPEG(logoFile, 800, 800, 0.8);
      return base64;
    }
  };

  const handleRemoveLogo = () => {
    setSettings({ ...settings, logo_url: '' });
    setLogoPreview('');
    setLogoFile(null); // Réinitialiser aussi le fichier sélectionné
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Building2 className="w-8 h-8 mr-3 text-blue-600" />
          Paramètres du Cabinet
        </h1>
        <p className="text-gray-600 mt-2">Configuration générale du cabinet médical</p>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}


      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations générales */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-blue-600" />
            Informations Générales
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom du Cabinet *
              </label>
              <input
                type="text"
                value={settings.nom_cabinet}
                onChange={(e) => setSettings({...settings, nom_cabinet: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                value={settings.adresse}
                onChange={(e) => setSettings({...settings, adresse: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ville
              </label>
              <input
                type="text"
                value={settings.ville}
                onChange={(e) => setSettings({...settings, ville: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Phone className="w-5 h-5 mr-2 text-blue-600" />
            Coordonnées
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone <span className="text-xs text-gray-500">(depuis le profil)</span>
              </label>
              <input
                type="tel"
                value={settings.telephone || userProfile?.telephone || ''}
                onChange={(e) => setSettings({...settings, telephone: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                placeholder={userProfile?.telephone || 'Non renseigné'}
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-xs text-gray-500">(depuis le profil)</span>
              </label>
              <input
                type="email"
                value={settings.email || userProfile?.email || ''}
                onChange={(e) => setSettings({...settings, email: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                placeholder={userProfile?.email || 'Non renseigné'}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Logo et identité visuelle */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <ImageIcon className="w-5 h-5 mr-2 text-blue-600" />
            Logo et Identité Visuelle
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo du Cabinet
              </label>
              <div className="flex items-center space-x-4">
                {logoPreview ? (
                  <div className="relative">
                    <img 
                      src={logoPreview} 
                      alt="Logo du cabinet" 
                      className="h-32 w-auto object-contain border border-gray-300 rounded-lg p-2 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="h-32 w-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {saving ? 'Sauvegarde en cours...' : logoFile ? 'Logo sélectionné' : logoPreview ? 'Changer le logo' : 'Sélectionner un logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                      disabled={saving || uploadingLogo}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Formats acceptés: JPG, PNG, GIF (max 5MB)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informations légales - Dropdown */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLegalInfo(!showLegalInfo)}
            className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Informations Légales
              </h2>
            </div>
            {showLegalInfo ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          
          {showLegalInfo && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro d'Agrément
                  </label>
                  <input
                    type="text"
                    value={settings.numero_agrement}
                    onChange={(e) => setSettings({...settings, numero_agrement: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NINEA
                  </label>
                  <input
                    type="text"
                    value={settings.ninea}
                    onChange={(e) => setSettings({...settings, ninea: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="9 chiffres"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registre de Commerce
                  </label>
                  <input
                    type="text"
                    value={settings.registre_commerce}
                    onChange={(e) => setSettings({...settings, registre_commerce: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TVA (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.tva}
                    onChange={(e) => setSettings({...settings, tva: parseFloat(e.target.value) || 0})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 18"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gestion des patients */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Gestion des Patients
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Jours d'inactivité avant passage automatique en "Inactif"
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  min="30"
                  max="1825"
                  value={settings.jours_inactivite || 365}
                  onChange={(e) => setSettings({...settings, jours_inactivite: parseInt(e.target.value) || 365})}
                  className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-600">jours</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Les patients sans consultation ni rendez-vous depuis ce nombre de jours seront automatiquement marqués comme "Inactif". 
                Un nouveau rendez-vous ou consultation réactivera automatiquement le patient.
              </p>
            </div>
          </div>
        </div>

        {/* Rémunération des médecins */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Percent className="w-5 h-5 mr-2 text-blue-600" />
            Rémunération des Médecins
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Taux de rétrocession médecin (%)
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.taux_retrocession_medecin ?? ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    taux_retrocession_medecin: e.target.value === '' ? null : parseFloat(e.target.value),
                  })}
                  className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 60"
                />
                <span className="text-sm text-gray-600">
                  {settings.taux_retrocession_medecin != null
                    ? `Le médecin garde ${settings.taux_retrocession_medecin}% du chiffre d'affaires encaissé, le cabinet garde ${(100 - settings.taux_retrocession_medecin).toFixed(2)}%.`
                    : 'Non configuré : le Récapitulatif n\'affichera pas de répartition tant que ce taux n\'est pas renseigné.'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Pourcentage du chiffre d'affaires encaissé par chaque médecin qui lui revient — le reste va au
                cabinet. S'applique à tous les médecins du cabinet et est utilisé dans le Récapitulatif pour
                calculer la part cabinet / part médecin.
              </p>
            </div>
          </div>
        </div>

        {/* Horaires d'ouverture */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Horaires d'Ouverture
          </h2>
          
          <div className="space-y-3">
            {Object.entries(settings.horaires_ouverture).map(([jour, horaire]) => (
              <div key={jour} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-24">
                  <span className="font-medium text-gray-900 capitalize">{jour}</span>
                </div>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={horaire.ouvert}
                    onChange={(e) => handleHoraireChange(jour, 'ouvert', e.target.checked)}
                    className="mr-2 rounded"
                      />
                  <span className="text-sm text-gray-700">Ouvert</span>
                </label>

                {horaire.ouvert && (
                  <>
                    <input
                      type="time"
                      value={horaire.debut}
                      onChange={(e) => handleHoraireChange(jour, 'debut', e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                    <span className="text-gray-600">à</span>
                    <input
                      type="time"
                      value={horaire.fin}
                      onChange={(e) => handleHoraireChange(jour, 'fin', e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bouton de sauvegarde */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Enregistrement en cours...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer les paramètres
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ParametresCabinet;