import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, User, Stethoscope, Shield, Award, Calculator } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSelectedUsername, setisSelectedUsername] = useState(false);
  const [isSearchingUsernames, setIsSearchingUsernames] = useState(false);
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const usernameInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Shortcut to toggle quick login
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setShowQuickLogin(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [testUsers, setTestUsers] = useState([]);

  useEffect(() => {
  if (!showQuickLogin) return;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // 🔍 LOGS DE DEBUG TEMPORAIRES
  console.log('🔍 MODE:', import.meta.env.MODE);
  console.log('🔍 SUPABASE_URL:', SUPABASE_URL);

  const loadUsers = async () => {
    try {
      const [tenantsRes, usersRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/tenants?select=id,name,logo_url&name=not.ilike.*default*&order=name`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/rpc/search_usernames`,
          {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ search_term: '' })
          }
        )
      ]);

      const tenants = await tenantsRes.json();
      const users = await usersRes.json();

      if (Array.isArray(tenants) && Array.isArray(users)) {
        const grouped = tenants.map(tenant => ({
          ...tenant,
          users: users.filter(u => u.tenant_id === tenant.id && u.role === 'admin')
        })).filter(t => t.users.length > 0);

        setTestUsers(grouped);
      }
    } catch (err) {
      console.error('Erreur loadUsers:', err);
    }
  };

  loadUsers();
}, [showQuickLogin]);

  // Fonction pour rechercher les usernames via RPC
  const searchUsernames = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setUsernameSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingUsernames(true);
    try {
      // Utiliser la fonction RPC pour contourner les politiques RLS
      const { data, error } = await supabase
        .rpc('search_usernames', { search_term: searchTerm });

      if (!error && data) {
        setUsernameSuggestions(data);
        setShowSuggestions(data.length > 0);
      } else {
        console.error('Erreur lors de la recherche des usernames:', error);
        setUsernameSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error('Erreur lors de la recherche des usernames:', err);
      setUsernameSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearchingUsernames(false);
    }
  };

  // Effet pour déclencher la recherche automatique
  useEffect(() => {
    const timer = setTimeout(() => {
      if (username && username.length >= 2 && !isSelectedUsername) {
        searchUsernames(username);
      } else {
        setUsernameSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [username]);

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        usernameInputRef.current &&
        !usernameInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUsernameSelect = (selectedUsername) => {
    setUsername(selectedUsername);
    setShowSuggestions(false);
    setisSelectedUsername(true);
    console.log('Selected username:', selectedUsername, ' show suggestions:', showSuggestions);
  };

  const handleQuickLogin = (user) => {
    // Prefer username, fallback to email local part if needed (though we added username to all testUsers)
    const userToSet = user.username || user.email.split('@')[0];
    setUsername(userToSet);
    setPassword(user.password);
    setError('');
    setSuccess('');
    setShowSuggestions(false);
    setisSelectedUsername(true); // Treat as selected to avoid auto-search
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        // Vérifier si l'utilisateur utilise le mot de passe temporaire
        if (result.isTemporaryPassword) {
          // Stocker l'information du mot de passe temporaire
          localStorage.setItem('hasTemporaryPassword', 'true');
          setSuccess('Connexion réussie ! Vous devez changer votre mot de passe temporaire.');
          setTimeout(() => {
            navigate('/reset-password?temp=true');
          }, 1500);
          } else {
            try { localStorage.removeItem('hasTemporaryPassword'); } catch (e) {}
            setSuccess('Connexion réussie ! Redirection...');

            // Récupérer le role de l'utilisateur
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const roleRes = await fetch(
  `${SUPABASE_URL}/rest/v1/rpc/search_usernames`,
  {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ search_term: username })
  }
);
const roleData = await roleRes.json();
const userRole = Array.isArray(roleData) && roleData.length > 0
  ? roleData.find(u => u.username === username)?.role
  : null;

setTimeout(() => {
  if (userRole === 'admin') {
    navigate('/cabinet-welcome');
  } else {
    navigate('/dashboard');
  }
}, 1000);
          }
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Une erreur est survenue lors de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const formVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { delay: 0.2, duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary via-medical-secondary to-medical-accent flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-6xl p-4 sm:p-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo et titre */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🏥</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Cabinet Médical
          </h1>
          <p className="text-white/80">
            Connectez-vous à votre espace de travail
          </p>
        </motion.div>

        <div className={`grid grid-cols-1 ${showQuickLogin ? 'lg:grid-cols-2' : ''} gap-8 items-start`}>

          {/* Boutons de connexion rapide (Gauche) */}
          {showQuickLogin && (
            <motion.div
              className="space-y-6 max-h-screen overflow-y-auto"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-white hidden lg:block">
                Connexion rapide
              </h2>

              {testUsers.map((cabinet) => (
                <div key={cabinet.id} className="mb-4">
                  {/* Nom du cabinet */}
                  <div className="flex items-center space-x-2 mb-2">
                    {cabinet.logo_url && (
                      <img
                        src={cabinet.logo_url}
                        alt={cabinet.name}
                        className="w-6 h-6 object-contain rounded"
                      />
                    )}
                    <h3 className="text-white font-semibold text-sm">{cabinet.name}</h3>
                  </div>

                  {/* Utilisateurs du cabinet */}
                  <div className="grid grid-cols-1 gap-2">
                    {cabinet.users.map((user, index) => {
                      const roleLabel = user.role === 'doctor' ? 'Médecin'
                        : user.role === 'secretary' ? 'Secrétaire'
                        : user.role === 'admin' ? 'Administrateur'
                        : user.role === 'caissier' ? 'Caissier'
                        : user.role === 'accounting' ? 'Comptabilité'
                        : user.role;

                      const color = user.role === 'doctor' ? 'bg-green-500 hover:bg-green-600'
                        : user.role === 'secretary' ? 'bg-blue-500 hover:bg-blue-600'
                        : user.role === 'admin' ? 'bg-purple-500 hover:bg-purple-600'
                        : user.role === 'caissier' ? 'bg-orange-500 hover:bg-orange-600'
                        : 'bg-indigo-500 hover:bg-indigo-600';

                      const IconComponent = user.role === 'doctor' ? Stethoscope
                        : user.role === 'admin' ? Shield
                        : user.role === 'accounting' ? Award
                        : user.role === 'caissier' ? Calculator
                        : User;

                      return (
                        <motion.button
                          key={user.username}
                          onClick={() => handleQuickLogin({ ...user, password: '' })}
                          className={`w-full ${color} text-white p-3 rounded-lg shadow transition-all flex items-center space-x-3 text-left`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                        >
                          <div className="bg-white/20 p-1.5 rounded-full flex-shrink-0">
                            <IconComponent size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {user.prenom} {user.nom}
                            </div>
                            <div className="text-xs opacity-75 truncate">
                              {roleLabel} — {user.username}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Formulaire (Droite) */}
          <motion.div
            className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col justify-center max-w-md w-full mx-auto"
            variants={formVariants}
            initial="hidden"
            animate="visible"
          >
             <span className='text-center text-lg font-semibold mb-4'>Connexion</span>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom d'utilisateur
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={20} />
                  {isSearchingUsernames && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-medical-primary/30 border-t-medical-primary rounded-full animate-spin"></div>
                    </div>
                  )}
                  <input
                    ref={usernameInputRef}
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (isSelectedUsername) {
                        setisSelectedUsername(false);
                      }
                      setShowSuggestions(true);
                    }}

                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent transition-all duration-200"
                    placeholder="nom.utilisateur"
                    required
                    autoComplete="off"
                  />

                  {/* Liste de suggestions */}
                  {showSuggestions  && (
                    <motion.div
                      ref={suggestionsRef}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
                    >
                      {usernameSuggestions.map((user, index) => (
                        <motion.div
                          key={user.username}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleUsernameSelect(user.username)}
                          className="px-4 py-3 hover:bg-medical-primary/10 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <User className="text-gray-400" size={18} />
                              <div>
                                <div className="font-medium text-gray-900">{user.username}</div>
                                {(user.nom || user.prenom) && (
                                  <div className="text-sm text-gray-500">
                                    {user.prenom} {user.nom}
                                  </div>
                                )}
                              </div>
                            </div>
                            {user.role && (
                              <span className="text-xs px-2 py-1 bg-medical-primary/10 text-medical-primary rounded-full">
                                {user.role === 'doctor'
                                  ? 'Médecin'
                                  : user.role === 'secretary'
                                    ? 'Secrétaire'
                                    : user.role === 'accounting'
                                      ? 'Comptabilité'
                                      : user.role === 'admin'
                                        ? 'Admin'
                                        : 'Utilisateur'}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-transparent transition-all duration-200"
                    placeholder="Votre mot de passe"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <AlertCircle className="text-red-500" size={20} />
                  <span className="text-sm text-red-700">{error}</span>
                </motion.div>
              )}

              {/* Succès */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <CheckCircle className="text-green-500" size={20} />
                  <span className="text-sm text-green-700">{success}</span>
                </motion.div>
              )}

              {/* Bouton de connexion */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-medical-primary hover:bg-medical-primary/90 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Connexion...</span>
                  </div>
                ) : (
               'Se connecter'
                )}
              </button>
            {/* Liens */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/reset-password')}
                  className="text-medical-primary hover:text-medical-primary/80 text-sm font-medium transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Informations de sécurité - Added back from design */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-xs font-semibold text-blue-700 mb-1">🔐 Authentification sécurisée</h3>
                <p className="text-xs text-blue-600">Protection RLS et Tokens JWT activés</p>
              </div>

            </form>

          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-white/60 text-sm">
            © 2024 Cabinet Médical. Tous droits réservés.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;