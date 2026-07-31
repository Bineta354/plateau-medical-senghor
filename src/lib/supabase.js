import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY // Clé de service pour l'API admin

if (typeof window !== 'undefined' && import.meta.env && import.meta.env.MODE === 'production') {
  console.log = () => {};
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: import.meta.env.MODE !== 'production', // Désactiver la persistance de session en production
    autoRefreshToken: import.meta.env.MODE !== 'production', // Désactiver le rafraîchissement automatique en production
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: `sb-auth-${import.meta.env.MODE}`,
    detectSessionInUrl: true,
    lock: (name, acquireTimeout, fn) => fn(), // désactive les locks
  },
  global: {
    fetch: (url, options = {}) => {
      const { signal, ...rest } = options;
      return fetch(url, rest).catch(err => {
        if (err?.name === 'AbortError') return new Response('{}', { status: 200 });
        throw err;
      });
    }
  }
})

//export const supabaseQuery = supabase;
/*export const supabaseQuery = createClient(supabaseUrl, supabaseAnonKey, {  
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (url, options = {}) => {
      const { signal, ...rest } = options;
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (token && rest.headers) {
        rest.headers['Authorization'] = `Bearer ${token}`;
      }
      return fetch(url, rest);
    }
  }
})*/

// Alias pour compatibilité
export const supabaseQuery = supabase;
// Client admin pour les opérations sensibles (nécessite la clé de service)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Fonctions d'authentification
export const signIn = async (username, password) => {
  try {
    console.log('🔐 [signIn] Tentative de connexion:', { username });

    // 1. Trouver l'utilisateur par username via RPC (contourne RLS)
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_by_username`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ p_username: username })
});

const userData = await rpcRes.json();

if (!rpcRes.ok) {
  console.log('❌ [signIn] Erreur recherche utilisateur:', userData);
  return {
    data: null,
    error: { message: 'Nom d\'utilisateur ou mot de passe incorrect' }
  };
}


    // La fonction RPC retourne un tableau, on prend le premier résultat
    const user = userData && userData.length > 0 ? userData[0] : null;

    if (!user || !user.email) {
      console.log('❌ [signIn] Utilisateur non trouvé ou inactif');
      return { data: null, error: { message: 'Nom d\'utilisateur ou mot de passe incorrect' } };
    }

    // 2. Utiliser l'email pour l'authentification Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
      options: {
        data: {
          role: user.role // Ajouter le rôle dans les métadonnées
        }
      }
    })

    if (error) {
      console.log('❌ [signIn] Erreur auth:', error.message);
      return { data: null, error }
    }

    console.log('✅ [signIn] Connexion réussie:', {
      userId: data.user?.id,
      username: user.username,
      email: data.user?.email,
      role: user.role,
      roleFromMetadata: data.user?.user_metadata?.role
    });

    return { data, error: null }
  } catch (error) {
    console.log('💥 [signIn] Erreur inattendue:', error);
    return { data: null, error }
  }
}

export const signUp = async (email, password, userData = {}) => {
  try {
    console.log('🔐 [signUp] Début de l\'inscription:', { email, userData });

    // 1. Inscription dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });

    if (authError) {
      console.error('❌ [signUp] Erreur auth:', authError.message);
      return { data: null, error: authError };
    }

    console.log('✅ [signUp] Inscription auth réussie:', {
      userId: authData.user?.id,
      emailConfirmed: authData.user?.email_confirmed_at
    });

    // 2. Insertion dans public.users avec mécanisme de retry
    if (authData.user) {
      let userRecord = null;
      let userError = null;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`🔄 Tentative ${attempt}/${maxAttempts} pour créer le profil utilisateur`);

          // Générer un username à partir de l'email si non fourni
          const username = userData.username || email.split('@')[0].toLowerCase();

          const { data, error } = await supabase
            .from('users')
            .upsert({
              auth_id: authData.user.id,
              email: email,
              username: username,
              role: userData.role || 'secretary',
              nom: userData.nom || '',
              prenom: userData.prenom || '',
              telephone: userData.telephone || null,
              specialite: userData.specialite || null,
              duree_consultation: userData.duree_consultation || 30,
              actif: true
            })
            .select()
            .single();

          if (error) {
            userError = error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Wait before retry
            continue;
          }

          userRecord = data;
          console.log('✅ [signUp] Profil utilisateur créé:', userRecord);
          break;
        } catch (error) {
          userError = error;
          console.error(`⚠️ [signUp] Erreur tentative ${attempt}:`, error);
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (!userRecord) {
        console.error('❌ [signUp] Échec après 3 tentatives:', userError);
        // Option: Envoyer une notification à l'admin ici
      }
    }

    return { data: authData, error: null };
  } catch (error) {
    console.error('💥 [signUp] Erreur inattendue:', error);
    return { data: null, error };
  }
}

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    return { error }
  } catch (error) {
    return { error }
  }
}

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  } catch (error) {
    return { user: null, error }
  }
}

// Fonctions de réinitialisation de mot de passe (utilise maintenant username)
export const resetPassword = async (username) => {
  try {
    // 1. Trouver l'utilisateur par username via RPC
    const { data: userData, error: userError } = await supabase
      .rpc('get_user_by_username', { p_username: username });

    // La fonction RPC retourne un tableau
    const user = userData && userData.length > 0 ? userData[0] : null;

    if (userError || !user || !user.email) {
      return {
        data: null,
        error: { message: 'Nom d\'utilisateur non trouvé' }
      };
    }

    // 2. Utiliser l'email pour la réinitialisation Supabase
    const { data, error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export const updatePassword = async (newPassword, email = null) => {
  try {
    console.log('🔐 [updatePassword] Début de la mise à jour du mot de passe', { email });

    // Vérifier si une session existe
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('📋 [updatePassword] Session actuelle:', {
      hasSession: !!session,
      sessionError: sessionError?.message,
      userId: session?.user?.id
    });

    if (sessionError || !session) {
      console.log('⚠️ [updatePassword] Pas de session, tentative de récupération...');

      // Si pas de session, essayer de récupérer la session depuis l'URL (pour les liens de réinitialisation)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      console.log('👤 [updatePassword] Données utilisateur:', {
        hasUser: !!userData.user,
        userError: userError?.message,
        userId: userData.user?.id
      });

      if (userError || !userData.user) {
        console.log('❌ [updatePassword] Aucun utilisateur trouvé, échec de la mise à jour');

        // Mode de développement : si on a un email, on peut essayer de mettre à jour directement
        if (email) {
          console.log('🛠️ [updatePassword] Mode développement: tentative de mise à jour directe...');

          // Trouver l'utilisateur dans la table users
          const { data: usersFromDB, error: dbError } = await supabase
            .from('users')
            .select('auth_id, email, id')
            .eq('email', email);

          if (dbError || !usersFromDB || usersFromDB.length === 0) {
            console.log('❌ [updatePassword] Utilisateur non trouvé en base:', dbError?.message);
            return {
              data: null,
              error: { message: 'Aucun compte trouvé avec cette adresse email.' }
            };
          }

          const userFromDB = usersFromDB[0];
          console.log('👤 [updatePassword] Utilisateur trouvé:', userFromDB);

          // Vérifier si l'utilisateur a un auth_id
          if (!userFromDB.auth_id) {
            console.log('❌ [updatePassword] Utilisateur sans auth_id - impossible de mettre à jour le mot de passe');
            return {
              data: null,
              error: { message: 'Ce compte n\'est pas configuré pour la réinitialisation de mot de passe. Contactez l\'administrateur.' }
            };
          }

          console.log('✅ [updatePassword] Utilisateur trouvé en base, tentative de mise à jour via API admin...');

          // Utiliser l'API admin pour mettre à jour le mot de passe
          if (!supabaseAdmin) {
            console.log('❌ [updatePassword] Clé de service non configurée');
            return {
              data: null,
              error: { message: 'Configuration manquante. Contactez l\'administrateur.' }
            };
          }

          try {
            console.log('🔄 [updatePassword] Mise à jour du mot de passe via API admin...');

            // Utiliser l'API admin pour mettre à jour le mot de passe
            const { data: adminResult, error: adminError } = await supabaseAdmin.auth.admin.updateUserById(
              userFromDB.auth_id,
              { password: newPassword }
            );

            if (adminError) {
              console.log('❌ [updatePassword] Erreur API admin:', adminError.message);
              return {
                data: null,
                error: { message: 'Erreur lors de la mise à jour du mot de passe: ' + adminError.message }
              };
            }

            console.log('🎯 [updatePassword] Mise à jour réussie via API admin');
            return {
              data: { user: adminResult.user },
              error: null
            };

          } catch (adminErr) {
            console.log('💥 [updatePassword] Erreur lors de la mise à jour admin:', adminErr);
            return {
              data: null,
              error: { message: 'Erreur lors de la mise à jour du mot de passe. Contactez l\'administrateur.' }
            };
          }
        }

        return {
          data: null,
          error: { message: 'Session d\'authentification manquante. Veuillez redémarrer le processus de réinitialisation.' }
        }
      }
    }

    console.log('✅ [updatePassword] Session valide, mise à jour du mot de passe...');

    // Ajouter un timeout pour éviter les blocages
    const updatePromise = supabase.auth.updateUser({
      password: newPassword
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: La mise à jour du mot de passe a pris trop de temps')), 10000);
    });

    try {
      const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

      console.log('🎯 [updatePassword] Résultat de la mise à jour:', {
        success: !error,
        error: error?.message,
        userId: data?.user?.id
      });

      // Si la mise à jour normale échoue, essayer avec l'API admin si on a un email
      if (error && email && supabaseAdmin) {
        console.log('🔄 [updatePassword] Échec mise à jour normale, tentative avec API admin...');

        // Récupérer l'utilisateur depuis la base de données
        const { data: usersFromDB, error: dbError } = await supabase
          .from('users')
          .select('auth_id, email')
          .eq('email', email);

        if (!dbError && usersFromDB && usersFromDB.length > 0) {
          const userFromDB = usersFromDB[0];

          if (userFromDB.auth_id) {
            console.log('🛠️ [updatePassword] Utilisation API admin pour:', userFromDB.auth_id);

            const { data: adminResult, error: adminError } = await supabaseAdmin.auth.admin.updateUserById(
              userFromDB.auth_id,
              { password: newPassword }
            );

            if (!adminError) {
              console.log('✅ [updatePassword] Mise à jour réussie via API admin');
              return { data: { user: adminResult.user }, error: null };
            } else {
              console.log('❌ [updatePassword] Erreur API admin:', adminError.message);
            }
          }
        }
      }

      return { data, error };
    } catch (timeoutError) {
      console.log('⏰ [updatePassword] Timeout détecté:', timeoutError.message);

      // En cas de timeout, essayer aussi l'API admin si disponible
      if (email && supabaseAdmin) {
        console.log('🔄 [updatePassword] Timeout - tentative avec API admin...');

        try {
          const { data: usersFromDB, error: dbError } = await supabase
            .from('users')
            .select('auth_id, email')
            .eq('email', email);

          if (!dbError && usersFromDB && usersFromDB.length > 0) {
            const userFromDB = usersFromDB[0];

            if (userFromDB.auth_id) {
              const { data: adminResult, error: adminError } = await supabaseAdmin.auth.admin.updateUserById(
                userFromDB.auth_id,
                { password: newPassword }
              );

              if (!adminError) {
                console.log('✅ [updatePassword] Mise à jour réussie via API admin après timeout');
                return { data: { user: adminResult.user }, error: null };
              }
            }
          }
        } catch (adminErr) {
          console.log('💥 [updatePassword] Erreur API admin après timeout:', adminErr);
        }
      }

      return {
        data: null,
        error: { message: 'La mise à jour du mot de passe a pris trop de temps. Veuillez réessayer.' }
      };
    }
  } catch (error) {
    console.log('💥 [updatePassword] Erreur inattendue:', error);
    return { data: null, error }
  }
}

export const verifyOtp = async (email, token, type = 'recovery') => {
  try {
    console.log('🔑 [verifyOtp] Vérification OTP:', { email, token, type });

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type
    })

    console.log('📋 [verifyOtp] Résultat OTP:', {
      success: !error,
      error: error?.message,
      hasSession: !!data.session,
      userId: data.user?.id
    });

    return { data, error }
  } catch (error) {
    console.log('💥 [verifyOtp] Erreur inattendue:', error);
    return { data: null, error }
  }
}

// Fonction pour créer un compte d'authentification pour un utilisateur existant
export const createAuthAccountForUser = async (email, temporaryPassword = 'temp123456') => {
  try {
    console.log('👤 [createAuthAccountForUser] Création d\'un compte auth pour:', email);

    // Créer un compte Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: temporaryPassword,
      options: {
        emailRedirectTo: undefined // Pas de redirection email
      }
    });

    if (authError) {
      console.log('❌ [createAuthAccountForUser] Erreur création auth:', authError.message);
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      console.log('❌ [createAuthAccountForUser] Aucun utilisateur créé');
      return { success: false, error: 'Échec de la création du compte d\'authentification' };
    }

    console.log('✅ [createAuthAccountForUser] Compte auth créé:', authData.user.id);

    // Mettre à jour la table users avec l'auth_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ auth_id: authData.user.id })
      .eq('email', email);

    if (updateError) {
      console.log('❌ [createAuthAccountForUser] Erreur mise à jour users:', updateError.message);
      return { success: false, error: 'Erreur lors de la liaison du compte' };
    }

    console.log('✅ [createAuthAccountForUser] Liaison réussie');
    return { 
      success: true, 
      authId: authData.user.id,
      message: 'Compte d\'authentification créé avec succès'
    };

  } catch (error) {
    console.log('💥 [createAuthAccountForUser] Erreur inattendue:', error);
    return { success: false, error: error.message };
  }
}

// Fonctions utilitaires avec authentification
export const fetchWithAuth = async (table, options = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Utilisateur non authentifié');
    }

    let query = supabase.from(table).select(options.select || '*');

    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (options.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
}

export const insertWithAuth = async (table, data) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    throw error;
  }
}

export const updateWithAuth = async (table, id, data) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Utilisateur non authentifié');
    }

    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    throw error;
  }
}

export const deleteWithAuth = async (table, id) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Utilisateur non authentifié');
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    throw error;
  }
}

// Fonctions utilitaires pour analyser la base de données
export const analyzeDatabase = async () => {
  try {
    // Récupérer la liste des tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tablesError) {
      console.error('Erreur lors de la récupération des tables:', tablesError)
      return null
    }

    console.log('Tables trouvées:', tables)

    // Analyser chaque table
    const tableAnalysis = {}

    for (const table of tables) {
      const tableName = table.table_name

      // Récupérer la structure de la table
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)

      if (!columnsError) {
        tableAnalysis[tableName] = {
          columns: columns,
          rowCount: 0
        }

        // Compter les lignes (si possible)
        try {
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })

          if (!countError) {
            tableAnalysis[tableName].rowCount = count
          }
        } catch (e) {
          console.log(`Impossible de compter les lignes pour ${tableName}:`, e.message)
        }
      }
    }

    return tableAnalysis
  } catch (error) {
    console.error('Erreur lors de l\'analyse de la base de données:', error)
    return null
  }
}

// Fonction pour récupérer les données d'une table spécifique
export const getTableData = async (tableName, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit)

    if (error) {
      console.error(`Erreur lors de la récupération des données de ${tableName}:`, error)
      return null
    }

    return data
  } catch (error) {
    console.error(`Erreur lors de la récupération des données de ${tableName}:`, error)
    return null
  }
}