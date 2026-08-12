import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePersonnalisation } from '../../contexts/PersonnalisationContext';
import { useToast } from '../../hooks/useToast.jsx';
import {
  Image as ImageIcon,
  Building2,
  Phone,
  FileText,
  Users,
  Clock,
  Globe,
  Upload,
  X,
  Save,
  RefreshCw
} from 'lucide-react';

// Compresse et redimensionne une image en JPEG avant upload (évite les logos
// bruts de plusieurs Mo qui dépassent la taille de colonne en base ou traînent
// le chargement de l'app sur toutes les pages qui affichent le logo).
const compressImageToJPEG = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fond blanc pour les images transparentes (PNG, etc.)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let base64String = canvas.toDataURL('image/jpeg', quality);

        if (base64String.length > 500000 && quality > 0.5) {
          base64String = canvas.toDataURL('image/jpeg', Math.max(0.5, quality - 0.1));
        } else if (base64String.length > 500000) {
          const smallerWidth = Math.floor(width * 0.8);
          const smallerHeight = Math.floor(height * 0.8);
          canvas.width = smallerWidth;
          canvas.height = smallerHeight;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, smallerWidth, smallerHeight);
          ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
          base64String = canvas.toDataURL('image/jpeg', 0.6);
        }

        resolve(base64String);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const base64ToBlob = (base64String) => {
  const parts = base64String.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

const dayOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const CardHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <Icon className="w-4 h-4 text-violet-700" strokeWidth={1.5} />
    <p className="text-sm font-semibold text-gray-900">{title}</p>
  </div>
);

const fieldClass =
  'w-full border border-gray-200 rounded-[10px] px-3 py-[9px] text-[13px] text-gray-900 bg-white box-border focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-colors';

const Field = (props) => <input className={fieldClass} {...props} />;

const PersonnalisationGeneral = () => {
  const { settings, saving, hasChanges, handleInputChange, handleHoraireChange, handleSave } = usePersonnalisation();
  const { showError } = useToast();

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Veuillez sélectionner une image');
      return;
    }

    setUploadingLogo(true);
    try {
      const base64 = await compressImageToJPEG(file, 800, 800, 0.8);
      const blob = base64ToBlob(base64);
      const filePath = `cabinet/logo-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('cabinet-assets')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        // Si le bucket n'existe pas ou l'upload échoue, on retombe sur le base64
        // compressé directement en base de données plutôt que de bloquer l'admin.
        handleInputChange('logo_url', base64);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('cabinet-assets')
          .getPublicUrl(filePath);
        handleInputChange('logo_url', publicUrl);
      }
    } catch (error) {
      console.error('Erreur lors du traitement du logo:', error);
      showError('Erreur lors du traitement du logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const tauxRetrocession = settings.taux_retrocession_medecin;

  return (
    <div className="min-h-screen bg-slate-50/80" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div className="max-w-[1180px] mx-auto px-6 md:px-10 pt-8 pb-16">

        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight m-0">Paramètres généraux</h1>
            <p className="text-[13px] text-gray-500 mt-1 mb-0">Informations administratives de votre établissement</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Logo et identité visuelle */}
          <div
            className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]"
            style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(139,92,246,.06), transparent 60%)' }}
          >
            <CardHeader icon={ImageIcon} title="Logo et identité visuelle" />
            <div className="flex flex-col gap-4">
              <div className="w-full h-[150px] rounded-[14px] bg-white border-[1.5px] border-dashed border-violet-200 flex flex-col items-center justify-center overflow-hidden">
                {settings.logo_url ? (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${settings.logo_url})`,
                      backgroundSize: 'contain',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                ) : (
                  <>
                    <ImageIcon className="w-[30px] h-[30px] text-violet-300" strokeWidth={1.5} />
                    <p className="mt-2.5 text-xs text-violet-400 font-medium">Aucun logo défini</p>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2.5">
                <p className="m-0 text-[11.5px] text-gray-400">JPG, PNG, GIF — compressé et redimensionné automatiquement.</p>
                <div className="flex gap-2 flex-none">
                  <label className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-500 text-white rounded-[10px] text-xs font-semibold cursor-pointer whitespace-nowrap shadow-[0_4px_14px_rgba(139,92,246,.3)] hover:bg-violet-600 transition-colors">
                    <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {uploadingLogo ? 'Traitement...' : settings.logo_url ? 'Changer le logo' : 'Sélectionner un logo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoFileSelect}
                      disabled={uploadingLogo}
                    />
                  </label>
                  {settings.logo_url && (
                    <button
                      type="button"
                      onClick={() => handleInputChange('logo_url', '')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-transparent border border-red-200 rounded-[10px] text-xs font-semibold text-red-600 cursor-pointer whitespace-nowrap hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Structure */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
            <CardHeader icon={Building2} title="Structure" />
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom du cabinet *</label>
                <Field
                  type="text"
                  value={settings.nom_cabinet || ''}
                  onChange={(e) => handleInputChange('nom_cabinet', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Adresse</label>
                <Field
                  type="text"
                  value={settings.adresse || ''}
                  onChange={(e) => handleInputChange('adresse', e.target.value)}
                  placeholder="Rue, avenue…"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <Field
                  type="text"
                  value={settings.ville || ''}
                  onChange={(e) => handleInputChange('ville', e.target.value)}
                  placeholder="Ville"
                />
                <Field
                  type="text"
                  value={settings.code_postal || ''}
                  onChange={(e) => handleInputChange('code_postal', e.target.value)}
                  placeholder="Code postal"
                />
                <Field
                  type="text"
                  value={settings.pays || ''}
                  onChange={(e) => handleInputChange('pays', e.target.value)}
                  placeholder="Pays"
                />
              </div>
            </div>
          </div>

          {/* Coordonnées + Informations légales */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
            <CardHeader icon={Phone} title="Coordonnées" />
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                <Field
                  type="tel"
                  value={settings.telephone || ''}
                  onChange={(e) => handleInputChange('telephone', e.target.value)}
                  placeholder="Téléphone"
                />
                <Field
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Email"
                />
              </div>
              <Field
                type="url"
                value={settings.site_web || ''}
                onChange={(e) => handleInputChange('site_web', e.target.value)}
                placeholder="Site web (https://…)"
              />
            </div>

            <div className="flex items-center gap-2.5 mt-5 mb-4 pt-4 border-t border-gray-100">
              <FileText className="w-4 h-4 text-violet-700" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-gray-900 m-0">Informations légales</p>
              <span className="px-2 py-[3px] bg-gray-100 text-gray-400 rounded-md text-[10px] font-semibold uppercase tracking-wide">Optionnel</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field
                type="text"
                value={settings.numero_agrement || ''}
                onChange={(e) => handleInputChange('numero_agrement', e.target.value)}
                placeholder="N° d'agrément"
              />
              <Field
                type="text"
                value={settings.ninea || ''}
                onChange={(e) => handleInputChange('ninea', e.target.value)}
                placeholder="NINEA"
              />
              <Field
                type="text"
                value={settings.registre_commerce || ''}
                onChange={(e) => handleInputChange('registre_commerce', e.target.value)}
                placeholder="Registre de commerce"
              />
              <div className="relative">
                <Field
                  type="number"
                  value={settings.tva ?? ''}
                  onChange={(e) => handleInputChange('tva', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  placeholder="TVA"
                  className={`${fieldClass} pr-[34px]`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] font-bold text-gray-400">%</span>
              </div>
            </div>
          </div>

          {/* Patients & rémunération */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
            <CardHeader icon={Users} title="Patients & rémunération" />
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Jours d'inactivité avant passage automatique en « Inactif »
                </label>
                <div className="relative">
                  <Field
                    type="number"
                    value={settings.jours_inactivite ?? 365}
                    onChange={(e) => handleInputChange('jours_inactivite', e.target.value === '' ? 365 : parseInt(e.target.value, 10))}
                    className={`${fieldClass} pr-[70px]`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">JOURS</span>
                </div>
                <p className="mt-1.5 mb-0 text-[11.5px] text-gray-400 leading-relaxed">
                  Les patients sans consultation ni rendez-vous depuis ce nombre de jours seront automatiquement marqués comme « Inactif ».
                </p>
              </div>
              <div className="pt-3.5 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Taux de rétrocession médecin</label>
                <div className="relative">
                  <Field
                    type="number"
                    value={tauxRetrocession ?? ''}
                    onChange={(e) => handleInputChange('taux_retrocession_medecin', e.target.value === '' ? null : parseFloat(e.target.value))}
                    placeholder="Ex: 60"
                    className={`${fieldClass} pr-[34px]`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] font-bold text-gray-400">%</span>
                </div>
                <p className="mt-1.5 mb-0 text-[11.5px] text-gray-400 leading-relaxed">
                  {tauxRetrocession != null
                    ? `Le médecin garde ${tauxRetrocession}% du chiffre d'affaires encaissé, le cabinet garde ${(100 - tauxRetrocession).toFixed(2)}%.`
                    : "Non configuré : le Récapitulatif n'affichera pas de répartition tant que ce taux n'est pas renseigné."}
                </p>
              </div>
            </div>
          </div>

          {/* Horaires d'ouverture */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px]">
            <CardHeader icon={Clock} title="Horaires d'ouverture" />
            <div className="flex flex-col gap-1.5">
              {dayOrder.map((jour) => {
                const h = settings.horaires_ouverture?.[jour] || {};
                return (
                  <div
                    key={jour}
                    className={`flex items-center gap-2.5 py-[7px] px-2.5 rounded-[10px] ${h.ouvert ? 'bg-violet-50/60' : 'bg-gray-50'}`}
                  >
                    <span className="w-[78px] text-[12.5px] font-semibold text-gray-900 capitalize flex-none">{jour}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600 flex-none">
                      <input
                        type="checkbox"
                        checked={h.ouvert || false}
                        onChange={(e) => handleHoraireChange(jour, 'ouvert', e.target.checked)}
                      />
                      Ouvert
                    </label>
                    {h.ouvert && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <input
                          type="time"
                          value={h.debut || ''}
                          onChange={(e) => handleHoraireChange(jour, 'debut', e.target.value)}
                          className="border border-gray-200 rounded-lg px-[7px] py-[5px] text-xs w-[90px]"
                        />
                        <span className="text-xs text-gray-400">à</span>
                        <input
                          type="time"
                          value={h.fin || ''}
                          onChange={(e) => handleHoraireChange(jour, 'fin', e.target.value)}
                          className="border border-gray-200 rounded-lg px-[7px] py-[5px] text-xs w-[90px]"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Régionalisation */}
          <div className="bg-white border border-gray-200 rounded-[20px] shadow-sm p-[22px] self-start">
            <CardHeader icon={Globe} title="Régionalisation" />
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={settings.langue || 'fr'}
                onChange={(e) => handleInputChange('langue', e.target.value)}
                className={`${fieldClass} bg-white cursor-pointer`}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
              <select
                value={settings.fuseau_horaire || 'Africa/Niamey'}
                onChange={(e) => handleInputChange('fuseau_horaire', e.target.value)}
                className={`${fieldClass} bg-white cursor-pointer`}
              >
                <option value="Africa/Dakar">Dakar (UTC+0)</option>
                <option value="Africa/Niamey">Niamey (UTC+1)</option>
                <option value="Europe/Paris">Paris (UTC+1)</option>
              </select>
              <div className="relative col-span-2">
                <Field
                  type="text"
                  value={settings.devise || ''}
                  onChange={(e) => handleInputChange('devise', e.target.value)}
                  placeholder="Devise"
                  className={`${fieldClass} pr-[76px]`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">SYMBOLE</span>
              </div>
            </div>
          </div>

        </div>

        <div className="sticky bottom-4 mt-5 bg-white border border-gray-200 rounded-2xl shadow-[0_8px_24px_rgba(17,24,39,.1)] px-5 py-3.5 flex items-center justify-between">
          <span className={`text-[13px] flex items-center gap-2 ${hasChanges ? 'text-amber-600' : 'text-emerald-700'}`}>
            ● {hasChanges ? 'Modifications en attente' : 'Synchronisé'}
          </span>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
              hasChanges && !saving
                ? 'bg-violet-500 text-white shadow-[0_4px_14px_rgba(139,92,246,.35)] hover:bg-violet-600 cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonnalisationGeneral;
