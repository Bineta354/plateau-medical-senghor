import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, signIn, signOut, signUp } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileCacheAt, setProfileCacheAt] = useState(0);
  const lastLoggedProfileRef = useRef(null);
  //const navigate = useNavigate();

  const loadUserProfile = useCallback(async (user) => {
    if (!user?.email && !user?.id) {
      setUserProfile(null);
      return null;
    }

    try {
      setProfileLoading(true);

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const sessionData = await supabase.auth.getSession().catch(() => null);
const token = sessionData?.data?.session?.access_token || SUPABASE_ANON_KEY;

if (!token) {
  setUserProfile(null);
  return null;
}

let profileRes = await fetch(
  `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${user.id}&select=*`,
  { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` } }
);
let profileData = await profileRes.json();
let profile = Array.isArray(profileData) && profileData.length > 0 ? profileData[0] : null;

if (!profile && user.email) {
  const emailRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(user.email)}&select=*`,
    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` } }
  );
  const emailData = await emailRes.json();
  profile = Array.isArray(emailData) && emailData.length > 0 ? emailData[0] : null;
}

const profileError = null;

      /*let profileResult = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!profileResult.data && !profileResult.error && user.email) {
        profileResult = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
      }

      const { data: profile, error: profileError } = profileResult;*/

      if (profileError) {
        console.warn('⚠️ [AuthContext] Erreur profil:', profileError.message);
        setUserProfile(null);
        return null;
      }

      if (!profile) {
        console.warn('⚠️ [AuthContext] Profil non trouvé pour:', user.email);
        setUserProfile(null);
        return null;
      }

      const profileKey = `${profile.id}-${profile.role}`;
      if (lastLoggedProfileRef.current !== profileKey) {
        console.log('✅ [AuthContext] Profil chargé:', { role: profile.role, id: profile.id });
        lastLoggedProfileRef.current = profileKey;
      }

      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error('❌ [AuthContext] Erreur chargement profil:', error);
      setUserProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Écouter les changements d'authentification
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('❌ [AuthContext] Erreur session:', error);
          setCurrentUser(null);
          setSession(null);
          setUserProfile(null);
          return;
        }
        if (session?.user) {
          setCurrentUser(session.user);
          setSession(session);
        } else {
          setCurrentUser(null);
          setSession(null);
          setUserProfile(null);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        if (error?.name === 'AbortError') return;
        console.error('❌ [AuthContext] Erreur critique session:', error);
        setCurrentUser(null);
        setSession(null);
        setUserProfile(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        try {
          if (event === 'TOKEN_REFRESHED' && session?.user) {
            setSession(session);
            setIsLoading(false);
            return;
          }
          if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setSession(null);
            setUserProfile(null);
            setIsLoading(false);
            return;
          }
          if (session?.user) {
            setCurrentUser(session.user);
            setSession(session);
          } else {
            setCurrentUser(null);
            setSession(null);
            setUserProfile(null);
          }
        } catch (error) {
          console.error('❌ [AuthContext] Erreur onAuthStateChange:', error);
        } finally {
          if (mounted) setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Charger le profil quand l'utilisateur change
  useEffect(() => {
    if (isLoading) return;
    if (!currentUser) {
      setUserProfile(null);
      return;
    }
    if (currentUser.profile) {
      setUserProfile((prev) =>
        prev?.id === currentUser.profile.id ? prev : currentUser.profile
      );
      setProfileCacheAt((prev) => currentUser.profile ? Date.now() : prev);
      return;
    }
    if (userProfile && userProfile.auth_id === currentUser.id) {
      setCurrentUser((prev) => {
        if (!prev || prev.id !== currentUser.id) return prev;
        if (prev.profile?.id === userProfile.id) return prev;
        return { ...prev, profile: userProfile };
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      loadUserProfile(currentUser).then((profile) => {
        if (!profile) return;
        setCurrentUser((prev) => {
          if (!prev || prev.id !== currentUser.id) return prev;
          if (prev.profile?.id === profile.id) return prev;
          return { ...prev, profile };
        });
        setProfileCacheAt(Date.now());
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentUser?.id, currentUser?.profile, isLoading, loadUserProfile, userProfile]);

  // ─── LOGIN ───────────────────────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      setIsLoading(true);
      const { data, error } = await signIn(username, password);

      if (error) {
        return { success: false, error: error.message };
      }

      // Charger le profil pour récupérer le tenant_id (et le rôle, renvoyé
      // ci-dessous pour que l'appelant n'ait pas besoin d'un second appel
      // réseau juste pour savoir où rediriger — voir Login.jsx).
      const profile = await loadUserProfile(data.user);
      if (profile?.tenant_id) {
        localStorage.setItem('lastTenantId', profile.tenant_id);
      }

      const isTemporaryPassword = password === 'temp123456';
      return { success: true, user: data.user, profile, isTemporaryPassword };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ─── LOGOUT ──────────────────────────────────────────────────────────────────

  const logout = async () => {
  try {
    setIsLoading(true);
    const { error } = await signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    setIsLoading(false);
  }
};
  /*const logout = async () => {
    try {
      setIsLoading(true);
      const { error } = await signOut();
      if (error) return { success: false, error: error.message };

      // Rediriger vers le cabinet si on sait lequel c'est, sinon vers /login
      const lastTenantId = localStorage.getItem('lastTenantId');
      if (lastTenantId) {
        navigate('/cabinet-welcome');
      } else {
        navigate('/login');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };*/

  // ─── REGISTER ────────────────────────────────────────────────────────────────
  const register = async (email, password, userData = {}) => {
    try {
      setIsLoading(true);
      const { data, error } = await signUp(email, password, userData);
      if (error) return { success: false, error: error.message };
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  const hasRole = (role) => {
    //if (userProfile?.role) return userProfile.role === role;
    if (currentUser?.profile?.role) return currentUser.profile.role === role;
    // Normaliser cashier → caissier
    const normalizedTarget = role === 'cashier' ? 'caissier' : role;
    
    // Essayer d'abord le profil en cache
    if (userProfile?.role) {
      const normalizedUserRole = userProfile.role === 'cashier' ? 'caissier' : userProfile.role;
      return normalizedUserRole === normalizedTarget;
    }
    
    // Puis le profil dans currentUser
    if (currentUser?.profile?.role) {
      const normalizedUserRole = currentUser.profile.role === 'cashier' ? 'caissier' : currentUser.profile.role;
      return normalizedUserRole === normalizedTarget;
    }
    
    // Enfin les métadonnées utilisateur comme fallback
    const userRole = currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
    const normalizedUserRole = userRole === 'cashier' ? 'caissier' : userRole;
    return normalizedUserRole === normalizedTarget;
  };

  const hasAnyRole = (roles) => {

    if (currentUser?.profile?.role) return roles.includes(currentUser.profile.role);
    const normalizedRoles = roles.map(r => r === 'cashier' ? 'caissier' : r);
    
    // Essayer d'abord le profil en cache
    if (userProfile?.role) {
      const normalizedUserRole = userProfile.role === 'cashier' ? 'caissier' : userProfile.role;
      return normalizedRoles.includes(normalizedUserRole);
    }
    
    // Puis le profil dans currentUser
    if (currentUser?.profile?.role) {
      const normalizedUserRole = currentUser.profile.role === 'cashier' ? 'caissier' : currentUser.profile.role;
      return normalizedRoles.includes(normalizedUserRole);
    }
    
    // Enfin les métadonnées utilisateur comme fallback
    const userRole = currentUser?.user_metadata?.role || currentUser?.app_metadata?.role;
    const normalizedUserRole = userRole === 'cashier' ? 'caissier' : userRole;
    return normalizedRoles.includes(normalizedUserRole);
  };

  const getUserProfile = async (forceRefresh = false) => {
    if (!currentUser) return null;
    if (userProfile && !forceRefresh) {
      const now = Date.now();
      if (now - profileCacheAt < 5 * 60 * 1000) return userProfile;
      return userProfile;
    }
    if (profileLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return userProfile;
    }
    try {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', currentUser.email)
        .maybeSingle();
      if (error) {
        console.error('Erreur profil:', error);
        return userProfile;
      }
      setUserProfile(data);
      setProfileCacheAt(Date.now());
      return data;
    } catch (error) {
      console.error('Erreur générale profil:', error);
      return userProfile;
    } finally {
      setProfileLoading(false);
    }
  };

  const isAuthenticated = !!currentUser && !!session;

  const getAccessToken = () => {
    if (!session?.access_token) return null;
    if (session.expires_at && Date.now() / 1000 >= session.expires_at) return null;
    return session.access_token;
  };

  // Tenant ID depuis le profil utilisateur
  const tenantId = userProfile?.tenant_id || null;

  const value = {
    currentUser,
    session,
    userProfile,
    tenantId,
    login,
    logout,
    register,
    hasRole,
    hasAnyRole,
    getUserProfile,
    isAuthenticated,
    getAccessToken,
    isLoading,
    profileLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
