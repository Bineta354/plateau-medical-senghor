import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Stethoscope, Shield, Calculator, Award, Lock } from 'lucide-react';


const CabinetWelcome = () => {
  const { currentUser, userProfile, login } = useAuth();
  const { tenantId: tenantIdFromUrl } = useParams(); // ← ajoute ça
  const navigate = useNavigate();
  const tenantId = tenantIdFromUrl || userProfile?.tenant_id;
  const [users, setUsers] = useState([]);
  const [cabinet, setCabinet] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /*useEffect(() => {
    if (userProfile?.tenant_id) {
      loadCabinetAndUsers();
    }
  }, [userProfile?.tenant_id]);*/

  useEffect(() => {
    if (tenantId) {
      loadCabinetAndUsers();
    }
  }, [tenantId]);

  /*const loadCabinetAndUsers = async () => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const sessionData = await supabase.auth.getSession().catch(() => null);
    const token = sessionData?.data?.session?.access_token || SUPABASE_ANON_KEY;

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      //'Authorization': `Bearer ${token}`
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`

    };

    const [cabinetRes, usersRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/tenants?id=eq.${userProfile.tenant_id}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/users?tenant_id=eq.${userProfile.tenant_id}&actif=eq.true&select=id,username,nom,prenom,role,photo_url&order=role`, { headers })
    ]);

    const cabinetData = await cabinetRes.json();
    const usersData = await usersRes.json();

    setCabinet(Array.isArray(cabinetData) ? cabinetData[0] : null);
    setUsers(Array.isArray(usersData) ? usersData : []);
  };*/
  /*const loadCabinetAndUsers = async () => {

    // Charger le cabinet
    const { data: cabinetData } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userProfile.tenant_id)
      .single();
    setCabinet(cabinetData);

    // Charger les utilisateurs du cabinet
    const { data: usersData } = await supabase
      .from('users')
      .select('id, username, nom, prenom, role, photo_url')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('actif', true)
      .order('role');
    setUsers(usersData || []);
  };*/

  const loadCabinetAndUsers = async () => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Mode public : pas besoin de token
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };

    // Le personnel passe par une fonction SECURITY DEFINER : la table users n'est plus lisible sans connexion
    const [cabinetRes, usersRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/tenants?id=eq.${tenantId}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_cabinet_staff`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_tenant_id: tenantId })
      })
    ]);

    const cabinetData = await cabinetRes.json();
    const usersData = await usersRes.json();

    setCabinet(Array.isArray(cabinetData) ? cabinetData[0] : null);
    setUsers(Array.isArray(usersData) ? usersData : []);
};

  const getRoleIcon = (role) => {
    switch (role) {
      case 'doctor': return <Stethoscope size={24} />;
      case 'admin': return <Shield size={24} />;
      case 'caissier': return <Calculator size={24} />;
      case 'accounting': return <Award size={24} />;
      default: return <User size={24} />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'doctor': return 'bg-green-500';
      case 'secretary': return 'bg-blue-500';
      case 'admin': return 'bg-purple-500';
      case 'caissier': return 'bg-orange-500';
      case 'accounting': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'doctor': return 'Médecin';
      case 'secretary': return 'Secrétaire';
      case 'admin': return 'Administrateur';
      case 'caissier': return 'Caissier';
      case 'accounting': return 'Comptabilité';
      default: return role;
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setPassword('');
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await login(selectedUser.username, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError('Mot de passe incorrect');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-6">
      {/* Bouton retour - uniquement en développement */}
      {import.meta.env.VITE_NODE_ENV !== 'production' && (
        <button
        onClick={() => navigate('/login')}
        className="absolute top-4 left-4 flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
        <span>←</span>
        <span className="text-sm">Changer de cabinet</span>
        </button>
      )}
      {/* Logo et nom du cabinet */}
      <div className="text-center mb-8">
        {cabinet?.logo_url && (
          <img
            src={cabinet.logo_url}
            alt="Logo cabinet"
            className="h-24 object-contain mx-auto mb-4"
          />
        )}
        <h1 className="text-3xl font-bold text-gray-800">{cabinet?.name}</h1>
        <p className="text-gray-500 mt-1">Connectez-vous en tant que...</p>
      </div>

      {/* Liste des utilisateurs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl w-full mb-8">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => handleUserClick(user)}
            className={`flex flex-col items-center p-4 bg-white rounded-xl shadow hover:shadow-md transition-all border-2 ${
              selectedUser?.id === user.id ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <div className={`w-14 h-14 rounded-full ${getRoleColor(user.role)} text-white flex items-center justify-center mb-2`}>
              {getRoleIcon(user.role)}
            </div>
            <p className="font-medium text-gray-800 text-sm text-center">
              {user.prenom} {user.nom}
            </p>
            <p className="text-xs text-gray-500">{getRoleLabel(user.role)}</p>
          </button>
        ))}
      </div>

      {/* Popup mot de passe */}
      {selectedUser && (
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`w-10 h-10 rounded-full ${getRoleColor(selectedUser.role)} text-white flex items-center justify-center`}>
              {getRoleIcon(selectedUser.role)}
            </div>
            <div>
              <p className="font-semibold">{selectedUser.prenom} {selectedUser.nom}</p>
              <p className="text-xs text-gray-500">{getRoleLabel(selectedUser.role)}</p>
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="relative mb-3">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CabinetWelcome;