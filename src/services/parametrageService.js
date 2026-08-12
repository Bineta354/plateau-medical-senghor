import { supabase } from '../lib/supabase';

/**
 * Récupère les paramètres du cabinet et de la plateforme.
 * Fusionne les deux jeux de paramètres en un seul objet.
 * @param {string} tenantId - Le tenant_id du cabinet connecté
 * @returns {Promise<Object>} L'objet des paramètres fusionnés.
 */
export const fetchParametres = async (tenantId = null) => {
  try {
    // Les paramètres du cabinet (horaires, coordonnées, logo...) sont propres à
    // chaque tenant (plusieurs cabinets partagent cette même base). Sans
    // tenantId on ne peut pas savoir à quel cabinet ils appartiennent — on ne
    // doit surtout pas retomber sur "n'importe quelle ligne" (ex. la plus
    // ancienne), sous peine d'afficher/mélanger les réglages d'un autre cabinet.
    let cabinetData = null;

    if (tenantId) {
      const { data, error: cabinetError } = await supabase
        .from('parametres_cabinet')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (cabinetError) {
        console.warn('Paramètres cabinet non disponibles, utilisation des valeurs par défaut.', cabinetError);
        // Ne pas bloquer le processus, continuer avec les valeurs par défaut
      } else {
        cabinetData = data || null;
      }
    } else {
      console.warn('[fetchParametres] Aucun tenantId fourni : les paramètres du cabinet (horaires, coordonnées...) ne seront pas chargés pour éviter de mélanger ceux d\'un autre cabinet.');
    }

    // Les paramètres de plateforme (apparence, modèles de documents...) sont
    // eux aussi propres à chaque tenant — même mise en garde que pour
    // parametres_cabinet ci-dessus, ne pas les charger sans tenantId.
    let platformData = null;

    if (tenantId) {
      const { data, error: platformError } = await supabase
        .from('parametres_plateforme')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (platformError && platformError.code !== 'PGRST116') {
        console.log('Table parametres_plateforme non trouvée, utilisation des valeurs par défaut');
      } else {
        platformData = data || null;
      }
    }

    // Fusionner les données - platformData d'abord, puis cabinetData pour écraser
    const settings = {
      ...(platformData?.configuration || {}),
      ...(cabinetData || {}),
    };
    
    // Assurer que les horaires d'ouverture sont bien un objet
    if (cabinetData && cabinetData.horaires_ouverture) {
        settings.horaires_ouverture = cabinetData.horaires_ouverture;
    }


    return settings;

  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
    // Propage l'erreur pour que le hook puisse la gérer
    throw error;
  }
};

/**
 * Sauvegarde les paramètres dans les tables appropriées.
 * @param {Object} settings - L'objet complet des paramètres à sauvegarder.
 * @param {string} tenantId - Le tenant_id du cabinet connecté. Requis pour
 *   `parametres_cabinet` ET `parametres_plateforme` : plusieurs cabinets
 *   partagent ces tables, il ne faut jamais mettre à jour/créer une ligne
 *   sans savoir à quel tenant elle appartient (sous peine d'écraser les
 *   réglages d'un autre cabinet).
 */
export const saveParametres = async (settings, tenantId = null) => {
  try {
    // 1. Préparer et sauvegarder les données pour `parametres_cabinet`
    if (!tenantId) {
      throw new Error('Impossible d\'enregistrer les paramètres du cabinet : tenant introuvable pour l\'utilisateur connecté.');
    }

    const cabinetData = {
      tenant_id: tenantId,
      nom_cabinet: settings.nom_cabinet,
      adresse: settings.adresse,
      ville: settings.ville,
      code_postal: settings.code_postal,
      pays: settings.pays,
      telephone: settings.telephone,
      email: settings.email,
      site_web: settings.site_web,
      numero_agrement: settings.numero_agrement,
      ninea: settings.ninea,
      registre_commerce: settings.registre_commerce,
      tva: settings.tva,
      logo_url: settings.logo_url,
      devise: settings.devise,
      fuseau_horaire: settings.fuseau_horaire,
      langue: settings.langue,
      format_date: settings.format_date,
      horaires_ouverture: settings.horaires_ouverture,
      jours_inactivite: settings.jours_inactivite,
      taux_retrocession_medecin: settings.taux_retrocession_medecin,
    };

    const { data: existingCabinet, error: findError } = await supabase
      .from('parametres_cabinet')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (findError) throw findError;

    if (existingCabinet) {
      const { error } = await supabase
        .from('parametres_cabinet')
        .update(cabinetData)
        .eq('id', existingCabinet.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('parametres_cabinet')
        .insert([cabinetData]);
      if (error) throw error;
    }

    // 2. Préparer et sauvegarder les données pour `parametres_plateforme`
    const platformConfiguration = {
        logo_url: settings.logo_url,
        favicon_url: settings.favicon_url,
        titre_page: settings.titre_page,
        couleur_principale: settings.couleur_principale,
        couleur_secondaire: settings.couleur_secondaire,
        couleur_accent: settings.couleur_accent,
        couleur_success: settings.couleur_success,
        couleur_warning: settings.couleur_warning,
        couleur_danger: settings.couleur_danger,
        couleur_info: settings.couleur_info,
        couleur_background: settings.couleur_background,
        couleur_surface: settings.couleur_surface,
        couleur_texte: settings.couleur_texte,
        couleur_texte_secondaire: settings.couleur_texte_secondaire,
        couleur_bordure: settings.couleur_bordure,
        couleur_sidebar_fond: settings.couleur_sidebar_fond,
        couleur_sidebar_texte: settings.couleur_sidebar_texte,
        titre_sidebar: settings.titre_sidebar,
        couleur_header_fond: settings.couleur_header_fond,
        couleur_header_texte: settings.couleur_header_texte,
        afficher_logo_header: settings.afficher_logo_header,
        afficher_nom_cabinet_header: settings.afficher_nom_cabinet_header,
        couleur_login_gradient_debut: settings.couleur_login_gradient_debut,
        couleur_login_gradient_milieu: settings.couleur_login_gradient_milieu,
        couleur_login_gradient_fin: settings.couleur_login_gradient_fin,
        police_famille: settings.police_famille,
        taille_police_base: settings.taille_police_base,
        theme: settings.theme,
        document_logo_url: settings.document_logo_url,
        document_cachet_url: settings.document_cachet_url,
        document_lieu_par_defaut: settings.document_lieu_par_defaut,
        document_afficher_logo: settings.document_afficher_logo,
        document_afficher_cachet: settings.document_afficher_cachet,
        document_afficher_adresse_complete: settings.document_afficher_adresse_complete,
        document_couleur_principale: settings.document_couleur_principale,
        document_couleur_secondaire: settings.document_couleur_secondaire,
        document_couleur_bordure: settings.document_couleur_bordure,
        certificat_titre: settings.certificat_titre,
        certificat_texte_introduction: settings.certificat_texte_introduction,
        certificat_texte_mention: settings.certificat_texte_mention,
        certificat_footer_texte: settings.certificat_footer_texte,
        certificat_afficher_numero_dossier: settings.certificat_afficher_numero_dossier,
        certificat_afficher_date_emission: settings.certificat_afficher_date_emission,
        ordonnance_titre: settings.ordonnance_titre,
        ordonnance_footer_texte: settings.ordonnance_footer_texte,
        ordonnance_afficher_numero: settings.ordonnance_afficher_numero,
        ordonnance_afficher_date_prescription: settings.ordonnance_afficher_date_prescription,
        ordonnance_afficher_prochain_rdv: settings.ordonnance_afficher_prochain_rdv,
        document_police: settings.document_police,
        document_taille_police: settings.document_taille_police,
        document_marge_haut: settings.document_marge_haut,
        document_marge_bas: settings.document_marge_bas,
        document_marge_gauche: settings.document_marge_gauche,
        document_marge_droite: settings.document_marge_droite,
        document_largeur_max: settings.document_largeur_max,
        document_afficher_fond: settings.document_afficher_fond,
        document_couleur_fond: settings.document_couleur_fond,
        document_texte_footer_general: settings.document_texte_footer_general,
        document_afficher_telephone: settings.document_afficher_telephone,
        document_afficher_email: settings.document_afficher_email,
        document_afficher_site_web: settings.document_afficher_site_web,
        document_afficher_numero_agrement: settings.document_afficher_numero_agrement,
    };
    
    const platformData = {
        tenant_id: tenantId,
        configuration: platformConfiguration,
        updated_at: new Date().toISOString()
    };

    console.log('[SAVE_PARAMETRES] Sauvegarde des paramètres Sidebar :', {
        fond: settings.couleur_sidebar_fond,
        texte: settings.couleur_sidebar_texte,
        titre: settings.titre_sidebar
    });

    const { data: existingPlatform } = await supabase
      .from('parametres_plateforme')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existingPlatform) {
      await supabase
        .from('parametres_plateforme')
        .update(platformData)
        .eq('id', existingPlatform.id);
    } else {
      await supabase
        .from('parametres_plateforme')
        .insert([platformData]);
    }

  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error);
    // Propage l'erreur pour que le hook puisse la gérer
    throw error;
  }
};
